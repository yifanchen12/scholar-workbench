# Privacy and data flow / 隐私与数据流

This describes the repository's implementation, not a provider's privacy contract. / 本文描述代码实现，不代替服务商的隐私合同。

## Storage / 存储

| Data / 数据 | Location / 位置 | External transfer / 对外发送 |
| --- | --- | --- |
| Tasks, cards, sessions, legacy experiences/drafts / 基础记录 | Browser localStorage, `youyan.study.v1` | No application upload / 应用不上传 |
| Books, extracted text, lessons, records/paths, photo and legacy copies, course progress / 教材、综测路径、照片与旧副本、课程数据 | Browser IndexedDB, `youyan.workspace.v2` | Only the requested textbook text/metadata below; no proof upload / 仅下述教材请求，不上传证明 |
| Photo previews and OCR text / 照片预览与识别原文 | Form/desktop memory; Windows OCR helper stdin / 表单、桌面内存及本机脚本标准输入 | No application upload / 应用不上传 |
| Photo folder and saved images / 照片目录与保存图片 | Folder preference in private desktop profile; image files in the user-selected directory / 私人桌面配置中的目录偏好、用户选择目录中的图片 | No upload; paths enter activity references / 不上传，路径随活动引用保存 |
| Base URL, model and API key / 连接信息与密钥 | Page memory, request, Node process during call / 页面及调用过程内存 | User-selected API; HTTPS preferred, HTTP allowed / 用户指定 API，优先 HTTPS，也允许 HTTP |
| Imported training report / 导入训练报告 | Page memory / 页面内存 | None / 不发送 |
| Python outputs / Python 输出 | Local files under the selected output directory / 指定目录的本机文件 | No script upload / 脚本不上传 |
| Full backup / 完整备份 | Downloaded plaintext JSON with Base64 file bytes / 下载的明文 JSON | Wherever the user sends the file / 由使用者决定文件去向 |
| Activity CSV + evidence ZIP / 活动 CSV 与附件 ZIP | User-selected local ZIP with actual originals and legacy bytes / 自选本机 ZIP，包含原文件与旧附件字节 | No application upload; user controls sharing / 应用不上传，用户决定分享 |

Browser storage is isolated by scheme, host and port. It is not encrypted by the application and is accessible to code running with appropriate browser/host privileges. There is no cloud sync, account or server-side user database. The local server reads application assets and temporarily handles generation requests; it does not persist imported books, proof files or keys.

浏览器存储按协议、主机、端口隔离。应用不对它加密，具有适当浏览器/主机权限的程序可能读取。没有云同步、账户或服务端用户数据库。本机服务读取应用资源、临时处理生成请求，不持久保存导入的教材、证明或密钥。

Without a configured photo folder, desktop drag-and-drop obtains disk-backed paths through the isolated `webUtils.getPathForFile` bridge. Photo preview reads supported image files locally and returns a scaled PNG to the page. Readable originals remain path references. When a dropped photo cannot be previewed by path, a browser-decodable fallback copy is held in memory and persisted with the saved activity; browser mode also supports these copies. Fallback copies preserve original bytes, optionally retain their source path and enter full backups. Canceling the activity does not save these new IndexedDB copies. Paths may reveal account names/folders and must be treated as private records. Non-photo paths use the native picker/manual fallback. No directory search or generic HTTP file-read/open endpoint is introduced.

After a native photo folder is chosen, newly dropped/pasted photos are written there immediately, with unique names. Dropped files preserve original bytes; the native paste button encodes clipboard bitmaps as PNG. Canceling the activity or removing its reference does not delete those files. The folder preference is stored in `.desktop-user-data/photo-folder.json`, excluded from Git, archives and workspace backups. References include saved image paths; external image bytes enter evidence ZIP exports, not path-only JSON references. Clipboard images are read on the user's paste action; there is no background clipboard polling or text-clipboard reading. Ctrl+V image events use only the provided image files; ordinary text paste is left to the input. Browser mode retains photos locally and needs desktop mode for external-folder writing.

未配置照片目录时，桌面拖拽通过隔离的 `webUtils.getPathForFile` 桥接取得磁盘路径。照片预览在本机读取受支持的图片，向页面返回缩放 PNG；可读取的原件仍仅记录路径。无法按路径预览时，将浏览器可解码的回退副本暂存内存、随活动保存；浏览器也支持此类副本。回退副本保留原字节、可选原位置，并进入完整备份；取消活动不保存这些新的 IndexedDB 副本。路径可能暴露账户名与目录，应按私人资料保管。非照片路径可用系统选择器或手动填写，未新增目录搜索或通用 HTTP 文件读取/执行接口。

选择本机照片目录后，新照片立即以独立文件名保存；拖入文件保留原字节，粘贴按钮将剪贴板位图编码为PNG；取消活动或移除引用不删除这些文件。目录偏好保存在 `.desktop-user-data/photo-folder.json`，排除 Git、发布包与工作台备份。活动保留图片保存路径；外部图片字节进入附件ZIP，不进入仅含引用的JSON字段。仅在用户粘贴操作时读取图片剪贴板，不后台监听、不读取文字剪贴板；Ctrl+V 事件只使用其提供的图片文件，普通文字粘贴交由输入框处理。浏览器照片保存在本浏览器，外部目录写入需桌面版。

Windows desktop OCR uses installed Windows.Media.Ocr through a fixed local PowerShell helper. Selected image bytes go through stdin, not command arguments or a provider API. Recognition text remains in the form until closed; only accepted activity fields are saved. It requires an installed OCR language component. This is independent of textbook generation and its API credentials. See [behavior, component requirements and limits](LOCAL_OCR.md).

Windows 桌面 OCR 经固定 PowerShell 脚本调用系统已安装的 Windows.Media.Ocr。图片字节通过标准输入传递，不进入命令参数或服务商 API。识别原文保留在表单内存，关闭后不留存；只保存使用者确认的活动字段。需安装 OCR 语言组件，与教材生成及其密钥独立。详见[组件要求、行为与边界](LOCAL_OCR.md)。

**Explicit desktop CSV/evidence export reads referenced originals and writes their actual bytes, plus stored photo/legacy copies, into a user-selected local ZIP.** Each filtered activity has its own folder; CSV uses packaged relative paths. Missing originals are listed for repair. Export itself does not add IndexedDB copies or upload evidence. The archive is plaintext and may contain private documents/photos; the user controls sharing. Full JSON backup includes stored copies and references, but not external path-only originals. Browser export remains CSV-only.

**主动导出桌面 CSV 与附件时，会读取引用的原件，将真实字节及已存照片/旧附件写入自选本机 ZIP。** 当前筛选活动各有目录，CSV 使用包内相对路径，缺失清单便于修复。导出本身不新增 IndexedDB 副本，也不上传证明。压缩包未加密，可能包含私人文件和照片，由使用者决定分享。完整 JSON 备份包含已存副本和引用，不包含外部仅记路径的原件；浏览器导出仍仅 CSV。

Desktop storage lives in `.desktop-user-data/` beside the project, independently of the ordinary browser. Explicit browser-to-desktop migration sends the full workspace backup and current activity draft to the loopback server, held in memory for up to two minutes and consumed once. No disk transfer file is created. PDFs, saved copies and pending draft photo bytes migrate with their corresponding records; path references remain references. API keys/settings are excluded. Browser data stays intact; an existing desktop workspace requires backup and confirmation before replacement. Initial runtime installation contacts npm/Electron distribution to download software without sending records. The private profile is ignored by Git and excluded from archives.

桌面存储位于项目旁的 `.desktop-user-data/`，与普通浏览器独立。主动迁移将完整备份和当前活动草稿发送至本机回环服务，仅内存暂存最多两分钟、单次接收，不创建中转文件。教材、已存副本与草稿待存照片随相应记录迁移，路径引用仍为引用；密钥与连接设置不迁移。浏览器数据保留，替换已有桌面数据须备份并确认。首次安装访问 npm/Electron 分发服务下载软件，不发送工作台记录。私人配置目录已排除 Git 与发布包。

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
