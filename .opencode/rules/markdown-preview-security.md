## Preview 模块

目标：
提供接近专业 Markdown 编辑器的阅读体验。

核心功能：
1. Markdown 基础渲染；
2. 标题、列表、表格、代码块、引用显示；
3. mweb-themes 内置预览主题切换；
4. 默认内置 typo、vue、lark、bear-default 四个主题；
5. 后续支持用户自定义 CSS；
6. Phase 2 后支持 KaTeX 与 Mermaid；
7. Preview CSS 与应用 UI 样式隔离。

验收标准：
1. Markdown 基础格式显示正常；
2. 可在至少 4 个内置主题之间切换；
3. 切换主题不影响编辑器内容；
4. 主题 CSS 不污染 Schola 主界面；
5. Markdown 预览不会执行危险脚本；
6. 主题许可证信息保留完整。