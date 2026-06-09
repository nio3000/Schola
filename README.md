# Schola

**面向高校科研人员、教育工作者与研究生的本地优先知识工作台。**

Schola 是一个桌面端学术知识管理环境。它以本地 Markdown Vault 为底座，将文献、笔记、资料编译为结构化知识页，打通从材料收集到写作输出的完整科研工作流。

> **本地优先，数据主权归你。** 所有数据存储于本地文件系统，不依赖云服务，不上传任何内容。

---

## 设计理念

Schola 遵循三条核心原则：

- **本地优先** — Markdown 文件保存在用户本地，可脱离 Schola 直接用任意编辑器访问
- **数据主权** — 默认不上传用户内容；远程 AI 调用须用户明确配置并逐次确认
- **渐进增强** — 图谱、文献导入、AI 辅助均为增强层，不绑定底座

长期愿景是为科研与教学构建一个完整闭环：

```
本地资料 → Markdown 笔记 → 双向链接 → 知识组织 → 写作辅助 → 文档输出
```

在此之上，Schola 规划了五层能力架构：

| 层 | 定位 |
|---|------|
| **Knowledge Compiler** | 把文献、资料、笔记编译成结构化 Markdown 知识页 |
| **LLM Wiki / Memory Tree** | 管理科研与教学知识结构，支持 Ingest / Query / Lint |
| **Multimodal Artifact** | 信息图、图文混排、教学图解、视觉草稿 |
| **PPT Artifact Exporter** | 可编辑 PPTX 课件与汇报材料生成 |
| **官方功能模块** | 科研写作、文献综述、课件生成、闪卡测验、本地知识库问答 |

当前版本提供了上述愿景的核心基础设施。

---

## 当前能力

**编辑与预览**
- CodeMirror 6 Markdown 编辑器，支持实时预览与左右分屏
- 自定义字体、字号、行距，实时生效
- marked + DOMPurify + highlight.js + KaTeX 渲染引擎

**知识组织**
- `[[wikilink]]` 自动解析，显示反向链接与未链接提及
- 基于文件链接的可视化知识图谱（力导向 / 层级布局）
- SQLite 全文索引，支持中文分词与正则搜索

**文献导入**
- PDF 拖入即导入，自动提取文本并转为 Markdown
- BaselinePaperEngine + pdfjs-dist 5.7，纯 JavaScript 实现
- 不依赖 Python、PyMuPDF4LLM、Marker、网络或子进程

**工作台**
- 活动栏 + 侧栏 + 编辑器 + 预览 + 底部面板 + 状态栏
- 8 种全局应用主题（深色 / 暖色 / 浅色 / 纸张 / 高对比度）
- 4 种 Markdown 内容主题（GitHub / Schola 风格）
- 面板拖拽调整、文件树、标签页管理
- 文件增删改移，自动监听外部变更

**安全架构**
- `contextIsolation: true`，`nodeIntegration: false`
- preload 白名单 API，不暴露 `ipcRenderer`
- 文件路径经 path-guard 限在 Vault 根目录
- SQL 参数化查询，Preview 经 DOMPurify 消毒

---

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Electron 42 |
| 前端 | React 18 + TypeScript 5 + Vite |
| 样式 | Tailwind CSS |
| 编辑器 | CodeMirror 6 |
| Markdown 渲染 | marked + DOMPurify + highlight.js + KaTeX |
| 存储 | `node:sqlite` + 本地文件系统 |
| 文件监听 | chokidar |
| 论文导入 | pdfjs-dist 5.7 |
| 格式化 | Prettier |
| 代码检查 | ESLint + typescript-eslint |
| 测试 | Vitest（单元）+ Playwright（E2E） |

---

## 快速开始

### 环境要求

- Windows 10+（x64）
- Node.js 18+
- 无需 Python、无需网络

### 开发

```bash
npm install            # 安装依赖
npm run dev            # 启动开发模式（Vite + Electron）
npm run typecheck      # 类型检查
npm run build          # 构建
npx vitest run         # 运行单元测试
npm run test:e2e       # 运行 E2E 测试
npm run package        # 打包 Windows 安装包
```

---

## 项目结构

```
electron/         主进程 — IPC handler、业务服务、安全守卫、SQLite schema
src/              渲染进程 — React 组件、hooks、类型契约
  features/       功能模块
    vault/        知识库打开、扫描、文件树
    editor/       CodeMirror 编辑器
    preview/      Markdown 预览与内容主题
    wiki/         wikilink 解析、反向链接
    search/       全文搜索
    workspace/    工作台布局
    theme/        全局主题切换
    graph/        知识图谱
    import-export/ 导入导出
    settings/     设置中心
  lib/            类型契约、平台 API 封装
tests/            单元测试（Vitest）+ E2E 测试（Playwright）
docs/             设计文档
```

---

## 产品边界

Schola 当前版本不追求：

- 插件生态与第三方市场
- 多人实时协作
- 多端云同步
- 一键生成完整论文
- 完整替代 Zotero、PowerPoint、Obsidian 或 Notion

---

## 许可

Copyright 2026 Schola

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
