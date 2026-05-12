# Testing Rules

- Phase 0 必须有应用启动冒烟测试。
- Phase 1 必须有 Vault、编辑保存、wikilink、backlinks、search 的 E2E 测试。
- 纯逻辑模块必须写单元测试。
- 修复 bug 必须补回归测试。
- 测试不得依赖用户真实目录。
- 测试使用 tests/fixtures/sample-vault。
- 不得通过删除测试来解决失败。
- 跳过测试必须标注原因和恢复条件。