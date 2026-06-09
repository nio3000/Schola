/**
 * Menu Command Registry — Phase 5-3-IMP.
 *
 * Fixed whitelist of 57 command IDs. No arbitrary commands.
 * Classifies commands by status: enabled, disabled, role, dev-only, macOS-only.
 */

// ── Command ID naming convention: schola.<domain>.<action> ──

export const ENABLED_COMMANDS = [
  // Schola
  'schola.app.about',
  'schola.app.preferences',
  'schola.app.quit',

  // File
  'schola.vault.open',
  'schola.vault.close',
  'schola.file.newMarkdown',
  'schola.file.newFolder',
  'schola.file.rename',
  'schola.file.delete',
  'schola.file.revealInExplorer',

  // Edit
  'schola.edit.find',

  // View
  'schola.view.toggleActivityBar',
  'schola.view.toggleSideBar',
  'schola.view.toggleBottomPanel',

  // Knowledge
  'schola.knowledge.addSourceFile',
  'schola.knowledge.addSourceFolder',
  'schola.knowledge.selectContext',
  'schola.knowledge.clearContext',

  // AI Research
  'schola.ai.openWorkbench',
  'schola.ai.selectModel',
  'schola.ai.configureProvider',
  'schola.ai.newDraft',
  'schola.ai.viewDraftEvidence',

  // Graph
  'schola.graph.openMainView',
  'schola.graph.scopeCurrentFile',
  'schola.graph.scopeSelectedFiles',
  'schola.graph.scopeFolderProject',
  'schola.graph.scopeCustom',
  'schola.graph.scopeWholeVault',
  'schola.graph.layoutForce',
  'schola.graph.layoutHierarchical',
  'schola.graph.layoutCircular',
  'schola.graph.openStylePanel',
  'schola.graph.toggleRelationLabel',
  'schola.graph.resetView',

  // Artifact
  'schola.artifact.openPanel',
  'schola.artifact.viewCurrentDraft',
  'schola.artifact.viewEvidence',

  // Settings
  'schola.settings.openCenter',
  'schola.settings.providerCenter',
  'schola.settings.modelSettings',
  'schola.settings.themeSettings',
  'schola.settings.privacy',

  // Help
  'schola.help.thirdPartyNotices',
  'schola.help.about',
] as const;

export const DISABLED_COMMANDS = [
  'schola.app.checkUpdate',
  'schola.edit.replace',
  'schola.knowledge.rescanVault',
  'schola.knowledge.rebuildIndex',
  'schola.ai.runCurrentTask',
  'schola.ai.cancelCurrentTask',
  'schola.artifact.clearDraft',
  'schola.artifact.saveToVault',
  'schola.artifact.exportArtifact',
  'schola.export.docx',
  'schola.export.pdf',
  'schola.export.latex',
  'schola.export.html',
  'schola.export.templateConfig',
  'schola.settings.vaultSettings',
  'schola.settings.keybindings',
  'schola.help.showHelp',
  'schola.help.logLocation',
  'schola.help.userDataDir',
  'schola.help.reportIssue',
] as const;

export const ROLE_COMMANDS = [
  'schola.edit.undo',
  'schola.edit.redo',
  'schola.edit.cut',
  'schola.edit.copy',
  'schola.edit.paste',
  'schola.edit.selectAll',
  'schola.view.zoomIn',
  'schola.view.zoomOut',
  'schola.view.resetZoom',
  'schola.view.toggleFullscreen',
] as const;

export const DEV_ONLY_COMMANDS = [
  'schola.view.toggleDevTools',
] as const;

export const MACOS_ONLY_ENABLED_COMMANDS = [
  'schola.app.hide',
  'schola.app.hideOthers',
  'schola.app.showAll',
] as const;

// ── Derived sets ──

export type CommandId =
  | (typeof ENABLED_COMMANDS)[number]
  | (typeof DISABLED_COMMANDS)[number]
  | (typeof ROLE_COMMANDS)[number]
  | (typeof DEV_ONLY_COMMANDS)[number]
  | (typeof MACOS_ONLY_ENABLED_COMMANDS)[number];

export const ALL_COMMAND_IDS: readonly string[] = [
  ...ENABLED_COMMANDS,
  ...DISABLED_COMMANDS,
  ...ROLE_COMMANDS,
  ...DEV_ONLY_COMMANDS,
  ...MACOS_ONLY_ENABLED_COMMANDS,
];

export const DISABLED_SET = new Set<string>(DISABLED_COMMANDS);
export const ROLE_SET = new Set<string>(ROLE_COMMANDS);
export const DEV_ONLY_SET = new Set<string>(DEV_ONLY_COMMANDS);
export const MACOS_ONLY_SET = new Set<string>(MACOS_ONLY_ENABLED_COMMANDS);

/** True if the command should be disabled in the current build. */
export function isCommandDisabled(commandId: string, isPackaged: boolean): boolean {
  if (DISABLED_SET.has(commandId)) return true;
  if (DEV_ONLY_SET.has(commandId) && isPackaged) return true;
  return false;
}
