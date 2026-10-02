# Validation scope / 验证范围

## Current acceptance / 当前验收

| Entry | Purpose / 范围 | Requirements / 条件 |
| --- | --- | --- |
| `tests/core.test.js` | 576 logic/state/algorithm checks / 逻辑、状态、算法 | Node |
| `tests/digits.test.cjs` | 200 exported JS/Python probability comparisons / 导出概率参考比较 | Node |
| `tests/metrics.test.cjs` | 624 classification-metric reference matrices / 指标参考矩阵 | Node |
| `tests/cards.test.cjs`, `state-integrity.test.cjs`, `backup-size.test.cjs` | Parsing, state integrity and backup limits / 解析、状态与备份边界 | Node |
| `tests/server.test.cjs`, `textbook-api.test.cjs` | Static allowlist, headers, local origin, schema, default/custom Base URL, synthetic gateway transport and rejected redirects / 本机服务、默认/自定义地址、模拟网关与重定向阻断 | Running local server / 已启动服务 |
| `tests/textbook-wait.test.cjs` | Accelerated application deadlines with delayed real HTTP headers/body; manual cancellation closes upstream / 加速应用定时器、真实 HTTP 慢响应、手动取消断开上游 | Node; isolated synthetic gateway / 隔离的合成网关 |
| `tests/launcher.test.cjs` | Windows launcher and port behavior / Windows 启动及端口 | Windows, Node |
| `tests/workspace-v2.test.cjs` | Real Chinese PDF extraction; course state/tools; memory-only Base URL; synthetic attachments; CSV safety; byte-preserving backup; invalid-input rejection; migration; 24 layouts / PDF、课程、附件、备份、迁移、布局 | Local server, Playwright, Chromium/Edge |
| `practice/test_math_lab.py` | Standard-library numerical/gradient checks / 标准库数值与梯度 | Python |
| `tests/tiny_llm.test.py` | Causal attention, SFT mask, frozen DPO reference, LoRA invariants, checkpoint equality, exact CPU resume / 训练机制与 CPU 恢复 | Python, PyTorch |
| `scripts/audit-public.py` | Tracked-file publication exclusions and credential-pattern scan, including ZIP entries / 公开文件排除与模式扫描 | Python, Git |
| `scripts/verify-release.py` | SHA-256, safe extraction, independent practice execution / 包校验及独立实训 | Generated archives, Python, Node |
| `tests/release-browser.test.cjs` | Freshly extracted seven routes, offline assets and downloads / 新解压包七页面与下载 | Release verification, Playwright |

The v2 implementation was exercised locally on Windows/Edge, including actual CPU training. API protocol acceptance uses mocks and a placeholder key; it does not demonstrate successful paid DeepSeek calls or every available provider model. Runtime error/layout checks do not constitute a full accessibility or security audit.

v2 已在 Windows/Edge 本机运行验证，包括真实 CPU 训练。API 验证用模拟响应和占位密钥，不证明真实付费 DeepSeek 调用或所有模型可用。布局与运行错误检查不等于完整无障碍或安全审计。

## CI and historical scripts / CI 与历史用例

GitHub Actions runs the dependency-free checks, HTTP/API boundary checks, publication scan and tiny-model invariant tests. This workflow does not run browser layout checks, a paid service call or CUDA/distributed training. Check the actual run status for the current commit rather than assuming a historical pass applies to new code.

GitHub Actions 运行无外部依赖的检查、HTTP/API 边界、公开扫描与小模型不变量；不运行浏览器布局、付费 API 或 CUDA/多卡。以当前提交的实际执行状态为准。

Other browser scripts whose assertions refer to the former AI mini-lab/application-material interface are retained as historical v1 cases. Some test names are unchanged for reproducibility; they are not current UI acceptance entries. `tests/V2验证范围.md` provides the older Chinese mapping. Run only relevant supported checks, rather than all historical scripts indiscriminately.

旧“AI 小实验/申请材料台”选择器的浏览器用例作为 v1 历史保留，不属于当前 UI 验收。`tests/V2验证范围.md` 是原中文对应说明；不要无区别执行所有历史脚本。
