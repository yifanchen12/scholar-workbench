# Contributing / 贡献指南

## English

Keep changes focused on a reproducible learning or record-keeping need. Prefer native APIs and the standard library; avoid new runtime dependencies without a concrete benefit. Discuss a substantial behavior or storage-format change in an issue before implementation. Ordinary fixes can be submitted directly as pull requests.

1. Fork and clone the repository, create a focused branch, and start `node server.js`.
2. Reproduce the issue with synthetic data. Never commit API keys, personal evidence, backups, proprietary textbooks or generated checkpoints.
3. Implement the smallest appropriate correction. Preserve legacy backup compatibility and distinguish validated executable features from explanatory coursework.
4. Run the relevant commands in the README. Changes to storage need round-trip/invalid-input checks; API changes need mocked protocol checks; training changes need numerical/invariant checks. Use `tests/workspace-v2.test.cjs` for current UI acceptance, not historical v1 selectors.
5. Update English and Chinese public documentation when behavior, limits, data flow or security assumptions change. Preserve every applicable third-party notice.
6. Inspect `git diff --cached`, run `python scripts/audit-public.py`, and submit a PR explaining the user-visible problem, correction and validation. Clearly state checks that were not run.

API tests must not require paid accounts. Screenshots should use empty or clearly synthetic records. Do not claim benchmark improvements from the tiny synthetic corpus. Adding a dependency requires its provenance, license and update implications to be documented. Contributions are offered under the applicable project license; do not contribute material you lack permission to share. No additional contributor agreement is required.

For vulnerabilities, use [private reporting](SECURITY.md), not a public issue or PR.

## 简体中文

围绕可复现的学习或记录需求修改，优先原生 API 与标准库，有明确收益才增加运行依赖。大幅改变行为或存储格式前先在 Issue 讨论；普通修复可直接提交 PR。

1. Fork、克隆、新建明确范围的分支，运行 `node server.js`。
2. 用合成数据复现，不提交密钥、个人证明、备份、无权公开的教材或生成权重。
3. 使用合适的最小修复，保持旧备份兼容，区分可运行实现与讲解课程。
4. 执行 README 中与改动相关的检查。存储变更验证恢复与非法输入；API 用模拟协议；训练验证数值与不变量；当前 UI 用 `workspace-v2.test.cjs`，不使用历史 v1 选择器验收。
5. 行为、限制、数据流或安全边界变化时同步修改中英文文档，保留第三方声明。
6. 检查 `git diff --cached`，运行 `python scripts/audit-public.py`；PR 说明实际问题、修复行为、验证与未运行的检查。

API 检查不得依赖付费账户，截图使用空记录或明确的合成记录。不能用微型合成语料宣称通用基准提升。新依赖需说明来源、许可及维护影响。贡献按适用的项目许可提交，不提交无权分享的内容；不要求额外贡献协议。

安全问题请按 [安全政策](SECURITY.zh-CN.md) 私下报告。
