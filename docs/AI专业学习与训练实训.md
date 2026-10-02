# AI专业学习与端到端训练实训

工作台按8个阶段组织自编课程：数学/Python → 经典机器学习 → 深度学习 → Transformer → 预训练 → 后训练/对齐 → 评估/部署 → 端到端项目。它是学习路线，不是北邮官方培养方案。每课有公式、具体例子、实作任务、自测答案与验收；进度由你按实际结果标记。

## 可运行的Decoder训练

代码：`practice/tiny_llm.py`。Python≥3.10，PyTorch≥2.2。已有PyTorch可直接运行；缺少时在独立环境按 [PyTorch官方安装页面](https://pytorch.org/get-started/locally/) 选择与你的系统匹配的安装命令。CPU足以运行默认教学规模；不自动下载基座、不需要服务密钥。

```powershell
python practice/tiny_llm.py all --steps 80
```

默认2层、64维、4头、上下文64，107,804个基座参数。数据是自编颜色问答，16条训练、4条验证、4条测试；按不同问题模板拆分，再编码。词表仅从训练及训练偏好回答拟合，验证/测试未知字符映射`<unk>`并计数。数据量很小，只用于观察机制，不能把低loss解释为通用能力。

默认输出目录`practice/llm-output`，可用`--output`指定另一个目录。实际运行产生`.pt`权重，不内置到代码交付包；请自己保留权重与日志。

```powershell
python practice/tiny_llm.py prepare
python practice/tiny_llm.py pretrain --steps 80
python practice/tiny_llm.py sft --steps 80
python practice/tiny_llm.py lora --steps 80
python practice/tiny_llm.py dpo --steps 80
python practice/tiny_llm.py evaluate
python practice/tiny_llm.py generate --checkpoint sft --temperature 0
```

- prepare：输出`data.json`，包含语料、分组、词表、词表hash、配置与版本。
- pretrain：从随机初始化开始，因果注意力+移位标签，训练全部token；验证loss按同目标记录。
- sft：从pretrain加载；只对回答与末尾换行计算loss，prompt可见但标签为-100。生成`sft.pt`。
- lora：独立从pretrain加载，冻结基座，在每层qkv/proj加入rank4、alpha8的适配器，3,072个可训练参数。程序检查冻结权重完全没变，checkpoint包含基座与适配器结构。
- dpo：从sft加载，复制并冻结参考模型；同一prompt下chosen/rejected响应求和log概率，beta0.1。起点策略=参考，首步损失应≈log2。输出偏好margin和独立响应loss；二者可能朝不同方向变化。
- evaluate：四种checkpoint在同一验证/测试集、同一响应mask下比较。与pretrain日志中的全tokenloss定义不同，不能混成一条曲线。
- generate：温度0显式argmax；温度>0采样。默认固定生成32token，没有EOS停止机制，可能重复。模型使用字符分词和学习位置，长输入会采用最近64token，不具备可靠长上下文能力。

课程的训练工具默认显示本机四阶段实测；你可以导入`training-report.json`替换显示，文件只在页面内存读取，刷新恢复示例。

每阶段`.json`记录实际loss、学习率、梯度范数、验证结果、训练参数数和耗时。`evaluation.json`统计有效token数与未知输入数。SFT/PPL变好并不保证DPO后一定变好；偏好目标与语言建模目标不同，实测下降或退化都应如实分析。

## 检查点与恢复

```powershell
python practice/tiny_llm.py pretrain --steps 80
python practice/tiny_llm.py pretrain --steps 20 --resume
```

预训练恢复保存的权重、AdamW状态、步数和Python/Torch CPU随机状态。固定数据随机重采样，无流式数据游标；不声称跨硬件位级一致，也不支持SFT/LoRA/DPO断点恢复。不要加载来历不明的checkpoint；代码使用`weights_only=True`读取自身生成的文件。CUDA选项未作为本次CPU验收的结果。

## 作业与验收

1. 核对输入标签移位、SFT的prompt mask、因果mask和所有tensor形状。
2. 做一次实际训练，提交4个checkpoint、4条loss轨迹与统一评估表。
3. 通过检查程序确认LoRA的基座冻结；比较全量与适配器参数数。
4. 验证DPO初始loss和参考模型冻结，观察偏好margin与测试loss可能不一致。
5. 更改一个因素（步数/学习率/数据），保留原实验，解释变化。
6. 写模型卡，说明合成语料、未知字符、规模、计算条件、重复生成和数据局限。

真实大模型还需授权语料、成熟分词器、更大上下文与位置设计、数据去重与质量系统、预算管理、多卡并行、容错与持续评测。本实训实现小型单设备训练链；DDP/FSDP/PPO/生产量化提供课程原理和规划任务，没有冒称这些系统在本机被验证。

参考：[PyTorch基础](https://docs.pytorch.org/tutorials/beginner/basics/)、[Hugging Face LLM Course](https://huggingface.co/learn/llm-course/chapter1/1)、[Transformer](https://arxiv.org/abs/1706.03762)、[LoRA](https://arxiv.org/abs/2106.09685)、[DPO](https://arxiv.org/abs/2305.18290)。课程讲解为自编，不复制上述课程全文。
