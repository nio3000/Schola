# IPC Contract Rules

- 所有 IPC 必须先定义 TypeScript contract。
- contract 文件放在 src/lib/contracts/。
- 主进程和渲染进程必须共享同一份类型定义。
- 新增字段必须同步更新测试。
- 删除字段必须先检查调用方。
- IPC 不得返回未规范化的 Error 对象。
- IPC 返回错误必须包含 code、message、details。
- 前端只传 vaultId 和 relativePath，不传绝对路径。