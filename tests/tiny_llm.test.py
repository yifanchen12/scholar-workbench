"""Meaningful training invariants; uses only tiny synthetic inputs."""
import math
from pathlib import Path
import sys
import tempfile
import random
from types import SimpleNamespace
import torch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'practice'))
from tiny_llm import Decoder, data, example, dpo_loss, batch, loss, save_checkpoint, load_checkpoint, train_stage

torch.set_num_threads(1)
torch.manual_seed(2025)
train, valid, test, vocab = data()
config = {'vocab': len(vocab), 'dim': 16, 'heads': 4, 'layers': 1, 'context': 64}
model = Decoder(config)
# Future tokens must not alter earlier logits.
a = torch.tensor([[2, 3, 4, 5]])
b = torch.tensor([[2, 3, 8, 9]])
assert torch.allclose(model(a)[:, :2], model(b)[:, :2], atol=1e-6)
x, labels = example(train[0], vocab, 64)
prompt_length = len('问：'+train[0]['prompt']+'\n答：')
assert all(y == -100 for y in labels[:prompt_length-1])
assert labels[prompt_length-1] != -100
reference = Decoder(config)
reference.load_state_dict(model.state_dict())
for p in reference.parameters():
    p.requires_grad_(False)
value, margin = dpo_loss(model, reference, train[0], vocab, 'cpu')
assert abs(value.item()-math.log(2)) < 1e-6 and abs(margin.item()) < 1e-6
value.backward()
assert all(p.grad is None for p in reference.parameters())
model.add_lora()
frozen = {n: p.detach().clone() for n, p in model.named_parameters() if not p.requires_grad}
optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=.02)
inputs, targets = batch(train[:4], vocab, config, 'cpu', True)
before = loss(model, inputs, targets).item()
for _ in range(30):
    optimizer.zero_grad(set_to_none=True)
    loss(model, inputs, targets).backward()
    optimizer.step()
after = loss(model, inputs, targets).item()
assert after < before
assert all(torch.equal(dict(model.named_parameters())[n].detach(), v) for n, v in frozen.items())
with tempfile.TemporaryDirectory() as directory:
    file = Path(directory)/'lora.pt'
    save_checkpoint(file, model, vocab, 'lora', optimizer, 30)
    restored, cp = load_checkpoint(file, 'cpu')
    assert torch.equal(model(inputs), restored(inputs))
    assert cp['step'] == 30
print('Causal attention, response mask, DPO initial objective/reference freeze, LoRA learning/base freeze and checkpoint identity passed.')

# A split pretrain run must match an uninterrupted run on this CPU path.
with tempfile.TemporaryDirectory() as directory:
    full, split = Path(directory)/'full', Path(directory)/'split'
    full.mkdir(); split.mkdir()
    def arguments(output, steps, resume=False):
        return SimpleNamespace(output=str(output), device='cpu', steps=steps, resume=resume, batch=4, lr=.002, seed=2025)
    random.seed(2025); torch.manual_seed(2025)
    train_stage(arguments(full, 15), 'pretrain', train, valid, vocab, config)
    random.seed(2025); torch.manual_seed(2025)
    train_stage(arguments(split, 5), 'pretrain', train, valid, vocab, config)
    train_stage(arguments(split, 10, True), 'pretrain', train, valid, vocab, config)
    _, a = load_checkpoint(full/'pretrain.pt', 'cpu')
    _, b = load_checkpoint(split/'pretrain.pt', 'cpu')
    assert a['step'] == b['step'] == 15
    assert all(torch.equal(a['weights'][k], b['weights'][k]) for k in a['weights'])
print('CPU checkpoint resume exactly matches uninterrupted training.')
