/**
 * Menu Template — Phase 5-3-IMP.
 *
 * Builds the full 11-menu Electron application menu template
 * using labels, command registry, and platform helpers.
 * Security: no generic IPC, no shell.openExternal, no arbitrary command.
 */

import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';
import type { AllMenuLabels } from './menu-labels';
import { getMenuLabels } from './menu-labels';
import {
  isCommandDisabled,
  ROLE_SET,
} from './menu-command-registry';
import {
  isMacOS,
  macOSItems,
  sep,
  accel,
} from './menu-platform';
import type { MenuActionDispatcher } from './menu-action-dispatcher';

// ── Role mapping ──

const ROLE_MAP: Record<string, string> = {
  'schola.edit.undo': 'undo',
  'schola.edit.redo': 'redo',
  'schola.edit.cut': 'cut',
  'schola.edit.copy': 'copy',
  'schola.edit.paste': 'paste',
  'schola.edit.selectAll': 'selectAll',
  'schola.view.zoomIn': 'zoomIn',
  'schola.view.zoomOut': 'zoomOut',
  'schola.view.resetZoom': 'resetZoom',
  'schola.view.toggleFullscreen': 'togglefullscreen',
};

function isEnglish(locale?: string): boolean {
  return locale === 'en';
}

// Then use it:
// label: isEnglish(input.locale) ? 'Knowledge Sources' : '知识库',

interface TemplateInput {
  readonly mainWindow: BrowserWindow;
  readonly isPackaged: boolean;
  readonly locale?: string;
  readonly dispatcher: MenuActionDispatcher;
}

function isEnglishLocale(locale?: string): boolean {
  return locale === 'en';
}

function item(
  commandId: string,
  label: string,
  input: TemplateInput,
  opts?: Partial<MenuItemConstructorOptions>,
): MenuItemConstructorOptions {
  const disabled = isCommandDisabled(commandId, input.isPackaged);
  const roleStr = ROLE_MAP[commandId];

  if (roleStr) {
    return { label, role: roleStr as MenuItemConstructorOptions['role'], enabled: !disabled, ...opts };
  }

  return {
    label,
    enabled: !disabled,
    click: disabled
      ? undefined
      : () => input.dispatcher.dispatch(commandId),
    ...opts,
  };
}

// ── Template builder ──

export function buildMenuTemplate(input: TemplateInput): MenuItemConstructorOptions[] {
  const L: AllMenuLabels = getMenuLabels(input.locale);

  const template: MenuItemConstructorOptions[] = [];

  // ── Schola (macOS App Menu) ──
  if (isMacOS()) {
    template.push({
      label: 'Schola',
      submenu: [
        item('schola.app.about', L.schola.about, input),
        item('schola.app.checkUpdate', L.schola.checkUpdate, input),
        sep(),
        item('schola.app.preferences', L.schola.preferences, input, { accelerator: 'Cmd+,' }),
        sep(),
        { role: 'services' as const },
        sep(),
        { role: 'hide' as const, label: L.schola.hide },
        { role: 'hideOthers' as const, label: L.schola.hideOthers },
        { role: 'unhide' as const, label: L.schola.showAll },
        sep(),
        { role: 'quit' as const, label: L.schola.quit, accelerator: 'Cmd+Q' },
      ],
    });
  }

  // ── 文件 ──
  template.push({
    label: isEnglishLocale(input.locale) ? 'File' : '文件',
    submenu: [
      item('schola.vault.open', L.file.openVault, input, { accelerator: accel('O') }),
      item('schola.vault.close', L.file.closeVault, input),
      sep(),
      item('schola.file.newMarkdown', L.file.newMarkdown, input, { accelerator: accel('N') }),
      item('schola.file.newFolder', L.file.newFolder, input),
      sep(),
      item('schola.file.rename', L.file.rename, input),
      item('schola.file.delete', L.file.delete, input, { accelerator: 'Delete' }),
      sep(),
      item('schola.file.revealInExplorer', L.file.revealInExplorer, input),
      ...(isMacOS() ? [] : [
        sep(),
        { role: 'quit' as const, label: L.schola.quit, accelerator: 'Alt+F4' },
      ]),
    ],
  });

  // ── 编辑 ──
  template.push({
    label: isEnglishLocale(input.locale) ? 'Edit' : '编辑',
    submenu: [
      item('schola.edit.undo', L.edit.undo, input, { accelerator: accel('Z') }),
      item('schola.edit.redo', L.edit.redo, input, { accelerator: accel('Shift+Z') }),
      sep(),
      item('schola.edit.cut', L.edit.cut, input, { accelerator: accel('X') }),
      item('schola.edit.copy', L.edit.copy, input, { accelerator: accel('C') }),
      item('schola.edit.paste', L.edit.paste, input, { accelerator: accel('V') }),
      item('schola.edit.selectAll', L.edit.selectAll, input, { accelerator: accel('A') }),
      sep(),
      item('schola.edit.find', L.edit.find, input, { accelerator: accel('F') }),
      item('schola.edit.replace', L.edit.replace, input, { accelerator: accel('H') }),
    ],
  });

  // ── 视图 ──
  template.push({
    label: isEnglishLocale(input.locale) ? 'View' : '视图',
    submenu: [
      item('schola.view.toggleActivityBar', L.view.toggleActivityBar, input),
      item('schola.view.toggleSideBar', L.view.toggleSideBar, input),
      item('schola.view.toggleBottomPanel', L.view.toggleBottomPanel, input),
      sep(),
      item('schola.view.zoomIn', L.view.zoomIn, input, { accelerator: accel('=') }),
      item('schola.view.zoomOut', L.view.zoomOut, input, { accelerator: accel('-') }),
      item('schola.view.resetZoom', L.view.resetZoom, input, { accelerator: accel('0') }),
      sep(),
      item('schola.view.toggleFullscreen', L.view.toggleFullscreen, input, { accelerator: 'F11' }),
      sep(),
      item('schola.view.toggleDevTools', L.view.toggleDevTools, input, { accelerator: accel('Shift+I') }),
    ],
  });

  // ── 知识库 ──
  template.push({
    label: isEnglishLocale(input.locale) ? 'Knowledge Sources' : '知识库',
    submenu: [
      item('schola.knowledge.addSourceFile', L.knowledge.addSourceFile, input),
      item('schola.knowledge.addSourceFolder', L.knowledge.addSourceFolder, input),
      sep(),
      item('schola.knowledge.selectContext', L.knowledge.selectContext, input),
      item('schola.knowledge.clearContext', L.knowledge.clearContext, input),
      sep(),
      item('schola.knowledge.rescanVault', L.knowledge.rescanVault, input),
      item('schola.knowledge.rebuildIndex', L.knowledge.rebuildIndex, input),
    ],
  });

  // ── AI Research ──
  template.push({
    label: 'AI Research',
    submenu: [
      item('schola.ai.openWorkbench', L.aiResearch.openWorkbench, input),
      sep(),
      item('schola.ai.selectModel', L.aiResearch.selectModel, input),
      item('schola.ai.configureProvider', L.aiResearch.configureProvider, input),
      sep(),
      item('schola.ai.newDraft', L.aiResearch.newDraft, input),
      item('schola.ai.runCurrentTask', L.aiResearch.runCurrentTask, input),
      item('schola.ai.cancelCurrentTask', L.aiResearch.cancelCurrentTask, input),
      sep(),
      item('schola.ai.viewDraftEvidence', L.aiResearch.viewDraftEvidence, input),
    ],
  });

  // ── 图谱 ──
  template.push({
    label: isEnglishLocale(input.locale) ? 'Graph' : '图谱',
    submenu: [
      item('schola.graph.openMainView', L.graph.openMainView, input),
      sep(),
      item('schola.graph.scopeCurrentFile', L.graph.scopeCurrentFile, input),
      item('schola.graph.scopeSelectedFiles', L.graph.scopeSelectedFiles, input),
      item('schola.graph.scopeFolderProject', L.graph.scopeFolderProject, input),
      item('schola.graph.scopeCustom', L.graph.scopeCustom, input),
      item('schola.graph.scopeWholeVault', L.graph.scopeWholeVault, input),
      sep(),
      item('schola.graph.layoutForce', L.graph.layoutForce, input),
      item('schola.graph.layoutHierarchical', L.graph.layoutHierarchical, input),
      item('schola.graph.layoutCircular', L.graph.layoutCircular, input),
      sep(),
      item('schola.graph.openStylePanel', L.graph.openStylePanel, input),
      item('schola.graph.toggleRelationLabel', L.graph.toggleRelationLabel, input),
      item('schola.graph.resetView', L.graph.resetView, input),
    ],
  });

  // ── Artifact ──
  template.push({
    label: 'Artifact',
    submenu: [
      item('schola.artifact.openPanel', L.artifact.openPanel, input),
      item('schola.artifact.viewCurrentDraft', L.artifact.viewCurrentDraft, input),
      item('schola.artifact.viewEvidence', L.artifact.viewEvidence, input),
      sep(),
      item('schola.artifact.clearDraft', L.artifact.clearDraft, input),
      sep(),
      item('schola.artifact.saveToVault', L.artifact.saveToVault, input),
      item('schola.artifact.exportArtifact', L.artifact.exportArtifact, input),
    ],
  });

  // ── 导出 ──
  template.push({
    label: isEnglishLocale(input.locale) ? 'Export' : '导出',
    submenu: [
      item('schola.export.docx', L.export.docx, input),
      item('schola.export.pdf', L.export.pdf, input),
      item('schola.export.latex', L.export.latex, input),
      item('schola.export.html', L.export.html, input),
      sep(),
      item('schola.export.templateConfig', L.export.templateConfig, input),
    ],
  });

  // ── 设置 ──
  template.push({
    label: isEnglishLocale(input.locale) ? 'Settings' : '设置',
    submenu: [
      item('schola.settings.openCenter', L.settings.openCenter, input, { accelerator: accel(',') }),
      item('schola.settings.providerCenter', L.settings.providerCenter, input),
      item('schola.settings.modelSettings', L.settings.modelSettings, input),
      sep(),
      item('schola.settings.vaultSettings', L.settings.vaultSettings, input),
      item('schola.settings.themeSettings', L.settings.themeSettings, input),
      sep(),
      item('schola.settings.privacy', L.settings.privacy, input),
      item('schola.settings.keybindings', L.settings.keybindings, input),
    ],
  });

  // ── 帮助 ──
  template.push({
    label: isEnglishLocale(input.locale) ? 'Help' : '帮助',
    submenu: [
      item('schola.help.showHelp', L.help.showHelp, input),
      item('schola.help.logLocation', L.help.logLocation, input),
      item('schola.help.userDataDir', L.help.userDataDir, input),
      sep(),
      item('schola.help.reportIssue', L.help.reportIssue, input),
      sep(),
      item('schola.help.thirdPartyNotices', L.help.thirdPartyNotices, input),
      item('schola.help.about', L.help.about, input),
      ...(isMacOS() ? [] : [
        sep(),
        item('schola.app.about', L.schola.about, input),
      ]),
    ],
  });

  return template;
}

/** Count total menu items (including separators). */
export function countMenuItems(template: readonly MenuItemConstructorOptions[]): number {
  let count = 0;
  for (const top of template) {
    count += 1; // top-level label
    if (top.submenu && Array.isArray(top.submenu)) {
      for (const child of top.submenu as readonly MenuItemConstructorOptions[]) {
        if (child.type === 'separator') continue;
        count += 1;
      }
    }
  }
  return count;
}
