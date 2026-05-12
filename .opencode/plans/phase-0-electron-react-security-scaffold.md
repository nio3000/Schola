# Phase 0 - Electron React 安全脚手架设计方案

## 1. 设计背景

Schola 是本地优先的科研知识工作台。当前冻结路线要求先完成本地知识库底座，再进入 AI、PPT、文献导入等增强能力。Phase 0 的职责不是实现 Vault、Markdown 编辑或 SQLite，而是建立后续 Phase 1 可以安全开发的工程底座。

本方案依据：

- `AGENTS.md`
- `docs/schola-roadmap-v1.md`
- `.opencode/agents/architect.md`
- `.opencode/agents/frontend.md`
- `.opencode/agents/backend.md`
- `.opencode/agents/review.md`
- `.opencode/agents/test.md`
- `.opencode/rules/*.md`

当前仓库现状：已有规划、Agent 与规则文件；尚未建立 `electron/`、`src/`、`tests/`、`resources/` 等应用代码目录；`.opencode/plans/` 目录在本次设计前不存在。

## 2. 当前目标

Phase 0 交付一个最小可运行、安全默认开启的 Electron + React + TypeScript 脚手架：

1. 初始化 Electron + React 18 + TypeScript 5 项目结构。
2. 使用 Vite 或等价构建工具承载 renderer。
3. 建立 Electron main / preload / renderer 三层目录和构建入口。
4. 建立严格 TypeScript、ESLint、Prettier 配置。
5. 创建最小 AppShell 页面，只证明窗口和 React 渲染正常。
6. 建立 `src/lib/contracts/`，先定义 preload/API contract。
7. 建立 Playwright 冒烟测试，验证应用窗口可启动并显示 AppShell。
8. 提供可运行命令：`npm run dev`、`npm run typecheck`、`npm run lint`、`npm run test:e2e`。
9. 固化 Electron 安全默认值：`contextIsolation: true`、`nodeIntegration: false`、不暴露原始 `ipcRenderer`、不设计通用 `send` / `invoke`。

## 3. 非目标

Phase 0 明确不做：

1. 不实现真实 Vault 打开、扫描或路径选择。
2. 不实现 Markdown 编辑器、预览、wikilink、反向链接、搜索。
3. 不接入 SQLite、better-sqlite3、chokidar 或文件监听。
4. 不实现文件读写、删除、重命名或 PathGuard 的完整业务能力。
5. 不实现 AI、PPT、Python 子进程、插件系统、多人协作或同步。
6. 不接入 mweb-themes 具体主题文件。
7. 不制作复杂 UI，不加入假数据演示业务功能。

## 4. 用户流程

Phase 0 的唯一用户可见流程：

1. 开发者执行 `npm run dev`。
2. Vite dev server 启动 renderer。
3. Electron main 创建 BrowserWindow。
4. preload 注入最小白名单 API。
5. renderer 显示 AppShell 骨架，包含应用名称、当前阶段说明和安全底座状态。
6. Playwright 启动应用并断言窗口标题或 AppShell 文案存在。

该流程只验证工程链路和安全配置，不承诺任何知识库业务能力。

## 5. 模块边界

### 5.1 Electron Main Process

建议位置：`electron/main.ts`。

职责：

- 创建和管理主窗口。
- 配置 `BrowserWindow.webPreferences`。
- 注册固定命名的 IPC handler。
- 管理应用生命周期。
- 在 Phase 0 只提供最小系统信息 handler。

禁止：

- 不直接实现 Vault、文件读写、SQLite、AI、Python。
- 不执行 renderer 传入的任意命令。
- 不接收绝对路径做文件操作。

### 5.2 Preload Layer

建议位置：`electron/preload.ts`。

职责：

- 通过 `contextBridge.exposeInMainWorld` 暴露极小白名单 API。
- 将 renderer 调用映射到固定 IPC channel。
- 不暴露 `ipcRenderer` 原对象。
- 不提供 `send(channel, payload)`、`invoke(channel, payload)` 或类似通用通道。

Phase 0 最小 API 建议：

```ts
window.schola.app.getInfo(): Promise<AppInfo>
```

其中 `AppInfo` 来自共享 contract。该 API 只返回应用版本、运行平台、当前 phase 等非敏感信息，不涉及用户文件或系统命令。

### 5.3 React Renderer

建议位置：`src/app/App.tsx` 与 `src/app/main.tsx`。

职责：

- 渲染最小 AppShell。
- 通过 renderer service/hook 调用 preload API。
- 展示 loading、success、error 的最小状态。

禁止：

- 不导入 `fs`、`path`、`child_process`。
- 不直接在组件中散落调用 `window.schola`；应封装在 `src/lib/platform/` 或 feature service 中。
- 不实现 Phase 1+ 的 Vault、编辑、预览等功能。

## 6. 最小目录结构

Phase 0 应创建以下目录与关键文件：

```text
schola/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   └── ipc/
│       └── app.ipc.ts
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── components/
│   ├── features/
│   ├── lib/
│   │   ├── contracts/
│   │   │   └── app.types.ts
│   │   ├── errors/
│   │   └── platform/
│   │       └── schola-api.ts
│   ├── types/
│   │   └── global.d.ts
│   └── styles.css
├── tests/
│   ├── e2e/
│   │   └── app-smoke.spec.ts
│   └── unit/
├── resources/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── playwright.config.ts
├── eslint.config.js
├── prettier.config.js
└── index.html
```

Phase 0 暂不创建 `electron/services/`、`electron/db/` 或 `electron/security/path-guard.ts` 的完整实现，避免暗示 Vault 和文件能力已经可用。如需占位，只能放 README 或空目录，不得写假业务逻辑。

## 7. 数据模型与 Contract

Phase 0 只有系统信息 contract：

```ts
export interface AppInfo {
  readonly name: 'Schola';
  readonly version: string;
  readonly platform: NodeJS.Platform;
  readonly phase: 'phase-0';
}

export interface ScholaAppApi {
  readonly getInfo: () => Promise<AppInfo>;
}

export interface ScholaApi {
  readonly app: ScholaAppApi;
}
```

Contract 规则：

- 文件放在 `src/lib/contracts/app.types.ts`。
- preload、renderer service、测试共享同一份类型。
- 新增 IPC 前必须先新增 contract。
- IPC 错误不得直接返回原始 `Error` 对象；后续统一为 `{ code, message, details }`。

## 8. IPC / Service 接口

Phase 0 只允许一个固定 IPC channel：

```text
app:get-info
```

建议映射：

```text
renderer service -> window.schola.app.getInfo()
preload -> ipcRenderer.invoke('app:get-info')
main -> ipcMain.handle('app:get-info', handler)
```

限制：

- 不允许 `window.schola.invoke(channel, payload)`。
- 不允许 `window.schola.send(channel, payload)`。
- 不允许暴露 `ipcRenderer.on/send/invoke`。
- 不允许动态 channel 名。
- `app:get-info` 无入参；若未来有入参，必须先写 validator。

## 9. 安全约束

### 9.1 BrowserWindow

`electron/main.ts` 必须显式配置：

```ts
webPreferences: {
  preload: preloadPath,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
}
```

补充要求：

- 生产模式加载本地构建产物，开发模式只加载本地 Vite dev server。
- 不启用远程不可信 URL。
- 禁止在 renderer 中启用 Node 能力。

### 9.2 Preload

- 只使用 `contextBridge` 暴露白名单对象。
- API 对象应尽量冻结或保持只读形态。
- 不暴露事件总线或通用 IPC。
- 不开放任意文件路径、系统命令、shell 能力。

### 9.3 Renderer

- React 组件不得导入 Node API。
- React 组件不得直接访问底层 IPC。
- 页面级异步调用要有 loading、error 状态。
- 不记录用户正文；Phase 0 尚无用户正文输入。

### 9.4 后续安全预留

Phase 1 进入 Vault 后必须补齐：

- `PathGuard`：只接受 `vaultId + relativePath`，禁止绝对路径和 `../` 逃逸。
- IPC 入参 validator。
- 文件保存 hash / 外部修改冲突策略。
- Markdown sanitizer。

这些能力不得在 Phase 0 用假实现冒充完成。

## 10. 测试与验收标准

### 10.1 TypeScript / Lint

必须通过：

```text
npm run typecheck
npm run lint
```

验收点：

- TypeScript strict 开启。
- 不使用 `any`、`@ts-ignore`、`@ts-expect-error`。
- renderer 不直接导入 Node API。
- contract 类型可被 main/preload/renderer 共享引用。

### 10.2 Electron 安全验收

Review 必查：

- `BrowserWindow` 包含 `contextIsolation: true`。
- `BrowserWindow` 包含 `nodeIntegration: false`。
- `BrowserWindow` 包含 `sandbox: true`。
- preload 未暴露 `ipcRenderer` 原对象。
- preload 未提供通用 `send` / `invoke`。
- IPC channel 固定为 `app:get-info`。

### 10.3 Playwright 冒烟测试

`tests/e2e/app-smoke.spec.ts` 至少验证：

1. 应用能启动 Electron 窗口。
2. AppShell 文案可见。
3. `window.schola` 存在。
4. `window.schola.app.getInfo()` 返回 `phase: 'phase-0'`。
5. `window.require`、`window.process` 不应作为 Node 能力暴露给 renderer。

### 10.4 命令验收

Phase 0 完成时必须能运行：

```text
npm run dev
npm run typecheck
npm run lint
npm run test:e2e
```

若因系统环境缺失导致无法运行，Test Agent 必须记录具体命令、错误信息和恢复条件。

## 11. Agent 分工

### Architect

- 本文件为 Architect 设计产物。
- 后续新增 IPC 或跨层接口时先更新 `src/lib/contracts/*.ts`。

### Test

- 在实现前输出 Phase 0 验收清单。
- 编写 Playwright app smoke test。
- 不为通过测试修改业务代码。

### Backend

- 实现 `electron/main.ts`、`electron/preload.ts`、`electron/ipc/app.ipc.ts`。
- 只提供 `app:get-info`。
- 保证 Electron 安全配置。

### Frontend

- 实现最小 AppShell。
- 通过封装 service/hook 使用 `window.schola.app.getInfo()`。
- 不修改 Electron 主进程文件。

### Review

- 只读审查安全配置、contract 一致性、类型质量和 Phase 范围。
- 对任何通用 IPC、Node API 暴露、超阶段功能标记为必须修复。

## 12. 风险与回退方案

### 风险 1：脚手架命令复杂导致不可运行

缓解：优先选择 Vite + Electron 的最小双进程开发脚本，避免过度封装。

回退：保留 `npm run typecheck` 和 `npm run lint` 可独立运行，E2E 单独修复。

### 风险 2：preload API 过早膨胀

缓解：Phase 0 只允许 `app:get-info`。任何 Vault、文件、SQLite API 必须进入 Phase 1 设计后再加。

回退：删除未授权 API，并同步 contract 与测试。

### 风险 3：安全配置被默认值掩盖

缓解：即使 Electron 默认安全，也必须显式写出安全选项，并由 Playwright 或静态检查覆盖。

回退：Review 阶段阻断合并，直到安全项显式存在。

### 风险 4：测试依赖真实用户环境

缓解：Phase 0 E2E 只启动应用，不读取用户目录。

回退：将 E2E 输入改为项目内 fixture 或纯窗口检查。

## 13. Phase 0 完成定义

Phase 0 只有在以下条件全部满足时才算完成：

1. 目录结构和配置文件已建立。
2. AppShell 可在 Electron 窗口中启动。
3. main / preload / renderer 边界符合本方案。
4. preload 只暴露最小白名单 API。
5. `npm run typecheck` 通过。
6. `npm run lint` 通过。
7. `npm run test:e2e` 冒烟测试通过，或记录明确环境阻塞。
8. Review 未发现 Electron 安全必须修复项。
9. 未实现任何 Phase 0 非目标功能。