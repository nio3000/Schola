/**
 * Menu Action Dispatcher — Phase 5-3-IMP.
 *
 * Maps 57 command IDs to fixed handler functions.
 * Security: NO generic IPC, NO shell.openExternal, NO arbitrary command.
 * All handlers are whitelisted and statically defined.
 *
 * Renderer communication uses existing fixed-function IPC channels
 * via webContents.send().
 */

import type { BrowserWindow } from 'electron';
import { app, dialog } from 'electron';
import { isCommandDisabled } from './menu-command-registry';

export interface MenuActionDispatcher {
  /** Dispatch a command by its ID. Unknown or disabled commands are silently ignored. */
  dispatch(commandId: string): void;
}

export function createMenuDispatcher(mainWindow: BrowserWindow): MenuActionDispatcher {
  const win = mainWindow;

  const handlers: Record<string, () => void> = {
    // ── App ──
    'schola.app.about': () => {
      dialog.showMessageBox(win, {
        type: 'info',
        title: '关于 Schola',
        message: `Schola v${app.getVersion()}`,
        detail: [
          `Electron ${process.versions.electron}`,
          `Node.js ${process.versions.node}`,
          `Chromium ${process.versions.chrome}`,
        ].join('\n'),
      });
    },
    'schola.app.preferences': () => {
      win.webContents.send('schola:navigate', { activity: 'settings' });
    },
    'schola.app.quit': () => {
      app.quit();
    },

    // ── File ──
    'schola.vault.open': () => {
      win.webContents.send('schola:navigate', { activity: 'files', action: 'openVault' });
    },
    'schola.vault.close': () => {
      win.webContents.send('schola:navigate', { activity: 'files', action: 'closeVault' });
    },
    'schola.file.newMarkdown': () => {
      win.webContents.send('schola:action', { action: 'newMarkdown' });
    },
    'schola.file.newFolder': () => {
      win.webContents.send('schola:action', { action: 'newFolder' });
    },
    'schola.file.rename': () => {
      win.webContents.send('schola:action', { action: 'rename' });
    },
    'schola.file.delete': () => {
      win.webContents.send('schola:action', { action: 'delete' });
    },
    'schola.file.revealInExplorer': () => {
      win.webContents.send('schola:action', { action: 'revealInExplorer' });
    },

    // ── Edit (role items handled by Electron, no handler needed) ──
    'schola.edit.find': () => {
      win.webContents.send('schola:action', { action: 'find' });
    },

    // ── View ──
    'schola.view.toggleActivityBar': () => {
      win.webContents.send('schola:view:toggle', { panel: 'activityBar' });
    },
    'schola.view.toggleSideBar': () => {
      win.webContents.send('schola:view:toggle', { panel: 'sideBar' });
    },
    'schola.view.toggleBottomPanel': () => {
      win.webContents.send('schola:view:toggle', { panel: 'bottomPanel' });
    },

    // ── Knowledge ──
    'schola.knowledge.addSourceFile': () => {
      win.webContents.send('schola:navigate', { activity: 'ai', section: 'knowledgeSources' });
    },
    'schola.knowledge.addSourceFolder': () => {
      win.webContents.send('schola:navigate', { activity: 'ai', section: 'knowledgeSources' });
    },
    'schola.knowledge.selectContext': () => {
      win.webContents.send('schola:navigate', { activity: 'ai', section: 'contextSource' });
    },
    'schola.knowledge.clearContext': () => {
      win.webContents.send('schola:action', { action: 'clearContext' });
    },

    // ── AI Research ──
    'schola.ai.openWorkbench': () => {
      win.webContents.send('schola:navigate', { activity: 'ai' });
    },
    'schola.ai.selectModel': () => {
      win.webContents.send('schola:navigate', { activity: 'ai', section: 'modelSelect' });
    },
    'schola.ai.configureProvider': () => {
      win.webContents.send('schola:navigate', { activity: 'settings', section: 'provider' });
    },
    'schola.ai.newDraft': () => {
      win.webContents.send('schola:navigate', { activity: 'ai', action: 'newDraft' });
    },
    'schola.ai.viewDraftEvidence': () => {
      win.webContents.send('schola:navigate', { activity: 'ai', section: 'draftEvidence' });
    },

    // ── Graph ──
    'schola.graph.openMainView': () => {
      win.webContents.send('schola:navigate', { activity: 'graph' });
    },
    'schola.graph.scopeCurrentFile': () => {
      win.webContents.send('schola:graph:scope', { scope: 'current-file' });
    },
    'schola.graph.scopeSelectedFiles': () => {
      win.webContents.send('schola:graph:scope', { scope: 'selected-files' });
    },
    'schola.graph.scopeFolderProject': () => {
      win.webContents.send('schola:graph:scope', { scope: 'folder-project' });
    },
    'schola.graph.scopeCustom': () => {
      win.webContents.send('schola:graph:scope', { scope: 'custom' });
    },
    'schola.graph.scopeWholeVault': () => {
      win.webContents.send('schola:graph:scope', { scope: 'whole-vault' });
    },
    'schola.graph.layoutForce': () => {
      win.webContents.send('schola:graph:layout', { layout: 'force-directed' });
    },
    'schola.graph.layoutHierarchical': () => {
      win.webContents.send('schola:graph:layout', { layout: 'hierarchical' });
    },
    'schola.graph.layoutCircular': () => {
      win.webContents.send('schola:graph:layout', { layout: 'circular' });
    },
    'schola.graph.openStylePanel': () => {
      win.webContents.send('schola:graph:action', { action: 'openStylePanel' });
    },
    'schola.graph.toggleRelationLabel': () => {
      win.webContents.send('schola:graph:action', { action: 'toggleRelationLabel' });
    },
    'schola.graph.resetView': () => {
      win.webContents.send('schola:graph:action', { action: 'resetView' });
    },

    // ── Artifact ──
    'schola.artifact.openPanel': () => {
      win.webContents.send('schola:navigate', { activity: 'artifacts' });
    },
    'schola.artifact.viewCurrentDraft': () => {
      win.webContents.send('schola:navigate', { activity: 'ai', section: 'draftEvidence' });
    },
    'schola.artifact.viewEvidence': () => {
      win.webContents.send('schola:navigate', { activity: 'ai', section: 'evidence' });
    },

    // ── Settings ──
    'schola.settings.openCenter': () => {
      win.webContents.send('schola:navigate', { activity: 'settings' });
    },
    'schola.settings.providerCenter': () => {
      win.webContents.send('schola:navigate', { activity: 'settings', section: 'provider' });
    },
    'schola.settings.modelSettings': () => {
      win.webContents.send('schola:navigate', { activity: 'settings', section: 'model' });
    },
    'schola.settings.themeSettings': () => {
      win.webContents.send('schola:navigate', { activity: 'settings', section: 'theme' });
    },
    'schola.settings.privacy': () => {
      win.webContents.send('schola:navigate', { activity: 'settings', section: 'privacy' });
    },

    // ── Help ──
    'schola.help.thirdPartyNotices': () => {
      win.webContents.send('schola:navigate', { activity: 'help', section: 'notices' });
    },
    'schola.help.about': () => {
      dialog.showMessageBox(win, {
        type: 'info',
        title: '关于 Schola',
        message: `Schola v${app.getVersion()}`,
        detail: [
          `Electron ${process.versions.electron}`,
          `Node.js ${process.versions.node}`,
          `Chromium ${process.versions.chrome}`,
        ].join('\n'),
      });
    },
  };

  return {
    dispatch(commandId: string): void {
      // Only dispatch enabled commands
      if (isCommandDisabled(commandId, app.isPackaged)) return;

      const handler = handlers[commandId];
      if (handler) {
        handler();
      }
      // Unknown commands are silently ignored — no arbitrary execution
    },
  };
}
