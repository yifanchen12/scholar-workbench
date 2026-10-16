# Privacy and data flow / 隐私与数据流

This describes the repository's implementation, not a provider's privacy contract. / 本文描述代码实现，不代替服务商的隐私合同。

## Storage / 存储

| Data / 数据 | Location / 位置 | External transfer / 对外发送 |
| --- | --- | --- |
| Tasks, cards, sessions, legacy experiences/drafts / 基础记录 | Browser localStorage, `youyan.study.v1` | No application upload / 应用不上传 |
| Books, extracted text, generated lessons, activity records/paths, legacy copies, course progress/notes / 教材、综测路径、旧副本与课程数据 | Browser IndexedDB, `youyan.workspace.v2` | Only the requested textbook text/metadata below / 仅下述请求的教材文字与元数据 |
| Base URL, model and API key / 连接信息与密钥 | Page memory, request, Node process during call / 页面及调用过程内存 | User-selected API; HTTPS preferred, HTTP allowed / 用户指定 API，优先 HTTPS，也允许 HTTP |
| Imported training report / 导入训练报告 | Page memory / 页面内存 | None / 不发送 |
| Python outputs / Python 输出 | Local files under the selected output directory / 指定目录的本机文件 | No script upload / 脚本不上传 |
| Full backup / 完整备份 | Downloaded plaintext JSON with Base64 file bytes / 下载的明文 JSON | Wherever the user sends the file / 由使用者决定文件去向 |
| Activity CSV + evidence ZIP / 活动 CSV 与附件 ZIP | User-selected local ZIP with actual originals and legacy bytes / 自选本机 ZIP，包含原文件与旧附件字节 | No application upload; user controls sharing / 应用不上传，用户决定分享 |

Browser storage is isolated by scheme, host and port. It is not encrypted by the application and is accessible to code running with appropriate browser/host privileges. There is no cloud sync, account or server-side user database. The local server reads application assets and temporarily handles generation requests; it does not persist imported books, proof files or keys.

浏览器存储按协议、主机、端口隔离。应用不对它加密，具有适当浏览器/主机权限的程序可能读取。没有云同步、账户或服务端用户数据库。本机服务读取应用资源、临时处理生成请求，不持久保存导入的教材、证明或密钥。

New activity evidence stores only path strings. Desktop drag-and-drop uses Electron's isolated `webUtils.getPathForFile` bridge to obtain the disk-backed original's path without reading file contents. Browser drops only expose names; its Windows-only local picker returns explicitly selected full paths, with manual entry as a fallback. There is no directory search or arbitrary file-read/open endpoint. Paths may reveal account names and folder structure, appear in CSV/full backups and should be treated as private records. Originals remain outside the app and are excluded from backups. Legacy copies remain until explicitly removed.

新综测证明只保存路径字符串。桌面拖拽通过隔离的 Electron `webUtils.getPathForFile` 桥接直接取得磁盘原路径，不读取内容。浏览器拖拽只读文件名，Windows 本机选择器只返回明确选中的完整路径，手动输入为备用。没有目录搜索或任意文件读取/执行接口。路径可能暴露账户名与目录结构，会进入 CSV/完整备份，应按私人记录保管。原文件不进入应用或备份，旧副本在明确移除前保留。

**Explicit desktop CSV/evidence export reads the referenced originals and writes their actual bytes, plus referenced legacy attachments, into a user-selected local ZIP.** Each filtered activity has its own folder; the CSV references packaged relative paths. Missing originals are listed with their original positions for repair. This does not add proof copies to IndexedDB or upload evidence. The archive is plaintext and may contain private documents/photos; the user controls any sharing. Full JSON backup behavior remains separate and path-only for new evidence. Browser-only export remains CSV-only.

**主动点击桌面版 CSV 与附件导出时，会读取所引用的原文件，将其真实字节及关联旧附件写入用户选择的本机 ZIP。** 当前筛选活动各有目录，CSV 使用包内相对路径；缺失清单保留原位置便于修复。不在 IndexedDB 新增证明副本，也不上传证明。压缩包未加密，可能含私人文件和照片，分享由使用者决定。完整 JSON 备份是独立功能，对新证明仍只保留路径；浏览器导出仍仅 CSV。

Desktop storage lives in `.desktop-user-data/` beside the project, independently of the ordinary browser. Explicit browser-to-desktop migration sends the full workspace backup and current activity draft to the loopback server, held only in memory for up to two minutes and consumed once by a launched desktop process. No disk transfer file is created. Existing PDF/legacy copy bytes migrate as part of the workspace; new evidence remains path-only. API keys/settings are excluded. The browser copy stays intact; an existing desktop workspace requires backup and confirmation before replacement. Initial runtime installation contacts npm and Electron's distribution service to download software, without sending workspace records. The private profile is ignored by Git and excluded from archives.

桌面存储位于项目旁的 `.desktop-user-data/`，与普通浏览器独立。主动迁移会把完整备份与当前活动草稿发送到本机回环服务，仅在内存暂存最多两分钟，由启动的桌面进程单次接收，不创建中转文件。教材和旧副本字节随工作台迁移，新证明仍仅路径；密钥与连接设置不迁移。浏览器副本保留，替换已有桌面工作台须先备份并确认。首次安装会访问 npm 与 Electron 分发服务下载软件，不发送工作台记录。私人配置目录已排除 Git 与发布包。

## Explicit generation request / 主动生成请求

```text
PDF -> local PDF.js -> browser IndexedDB
                         |
                  user requests generation
                         |
           selected text + title + goal + key + baseUrl
                         |
            HTTP 127.0.0.1 /api/textbook
                         |
          user-selected HTTP(S) .../chat/completions
                         |
          typed validation -> escaped display -> IndexedDB
```

An outline request includes page-numbered first-120/last-60-character excerpts from each page. A lesson request includes full extracted text from selected pages, physical page numbers, book title and learning goal. The key is in the authorization header of the provider request, not the prompt. The destination is selected by the user (default: `https://api.deepseek.com`); compatible campus endpoints, including private addresses, are supported. HTTP exposes the request in plaintext; HTTPS is preferred, and redirects are not followed. Connection settings reset on refresh and are not saved to backups. The selected provider also receives ordinary network/account metadata and applies its own retention and processing policies; the project cannot promise zero retention or delete provider-held copies.

目录请求包含逐页物理页码及首 120/尾 60 字符节选；章节请求包含所选页全文、页码、书名、学习目标。密钥用于服务商请求的认证头，不在提示词正文。目标由使用者指定（默认 `https://api.deepseek.com`），支持兼容校园接口与私网地址；HTTP 明文传输，优先 HTTPS，不跟随重定向。连接信息刷新恢复默认，不进入备份。所选服务商还会接收通常的网络/账户元数据，并按自己的政策处理；本项目不能承诺其零留存，也不能删除其已保存的副本。

The shipped application has no analytics SDK or remote script loading. Ordinary use does not contact a model provider automatically. Clicking an external documentation link opens the external site, which has its own policies. Browser extensions, operating-system backup/sync and user-initiated sharing are outside application control.

应用不含统计 SDK 或远程脚本，普通操作不会自动联系模型服务商。点击外部文档链接后适用该网站政策。扩展、系统备份/同步及使用者主动分享不由应用控制。

## Backup, removal and repository publication / 备份、删除与公开仓库

Full backups can contain student identity, awards, original evidence paths, copyrighted text and legacy private photos if previously imported. New path references do not contain target file bytes. Base64 merely encodes bytes. Keep backups outside public repositories and revoke sharing links when appropriate. The importer validates structure before replacing data, but does not sanitize the private meaning of valid contents.

完整备份可能包含身份、获奖、原文件路径、教材与旧副本照片，不含新路径指向的原文件字节。Base64 只是编码。备份应放在公开仓库之外，必要时撤销分享链接。导入器校验结构，但无法判断有效内容中的隐私。

Use the module's delete controls to remove a book, activity or attachment. To clear all stored application data, clear the site's data in browser settings for the actual origin. Existing downloaded backups, earlier shares and provider copies remain separate and must be handled separately. A factory reset of basic records is not a secure erase of every storage medium. Deleted bytes may remain in browser/OS backups; there is no forensic-erasure guarantee.

用对应模块删除教材、活动或附件；全部清理需在浏览器设置中清除实际访问来源的站点数据。已下载备份、早期分享、第三方副本仍需单独处理。基础记录重置不等于所有存储介质安全擦除；浏览器或系统备份可能保留旧字节，不保证取证级擦除。

The public repository contains application code, synthetic test fixtures, authored teaching files and third-party components. It excludes local keys, browser databases, user uploads, private backups, internal planning and training checkpoints. Do not treat `.gitignore` or the pattern audit as a guarantee that a future file is safe to publish; review the staged file list and contents before each push.

公开仓库只包含代码、合成测试数据、自编教学文件及第三方组件，不包含本机密钥、浏览器数据库、用户上传、私人备份、内部规划或训练权重。`.gitignore` 和模式扫描不保证未来文件可安全公开；每次推送前仍需检查暂存内容。
