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

