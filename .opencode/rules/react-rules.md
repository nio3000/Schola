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

