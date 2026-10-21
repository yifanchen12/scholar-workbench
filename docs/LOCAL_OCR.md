# 照片预览与本地 OCR / Photo preview and local OCR

## 使用 / Usage

1. 重开新版“启动桌面工作台.cmd”，进入综测记录台，点击记录活动。旧窗口需重开才能载入新桌面桥接。
2. 拖入照片即可预览；点击缩略图放大。原路径可预览时保留路径，不能预览时使用拖入的照片，并在保存活动时保留副本。取消表单不保存新副本。
3. 首张新照片会自动本地识别，也可点击“选图识别并填表”，或在已有照片上点击“识别并编辑”。识别期间可取消，关闭表单会取消；迟到结果不会写入另一个表单。
4. OCR 只填空白的活动名称、举办单位、获奖等级、日期、分类或备注。手填内容不被覆盖。不确定的内容留空，必须核对后保存。展开“查看或纠正识别原文”可修正文字，再填写空白项。
5. 桌面“导出 CSV 与附件（ZIP）”同时包含原件、已存照片副本和旧附件。完整 JSON 备份包含已存副本及路径引用；路径本身不能保护外部原文件。

Restart the updated desktop launcher, open an activity and drop a photo. Click its thumbnail to enlarge it. Readable original paths stay as references; a photo that cannot be previewed from its path is retained as a copy when the activity is saved. Canceling the form does not persist new copies. The first new photo starts recognition automatically; the photo picker or a saved photo's edit action can also start it. Only empty fields are filled. Review all extracted information before saving. Closing/canceling recognition prevents stale results from editing a later form. ZIP exports include actual evidence and stored copies; JSON backups include stored copies and references.

## 系统与识别范围 / Requirements and extraction

本地 OCR 使用 **Windows 10/11 内置 Windows.Media.Ocr**，不接入教材 API、不需要密钥、不上传图片，也不随项目下载 OCR 模型。需已安装可用的 OCR 语言组件，优先简体中文。缺少组件时会提示在 Windows 语言设置添加“光学字符识别”；组件安装需要系统提供的下载能力。识别固定使用系统 Windows PowerShell 5.1；脚本执行策略参数仅对该子进程生效，不修改用户或计算机策略，组织强制策略仍可能阻止运行。

识别对象为清晰照片/截图中的印刷体文字。解析支持常见中英文字段标记、合法日期和明确奖级，不推断学号、姓名或综测分值。分类只在尚未手动选择时自动调整。手写、复杂海报、缺失字段和不清晰图片可能无法准确解析。识别原文仅保留在当前表单内存，不自动写入活动、备份或日志。备注只在识别出明确备注内容且该字段为空时填写。

OCR uses **Windows.Media.Ocr on Windows 10/11**, with an installed language component, preferring Simplified Chinese. No API key, remote recognition service or bundled model is used. A missing component produces an installation hint; Windows may need a network connection to install that component. The fixed helper uses system Windows PowerShell 5.1 with a process-only execution-policy argument, without changing machine/user policy. Organization-enforced restrictions may still prevent execution. Browser mode supports photo previews/copies and draft transfer, while automatic OCR requires the Windows desktop app.

The parser recognizes explicit Chinese/English activity labels, valid dates and clear award descriptions. It does not infer student identity or credit scores. Category may change only while its default has not been manually selected. Handwriting, unclear images and complex layouts may not parse correctly. Recognition text stays in form memory unless explicitly entered into activity fields. Treat extracted fields as a draft requiring review.

## 存储与限制 / Storage and limits

- 每项活动最多 10 份证明，照片副本只计一份；每份已存照片最多 20 MiB，与教材及旧附件共享 120 MiB 上限。
- 缩略图使用内存中的缩放图，保存副本保留原文件字节。原生预览支持可解码的 PNG、JPEG、WebP、GIF、BMP、AVIF；原生无法解码但浏览器能预览的格式（例如 SVG）可作为副本，SVG 识别前本地栅格化。动画只识别当前静态画面。
- 预览解码上限 4,000 万像素；原生预览最长边 1,800 像素，识别最长边 2,600 像素。本地 OCR 最长运行两分钟，可手动取消。**此限制不影响学校教材 API 请求；教材生成仍无应用主动超时。**
- 只有路径而原文件已删除、且没有已存副本时，应用不能自动恢复原文件。点击失效照片后重新选择原件即可改存副本。外部原文件发生变化后可重开应用刷新预览。

Each activity permits 10 proof items. A stored photo is limited to 20 MiB; all stored copies and textbooks share 120 MiB. Copies preserve original bytes, while previews use temporary scaled images. Native decoding supports the listed raster formats; browser-previewable fallback formats such as SVG can be copied and rasterized locally for recognition. Decoding is limited to 40 million pixels; preview and OCR longest edges are 1,800 and 2,600 pixels. Local OCR has a two-minute limit and manual cancellation. **School textbook API generation keeps its existing behavior without an application-imposed deadline.** Deleted path-only originals require reselection; they cannot be reconstructed from path text. Restart to refresh externally changed originals.

## 验证 / Verification

`tests/record-ocr.test.cjs` 检查字段解析、空缺与非法日期；`tests/desktop-photos.test.cjs` 使用隔离配置与合成照片，验证真实系统 OCR（若已安装语言组件）、原路径预览、内存/SVG 副本、手填保护、迟到结果隔离、备份和 ZIP 字节；`tests/photo-browser.test.cjs` 验证浏览器照片、迁移草稿和 390/1,440 像素表单。测试不读取真实用户资料。Windows CI 无语言组件时仅跳过真实识别断言并显示原因，其余流程仍执行。本机已额外完成简体中文合成证书的真实识别。

The parser and isolated desktop/browser tests cover extraction boundaries, real system OCR when its language component exists, path previews, fallback copies, field preservation, stale-result protection, transfer, backups and exact ZIP bytes. CI explicitly reports a missing Windows language component and still runs the remaining checks. A real Simplified Chinese synthetic certificate was also recognized locally; this does not establish accuracy for every certificate layout.
