"""CPU-sized educational Decoder pipeline. Own synthetic data; no downloads.
Python >=3.10, PyTorch >=2.2. Not a useful general-purpose language model.
"""
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
import random
import time

import torch
from torch import nn
from torch.nn import functional as F


def data():
    pairs = []
    colors = [('红', '红色'), ('蓝', '蓝色'), ('绿', '绿色'), ('黄', '黄色')]
    for prefix in ['这个', '眼前的', '一个', '小小的', '桌上的', '图片里的']:
        for color, answer in colors:
            prompt = f'{prefix}{color}球是什么颜色？'
            pairs.append({'prompt': prompt, 'chosen': answer+'。', 'rejected': '不知道。'})
    # Split at document / prompt level before creating windows.
    train = pairs[:16]
    valid = pairs[16:20]
    test = pairs[20:]
    docs = [f'问：{p["prompt"]}\n答：{p["chosen"]}\n' for p in train]
    # Vocabulary is fitted to training; validation unknowns become <unk>.
    vocabulary = ['<pad>', '<unk>'] + sorted(set(''.join(docs) + '不知道。'))
    return train, valid, test, vocabulary


class LoRALinear(nn.Module):
    def __init__(self, base, rank=4, alpha=8):
        super().__init__()
        self.base = base
        self.a = nn.Parameter(torch.randn(rank, base.in_features, device=base.weight.device)*0.02)
        self.b = nn.Parameter(torch.zeros(base.out_features, rank, device=base.weight.device))
        self.scale = alpha/rank
        for parameter in base.parameters():
            parameter.requires_grad_(False)

    def forward(self, x):
        return self.base(x) + F.linear(F.linear(x, self.a), self.b)*self.scale


class Block(nn.Module):
    def __init__(self, dim, heads):
        super().__init__()
        self.heads = heads
        self.ln1, self.ln2 = nn.LayerNorm(dim), nn.LayerNorm(dim)
        self.qkv, self.proj = nn.Linear(dim, dim*3), nn.Linear(dim, dim)
        self.ffn = nn.Sequential(nn.Linear(dim, dim*4), nn.GELU(), nn.Linear(dim*4, dim))

    def forward(self, x):
        batch, length, dim = x.shape
        q, k, v = self.qkv(self.ln1(x)).chunk(3, dim=-1)
        reshape = lambda t: t.view(batch, length, self.heads, dim//self.heads).transpose(1, 2)
        attention = F.scaled_dot_product_attention(reshape(q), reshape(k), reshape(v), is_causal=True)
        x = x + self.proj(attention.transpose(1, 2).contiguous().view(batch, length, dim))
        return x + self.ffn(self.ln2(x))


class Decoder(nn.Module):
    def __init__(self, config):
        super().__init__()
        dim = config['dim']
        self.config = config
        self.token = nn.Embedding(config['vocab'], dim)
        self.position = nn.Embedding(config['context'], dim)
        self.blocks = nn.ModuleList([Block(dim, config['heads']) for _ in range(config['layers'])])
        self.norm, self.head = nn.LayerNorm(dim), nn.Linear(dim, config['vocab'])

    def forward(self, ids):
        if ids.shape[1] > self.config['context']:
            raise ValueError('Sequence exceeds context window')
        x = self.token(ids) + self.position(torch.arange(ids.shape[1], device=ids.device))
        for block in self.blocks:
            x = block(x)
        return self.head(self.norm(x))

    def add_lora(self):
        for parameter in self.parameters():
            parameter.requires_grad_(False)
        for block in self.blocks:
            block.qkv = LoRALinear(block.qkv)
            block.proj = LoRALinear(block.proj)


def encode(text, vocabulary):
    mapping = {token: i for i, token in enumerate(vocabulary)}
    return [mapping.get(character, 1) for character in text]


def example(pair, vocabulary, context, response_only=True, chosen=True):
    prompt = '问：' + pair['prompt'] + '\n答：'
    response = pair['chosen' if chosen else 'rejected'] + '\n'
    ids = encode(prompt + response, vocabulary)
    if len(ids) > context+1:
        raise ValueError('Example too long; refusing to truncate response silently')
    x, y = ids[:-1], ids[1:]
    labels = list(y)
    if response_only:
        # target at position len(prompt)-1 is the first response token.
        for i in range(len(prompt)-1):
            labels[i] = -100
    return x, labels


def batch(pairs, vocabulary, config, device, response_only):
    rows = [example(p, vocabulary, config['context'], response_only) for p in pairs]
    length = max(len(x) for x, _ in rows)
    x = torch.tensor([r[0]+[0]*(length-len(r[0])) for r in rows], device=device)
    y = torch.tensor([r[1]+[-100]*(length-len(r[1])) for r in rows], device=device)
    return x, y


def loss(model, x, y):
    return F.cross_entropy(model(x).reshape(-1, model.config['vocab']), y.reshape(-1), ignore_index=-100)


@torch.no_grad()
def evaluate(model, pairs, vocabulary, device, response_only=True):
    model.eval()
    x, y = batch(pairs, vocabulary, model.config, device, response_only)
    value = loss(model, x, y).item()
    return {'loss': value, 'perplexity': math.exp(min(value, 50)), 'tokens': int((y != -100).sum()),
            'unknownInputTokens': int((x == 1).sum()), 'examples': len(pairs)}


def response_logp(model, pair, vocabulary, device, chosen):
    ids, labels = example(pair, vocabulary, model.config['context'], True, chosen)
    x = torch.tensor([ids], device=device)
    y = torch.tensor([labels], device=device)
    logp = model(x).log_softmax(-1)
    selected = logp.gather(-1, y.clamp(min=0).unsqueeze(-1)).squeeze(-1)
    return (selected * (y != -100)).sum()


def dpo_loss(model, reference, pair, vocabulary, device, beta=.1):
    chosen = response_logp(model, pair, vocabulary, device, True)
    rejected = response_logp(model, pair, vocabulary, device, False)
    with torch.no_grad():
        ref_chosen = response_logp(reference, pair, vocabulary, device, True)
        ref_rejected = response_logp(reference, pair, vocabulary, device, False)
    margin = (chosen-rejected) - (ref_chosen-ref_rejected)
    return -F.logsigmoid(beta*margin), margin


def save_checkpoint(destination, model, vocabulary, stage, optimizer=None, step=0):
    temporary = destination.with_suffix('.tmp')
    payload = {'config': model.config, 'vocabulary': vocabulary, 'stage': stage,
               'weights': model.state_dict(), 'step': step, 'torch_rng': torch.get_rng_state(),
               'python_rng': random.getstate()}
    if optimizer is not None:
        payload['optimizer'] = optimizer.state_dict()
    torch.save(payload, temporary)
    temporary.replace(destination)


def load_checkpoint(destination, device):
    checkpoint = torch.load(destination, map_location=device, weights_only=True)
    model = Decoder(checkpoint['config']).to(device)
    if checkpoint['stage'] == 'lora':
        model.add_lora()
    model.load_state_dict(checkpoint['weights'])
    return model, checkpoint


@torch.no_grad()
def generate(model, prompt, vocabulary, device, tokens=32, temperature=.8):
    if not math.isfinite(temperature) or temperature < 0:
        raise ValueError('Temperature must be finite and nonnegative')
    model.eval()
    ids = encode(prompt, vocabulary) or [1]
    for _ in range(tokens):
        x = torch.tensor([ids[-model.config['context']:]], device=device)
        logits = model(x)[0, -1].clone()
        logits[0] = -float('inf')  # do not generate padding
        next_id = int(logits.argmax()) if temperature == 0 else int(torch.multinomial((logits/temperature).softmax(-1), 1))
        ids.append(next_id)
    return ''.join(vocabulary[i] if i > 1 else '�' for i in ids)


def train_stage(args, stage, train, valid, vocabulary, config):
    root, device = Path(args.output), args.device
    resume_path = root/(stage+'.pt')
    if args.resume:
        if stage != 'pretrain':
            raise ValueError('--resume currently supports pretrain only')
        model, previous = load_checkpoint(resume_path, device)
        torch.set_rng_state(previous['torch_rng'].cpu())
        random.setstate(previous['python_rng'])
        vocabulary = previous['vocabulary']
        start = previous['step']
    elif stage == 'pretrain':
        model, previous, start = Decoder(config).to(device), {}, 0
    else:
        source = 'sft' if stage == 'dpo' else 'pretrain'
        model, previous = load_checkpoint(root/(source+'.pt'), device)
        vocabulary = previous['vocabulary']
        start = 0
        if stage == 'lora':
            model.add_lora()
    base = {n: p.detach().clone() for n, p in model.named_parameters() if not p.requires_grad}
    reference = copy.deepcopy(model).eval() if stage == 'dpo' else None
    if reference:
        for parameter in reference.parameters():
            parameter.requires_grad_(False)
    optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=args.lr)
    if args.resume:
        optimizer.load_state_dict(previous['optimizer'])
    log = {'stage': stage, 'config': model.config, 'seed': args.seed, 'device': device,
           'trainableParameters': sum(p.numel() for p in model.parameters() if p.requires_grad),
           'totalParameters': sum(p.numel() for p in model.parameters()), 'history': [],
           'before': evaluate(model, valid, vocabulary, device, stage != 'pretrain')}
    started = time.perf_counter()
    for step in range(start, start+args.steps):
        model.train()
        optimizer.zero_grad(set_to_none=True)
        if stage == 'dpo':
            value, margin = dpo_loss(model, reference, random.choice(train), vocabulary, device)
        else:
            samples = random.sample(train, min(args.batch, len(train)))
            x, y = batch(samples, vocabulary, model.config, device, stage != 'pretrain')
            value = loss(model, x, y)
        if not torch.isfinite(value):
            raise ValueError('Nonfinite loss; no checkpoint saved')
        value.backward()
        norm = nn.utils.clip_grad_norm_(model.parameters(), 1.0, error_if_nonfinite=True)
        warmup = min(1.0, (step+1)/10)
        for group in optimizer.param_groups:
            group['lr'] = args.lr*warmup
        optimizer.step()
        if step == start or (step+1) % 10 == 0:
            entry = {'step': step+1, 'loss': value.item(), 'gradNorm': float(norm),
                     'lr': optimizer.param_groups[0]['lr']}
            if stage == 'dpo':
                entry['preUpdatePreferenceMargin'] = margin.item()
            else:
                entry['validation'] = evaluate(model, valid, vocabulary, device, stage != 'pretrain')
            log['history'].append(entry)
    for name, parameter in model.named_parameters():
        if name in base and not torch.equal(parameter.detach(), base[name]):
            raise AssertionError('Frozen base parameter changed: '+name)
    log['frozenBaseUnchanged'] = True
    log['after'] = evaluate(model, valid, vocabulary, device, stage != 'pretrain')
    if stage == 'dpo':
        with torch.no_grad():
            log['validationPreferenceMargin'] = sum(dpo_loss(model, reference, p, vocabulary, device)[1].item() for p in valid)/len(valid)
    log['seconds'] = time.perf_counter()-started
    save_checkpoint(root/(stage+'.pt'), model, vocabulary, stage, optimizer, start+args.steps)
    (root/(stage+'.json')).write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding='utf-8')
    print(stage, json.dumps({'before': log['before']['loss'], 'after': log['after']['loss'],
                             'trainable': log['trainableParameters'], 'seconds': round(log['seconds'], 2)}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage', choices=['prepare', 'pretrain', 'sft', 'lora', 'dpo', 'evaluate', 'generate', 'all'])
    parser.add_argument('--output', default=str(Path(__file__).parent/'llm-output'))
    parser.add_argument('--steps', type=int, default=80)
    parser.add_argument('--batch', type=int, default=4)
    parser.add_argument('--lr', type=float, default=.002)
    parser.add_argument('--seed', type=int, default=2025)
    parser.add_argument('--device', default='cpu', choices=['cpu', 'cuda'])
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--checkpoint', default='sft', choices=['pretrain', 'sft', 'lora', 'dpo'])
    parser.add_argument('--prompt', default='问：这个红球是什么颜色？\n答：')
    parser.add_argument('--temperature', type=float, default=.8)
    args = parser.parse_args()
    if not 1 <= args.steps <= 100000 or not 1 <= args.batch <= 1000 or not math.isfinite(args.lr) or not 0 < args.lr <= 1:
        parser.error('Invalid steps/batch/lr')
    if args.resume and args.stage != 'pretrain':
        parser.error('--resume requires pretrain')
    torch.set_num_threads(1)
    random.seed(args.seed)
    torch.manual_seed(args.seed)
    root = Path(args.output)
    root.mkdir(parents=True, exist_ok=True)
    train, valid, test, vocabulary = data()
    config = {'vocab': len(vocabulary), 'dim': 64, 'heads': 4, 'layers': 2, 'context': 64}
    if args.stage in ['prepare', 'all']:
        report = {'description': 'Self-authored synthetic color Q/A, no general knowledge benchmark',
                  'train': train, 'validation': valid, 'test': test, 'vocabulary': vocabulary,
                  'vocabularySha256': hashlib.sha256(json.dumps(vocabulary, ensure_ascii=False).encode()).hexdigest(),
                  'config': config, 'torchVersion': torch.__version__, 'seed': args.seed}
        (root/'data.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print('prepare:', len(train), 'train;', len(valid), 'validation;', len(test), 'test;', len(vocabulary), 'vocabulary')
    for stage in ['pretrain', 'sft', 'lora', 'dpo']:
        if args.stage in [stage, 'all']:
            train_stage(args, stage, train, valid, vocabulary, config)
    if args.stage in ['evaluate', 'all']:
        report = {}
        for stage in ['pretrain', 'sft', 'lora', 'dpo']:
            if (root/(stage+'.pt')).exists():
                model, checkpoint = load_checkpoint(root/(stage+'.pt'), args.device)
                report[stage] = {'validation': evaluate(model, valid, checkpoint['vocabulary'], args.device),
                                 'test': evaluate(model, test, checkpoint['vocabulary'], args.device)}
        (root/'evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print('evaluation:', json.dumps(report))
        combined = {'description': '本机真实CPU教学实测；自编颜色问答，16训练/4验证/4测试，seed2025；不是通用大模型基准。', 'stages': {stage: json.loads((root/(stage+'.json')).read_text('utf-8')) for stage in report}, 'evaluation': report}
        (root/'training-report.json').write_text(json.dumps(combined, ensure_ascii=False, indent=2), encoding='utf-8')
    if args.stage in ['generate', 'all']:
        model, checkpoint = load_checkpoint(root/(args.checkpoint+'.pt'), args.device)
        text = generate(model, args.prompt, checkpoint['vocabulary'], args.device, temperature=args.temperature)
        (root/'generation.txt').write_text(text, encoding='utf-8')
        print('generation:', text)


if __name__ == '__main__':
    main()
