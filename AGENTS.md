```markdown
# Schola 项目全局指令

## 项目定位
Schola 是一个面向高校科研人员、教师和研究生的本地优先知识工作台。
核心目标是：本地 Markdown 知识库、双向链接、反向链接、搜索、知识组织和后续 AI 辅助写作。

## 当前冻结路线
先完成本地知识库底座，再做 AI、PPT、文献导入和学术增强。

## 技术栈
- Electron + Node.js
- React 18 + TypeScript 5
- Zustand
- CodeMirror 6
- Tailwind CSS
- better-sqlite3
- chokidar
- Vitest + Playwright
- Phase 3 后可接入 OpenAI Compatible API / Ollama / Python 子进程

## 当前 MVP 范围
MVP 只做：
1. Vault 打开与扫描；
2. Markdown 文件树；
3. Markdown 编辑与保存；
4. Markdown 预览；
5. `[[wikilink]]` 识别；
6. 反向链接；
7. SQLite 索引；
8. 基础搜索；
9. 亮色 / 暗色主题；
10. 核心 E2E 测试。

MVP 不做：
1. AI 深度解析；
2. 一键论文生成；
3. PPT 自动生成；
4. 期刊推荐；
5. 前沿哨兵；
6. 插件系统；
7. 多人协作；
8. 多端同步。

## Agent 团队
- architect：系统架构师，负责设计方案、接口契约、阶段边界。
- frontend：前端开发，负责 React、编辑器、预览、文件树、反向链接、搜索 UI。
- backend：后端与原生层，负责 Electron、IPC、文件系统、SQLite、文件监听。
- review：只读代码评审，负责安全、架构、逻辑 bug 审查。
- test：测试工程师，负责验收清单、单元测试、E2E 测试。

## 强制工作流
1. 大功能必须先由 architect 输出设计方案。
2. 接口必须先写 contract，再实现。
3. test 必须在实现前给出验收清单。
4. frontend/backend 按 contract 实现，不得互相越界。
5. review 只读审查，不得修改文件。
6. test 执行测试并补充回归用例。
7. 每个阶段结束必须复盘。

## 安全硬规则
- Electron 必须启用 contextIsolation。
- Electron 必须禁用 nodeIntegration。
- preload 不得暴露 ipcRenderer 原对象。
- IPC 必须白名单。
- IPC 入参必须校验。
- 文件路径必须限制在 Vault 根目录。
- SQL 必须参数化。
- Markdown 预览必须防 XSS。
- 远程 AI 默认关闭。
- AI 输出不得自动覆盖用户原文。

## 开发硬规则
- 禁止无设计方案直接开发大功能。
- 禁止无 contract 修改前后端接口。
- 禁止无测试合并核心功能。
- 禁止引入大型依赖而不说明理由。
- 禁止在当前 Phase 外扩展功能。
- 禁止用假数据冒充真实功能完成。
- 禁止隐藏报错。
- 禁止把安全检查留到最后。
```

---

