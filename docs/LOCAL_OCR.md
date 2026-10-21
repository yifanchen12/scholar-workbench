# 照片预览与本地 OCR / Photo preview and local OCR

## 使用 / Usage

1. 重开新版“启动桌面工作台.cmd”，进入综测记录台，点击记录活动。旧窗口需重开才能载入新桌面桥接。
2. 点击“选择保存文件夹”设置一次目录，之后拖入或 Ctrl+V 粘贴照片会立即保存到该目录；也可点击“粘贴照片”，首次可直接选目录。文件名独立，不覆盖原件；取消活动或移除引用保留目录里已保存的照片。更改目录后，新照片写入新位置，旧引用仍指向旧位置。未设目录时原有磁盘照片引用流程继续可用。
3. 首张新照片会自动本地识别，也可点击“选图识别并填表”，或在已有照片上点击“识别并编辑”。识别期间可取消，关闭表单会取消；迟到结果不会写入另一个表单。
4. OCR 只填空白的活动名称、举办单位、获奖等级、日期、分类或备注。手填内容不被覆盖。不确定的内容留空，必须核对后保存。展开“查看或纠正识别原文”可修正文字，再填写空白项。
5. 桌面“导出 CSV 与附件（ZIP）”同时包含原件、已存照片副本和旧附件。完整 JSON 备份包含已存副本及路径引用；路径本身不能保护外部原文件。

Restart the updated desktop launcher and choose a photo folder once. Subsequent dropped/pasted photos are saved there immediately with unique names; the paste button can prompt for the initial folder. Canceling an activity or removing a reference leaves saved files intact. New photos follow a changed folder preference; existing references keep their paths. Normal readable folder photos are referenced without an extra IndexedDB copy. A format that cannot be previewed by path may still retain a browser copy with the saved activity. Click thumbnails to enlarge. The first photo starts OCR automatically. Review fields before saving. Closing/canceling recognition prevents stale results from editing a later form. ZIP exports contain actual evidence and copies; JSON backups contain stored browser copies and references, not external folder-photo bytes.

## 分类 / Classification

分类采用用户更正后提供的《北京邮电大学人工智能学院2025级本科生综合素质评价办法实施细则（2025-2026学年）》的发展素质六项：思想成长、学术创新、身心健康、美育素养、劳动素养、组织协调能力，另有“其他”。记录活动级别（年/院/校/市/国家或相应范围）；学术创新中的竞赛可另填 S/A+/A/B+/B 级，均可留待确认。表单、筛选、JSON备份和 CSV/ZIP导出保持一致，旧分类不强制改写。文件认定期为2025-08-21至2026-09-13（含）；应用继续允许跨学年记录，不自动推断赛事档位、不自动计算或认定分数。

Categories use the corrected AI School 2025-cohort comprehensive-evaluation rules for 2025–2026: ideological growth, academic innovation, physical/mental health, aesthetic education, labor literacy and organizational coordination, plus Other. Organizational activity level and academic-competition tier (S/A+/A/B+/B) are optional and preserved by forms, filters, backup and CSV/ZIP. Legacy categories remain available. The document's recognition period is 2025-08-21 through 2026-09-13 inclusive; the app accepts records outside that period for other academic years. It neither guesses competition tiers nor computes/certifies scores.

## 系统与识别范围 / Requirements and extraction

本地 OCR 使用 **Windows 10/11 内置 Windows.Media.Ocr**，不接入教材 API、不需要密钥、不上传图片，也不随项目下载 OCR 模型。需已安装可用的 OCR 语言组件，优先简体中文。缺少组件时会提示在 Windows 语言设置添加“光学字符识别”；组件安装需要系统提供的下载能力。识别固定使用系统 Windows PowerShell 5.1；脚本执行策略参数仅对该子进程生效，不修改用户或计算机策略，组织强制策略仍可能阻止运行。

识别对象为清晰照片/截图中的印刷体文字。解析支持常见中英文字段标记、合法日期和明确奖级，不推断学号、姓名或综测分值。分类只在尚未手动选择时自动调整。手写、复杂海报、缺失字段和不清晰图片可能无法准确解析。识别原文仅保留在当前表单内存，不自动写入活动、备份或日志。备注只在识别出明确备注内容且该字段为空时填写。

OCR uses **Windows.Media.Ocr on Windows 10/11**, with an installed language component, preferring Simplified Chinese. No API key, remote recognition service or bundled model is used. A missing component produces an installation hint; Windows may need a network connection to install that component. The fixed helper uses system Windows PowerShell 5.1 with a process-only execution-policy argument, without changing machine/user policy. Organization-enforced restrictions may still prevent execution. Browser mode supports photo previews/copies and draft transfer, while automatic OCR requires the Windows desktop app.

The parser recognizes explicit Chinese/English activity labels, valid dates and clear award descriptions. It does not infer student identity or credit scores. Category may change only while its default has not been manually selected. Handwriting, unclear images and complex layouts may not parse correctly. Recognition text stays in form memory unless explicitly entered into activity fields. Treat extracted fields as a draft requiring review.

## 存储与限制 / Storage and limits

- 每项活动最多 10 份证明，照片副本只计一份；每次新增照片最多20 MiB。浏览器内保存的副本与教材及旧附件共享120 MiB上限，外部文件夹照片不占该配额。
- 缩略图使用内存中的缩放图，保存副本保留原文件字节。原生预览支持可解码的 PNG、JPEG、WebP、GIF、BMP、AVIF；原生无法解码但浏览器能预览的格式（例如 SVG）可作为副本，SVG 识别前本地栅格化。动画只识别当前静态画面。
- 预览解码上限 4,000 万像素；原生预览最长边 1,800 像素，识别最长边 2,600 像素。本地 OCR 最长运行两分钟，可手动取消。**此限制不影响学校教材 API 请求；教材生成仍无应用主动超时。**
- 只有路径而原文件已删除、且没有已存副本时，应用不能自动恢复原文件。点击失效照片后重新选择原件即可改存副本。外部原文件发生变化后可重开应用刷新预览。

Each activity permits 10 proof items and each newly saved photo is at most 20 MiB. IndexedDB copies and textbooks share 120 MiB; external folder photos do not consume that quota. Dropped file copies preserve original bytes; the native paste button encodes clipboard bitmaps as PNG. Previews use temporary scaled images. Native decoding supports the listed raster formats; browser-previewable fallback formats such as SVG can be copied and rasterized locally for recognition. Decoding is limited to 40 million pixels; preview and OCR longest edges are 1,800 and 2,600 pixels. Local OCR has a two-minute limit and manual cancellation. **School textbook API generation keeps its existing behavior without an application-imposed deadline.** Deleted path-only originals require reselection; they cannot be reconstructed from path text. Restart to refresh externally changed originals.

## 验证 / Verification

`tests/photo-storage.test.cjs` 与 `tests/desktop-photo-folder.test.cjs` 额外验证目录持久化、取消选择、粘贴按钮、图片粘贴事件、磁盘字节、不覆盖、普通文字粘贴、六类/级别、旧分类及筛选后ZIP。剪贴板读取器和粘贴事件使用合成数据，不读取或修改真实剪贴板。/ Additional storage/native tests verify folder persistence, canceled selection, paste controls/events, exact file bytes, safe names, text paste, category/level round trips, legacy categories and filtered ZIP. Clipboard fixtures are synthetic; tests do not read or modify the real clipboard.

`tests/record-ocr.test.cjs` 检查字段解析、空缺与非法日期；`tests/desktop-photos.test.cjs` 使用隔离配置与合成照片，验证真实系统 OCR（若已安装语言组件）、原路径预览、内存/SVG 副本、手填保护、迟到结果隔离、备份和 ZIP 字节；`tests/photo-browser.test.cjs` 验证浏览器照片、迁移草稿和 390/1,440 像素表单。测试不读取真实用户资料。Windows CI 无语言组件时仅跳过真实识别断言并显示原因，其余流程仍执行。本机已额外完成简体中文合成证书的真实识别。

The parser and isolated desktop/browser tests cover extraction boundaries, real system OCR when its language component exists, path previews, fallback copies, field preservation, stale-result protection, transfer, backups and exact ZIP bytes. CI explicitly reports a missing Windows language component and still runs the remaining checks. A real Simplified Chinese synthetic certificate was also recognized locally; this does not establish accuracy for every certificate layout.
