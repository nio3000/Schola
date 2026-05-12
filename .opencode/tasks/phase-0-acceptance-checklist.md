# Phase 0 验收清单 - Electron React 安全脚手架

## 范围

本验收清单对应 `.opencode/plans/phase-0-electron-react-security-scaffold.md`，只验证 Phase 0 工程底座，不验收 Vault、Markdown、SQLite、AI、PPT 或文件读写能力。

## 必须通过

1. `electron/main.ts` 创建 Electron BrowserWindow。
2. `electron/preload.ts` 只通过 `contextBridge` 暴露 `window.schola.app.getInfo()`。
3. preload 不暴露原始 `ipcRenderer`，不提供通用 `send` / `invoke`。
4. BrowserWindow 显式设置 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`、`webSecurity: true`、`allowRunningInsecureContent: false`。
5. IPC channel 固定为 `app:get-info`，channel 常量来自共享 contract。
6. renderer TypeScript 配置不加载 Node ambient types。
7. React AppShell 能显示 Schola 与 Phase 0 状态。
8. Playwright 冒烟测试能启动 Electron、读取 preload API，并验证 renderer 未暴露 Node require/process version。
9. `npm run typecheck` 通过。
10. `npm run lint` 通过。
11. `npm run test:e2e` 通过。
12. `npm run dev` 能启动 Vite 与 Electron。

## 明确不测

1. Vault 打开、扫描、文件树。
2. Markdown 编辑、保存、预览、wikilink、反向链接。
3. SQLite 索引、搜索、文件监听。
4. AI、Python、PPT、插件系统。