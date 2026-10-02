# Tiny Decoder model card / 微型 Decoder 模型卡

## Intended use / 用途

An executable teaching model for examining the mechanics of pretraining, supervised fine-tuning, low-rank adaptation, direct preference optimization and evaluation. It is not a general assistant, commercial model, safety-trained system or university benchmark. Code: `practice/tiny_llm.py`; bundled run: `examples/tiny-llm-run.json` and `training-run.js`.

用于观察预训练、SFT、LoRA、DPO 与评估机制，不是通用助手、商业模型、安全训练系统或高校基准。

## Architecture and data / 结构与数据

- Decoder-only causal attention; 2 layers, width 64, 4 heads, context 64; learned positional embeddings.
- 107,804 base parameters. Rank-4, alpha-8 LoRA on QKV/projection adds 3,072 trainable parameters while freezing the base.
- Self-authored synthetic Chinese color questions: 16 train, 4 validation, 4 test examples, split by question templates. These small sets are not a representative generalization benchmark.
- Character vocabulary from training-side examples/preference responses; unseen validation/test characters are counted and mapped to `<unk>`.
- Default CPU, seed 2025, batch 4, learning rate 0.002, 80 updates per training stage. Exact configuration, library version and recorded metrics are in the exported report.

2 层因果 Decoder、64 维/4 头/64 上下文、可学习位置；基座 107,804 参数，LoRA 3,072 可训练参数。自编合成颜色问答按模板拆成 16/4/4 条；训练侧字符词表与未知计数避免把验证/测试用于拟合词表。数据太小，不能代表通用泛化能力。

## Training and evaluation / 训练与评估

Pretraining starts from random initialization and predicts shifted tokens. SFT starts from pretraining and masks prompt labels. LoRA independently starts from pretraining; it is not a sequential adapter placed on the SFT model. DPO starts from SFT with a frozen copied reference, beta 0.1, summed response log probabilities and an initial preference loss near `ln(2)`.

All checkpoints are compared using the same response-only evaluation mask. Pretraining logs use full-token loss, so those logs are not directly comparable to SFT/DPO response loss. The included CPU run reports actual metrics, including DPO language-model loss regression; preference margin and cross-entropy can move in different directions. No broad reasoning, factuality, safety or real-world usefulness evaluation was performed.

预训练随机初始化与移位预测；SFT 从预训练加载，屏蔽 prompt 标签；LoRA 独立从预训练加载；DPO 从 SFT 加载并冻结参考，beta 0.1，初始偏好损失约 `ln(2)`。统一比较使用回答 mask；不能直接比较预训练全 token 日志与 SFT 回答 loss。示例如实记录 DPO 退化，没有开展通用推理、事实性、安全性或实用性基准。

## Limits and reproducibility / 限制与复现

Generation emits a fixed 32 tokens with no EOS stopping; it can repeat or produce meaningless answers. The character tokenizer, tiny corpus and short context sharply limit capability. Inputs exceeding context use recent tokens. Pretraining resume saves optimizer, Python RNG and Torch CPU RNG; exact split/full equivalence is checked on CPU. Resume is not implemented for other stages, and cross-hardware bitwise reproducibility is not promised.

CUDA is an unvalidated option, not a verified result. There is no distributed training, PPO pipeline, production quantization, retrieval service or pretrained model download in this script. No model weights are published in Git. Reports/checkpoints generated on private data can themselves contain sensitive information and should not be published automatically.

生成固定 32 token、无 EOS，可重复或无意义；小语料、字符分词、短上下文能力有限。仅预训练恢复保存优化器与 Python/Torch CPU 随机状态，并验证 CPU 分段/连续一致；不承诺跨硬件位级复现。CUDA 未验收，无多卡/PPO/生产量化实现，Git 不发布权重。私有数据训练的报告与权重可能敏感。

Run commands and dependencies are documented in both READMEs and the [training guide](AI专业学习与训练实训.md). Original synthetic corpus and model implementation are MIT licensed; the separate UCI digit classifier follows its own data attribution in [third-party notices](../THIRD_PARTY_NOTICES.md).
