# Third-party notices / 第三方许可与来源

The root MIT license covers original application code and authored teaching material, subject to the exclusions below. It does not replace third-party licenses, user-file rights or service terms. / 根目录 MIT 适用于原创代码与自编材料，以下部分例外；不能代替第三方许可、用户文件权利或服务条款。

## PDF.js and bundled components

`vendor/pdfjs/` contains the distributed assets of **PDF.js 5.6.205**, from Mozilla's `pdfjs-dist`. PDF.js is Apache-2.0 licensed. Source and upstream project: [mozilla/pdf.js](https://github.com/mozilla/pdf.js), [distribution](https://github.com/mozilla/pdfjs-dist). The following upstream license files are preserved unmodified in the repository:

- [PDF.js Apache-2.0](vendor/pdfjs/LICENSE).
- [Adobe CMap terms](vendor/pdfjs/cmaps/LICENSE).
- [Foxit standard-font terms](vendor/pdfjs/standard_fonts/LICENSE_FOXIT).
- [Liberation/Arimo/Tinos/Cousine font terms](vendor/pdfjs/standard_fonts/LICENSE_LIBERATION), including SIL Open Font License and reserved-name conditions.
- [JBIG2](vendor/pdfjs/wasm/LICENSE_JBIG2), [OpenJPEG](vendor/pdfjs/wasm/LICENSE_OPENJPEG), [QCMS](vendor/pdfjs/wasm/LICENSE_QCMS).
- PDF.js integration notices: [JBIG2](vendor/pdfjs/wasm/LICENSE_PDFJS_JBIG2), [OpenJPEG](vendor/pdfjs/wasm/LICENSE_PDFJS_OPENJPEG), [QCMS](vendor/pdfjs/wasm/LICENSE_PDFJS_QCMS).

These components and font files keep their own terms; they are not MIT-relicensed. Retain their attribution and license files when redistributing. / 这些组件与字体保留自身许可，分发时保留声明，不能重新标为 MIT。

## Optical Recognition of Handwritten Digits

The browser digit classifier and numerical reference fixtures use/adapt the 8×8 digit samples available through scikit-learn's `load_digits`, sourced from:

**Alpaydin, E. and Kaynak, C. (1998). Optical Recognition of Handwritten Digits. UCI Machine Learning Repository. DOI: [10.24432/C50P49](https://doi.org/10.24432/C50P49).** Dataset license: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

Affected data/model artifacts include `digits-model.js`, `tests/digits-reference.json` and the dataset-derived training report. The original JavaScript/Python implementation remains MIT; redistributed dataset-derived sample arrays, fitted model data and dataset-derived reference values are distributed under CC BY 4.0 with this attribution. Transformations include 8×8 representation, scaling, deterministic splitting, softmax fitting and exported probabilities; there is no endorsement by the data creators. Details: [数字分类模型说明](docs/数字分类模型说明.md).

数字分类模型及数值参考使用上述 UCI 数据的 8×8 版本，经缩放、拆分、模型拟合与概率导出。原创程序为 MIT，派生样本数组、模型数据、参考数值按 CC BY 4.0 分发并保留署名；不表示数据作者背书。

## Authored PDFs and embedded fonts

The shipped exercise PDFs contain original educational text and subset-embedded fonts. Original text is MIT licensed; embedded fonts retain their respective rights and are not separately licensed for extraction, application bundling or redistribution by this project. The Windows PDF builders use locally installed Microsoft YaHei and do not ship the source Windows font files. Follow [Microsoft's font embedding guidance](https://learn.microsoft.com/en-us/typography/fonts/font-faq) and the installed font's embedding permissions when rebuilding.

练习 PDF 的自编文字按 MIT 发布，嵌入字体保留其权利，不单独授予提取、应用打包或再分发字体的权利。Windows 构建脚本使用本机已安装的微软雅黑，不分发 Windows 源字体文件；重新构建须遵循嵌入规则与字体权限。

## Optional tools and external services

PyTorch, scikit-learn, Playwright and PDF-building tools are optional development/practice dependencies, not part of the application's installed runtime. Their upstream licenses apply when installed. DeepSeek or a user-configured compatible school/provider gateway is an external service accessed with the user's credentials; its account terms, billing and privacy policies are independent of this repository's license. Linked papers and courses are references, not republished course contents.

PyTorch、scikit-learn、Playwright、PDF 构建工具为可选开发/实训依赖，不是主应用必装运行包；安装后适用各自上游许可。DeepSeek 或用户配置的学校/服务商接口，其账户、费用与隐私政策独立于项目许可。论文与课程链接仅为参考，不是全文再分发。
