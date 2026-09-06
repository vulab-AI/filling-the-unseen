# Filling the Unseen — ACM MM 2026

《Filling the Unseen: Scene Extrapolation via 3D Gaussian Splatting》的学术项目主页。

网站：https://vulab-ai.github.io/filling-the-unseen/

作者：Yunlai Zhou, Yiren Lu, Tuo Liang, Disheng Liu, Vipin Chaudhary, Yu Yin。单位：Case Western Reserve University。

这是项目**网站源码**。论文算法的研究代码尚未在此仓库发布。

## 本地预览

需要 Node.js 20 或更高版本。页面本身是原生 HTML/CSS/JavaScript，没有运行时依赖。

```bash
npm run dev
```

打开 http://localhost:4173 。也可以直接打开 `index.html`；复制到剪贴板等浏览器功能推荐通过本地服务器使用。

```bash
npm test             # 资源、页面链接、PDF、视频等基本检查
npm run build        # 生成 dist/ 部署目录
npm run preview      # 预览 dist/
```

浏览器检查需安装开发依赖和 Chrome：

```bash
npm ci
npm run dev          # 一个终端中运行
npm run test:browser # 另一个终端中运行
```

检查覆盖桌面/移动端布局、全部场景/方法、键盘/触屏滑块、图表放大、指标切换、BibTeX 复制、视频播放/跳转和 WCAG 无障碍。截图保存在 `.work/screenshots/`（不提交）。

## 内容与维护

| 文件 | 用途 |
| --- | --- |
| `index.html` | 作者、摘要、方法、实验表格、BibTeX、搜索/分享元数据 |
| `site-config.js` | Paper、arXiv、研究代码、网站源码链接 |
| `app.js` | 场景/视角/方法数据及交互 |
| `styles.css` | 页面视觉与手机适配 |
| `assets/results/` | 从论文 PDF 提取的原始 JPEG 结果图 |
| `assets/figures/` | 方法图、完整对比图和原始 figure PDF |
| `assets/paper/filling-the-unseen.pdf` | 从用户提供的 arXiv 源文件编译的论文 |
| `assets/video/supplementary.mp4` | 投稿补充视频，开启 MP4 fast-start |

有 arXiv 页面或研究代码仓库后，填写 `site-config.js` 对应字段即可显示按钮；留空则隐藏。不把网站源码仓库冒充研究代码。更改论文下载路径时也请同步 `index.html` 中的静态 Paper 链接及 `citation_pdf_url`，以便无 JavaScript 场景和搜索引擎正常访问。

如需更改网站域名，修改 `index.html` 的 canonical、Open Graph、`citation_pdf_url` 和 `site-config.js` 的 URL；`npm run build` 会据此更新 sitemap。

论文引用中的 DOI 来自正式稿：`10.1145/3767308.3835425`。部署时 DOI 尚未解析出正式出版页，因此 Paper 按钮使用本站 PDF。未猜测 arXiv 编号、出版页码或研究代码地址。

## GitHub Pages

GitHub 仓库 Settings → Pages → Build and deployment 使用 **GitHub Actions**。提交到 `main` 后，`.github/workflows/pages.yml` 会检查、构建并自动部署 `dist/`。

部署目录仅包含页面和公共素材。原始 ZIP、论文 LaTeX 源码、根目录原视频、本地工具、截图、Node 开发依赖均不提交、不部署。本地预览服务器也只允许访问网站公共文件。

## 素材与学术内容来源

- 标题、六位作者、作者顺序、单位、通讯作者、会议、DOI 和正式稿 PDF：用户提供的 `arxiv_submission.zip`。
- 结果图、补充场景以及实验表格：用户提供的 `_ACM_MM26_Yunlai__Scene_Interpolation_and_Extrapolation.zip`，主表数字与正式稿交叉核对。
- 完整视频：用户提供的 `2911_Filling_the_Unseen_Holist_SUPP_VIDEO.mp4`，时长约 71 秒，1080p，无音轨。保留视频内的原有方法标签和额外后处理说明。
- 作者个人链接：参考作者已公开的 [BARD-GS 项目页](https://vulab-ai.github.io/BARD-GS/)。没有确认的作者主页不添加链接。
- 布局参考用户指定的 [View-consistent Object Removal in Radiance Fields](https://yiren-lu.com/project_pages/view-consistent_object_removal_in_radiance_fields/)，页面 HTML/CSS/JS 为重新实现，没有引入第三方模板脚本或追踪代码。
- Manrope 字体由本站托管，许可见 `assets/fonts/OFL.txt`。

所有结果图都是论文里的真实图像，未使用 AI 生成、修图或超分。`scripts/extract-assets.py` 直接导出嵌入式 JPEG，不重新编码；部分 PDF 包含被遮挡的旧图层，脚本按最终可见图层选择结果。图像导出记录保存在本地 `.work/asset-provenance.json`。

复现素材导出需要将首个 ZIP 解压到 `.paper-source/`，安装 PyMuPDF、Poppler，然后运行 `python scripts/extract-assets.py`。已有素材齐全时无需执行。分享预览图可用 `node scripts/social-preview.mjs` 生成。

正式稿编译只对工作副本增加了 `\PassOptionsToPackage{table}{xcolor}`，解决 acmart 与 xcolor 的加载选项冲突；原始 ZIP 与原始 LaTeX 内容保留不变。编译工具为 Tectonic 0.17.0（XeLaTeX），PDF 为 10 页；字体和原有排版警告未阻止输出。

论文/论文图像依据正式稿采用 CC BY 4.0。字体遵循其单独许可。网站实现没有替作者额外声明研究代码开源许可。
