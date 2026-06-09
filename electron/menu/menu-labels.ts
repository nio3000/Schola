/**
 * Menu labels — i18n for Schola application menu.
 *
 * Default locale: zh-CN. English fallback available.
 * No external i18n dependency. Pure TypeScript object mapping.
 *
 * Phase 5-3-IMP.
 */

export type MenuLocale = 'zh-CN' | 'en';

// ── Per-menu label groups ──

export interface ScholaMenuLabels {
  readonly about: string;
  readonly checkUpdate: string;
  readonly preferences: string;
  readonly hide: string;
  readonly hideOthers: string;
  readonly showAll: string;
  readonly quit: string;
}

export interface FileMenuLabels {
  readonly openVault: string;
  readonly closeVault: string;
  readonly newMarkdown: string;
  readonly newFolder: string;
  readonly rename: string;
  readonly delete: string;
  readonly revealInExplorer: string;
}

export interface EditMenuLabels {
  readonly undo: string;
  readonly redo: string;
  readonly cut: string;
  readonly copy: string;
  readonly paste: string;
  readonly selectAll: string;
  readonly find: string;
  readonly replace: string;
}

export interface ViewMenuLabels {
  readonly toggleActivityBar: string;
  readonly toggleSideBar: string;
  readonly toggleBottomPanel: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
  readonly resetZoom: string;
  readonly toggleFullscreen: string;
  readonly toggleDevTools: string;
}

export interface KnowledgeMenuLabels {
  readonly addSourceFile: string;
  readonly addSourceFolder: string;
  readonly selectContext: string;
  readonly clearContext: string;
  readonly rescanVault: string;
  readonly rebuildIndex: string;
}

export interface AIResearchMenuLabels {
  readonly openWorkbench: string;
  readonly selectModel: string;
  readonly configureProvider: string;
  readonly newDraft: string;
  readonly runCurrentTask: string;
  readonly cancelCurrentTask: string;
  readonly viewDraftEvidence: string;
}

export interface GraphMenuLabels {
  readonly openMainView: string;
  readonly scopeCurrentFile: string;
  readonly scopeSelectedFiles: string;
  readonly scopeFolderProject: string;
  readonly scopeCustom: string;
  readonly scopeWholeVault: string;
  readonly layoutForce: string;
  readonly layoutHierarchical: string;
  readonly layoutCircular: string;
  readonly openStylePanel: string;
  readonly toggleRelationLabel: string;
  readonly resetView: string;
}

export interface ArtifactMenuLabels {
  readonly openPanel: string;
  readonly viewCurrentDraft: string;
  readonly viewEvidence: string;
  readonly clearDraft: string;
  readonly saveToVault: string;
  readonly exportArtifact: string;
}

export interface ExportMenuLabels {
  readonly docx: string;
  readonly pdf: string;
  readonly latex: string;
  readonly html: string;
  readonly templateConfig: string;
}

export interface SettingsMenuLabels {
  readonly openCenter: string;
  readonly providerCenter: string;
  readonly modelSettings: string;
  readonly vaultSettings: string;
  readonly themeSettings: string;
  readonly privacy: string;
  readonly keybindings: string;
}

export interface HelpMenuLabels {
  readonly showHelp: string;
  readonly logLocation: string;
  readonly userDataDir: string;
  readonly reportIssue: string;
  readonly thirdPartyNotices: string;
  readonly about: string;
}

export interface AllMenuLabels {
  readonly schola: ScholaMenuLabels;
  readonly file: FileMenuLabels;
  readonly edit: EditMenuLabels;
  readonly view: ViewMenuLabels;
  readonly knowledge: KnowledgeMenuLabels;
  readonly aiResearch: AIResearchMenuLabels;
  readonly graph: GraphMenuLabels;
  readonly artifact: ArtifactMenuLabels;
  readonly export: ExportMenuLabels;
  readonly settings: SettingsMenuLabels;
  readonly help: HelpMenuLabels;
}

// ── zh-CN ──

const ZH_CN: AllMenuLabels = {
  schola: {
    about: '关于 Schola',
    checkUpdate: '检查更新',
    preferences: '偏好设置',
    hide: '隐藏 Schola',
    hideOthers: '隐藏其他',
    showAll: '显示全部',
    quit: '退出',
  },
  file: {
    openVault: '打开 Vault…',
    closeVault: '关闭 Vault',
    newMarkdown: '新建 Markdown',
    newFolder: '新建文件夹',
    rename: '重命名',
    delete: '删除到回收站',
    revealInExplorer: '在文件管理器中显示',
  },
  edit: {
    undo: '撤销',
    redo: '重做',
    cut: '剪切',
    copy: '复制',
    paste: '粘贴',
    selectAll: '全选',
    find: '查找',
    replace: '替换',
  },
  view: {
    toggleActivityBar: '切换 Activity Bar',
    toggleSideBar: '切换 SideBar',
    toggleBottomPanel: '切换 Bottom Panel',
    zoomIn: '放大',
    zoomOut: '缩小',
    resetZoom: '重置缩放',
    toggleFullscreen: '切换全屏',
    toggleDevTools: '开发者工具',
  },
  knowledge: {
    addSourceFile: '添加知识库源文件…',
    addSourceFolder: '添加知识库文件夹…',
    selectContext: '选择上下文',
    clearContext: '清空当前上下文',
    rescanVault: '重新扫描 Vault',
    rebuildIndex: '重建索引',
  },
  aiResearch: {
    openWorkbench: '打开 AI Research Workbench',
    selectModel: '选择模型',
    configureProvider: '配置 Provider…',
    newDraft: '新建 AI 任务草稿',
    runCurrentTask: '运行当前任务',
    cancelCurrentTask: '取消当前任务',
    viewDraftEvidence: '查看草稿与证据',
  },
  graph: {
    openMainView: '打开 Graph 主视图',
    scopeCurrentFile: '当前文件图谱',
    scopeSelectedFiles: '已选文件图谱',
    scopeFolderProject: '文件夹 / 项目图谱',
    scopeCustom: '自定义范围图谱',
    scopeWholeVault: 'Whole Vault 图谱（高级）',
    layoutForce: '切换布局：Force',
    layoutHierarchical: '切换布局：Hierarchical',
    layoutCircular: '切换布局：Circular',
    openStylePanel: '打开 Style Panel',
    toggleRelationLabel: '显示 / 隐藏关系名称',
    resetView: '重置图谱视图',
  },
  artifact: {
    openPanel: '打开 Artifact 面板',
    viewCurrentDraft: '查看当前草稿',
    viewEvidence: '查看 Evidence',
    clearDraft: '清除当前草稿',
    saveToVault: '保存到 Vault',
    exportArtifact: '导出 Artifact',
  },
  export: {
    docx: '导出为 DOCX',
    pdf: '导出为 PDF',
    latex: '导出为 LaTeX',
    html: '导出为 HTML',
    templateConfig: '导出模板设置',
  },
  settings: {
    openCenter: '打开设置中心',
    providerCenter: 'Provider Center',
    modelSettings: '模型设置',
    vaultSettings: 'Vault 设置',
    themeSettings: '主题设置',
    privacy: '隐私与上下文确认',
    keybindings: '快捷键设置',
  },
  help: {
    showHelp: 'Schola 帮助',
    logLocation: '查看日志位置',
    userDataDir: '打开用户数据目录',
    reportIssue: '报告问题',
    thirdPartyNotices: '许可证与第三方声明',
    about: '关于',
  },
};

// ── en fallback ──

const EN: AllMenuLabels = {
  schola: {
    about: 'About Schola',
    checkUpdate: 'Check for Updates',
    preferences: 'Preferences',
    hide: 'Hide Schola',
    hideOthers: 'Hide Others',
    showAll: 'Show All',
    quit: 'Quit',
  },
  file: {
    openVault: 'Open Vault…',
    closeVault: 'Close Vault',
    newMarkdown: 'New Markdown',
    newFolder: 'New Folder',
    rename: 'Rename',
    delete: 'Move to Trash',
    revealInExplorer: 'Reveal in Explorer',
  },
  edit: {
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    find: 'Find',
    replace: 'Replace',
  },
  view: {
    toggleActivityBar: 'Toggle Activity Bar',
    toggleSideBar: 'Toggle SideBar',
    toggleBottomPanel: 'Toggle Bottom Panel',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    resetZoom: 'Reset Zoom',
    toggleFullscreen: 'Toggle Fullscreen',
    toggleDevTools: 'Developer Tools',
  },
  knowledge: {
    addSourceFile: 'Add Knowledge Source File…',
    addSourceFolder: 'Add Knowledge Source Folder…',
    selectContext: 'Select Context',
    clearContext: 'Clear Current Context',
    rescanVault: 'Rescan Vault',
    rebuildIndex: 'Rebuild Index',
  },
  aiResearch: {
    openWorkbench: 'Open AI Research Workbench',
    selectModel: 'Select Model',
    configureProvider: 'Configure Provider…',
    newDraft: 'New AI Task Draft',
    runCurrentTask: 'Run Current Task',
    cancelCurrentTask: 'Cancel Current Task',
    viewDraftEvidence: 'View Draft & Evidence',
  },
  graph: {
    openMainView: 'Open Graph Main View',
    scopeCurrentFile: 'Current File Graph',
    scopeSelectedFiles: 'Selected Files Graph',
    scopeFolderProject: 'Folder / Project Graph',
    scopeCustom: 'Custom Scope Graph',
    scopeWholeVault: 'Whole Vault Graph (Advanced)',
    layoutForce: 'Switch Layout: Force',
    layoutHierarchical: 'Switch Layout: Hierarchical',
    layoutCircular: 'Switch Layout: Circular',
    openStylePanel: 'Open Style Panel',
    toggleRelationLabel: 'Show / Hide Relation Labels',
    resetView: 'Reset Graph View',
  },
  artifact: {
    openPanel: 'Open Artifact Panel',
    viewCurrentDraft: 'View Current Draft',
    viewEvidence: 'View Evidence',
    clearDraft: 'Clear Current Draft',
    saveToVault: 'Save to Vault',
    exportArtifact: 'Export Artifact',
  },
  export: {
    docx: 'Export as DOCX',
    pdf: 'Export as PDF',
    latex: 'Export as LaTeX',
    html: 'Export as HTML',
    templateConfig: 'Export Template Settings',
  },
  settings: {
    openCenter: 'Open Settings Center',
    providerCenter: 'Provider Center',
    modelSettings: 'Model Settings',
    vaultSettings: 'Vault Settings',
    themeSettings: 'Theme Settings',
    privacy: 'Privacy & Context Confirmation',
    keybindings: 'Keyboard Shortcuts',
  },
  help: {
    showHelp: 'Schola Help',
    logLocation: 'View Log Location',
    userDataDir: 'Open User Data Directory',
    reportIssue: 'Report Issue',
    thirdPartyNotices: 'License & Third-Party Notices',
    about: 'About',
  },
};

// ── Public API ──

const LABELS: Record<MenuLocale, AllMenuLabels> = {
  'zh-CN': ZH_CN,
  en: EN,
};

/** Get menu labels for the given locale. Falls back to zh-CN for unknown locales. */
export function getMenuLabels(locale?: string | null): AllMenuLabels {
  if (locale && locale in LABELS) {
    return LABELS[locale as MenuLocale];
  }
  return ZH_CN;
}

export { ZH_CN, EN };
