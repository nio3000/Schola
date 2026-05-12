# Schola 可落地总体规划（冻结版 v1.0）

**项目名称**：Schola
**项目定位**：面向高校科研人员、教育工作者和研究生的本地优先知识工作台
**开发方式**：OpenCode 多 Agent 协作开发
**技术主线**：Electron + React + TypeScript + Markdown + SQLite + 可选 AI 增强

---

## 1. 项目定位

Schola 是一个面向高校科研人员、教师和研究生的本地优先知识工作台。它的核心价值不是替代所有工具，而是把科研与教学写作中的材料、笔记、知识关系和输出流程连接起来。

### 1.1 核心闭环

```text
本地资料 → Markdown 笔记 → 双向链接 → 知识组织 → 写作辅助 → 文档输出
```

### 1.2 产品边界

Schola 当前版本不追求：

1. 插件生态；
2. 多人实时协作；
3. 多端云同步；
4. 自动投稿；
5. 一键生成完整论文；
6. 完整替代 Zotero；
7. 完整替代 PowerPoint；
8. 完整替代 Obsidian / Notion。

### 1.3 核心设计原则

1. **本地优先**：Markdown 文件保存在用户本地，用户可以脱离软件直接访问。
2. **数据主权**：默认不上传用户内容，远程 AI 调用必须明确配置和确认。
3. **渐进增强**：AI、PPT、文献导入、图谱都是增强层，不是底座依赖。
4. **架构隔离**：前端、Electron 主进程、SQLite、Python 子进程、AI 服务必须分层。
5. **可验收开发**：每个阶段必须有明确完成标准，不能只写“实现某功能”。
6. **Agent 受控协作**：OpenCode Agent 必须按职责执行，不允许跨层乱改。

---

## 2. MVP 

### 2.1 MVP 目标

MVP 的唯一目标是验证：

> 用户是否可以稳定地使用 Schola 管理一个本地 Markdown 知识库，并通过 `[[wikilink]]` 和反向链接形成知识网络。

### 2.2 MVP 必须包含

| 模块           | 功能                      | 进入 MVP   |   |
| ------------ | ----------------------- | -------- | - |
| Vault        | 打开本地文件夹作为知识库            | 是        |   |
| File Tree    | 展示 Markdown 文件目录        | 是        |   |
| Editor       | Markdown 编辑             | 是        |   |
| Save         | 文件读取、保存、外部变更提示          | 是        |   |
| Preview      | Markdown 基础预览           | 是        |   |
| Wikilink     | 识别 `[[note]]` 与 `[[note\|alias]]` | 是 |
| Backlinks    | 显示当前笔记的反向链接             | 是        |   |
| SQLite Index | 保存文件索引、链接关系、搜索索引        | 是        |   |
| Search       | 标题和正文基础搜索               | 是        |   |
| Theme        | 应用亮色 / 暗色模式 + Markdown 预览主题切换           | 是        |   |
| Test         | 核心流程 Playwright E2E 测试  | 是        |   |

### 2.3 MVP 明确不包含

| 功能          | 暂缓原因                  |
| ----------- | --------------------- |
| AI 深度解析 PDF | 隐私、成本、准确率和复杂度高        |
| 一键论文生成      | 学术风险高，产品定位不稳          |
| PPT 自动生成    | 依赖 Python 子进程和模板系统，后置 |
| 期刊推荐        | 依赖外部数据库，不是底座能力        |
| 前沿哨兵        | 涉及定时检索和推荐逻辑，后置        |
| 闪卡测验        | 属于学习增强，不是科研知识库底座      |
| 插件系统        | 会显著放大架构和安全复杂度         |
| Web 版       | 当前只做本地桌面版，保留接口抽象      |

---

## 3. 总体技术路线

### 3.1 技术栈

| 层级     | 技术                              | 说明                           |
| ------ | ------------------------------- | ---------------------------- |
| 桌面外壳   | Electron + Node.js              | 访问本地文件系统、SQLite、子进程          |
| 前端框架   | React 18 + TypeScript 5         | 复杂交互与组件化开发                   |
| 状态管理   | Zustand                         | 轻量，适合模块化状态                   |
| 编辑器    | CodeMirror 6                    | Markdown 编辑、语法扩展、wikilink 扩展 |
| 样式     | Tailwind CSS                    | 快速构建稳定 UI                    |
| 预览     | Markdown 渲染器 + mweb-themes 预览主题 + KaTeX/Mermaid 后置 | MVP 先做基础 Markdown            |
| 数据索引   | better-sqlite3                  | 本地索引和链接关系，不保存唯一正文            |
| 文件监听   | chokidar                        | 监听外部文件变更                     |
| 测试     | Vitest + Playwright             | 单元测试 + E2E 测试                |
| 打包     | electron-builder                | Windows 优先，后续 macOS/Linux    |
| AI     | OpenAI Compatible / Ollama 抽象层  | Phase 3 后引入                  |
| Python | MarkItDown / ppt-master 桥接      | Phase 3 后通过 TaskRunner 引入    |

### 3.2 核心架构

```text
Schola Desktop App
│
├── Electron Main Process
│   ├── IPC Gateway
│   ├── VaultService
│   ├── FileService
│   ├── IndexService
│   ├── SearchService
│   ├── WatcherService
│   ├── TaskRunnerService      # Phase 3 后启用
│   └── AIProxyService         # Phase 3 后启用
│
├── Preload Layer
│   └── Safe ContextBridge API
│
├── React Renderer
│   ├── Layout
│   ├── FileTree
│   ├── MarkdownEditor
│   ├── PreviewPanel
│   ├── BacklinksPanel
│   ├── SearchPanel
│   ├── GraphPanel             # Phase 2 后启用
│   └── AIPanel                # Phase 3 后启用
│
├── Local Storage
│   ├── Markdown Files          # 用户真实数据
│   ├── Assets                  # 图片与附件
│   └── SQLite Index            # 可重建索引
│
└── Optional External Services
    ├── Remote AI API
    ├── Ollama Local Model
    ├── MarkItDown Python Task
    └── PPT Python Task
```

### 3.3 关键架构原则

1. React 组件不得直接调用 Node API。
2. React 组件不得直接使用 `window.electronAPI`，必须通过 hooks/service 封装。
3. Electron 主进程负责文件、SQLite、系统能力。
4. Preload 只暴露受控 API，不暴露 `ipcRenderer` 原对象。
5. SQLite 只做索引，Markdown 文件是主数据源。
6. AI 和 Python 是可选增强层，不能阻塞基础知识库使用。

---

## 4. 目录结构

```text
schola/
├── .opencode/
│   ├── opencode.json
│   ├── agents/
│   │   ├── architect.md
│   │   ├── frontend.md
│   │   ├── backend.md
│   │   ├── review.md
│   │   └── test.md
│   ├── rules/
│   │   ├── code-style.md
│   │   ├── electron-security.md
│   │   ├── react-rules.md
│   │   ├── ipc-contracts.md
│   │   ├── testing-rules.md
│   │   └── opencode-bug-guard.md
│   ├── plans/
│   ├── reviews/
│   └── tasks/
│
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── ipc/
│   │   ├── vault.ipc.ts
│   │   ├── file.ipc.ts
│   │   ├── index.ipc.ts
│   │   ├── search.ipc.ts
│   │   ├── system.ipc.ts
│   │   ├── ai.ipc.ts              # Phase 3
│   │   └── task.ipc.ts            # Phase 3
│   ├── services/
│   │   ├── vault.service.ts
│   │   ├── file.service.ts
│   │   ├── index.service.ts
│   │   ├── search.service.ts
│   │   ├── watcher.service.ts
│   │   ├── task-runner.service.ts # Phase 3
│   │   └── ai-proxy.service.ts    # Phase 3
│   ├── security/
│   │   ├── path-guard.ts
│   │   ├── ipc-validators.ts
│   │   └── markdown-sanitizer.ts
│   └── db/
│       ├── sqlite.ts
│       ├── migrations/
│       └── schema.ts
│
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── routes.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── ui/
│   │   └── layout/
│   ├── features/
│   │   ├── vault/
│   │   ├── editor/
│   │   ├── preview/
│   │   ├── backlinks/
│   │   ├── search/
│   │   ├── graph/                # Phase 2
│   │   ├── ai/                   # Phase 3
│   │   ├── import/               # Phase 3
│   │   ├── export/               # Phase 4
│   │   ├── ppt/                  # Phase 4
│   │   └── themes/
│   ├── hooks/
│   ├── lib/
│   │   ├── contracts/
│   │   ├── markdown/
│   │   ├── wikilink/
│   │   ├── platform/
│   │   └── errors/
│   ├── store/
│   └── types/
│
├── python/                       # Phase 3 后启用
│   ├── markitdown_bridge.py
│   ├── ppt_bridge.py
│   └── requirements.txt
│
├── tests/
│   ├── unit/
│   ├── e2e/
│   └── fixtures/
│       └── sample-vault/
│
resources/
│  └── markdown-themes/
│    ├── mweb/
│    │   ├── mweb-typo.css
│    │   ├── mweb-vue.css
│    │   ├── mweb-lark.css
│    │   ├── mweb-bear-default.css
│    │   └── LICENSE-THIRD-PARTY.md
│    └── custom/
├── scripts/
├── package.json
├── tsconfig.json
├── electron-builder.yml
├── AGENTS.md
└── README.md
```

---

## 5. 核心数据模型

### 5.1 Markdown 文件是主数据

所有用户笔记都以 `.md` 文件形式存放在 Vault 中。SQLite 只保存索引，任何时候都可以删除并重建。

### 5.2 SQLite 表建议

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  title TEXT,
  slug TEXT,
  mtime INTEGER NOT NULL,
  size INTEGER NOT NULL,
  hash TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(vault_id, relative_path)
);

CREATE TABLE links (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  source_note_id TEXT NOT NULL,
  target_text TEXT NOT NULL,
  target_note_id TEXT,
  alias TEXT,
  line INTEGER,
  column INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE search_index (
  note_id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  title TEXT,
  content TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT,
  output_json TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### 5.3 数据模型原则

1. `notes.relative_path` 必须使用 Vault 内相对路径。
2. 不在数据库中保存唯一正文；`search_index.content` 是可重建索引。
3. 链接解析失败时允许 `target_note_id = NULL`，用于显示“未创建链接”。
4. 数据库损坏时，允许通过重新扫描 Vault 重建。
5. 所有数据库迁移必须走 migrations，不允许直接修改生产表结构。

---

## 6. IPC 接口契约

所有 IPC 必须先定义 TypeScript contract，再实现主进程和渲染进程调用。

### 6.1 Vault Contract

```typescript
export interface VaultInfo {
  id: string;
  name: string;
  rootPath: string;
  noteCount: number;
  openedAt: number;
}

export interface FileEntry {
  id: string;
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  children?: FileEntry[];
  mtime?: number;
  size?: number;
}

export interface VaultAPI {
  openVault(): Promise<VaultInfo>;
  scanVault(vaultId: string): Promise<FileEntry[]>;
  closeVault(vaultId: string): Promise<void>;
  getRecentVaults(): Promise<VaultInfo[]>;
}
```

### 6.2 File Contract

```typescript
export interface NoteContent {
  noteId: string;
  relativePath: string;
  content: string;
  mtime: number;
  hash: string;
}

export interface SaveNoteInput {
  vaultId: string;
  relativePath: string;
  content: string;
  expectedHash?: string;
}

export interface SaveNoteResult {
  ok: boolean;
  conflict?: boolean;
  newHash?: string;
  message?: string;
}

export interface FileAPI {
  readNote(vaultId: string, relativePath: string): Promise<NoteContent>;
  saveNote(input: SaveNoteInput): Promise<SaveNoteResult>;
  createNote(vaultId: string, relativePath: string, content?: string): Promise<NoteContent>;
  deleteNote(vaultId: string, relativePath: string): Promise<void>;
  renameNote(vaultId: string, oldPath: string, newPath: string): Promise<void>;
}
```

### 6.3 Link Contract

```typescript
export interface Wikilink {
  raw: string;
  target: string;
  alias?: string;
  line: number;
  column: number;
}

export interface BacklinkItem {
  sourceNoteId: string;
  sourceTitle: string;
  sourcePath: string;
  excerpt: string;
  line: number;
}

export interface LinkAPI {
  parseLinks(content: string): Promise<Wikilink[]>;
  reindexNote(vaultId: string, relativePath: string): Promise<void>;
  getBacklinks(vaultId: string, noteId: string): Promise<BacklinkItem[]>;
  getOutgoingLinks(vaultId: string, noteId: string): Promise<Wikilink[]>;
}
```

### 6.4 Search Contract

```typescript
export interface SearchQuery {
  vaultId: string;
  query: string;
  limit?: number;
}

export interface SearchResult {
  noteId: string;
  title: string;
  relativePath: string;
  excerpt: string;
  score: number;
}

export interface SearchAPI {
  searchNotes(input: SearchQuery): Promise<SearchResult[]>;
}
```

### 6.5 IPC 安全要求

1. 所有 IPC 入参必须校验。
2. IPC channel 必须固定白名单。
3. 不允许动态 channel 名称。
4. 不允许从前端传入绝对路径直接执行文件操作。
5. 前端只传 `vaultId` 和 `relativePath`，路径拼接由主进程完成。
6. 每个 IPC handler 必须捕获异常并返回规范错误。

---

## 7. 安全规划

### 7.1 Electron 安全

必须执行：

```typescript
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    preload: preloadPath,
  },
});
```

禁止事项：

1. 禁止在渲染进程开启 Node 能力。
2. 禁止暴露 `ipcRenderer` 原对象。
3. 禁止暴露通用 `send(channel, data)`。
4. 禁止前端直接访问 `fs`、`path`、`child_process`。
5. 禁止在 preload 中开放任意文件路径操作。

### 7.2 文件系统安全

必须执行：

1. 所有路径都必须转换为 Vault 根目录下的绝对路径。
2. 使用 `path.resolve(root, relativePath)` 后，必须检查结果是否仍在 root 内。
3. 禁止 `../` 路径逃逸。
4. 删除文件必须二次确认。
5. 写文件时优先采用临时文件 + 原子替换策略。
6. 保存时检查 hash，避免外部修改被覆盖。

### 7.3 Markdown 渲染安全

1. 默认禁用危险 HTML。
2. 禁止执行 `<script>`。
3. 外链点击通过系统浏览器打开，不在 Electron 内直接跳转未知页面。
4. 本地图片必须限制在 Vault 或授权目录内。
5. Mermaid 后置，并进行渲染隔离。

### 7.4 mweb-themes 主题 CSS 安全；

1. 只复制发布包中的 CSS 文件。
2. 不运行 mweb-themes 的构建脚本。
3. 不把 mweb-themes 作为运行时 npm 依赖。
4. 预览内容必须挂载在 .schola-markdown-preview 容器内。
5. 外部主题 CSS 必须加选择器前缀，避免污染 Schola 应用 UI。
6. 主题 CSS 不得访问 Vault 外部本地资源。
7. 必须保留第三方许可证说明。

### 7.5 SQLite 安全

1. 所有 SQL 使用参数化。
2. 禁止拼接用户输入。
3. 数据库文件放在应用数据目录，不放入用户 Vault，除非用户明确选择。
4. 索引可重建，不能成为唯一数据来源。
5. 数据库迁移必须可回滚或可重建。

### 7.6 AI 隐私安全

Phase 3 后启用 AI 时，必须遵守：

1. 默认关闭远程 AI。
2. 用户手动配置 API Key 后才能启用。
3. 发送前明确提示内容范围。
4. 支持“仅使用本地模型”模式。
5. AI 输出进入草稿区，不自动覆盖用户原文。
6. 日志不得保存完整敏感正文。
7. 涉及未发表论文、课题申报、学生材料时给出隐私提示。

### 7.7 Python 子进程安全

1. 前端不得直接调用 Python。
2. Python 任务统一由 TaskRunner 调用。
3. 子进程必须有超时、取消、日志和错误捕获。
4. 子进程输入输出路径必须通过 path guard。
5. 不允许 Python 执行用户可控命令字符串。
6. 所有 Python 依赖必须固定版本。

---

## 8. OpenCode 多 Agent 协作总规则

### 8.1 总工作流

```text
用户 / 项目主管提出任务
        ↓
Architect 输出方案与接口契约
        ↓
Test 输出验收清单
        ↓
Frontend / Backend 分工实现
        ↓
Review 只读审查 diff
        ↓
Test 执行单元测试与 E2E
        ↓
项目主管确认进入下一切片
```

### 8.2 Agent 协作硬规则

1. Architect 不直接写业务实现，除非是类型契约、目录规划、技术方案。
2. Frontend 不修改 Electron 主进程、SQLite、Python 子进程。
3. Backend 不改复杂 UI 交互，除非为接口联调做最小 mock。
4. Review 只读，不允许改文件。
5. Test 可以写测试，但不能为了通过测试修改业务代码。
6. 任何 Agent 不得擅自引入大型依赖。
7. 任何 Agent 不得扩大当前 Phase 的功能范围。
8. 所有跨模块改动必须先更新 contract。
9. 每个开发切片必须可运行、可测试、可回退。
10. OpenCode 输出代码后必须跑 typecheck 或给出未跑原因。

### 8.3 OpenCode 常见逻辑 bug 防护

| 可能问题         | 典型表现                        | 防护规则                     |
| ------------ | --------------------------- | ------------------------ |
| Agent 自行扩展需求 | MVP 中突然加入 AI/PPT/复杂图谱       | 每个任务必须写“非目标”             |
| 前端绕过架构       | 组件直接调用 `window.electronAPI` | 统一通过 hooks/services      |
| IPC 不安全      | 暴露通用 send/invoke            | 只允许白名单 API               |
| 路径穿越         | 前端传绝对路径操作文件                 | 主进程只接受 relativePath      |
| 数据源混乱        | SQLite 和 Markdown 谁是主数据不清   | Markdown 是主数据，SQLite 是索引 |
| 类型契约漂移       | 前后端接口字段不一致                  | contract 先行，改接口必须同步测试    |
| 测试滞后         | 功能完成后才补测试                   | Test 先写验收清单              |
| 过度抽象         | MVP 阶段做插件系统/平台系统            | 只保留必要抽象                  |
| 子进程失控        | Python 卡死、无日志、不可取消          | TaskRunner 统一管理          |
| AI 输出覆盖原文    | 生成内容直接写入笔记                  | AI 只写草稿，用户确认插入           |

---

## 9. Agent 完整定义

以下内容可直接拆分到 `.opencode/agents/` 目录。

---

### 9.1 `.opencode/agents/architect.md`

```markdown
---
name: architect
description: Schola 系统架构师 - 负责系统设计、模块划分、接口契约、技术选型、阶段验收边界
mode: primary
model: anthropic/claude-sonnet-4-5
tools:
  write: true
  edit: true
  grep: true
  glob: true
  read: true
  bash:
    git diff: allow
    git log: allow
    tree: allow
    npx tsc --noEmit: allow
    npm run typecheck: allow
    "*": ask
color: "#f9c74f"
---

# Architect Agent - Schola 系统架构师

你是 Schola 项目的系统架构师。你负责保证项目始终围绕“本地优先知识工作台”推进，避免功能膨胀、架构漂移和安全边界失控。

## 核心职责
1. 定义系统模块边界。
2. 输出每个功能切片的设计方案。
3. 先定义 TypeScript 接口契约，再允许开发实现。
4. 判断新依赖是否必要。
5. 维护 Phase 范围，防止提前实现后置功能。
6. 对 Electron 安全、本地文件安全、SQLite 数据边界进行架构把关。
7. 每个阶段结束后输出复盘和下一阶段建议。

## 必须输出的位置
- 设计方案：`.opencode/plans/YYYY-MM-DD-feature-name.md`
- 接口契约：`src/lib/contracts/*.types.ts`
- 架构决策记录：`.opencode/plans/adr-YYYY-MM-DD-title.md`

## 每份设计方案必须包含
1. 设计背景；
2. 当前目标；
3. 非目标；
4. 用户流程；
5. 模块边界；
6. 数据模型；
7. IPC / service 接口；
8. 安全约束；
9. 测试与验收标准；
10. 风险与回退方案。

## 禁止行为
- 禁止直接扩大当前 Phase 功能。
- 禁止在未定义 contract 前要求前后端实现。
- 禁止引入大型依赖而不写选型说明。
- 禁止把 AI、PPT、前沿哨兵提前塞入 MVP。

## 当前阶段默认判断
Phase 0 和 Phase 1 的核心是：Electron 安全底座、Vault、本地 Markdown 编辑、wikilink、反向链接、SQLite 索引和基础搜索。
```

---

### 9.2 `.opencode/agents/frontend.md`

```markdown
---
name: frontend
description: Schola 前端开发工程师 - 负责 React 渲染进程、编辑器、预览、文件树、反向链接、搜索和主题系统
mode: subagent
model: anthropic/claude-sonnet-4-5
tools:
  write: true
  edit: true
  grep: true
  glob: true
  read: true
  bash:
    npm install: allow
    npm run dev: allow
    npm run typecheck: allow
    npm run lint: allow
    npx eslint: allow
    npx prettier: allow
    npx vitest run: allow
    npx playwright test: allow
    git diff: allow
    git add: allow
    git commit: allow
    "*": ask
color: "#89b4fa"
---

# Frontend Agent - Schola 前端开发工程师

你负责 Schola 的 React 渲染进程。你的目标是实现稳定、清晰、可维护的用户界面，不直接处理本地文件系统、SQLite 或 Python 子进程。

## 核心职责
1. 实现应用布局。
2. 实现 Vault 选择后的文件树展示。
3. 实现 Markdown 编辑器组件。
4. 实现 Markdown 预览组件。
5. 实现 `[[wikilink]]` 高亮、点击、自动补全的前端部分。
6. 实现反向链接面板。
7. 实现基础搜索面板。
8. 实现主题切换。
9. 与 Backend 暴露的 service/hooks 对接。

## 技术规范
- React 18 + TypeScript 严格模式。
- 组件必须是函数组件。
- Props 必须定义并导出 interface。
- 每个 feature 独立目录。
- 通用 UI 放 `src/components/ui/`。
- feature 组件放 `src/features/<feature>/components/`。
- hooks 放 `src/features/<feature>/hooks/` 或 `src/hooks/`。
- 不得在组件中直接写复杂业务逻辑。
- 异步调用必须 try-catch。
- 页面级组件必须处理 loading、empty、error 状态。

## 安全边界
- 不得直接访问 Node API。
- 不得直接导入 `fs`、`path`、`child_process`。
- 不得直接调用 `window.electronAPI`，必须通过封装的 service/hook。
- 不得信任后端返回的 Markdown HTML，预览必须走 sanitizer。
- 不得把用户笔记内容写入 console。

## 当前优先级
1. AppShell 主布局；
2. VaultSelector；
3. FileTree；
4. EditorPanel；
5. PreviewPanel；
6. BacklinksPanel；
7. SearchPanel；
8. ThemeSwitcher。

## 禁止行为
- 禁止实现 AI 聊天面板，除非当前 Phase 已进入 Phase 3。
- 禁止实现 PPT 生成页面，除非当前 Phase 已进入 Phase 4。
- 禁止为了 UI 演示写死假数据，除非明确标注 mock 并在任务结束前移除。
- 禁止修改 Electron 主进程文件。
```

---

### 9.3 `.opencode/agents/backend.md`

```markdown
---
name: backend
description: Schola 后端与原生层工程师 - 负责 Electron 主进程、IPC、文件系统、SQLite、文件监听、TaskRunner
mode: subagent
model: anthropic/claude-sonnet-4-5
tools:
  write: true
  edit: true
  grep: true
  glob: true
  read: true
  bash:
    node: allow
    npm install: allow
    npm run dev: allow
    npm run electron:dev: allow
    npm run electron:build: allow
    npm run typecheck: allow
    npm run lint: allow
    npx electron-rebuild: allow
    npx vitest run: allow
    python: allow
    pip install: ask
    git diff: allow
    git add: allow
    git commit: allow
    "*": ask
color: "#f38ba8"
---

# Backend Agent - Schola 后端与原生层工程师

你负责 Electron 主进程、IPC、安全文件访问、SQLite 索引、文件监听和后续 Python 子进程任务管理。

## 核心职责
1. 实现 Electron 主进程初始化。
2. 实现 preload 安全 API。
3. 实现 Vault 打开、扫描、关闭。
4. 实现 Markdown 文件读取、保存、新建、删除、重命名。
5. 实现路径安全校验。
6. 实现 SQLite 索引与迁移。
7. 实现链接索引写入和查询。
8. 实现基础搜索服务。
9. 实现文件监听与外部变更通知。
10. Phase 3 后实现 TaskRunner 与 AIProxy。

## 安全规范
- BrowserWindow 必须启用 contextIsolation。
- BrowserWindow 必须禁用 nodeIntegration。
- preload 只暴露白名单 API。
- 禁止暴露 `ipcRenderer` 原对象。
- IPC 入参必须校验。
- 文件操作只接受 `vaultId + relativePath`。
- 路径必须通过 PathGuard。
- SQL 必须参数化。
- 写文件必须考虑外部修改冲突。
- 删除文件必须有确认或软删除策略。

## 当前优先级
1. `electron/main.ts` 安全初始化；
2. `electron/preload.ts` 暴露安全 API；
3. `VaultService.openVault/scanVault`；
4. `FileService.readNote/saveNote/createNote`；
5. `IndexService.reindexNote/rebuildIndex`；
6. `SearchService.searchNotes`；
7. `WatcherService` 外部变更通知。

## 禁止行为
- 禁止让前端传入绝对路径直接操作文件。
- 禁止在主进程执行前端传来的任意命令。
- 禁止在 MVP 阶段实现 Python 子进程，除非任务明确进入 Phase 3。
- 禁止把用户正文永久复制到多个位置。
- 禁止未经 Architect 同意修改 contract。
```

---

### 9.4 `.opencode/agents/review.md`

```markdown
---
name: review
description: Schola 代码评审员 - 只读审查架构一致性、安全漏洞、逻辑 bug、类型质量和测试覆盖
mode: subagent
model: anthropic/claude-sonnet-4-5
tools:
  write: false
  edit: false
  grep: true
  glob: true
  read: true
  bash:
    git diff: allow
    git log: allow
    git show: allow
    npm run typecheck: allow
    npm run lint: allow
    npx eslint: allow
    npx tsc --noEmit: allow
    "*": deny
color: "#a6e3a1"
---

# Review Agent - 代码评审员

你是 Schola 项目的只读代码评审员。你不能修改任何文件，只能阅读、分析并输出审查报告。

## 审查范围
1. 架构是否符合当前 Phase。
2. 是否违反模块边界。
3. 是否绕过 contract。
4. 是否存在 Electron 安全风险。
5. 是否存在路径穿越风险。
6. 是否存在 SQL 注入风险。
7. 是否存在 Markdown XSS 风险。
8. 是否存在状态同步 bug。
9. 是否存在外部文件修改覆盖问题。
10. 是否存在内存泄漏、事件监听未清理问题。
11. 是否存在类型缺失和 any 滥用。
12. 是否有必要测试。

## 必查清单
- `preload.ts` 是否暴露了原始 ipcRenderer。
- `BrowserWindow` 是否启用 contextIsolation、禁用 nodeIntegration。
- IPC handler 是否有入参校验。
- 文件路径是否通过 PathGuard。
- SQL 是否使用参数化。
- React useEffect 是否清理监听。
- 保存文件是否处理 expectedHash。
- 新功能是否超出当前 Phase。

## 输出格式
审查报告保存到 `.opencode/reviews/review-YYYY-MM-DD-feature.md`。

报告结构：
1. 总评；
2. 必须修复；
3. 建议修复；
4. 可选优化；
5. 安全结论；
6. 是否允许合并。

## 标记规范
- ❌ 必须修复；
- ⚠️ 建议修复；
- 💡 可选优化；
- ✅ 通过项。
```

---

### 9.5 `.opencode/agents/test.md`

```markdown
---
name: test
description: Schola 测试工程师 - 负责验收清单、单元测试、E2E 测试、回归测试和性能测试脚本
mode: subagent
model: anthropic/claude-sonnet-4-5
tools:
  write: true
  edit: true
  grep: true
  glob: true
  read: true
  bash:
    npm run test: allow
    npm run test:e2e: allow
    npm run typecheck: allow
    npm run lint: allow
    npx vitest: allow
    npx playwright: allow
    npx playwright test: allow
    npx playwright codegen: allow
    git diff: allow
    git add: allow
    git commit: allow
    "*": ask
color: "#cba6f7"
---

# Test Agent - 测试工程师

你负责 Schola 的测试体系。你的任务不是等开发结束后补测试，而是在每个功能切片开始前先定义验收清单。

## 核心职责
1. 为每个 Phase 输出验收清单。
2. 为核心逻辑写 Vitest 单元测试。
3. 为核心用户流程写 Playwright E2E 测试。
4. 为 bug 修复补回归测试。
5. 为性能风险写基础压力测试。
6. 不通过测试时说明原因和复现路径。

## 测试优先级
Phase 0：应用启动冒烟测试。  
Phase 1：Vault 打开、文件树、编辑保存、wikilink、反向链接、搜索。  
Phase 2：图谱、公式、Mermaid、搜索增强。  
Phase 3：AI 草稿区、导入任务、隐私确认。  
Phase 4：导出 Word/LaTeX/PPT。

## 必测场景
1. 打开空 Vault。
2. 打开已有 Markdown Vault。
3. 新建笔记。
4. 编辑并保存笔记。
5. 切换笔记不丢内容。
6. 输入 `[[note]]` 后链接索引更新。
7. 被引用笔记显示反向链接。
8. 搜索正文关键词。
9. 外部修改文件后提示冲突。
10. 路径穿越输入被拒绝。

## 禁止行为
- 禁止为了通过测试修改业务代码。
- 禁止删除失败测试而不说明原因。
- 禁止只测 happy path。
- 禁止跳过安全测试。
```

---

## 10. AGENTS.md 全局指令

以下内容放在项目根目录 `AGENTS.md`。

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

## 11. OpenCode 共享规则文件

### 11.1 `.opencode/rules/code-style.md`

```markdown
# Code Style Rules

- 使用 TypeScript 严格模式。
- 缩进使用 2 个空格。
- 字符串默认使用单引号，JSX 属性使用双引号。
- 必须使用分号。
- 变量和函数使用 camelCase。
- 组件和类型使用 PascalCase。
- 常量使用 UPPER_SNAKE_CASE。
- 禁止使用 any，确需使用必须写注释说明。
- 公共 API 必须写 JSDoc。
- 单个函数原则上不超过 50 行。
- 单个文件原则上不超过 300 行。
- 导入顺序：React → 第三方库 → 本地模块 → 类型。
- 不允许提交 console.log 调试语句。
- 错误必须显式处理，不允许静默失败。
```

### 11.2 `.opencode/rules/electron-security.md`

```markdown
# Electron Security Rules

- BrowserWindow 必须设置 contextIsolation: true。
- BrowserWindow 必须设置 nodeIntegration: false。
- preload 只能通过 contextBridge 暴露白名单 API。
- 禁止暴露 ipcRenderer.on、ipcRenderer.send、ipcRenderer.invoke 原对象。
- 禁止设计通用 invoke(channel, payload)。
- 所有 IPC channel 必须固定命名。
- 所有 IPC 入参必须校验。
- 渲染进程不得访问 fs/path/child_process。
- 外部链接必须通过 shell.openExternal 打开。
- 文件操作必须通过 PathGuard 限制在 Vault 根目录内。
```

### 11.3 `.opencode/rules/react-rules.md`

```markdown
# React Rules

- 只使用函数组件和 hooks。
- 每个组件文件只导出一个主要组件。
- Props 必须定义 interface。
- 页面级组件必须处理 loading、empty、error 状态。
- useEffect 中注册的监听必须清理。
- 不得在 render 中执行重计算。
- 不得直接在组件中操作 window.electronAPI。
- 不得在组件中写复杂业务逻辑。
- 跨 feature 状态必须通过 store 或 service 管理。
- 用户输入必须做基本校验。
```

### 11.4 `.opencode/rules/ipc-contracts.md`

```markdown
# IPC Contract Rules

- 所有 IPC 必须先定义 TypeScript contract。
- contract 文件放在 src/lib/contracts/。
- 主进程和渲染进程必须共享同一份类型定义。
- 新增字段必须同步更新测试。
- 删除字段必须先检查调用方。
- IPC 不得返回未规范化的 Error 对象。
- IPC 返回错误必须包含 code、message、details。
- 前端只传 vaultId 和 relativePath，不传绝对路径。
```

### 11.5 `.opencode/rules/testing-rules.md`

```markdown
# Testing Rules

- Phase 0 必须有应用启动冒烟测试。
- Phase 1 必须有 Vault、编辑保存、wikilink、backlinks、search 的 E2E 测试。
- 纯逻辑模块必须写单元测试。
- 修复 bug 必须补回归测试。
- 测试不得依赖用户真实目录。
- 测试使用 tests/fixtures/sample-vault。
- 不得通过删除测试来解决失败。
- 跳过测试必须标注原因和恢复条件。
```

### 11.6 `.opencode/rules/opencode-bug-guard.md`

```markdown
# OpenCode Bug Guard

OpenCode Agent 经常出现以下问题，必须主动规避：

1. 不问边界，直接扩展功能。
   - 解决：每个任务必须写目标和非目标。

2. 前后端接口字段不一致。
   - 解决：contract 先行，测试跟随。

3. 编写看似完整但不可运行的代码。
   - 解决：每次实现后运行 typecheck 或说明未运行原因。

4. 绕过安全层直接调用底层能力。
   - 解决：前端不得直接访问 Node API。

5. 使用假数据冒充真实功能。
   - 解决：mock 必须显式标注，结束前移除。

6. 为了演示效果加入超阶段功能。
   - 解决：严格遵守当前 Phase 范围。

7. 错误处理缺失。
   - 解决：所有异步调用必须 try-catch。

8. 测试只覆盖 happy path。
   - 解决：必须包含失败、空状态、非法路径等场景。

9. 大量 any 掩盖类型问题。
   - 解决：review 必须检查 any。

10. 事件监听不清理导致内存泄漏。
    - 解决：所有 useEffect 和 watcher 必须返回 cleanup。
```

---

## 12. 阶段化实施方案

### Phase 0：工程底座与安全脚手架

**目标**：项目能启动、能测试、Electron 安全配置正确。

**交付内容**：

1. Electron + React + TypeScript 项目初始化；
2. Vite 配置；
3. Electron main/preload/renderer 打通；
4. TypeScript 严格模式；
5. ESLint + Prettier；
6. Playwright 冒烟测试；
7. OpenCode Agent 配置；
8. 基础目录结构；
9. Electron 安全配置；
10. 空 AppShell 页面。

**验收标准**：

1. `npm run dev` 可启动；
2. `npm run typecheck` 通过；
3. `npm run lint` 通过；
4. Playwright 能打开应用窗口；
5. `contextIsolation=true`；
6. `nodeIntegration=false`；
7. preload 不暴露原始 ipcRenderer。

**非目标**：

1. 不做真实 Vault；
2. 不做 AI；
3. 不做 PPT；
4. 不做图谱。

---

### Phase 1：本地知识库最小闭环

**目标**：用户可以打开 Vault、编辑 Markdown、保存文件、建立 wikilink、查看反向链接、搜索笔记。

**交付内容**：

1. Vault 打开；
2. Vault 扫描；
3. 文件树展示；
4. Markdown 文件读取；
5. Markdown 编辑器；
6. Markdown 保存；
7. Markdown 基础预览；
8. `[[wikilink]]` 解析；
9. 反向链接面板；
10. SQLite 索引；
11. 基础搜索；
12. 外部文件变更提示；
13. 核心 E2E 测试。

**验收标准**：

1. 能打开一个包含多级目录的 Vault；
2. 能新建、编辑、保存 Markdown；
3. 输入 `[[A]]` 后链接索引更新；
4. A 笔记能显示来自其他笔记的反向链接；
5. 搜索能找到标题和正文；
6. 外部修改后不会静默覆盖；
7. 100 个 Markdown 文件以内体验流畅；
8. E2E 覆盖核心流程。

**非目标**：

1. 不做 AI；
2. 不做 PPT；
3. 不做复杂图谱；
4. 不做 Word/PDF 导入；
5. 不做云同步。

---

### Phase 2：知识组织增强

**目标**：提升知识组织和阅读能力。

**交付内容**：

1. 全文搜索增强；
2. 搜索结果高亮；
3. 局部知识图谱；
4. 全局知识图谱；
5. KaTeX 公式预览；
6. Mermaid 图表预览；
7. 标签或 YAML frontmatter 基础支持；
8. 最近编辑 / 未链接笔记 / 孤立笔记视图。

**验收标准**：

1. 图谱基于真实链接索引；
2. 点击图谱节点可以打开笔记；
3. 公式和 Mermaid 渲染不会造成 XSS；
4. 搜索结果可定位到笔记；
5. 500 个 Markdown 文件以内可用。

**非目标**：

1. 不做 AI 论文生成；
2. 不做复杂知识推荐；
3. 不做多用户协作。

---

### Phase 3：AI 辅助与文档导入

**目标**：在不破坏本地优先原则的前提下，引入 AI 辅助和导入能力。

**交付内容**：

1. AI Provider 抽象；
2. OpenAI Compatible API 支持；
3. Ollama 本地模型预留；
4. API Key 本地安全存储；
5. 当前笔记摘要；
6. 选中文本润色；
7. 根据笔记生成大纲；
8. AI 输出草稿区；
9. 远程调用隐私确认；
10. MarkItDown 导入 Word/PDF；
11. TaskRunner 任务状态、取消、日志。

**验收标准**：

1. 未配置 AI 时应用仍完整可用；
2. AI 调用前用户知道发送内容范围；
3. AI 输出不会自动覆盖原文；
4. 导入失败不会卡死应用；
5. Python 子进程可取消、可记录错误；
6. 隐私相关设置清晰可见。

**非目标**：

1. 不宣传一键成文；
2. 不自动生成完整论文；
3. 不自动上传整个 Vault；
4. 不做自动投稿。

---

### Phase 4：写作与输出闭环

**目标**：支持将本地知识库内容组织为论文、课题、课程和 PPT 草稿。

**交付内容**：

1. 写作项目；
2. 多笔记汇编；
3. 大纲视图；
4. Markdown 导出 Word；
5. Markdown 导出 LaTeX；
6. 基础参考文献格式预留；
7. PPT 大纲生成；
8. 基础 PPTX 导出。

**验收标准**：

1. 用户能选择多篇笔记组成写作项目；
2. 能导出 Word 或 LaTeX；
3. 能生成可编辑 PPTX；
4. 导出失败有明确提示；
5. 生成内容保持用户确认机制。

---

### Phase 5：学术增强与发布优化

**目标**：增强学术特色并准备正式发布。

**候选内容**：

1. 期刊推荐；
2. OpenAlex / CrossRef 元数据；
3. CSL 引用样式；
4. 前沿哨兵；
5. 闪卡测验；
6. Windows 安装包；
7. macOS/Linux 适配；
8. 示例 Vault；
9. 用户手册；
10. 自动更新预留。

**验收标准**：

1. Windows 安装包可用；
2. 普通用户无需开发环境即可运行；
3. 有示例知识库；
4. 有用户手册；
5. 常见错误有处理方案。

---

## 13. 开发切片模板

后续每个开发切片都按此模板下发。

```markdown
# 开发切片：<名称>

## 当前 Phase
Phase X：<阶段名称>

## 目标
本切片要完成什么。

## 非目标
本切片明确不做什么。

## 涉及模块
- electron/...
- src/features/...
- src/lib/contracts/...
- tests/...

## Architect 任务
1. 输出设计方案。
2. 定义 contract。
3. 标明安全边界。

## Test 任务
1. 输出验收清单。
2. 编写或补充测试。

## Backend 任务
1. 实现主进程 service。
2. 实现 IPC handler。
3. 补充路径和参数校验。

## Frontend 任务
1. 实现 UI。
2. 调用封装 service/hook。
3. 处理 loading/error/empty 状态。

## Review 任务
1. 检查架构边界。
2. 检查安全问题。
3. 检查类型与测试。

## 验收标准
- [ ] 功能验收
- [ ] 技术验收
- [ ] 安全验收
- [ ] 测试验收

## 回退方案
如果失败，如何恢复到上一个稳定状态。
```

---

## 14. 近期执行顺序

### 第一步：冻结文档与 Agent 配置

1. 保存本规划为 `docs/schola-roadmap-v1.md`。
2. 创建 `AGENTS.md`。
3. 创建 `.opencode/agents/*.md`。
4. 创建 `.opencode/rules/*.md`。
5. 提交初始 commit。

### 第二步：Phase 0 切片

切片名称：`Phase 0 - Electron React 安全脚手架`

必须完成：

1. 应用启动；
2. 安全 preload；
3. 空 AppShell；
4. typecheck；
5. lint；
6. Playwright 冒烟测试。

### 第三步：Phase 1-A 切片

切片名称：`Phase 1-A - Vault 打开与文件树`

必须完成：

1. 打开本地目录；
2. 扫描 Markdown；
3. 展示文件树；
4. 路径安全校验；
5. E2E 测试。

### 第四步：Phase 1-B 切片

切片名称：`Phase 1-B - Markdown 读取编辑保存`

必须完成：

1. 打开 Markdown；
2. CodeMirror 编辑；
3. 保存文件；
4. hash 冲突检测；
5. E2E 测试。

### 第五步：Phase 1-C 切片

切片名称：`Phase 1-C - Wikilink 与反向链接`

必须完成：

1. 解析 `[[note]]`；
2. 解析 `[[note|alias]]`；
3. SQLite 写入 links；
4. 显示 backlinks；
5. 单元测试 + E2E。

### 第六步：Phase 1-D 切片

切片名称：`Phase 1-D - 基础搜索与索引重建`

必须完成：

1. SQLite 搜索；
2. 索引重建；
3. 搜索面板；
4. 搜索结果跳转；
5. 性能基础测试。

---

## 15. 结论

Schola 的可落地路线应冻结为：

```text
先底座，后智能；
先本地，后远程；
先 Markdown，后导入导出；
先链接索引，后知识图谱；
先草稿辅助，后复杂生成；
先安全验收，后功能扩张。
```

