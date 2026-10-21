# Scholar Workbench · 邮研学习工作台

[English](README.md) · **简体中文** · [安全政策](SECURITY.zh-CN.md) · [隐私与数据流](docs/PRIVACY.md)

一个优先使用本地存储的学习工作台：PDF 教材学习、AI 专业课程与训练实训、综测活动及证明材料记录。前端使用原生 HTML、CSS、JavaScript，本机服务仅使用 Node.js 标准库。界面与自编课程目前为中文，中英文文档同时维护。

项目从大学 AI 学习场景出发，不代表任何高校的官方培养方案、成绩认定或综测规则，也没有高校背书。

## 功能与边界

| 模块 | 已实现 | 使用边界 |
| --- | --- | --- |
| PDF 教材 | 本地解析，目录识别，章节概念/步骤/对照/图表/自测，物理页码引用，Markdown 导出 | AI 生成需要自己的兼容 API 账户（DeepSeek 或学校接口）；扫描件需先 OCR；公式与排版须核对原文 |
| AI 专业学习 | 8 阶段、43 课：数学/Python、经典 ML、深度学习、Transformer、预训练、后训练、评估/RAG/部署、项目 | 自编学习路线，不能代替完整学历课程；部分工程主题为原理和作业 |
| 训练实训 | PyTorch 小型 Decoder：预训练、SFT、LoRA、DPO、统一评估、生成、预训练恢复 | 默认 CPU 教学规模；生产大模型、多卡与 CUDA 未验收 |
| 综测记录 | 活动、举办单位、奖级、日期、分类、贡献与文件/照片原路径；拖拽、本机选择、检索、编辑、桌面 CSV 与附件 ZIP | 记录证据，不自动计算或认定官方综测分值 |
| 日常工具 | 任务、专注、复习卡、卡诺图、电路、梯度下降、数字分类、分类指标 | 算法适用条件见 `docs/`；不推断个人经历 |
| 完整备份 | 原 PDF、文本、学习展示、课程笔记/进度、证明路径、旧附件、基础记录 | JSON 未加密；不含路径指向的原文件，教材与旧存储附件仍含字节 |

![AI 专业学习界面，无个人记录](docs/screenshots-v2/ai-clean.png)

## 本地启动

浏览器模式要求 **Node.js 18+** 和支持 ES modules、Web Workers、IndexedDB 的现代浏览器。建议使用仍受维护的 Node.js LTS；兼容下限不表示旧版本仍有安全维护。浏览器模式无需 npm 依赖；可选桌面入口要求 **Node.js 22.12+** 与锁定版本的 Electron。

```sh
git clone https://github.com/yifanchen12/scholar-workbench.git
cd scholar-workbench
node server.js
```

打开 **http://127.0.0.1:5179**，保持服务运行。Windows 可双击 `启动工作台.cmd`。命令行入口可跨平台运行；本版本完整桌面验收在 Windows/Edge 完成。

端口冲突时设置 `STUDY_PORT`（1024–65535），例如 PowerShell：

```powershell
$env:STUDY_PORT = '5180'
node server.js
```

固定使用同一入口。`file:`、`localhost`、`127.0.0.1` 和不同端口属于不同浏览器来源，数据不共享。更换地址前导出完整备份。直接打开 HTML 不等价于本地服务模式。服务绑定 `127.0.0.1`，面向个人本机使用，没有公共网络服务或多用户认证。

### 桌面入口：拖入证明，无需填路径

Windows 双击 **`启动桌面工作台.cmd`**。首次启动会通过 npm 安装锁定的桌面依赖并下载 Electron 运行时，请保持网络与安装窗口开启；以后直接使用已安装的运行时。桌面窗口自动启动或复用本机服务。其他系统可运行 `npm ci` 后执行 `npm run desktop`，原生集成目前仅在 Windows 验收。

已有浏览器记录时，点击综测页面或活动表单中的 **“启用直接拖入”**，现有记录与当前未保存的活动表单会自动带入桌面窗口；全新下载请先完成上面的首次安装。原网页数据保留。桌面已有数据时，经确认先下载完整备份再替换，不合并记录。此前在浏览器拖入的文件，需要在桌面窗口重新拖入一次，才能取得真实路径。

桌面数据保存在项目目录内的 `.desktop-user-data/`，与普通浏览器独立，已排除 Git 提交及发布包。固定使用同一桌面目录，移动前先导出完整备份。

## 上传教材与生成展示

1. 导入带文字层的 PDF，原文件与提取文字存入本机浏览器 IndexedDB。
2. 填写服务商或学校提供的 Base URL、API 密钥与模型名称。点击生成才调用，费用由该账户承担。
3. 生成目录会发送每页首 120、尾 60 个 JavaScript 字符的节选，不等同于完整审读全书。
4. 选择章节或物理页码生成展示。单次最多 40 页、100,000 个 JavaScript 字符；长章分段。
5. 对照 PDF 核查公式、例题、图表、答案；可展开提取文字、保存展示与导出 Markdown。

连接信息与密钥只在页面内存与请求中使用，刷新恢复默认，不写入持久存储或备份。选定文字、书名和学习目标经本机代理发送至 Base URL 指定的接口；默认是 [DeepSeek](https://api-docs.deepseek.com/api/create-chat-completion/)，也支持兼容的学校接口。目录发送节选，章节发送所选页全文；综测证明、课程笔记及其他记录不发送。第三方处理受其政策约束，发送前应确认教材使用权限。

密码 PDF 先解密，扫描 PDF 先 OCR。双栏顺序、数学符号、图片和公式可能提取不完整。引用页码从 PDF 第一页计数，不是印刷页码。结构与引用范围校验不能证明 AI 内容正确。无密钥时仍可本地阅读，不生成虚构结果。

Base URL 填写示例（学校域名为演示，请替换为学校提供的地址）：

| 输入 | 实际请求地址 |
| --- | --- |
| `https://api.deepseek.com` | `https://api.deepseek.com/chat/completions` |
| `https://ai.example.org/campus/v1/` | `https://ai.example.org/campus/v1/chat/completions` |
| `https://ai.example.org/v1/chat/completions` | 直接使用，不重复拼接 |

接口须兼容 Bearer 认证、非流式 Chat Completions、`response_format: {"type":"json_object"}` 和所需输出 token 预算。模型 ID 按学校提供填写，支持 `/`、`:`。需要校园网/VPN 时先连接。地址只能用 HTTP(S)，不得含账号密码、查询参数或片段。优先 HTTPS；HTTP 会明文发送密钥与教材文字，仅用于明确可信的本机/校园接口。不跟随重定向，请直接填写最终地址。接收数据与密钥的是所选服务，不一定是 DeepSeek。

若连接报错包含 `EACCES/EPERM`，说明本机策略禁止 Node.js 进程联网。停止该服务，在普通终端运行 `node server.js`，或允许该进程对外联网。这类失败发生在收到 API HTTP 响应之前，不能判断密钥或模型是否有效。未认证请求返回 `401` 只说明地址可达，不代表带真实密钥的生成已成功。

生成请求没有工作台设置的等待期限或响应空闲超时，学校接口慢时会持续等待，保持页面与服务开启即可。点击“取消生成”或关闭浏览器连接才会停止本机待处理请求，不自动重试。学校网关仍可能返回自身超时错误或断开连接；页面会区分说明，移除本机期限不能阻止外部服务断开。

## AI 训练实训

基础 Python 实验使用标准库；小型语言模型要求 **Python 3.10+、PyTorch 2.2+**。建议使用独立虚拟环境，按 [PyTorch 官方安装页](https://pytorch.org/get-started/locally/) 选择适合操作系统的命令。

```sh
python practice/test_math_lab.py
python practice/run_lab.py
python tests/tiny_llm.test.py
python practice/tiny_llm.py all --steps 80 --output practice/llm-output
```

默认模型 2 层、64 维、4 头、上下文 64 token，共 **107,804 个基座参数**；LoRA 训练 **3,072 个参数**。自编颜色问答训练/验证/测试为 16/4/4 条。字符词表从训练侧拟合，未见字符映射 `<unk>` 并计数；无需下载外部基座或使用 API。

输出包括权重、日志、统一评估与 `training-report.json`，可导入训练记录工具。SFT 仅对回答计算 loss；LoRA 检查基座冻结；DPO 使用冻结的 SFT 参考模型。预训练支持恢复优化器与 CPU 随机状态。

示例来自真实 CPU 运行。**低 loss 不代表通用能力，DPO 偏好优化也不保证降低语言建模 loss，示例确实出现退化。** 生成固定数量 token，没有 EOS 停止机制，可能重复。CUDA、多卡、PPO、生产量化不属于已验收实现。详见 [训练说明](docs/AI专业学习与训练实训.md) 和 [模型卡](docs/MODEL_CARD.md)。

## 综测与备份

记录活动、单位、奖级、日期和贡献，**直接拖入文件或照片**。桌面版优先记录可读取的原路径，照片显示缩略图并可点击放大；原路径无法预览时，使用拖入的照片预览，并在保存活动时留一份本地副本。浏览器也支持拖入照片并保存副本；非图片的完整原路径仍需桌面选择器或手动填写。证明照片不会发送给教材 API。

**Windows 桌面版本地 OCR** 会自动识别首张新加入、可预览的照片，也可点击“选图识别并填表”。使用 Windows 已安装的 OCR 语言组件，无需 API 密钥，只填活动表单中的空白项，保留手填内容，不确定的字段留空。可查看和纠正识别原文，核对表单后保存。浏览器可携带当前草稿及照片副本进入桌面版。详见[照片预览与本地 OCR](docs/LOCAL_OCR.md)。

新完整备份使用 `youyan-workspace-v3` 标记，避免旧程序恢复时静默丢弃路径；当前程序仍可导入旧 v2 备份，请用新版恢复。

桌面版点击 **“导出 CSV 与附件（ZIP）”**，会把**当前筛选列表及真实文件、照片副本和旧附件一起打包**。每项活动使用独立目录，UTF-8 CSV 填写包内相对路径；同名文件保持独立，缺失原件明确报告。导出时流式读取原件，不修改原文件；取消或失败保留已有导出包，禁止覆盖原证明。浏览器导出仍仅 CSV。

**完整 JSON 备份包含已保存的照片副本、旧附件和路径引用；仅记录路径的原件仍需单独保管或另导出附件 ZIP。** 移动或删除原件会导致预览失效；没有已存副本时，可重新选择照片保存副本，无法仅凭失效路径恢复原文件。删除活动或引用不会删除原件。副本元数据使用现有 v3 备份的可选字段，当前程序仍可导入 v2。未知奖项信息留空，分值以当年官方认定为准。

限制：单个 PDF 50 MiB/1,000 页、最多 30 本；最多 1,000 项活动，每项合计 10 份证明。照片副本和旧附件每份最多 20 MiB，与教材共享 120 MiB 存储上限；预览解码上限 4,000 万像素。导入完整备份上限 256 MiB。浏览器配额可能更小。

教材 API 面板提供 [bupt-api 校园接口资料](https://github.com/wzekin/bupt-api)和 [BUPTapi-dsh 本机 DSH 接入仓库](https://github.com/yifanchen12/BUPTapi-dsh)。链接仅供查阅，不代表自动发现 Base URL 或对官方大模型服务可用性的保证。

换设备、清理浏览器或大量编辑前导出完整备份。备份为明文 JSON，**Base64 不是加密**。导入前核查来源，替换前保存当前备份。隐私模式、清除站点数据、存储失败可能导致丢失；当前没有多窗口编辑冲突合并。旧经历与草稿兼容迁移，未知单位、奖级、日期不会被补造。

## 验证与开发

无需外部依赖：

```sh
node tests/core.test.js
node tests/cards.test.cjs
node tests/state-integrity.test.cjs
node tests/backup-size.test.cjs
node tests/digits.test.cjs
node tests/metrics.test.cjs
node tests/record-ocr.test.cjs
python practice/test_math_lab.py
python scripts/audit-public.py
```

另一个终端运行 `node server.js` 后：

```sh
node tests/server.test.cjs
node tests/textbook-api.test.cjs
node tests/textbook-wait.test.cjs
node tests/desktop-transfer.test.cjs
```

API 检查使用模拟响应与占位密钥，不产生付费调用。浏览器检查可按需安装 Playwright（仅开发用途）：

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node tests/workspace-v2.test.cjs
node tests/photo-browser.test.cjs
```

原生集成使用真实磁盘测试文件、隔离 Electron 配置与合成数据：运行 `npm ci`，按上文安装 Playwright 后，在 Windows 执行 `node tests/desktop.test.cjs` 和 `node tests/desktop-photos.test.cjs`。检查路径提取、预览、组件可用时的本地 OCR、副本回退、记录/草稿迁移、持久化及 ZIP 字节，不访问使用者的实际配置。ZIP 检查需要 Python，可用 `STUDY_PYTHON_PATH` 指定程序。

`PLAYWRIGHT_PATH` 指定 Playwright 包，`BROWSER_PATH` 指定 Chromium/Edge 程序，`STUDY_URL` 指定本机地址。端到端检查用隔离浏览器上下文、合成活动与附件，覆盖真实中文 PDF、课程进度、路径不复制存储、旧附件字节恢复、旧数据迁移和 24 个布局。历史 v1 UI 用例不作为新版验收入口，见 [验证范围](docs/VALIDATION.md)。

运行 `python scripts/package-workbench.py` 构建便携包，再用 `python scripts/verify-release.py` 校验新解压内容与独立实训。主 ZIP 为生成产物，不提交 Git；界面使用的小型 Python 实训包随源码提供。

## 目录与维护

```text
server.js / deepseek-api.js       本机服务与可配置 API 代理
textbook*.js / vendor/pdfjs/      教材解析、校验与展示
curriculum*.js / training*.js    自编课程、工具与实际 CPU 记录
records.js / vault.js             证明路径、旧附件、持久存储与备份
practice/                        Python 与 PyTorch 实训
tests/ / scripts/                验证、打包与复现
docs/                            算法、隐私、模型卡、验证说明
```

贡献请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。漏洞按 [安全政策](SECURITY.zh-CN.md) 私下报告，不在公开 Issue 上传密钥、教材、证明或利用细节。

原创代码与自编内容采用 [MIT 许可](LICENSE)。PDF.js、字体组件、UCI 派生数字数据保留各自许可，**不被 MIT 重新授权**，见 [第三方声明](THIRD_PARTY_NOTICES.md)。用户导入文件与第三方服务不在本项目授权范围内。
