# Privacy and data flow / 隐私与数据流

This describes the repository's implementation, not a provider's privacy contract. / 本文描述代码实现，不代替服务商的隐私合同。

## Storage / 存储

| Data / 数据 | Location / 位置 | External transfer / 对外发送 |
| --- | --- | --- |
| Tasks, cards, sessions, legacy experiences/drafts / 基础记录 | Browser localStorage, `youyan.study.v1` | No application upload / 应用不上传 |
| Books, extracted text, generated lessons, activity records/files, course progress/notes / 教材、综测与课程数据 | Browser IndexedDB, `youyan.workspace.v2` | Only the requested textbook text/metadata below / 仅下述请求的教材文字与元数据 |
| API key / API 密钥 | Page memory, request, Node process during call / 页面及调用过程内存 | DeepSeek authentication over HTTPS, via loopback HTTP / 经本机 HTTP 代理，通过 HTTPS 用于认证 |
| Imported training report / 导入训练报告 | Page memory / 页面内存 | None / 不发送 |
| Python outputs / Python 输出 | Local files under the selected output directory / 指定目录的本机文件 | No script upload / 脚本不上传 |
| Full backup / 完整备份 | Downloaded plaintext JSON with Base64 file bytes / 下载的明文 JSON | Wherever the user sends the file / 由使用者决定文件去向 |

Browser storage is isolated by scheme, host and port. It is not encrypted by the application and is accessible to code running with appropriate browser/host privileges. There is no cloud sync, account or server-side user database. The local server reads application assets and temporarily handles generation requests; it does not persist imported books, proof files or keys.

浏览器存储按协议、主机、端口隔离。应用不对它加密，具有适当浏览器/主机权限的程序可能读取。没有云同步、账户或服务端用户数据库。本机服务读取应用资源、临时处理生成请求，不持久保存导入的教材、证明或密钥。

## Explicit generation request / 主动生成请求

```text
PDF -> local PDF.js -> browser IndexedDB
                         |
                  user requests generation
                         |
           selected text + title + goal + key
                         |
            HTTP 127.0.0.1 /api/textbook
                         |
          HTTPS api.deepseek.com/chat/completions
                         |
          typed validation -> escaped display -> IndexedDB
```

An outline request includes page-numbered first-120/last-60-character excerpts from each page. A lesson request includes full extracted text from selected pages, physical page numbers, book title and learning goal. The key is in the authorization header of the provider request, not the prompt. The provider also receives ordinary network/account metadata and applies its own retention and processing policies; the project cannot promise zero retention or delete provider-held copies.

目录请求包含逐页物理页码及首 120/尾 60 字符节选；章节请求包含所选页全文、页码、书名、学习目标。密钥用于服务商请求的认证头，不在提示词正文。服务商还会接收通常的网络/账户元数据，并按自己的政策处理；本项目不能承诺其零留存，也不能删除其已保存的副本。

The shipped application has no analytics SDK or remote script loading. Ordinary use does not contact DeepSeek automatically. Clicking an external documentation link opens the external site, which has its own policies. Browser extensions, operating-system backup/sync and user-initiated sharing are outside application control.

应用不含统计 SDK 或远程脚本，普通操作不会自动联系 DeepSeek。点击外部文档链接后适用该网站政策。扩展、系统备份/同步及使用者主动分享不由应用控制。

## Backup, removal and repository publication / 备份、删除与公开仓库

Full backups can contain student identity, awards, copyrighted text and private photos if you imported them. Base64 merely encodes bytes. Keep backups outside public repositories and revoke sharing links when appropriate. The importer validates structure before replacing data, but does not sanitize the private meaning of valid contents.

完整备份可能包含用户导入的身份、获奖、教材、私人照片。Base64 只是编码。备份应放在公开仓库之外，必要时撤销分享链接。导入器校验结构，但无法判断有效内容中的隐私。

Use the module's delete controls to remove a book, activity or attachment. To clear all stored application data, clear the site's data in browser settings for the actual origin. Existing downloaded backups, earlier shares and provider copies remain separate and must be handled separately. A factory reset of basic records is not a secure erase of every storage medium. Deleted bytes may remain in browser/OS backups; there is no forensic-erasure guarantee.

用对应模块删除教材、活动或附件；全部清理需在浏览器设置中清除实际访问来源的站点数据。已下载备份、早期分享、第三方副本仍需单独处理。基础记录重置不等于所有存储介质安全擦除；浏览器或系统备份可能保留旧字节，不保证取证级擦除。

The public repository contains application code, synthetic test fixtures, authored teaching files and third-party components. It excludes local keys, browser databases, user uploads, private backups, internal planning and training checkpoints. Do not treat `.gitignore` or the pattern audit as a guarantee that a future file is safe to publish; review the staged file list and contents before each push.

公开仓库只包含代码、合成测试数据、自编教学文件及第三方组件，不包含本机密钥、浏览器数据库、用户上传、私人备份、内部规划或训练权重。`.gitignore` 和模式扫描不保证未来文件可安全公开；每次推送前仍需检查暂存内容。
