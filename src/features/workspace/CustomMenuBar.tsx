/**
 * CustomMenuBar — Phase 5-DEV-WORKSPACE-GLOBAL-THEME-MENUBAR-PRIMER-R6-R5.
 *
 * Renderer-based custom menu bar that replaces the native Electron menu bar.
 * Native menu is hidden via BrowserWindow frame:false; keyboard accelerators
 * still work through the registered native Menu.setApplicationMenu.
 *
 * Security: no IPC, no provider, no Vault write, no context send.
 * All actions dispatch through typed callbacks from WorkspaceShell.
 */
import { useState, useCallback, useRef, useEffect, type ReactElement } from 'react';
import type { ActivityId } from './ActivityBar';
import type { GraphScope, GraphLayoutAlgorithm } from '../graph/lib/graphTypes';

export type MenuNavigateActivityId = ActivityId | 'search' | 'help';

export interface MenuCommandCallbacks {
  readonly onNavigate: (activity: MenuNavigateActivityId, section?: string, action?: string) => void;
  readonly onAction: (action: string) => void;
  readonly onViewToggle: (panel: string) => void;
  readonly onGraphScope: (scope: GraphScope) => void;
  readonly onGraphLayout: (layout: GraphLayoutAlgorithm) => void;
  readonly onGraphAction: (action: string) => void;
}

// ── Menu definition ──

interface MenuItemDef {
  readonly label: string;
  readonly command: string;
}

interface MenuDef {
  readonly label: string;
  readonly items: readonly MenuItemDef[];
}

export const MENU_DEFS: readonly MenuDef[] = [
  {
    label: '\u6587\u4EF6',
    items: [
      { label: '\u6253\u5F00\u77E5\u8BC6\u5E93\u2026', command: 'navigate:files' },
      { label: '\u5173\u95ED\u77E5\u8BC6\u5E93', command: 'navigate:files:close' },
      { label: '-', command: '' },
      { label: '\u65B0\u5EFA Markdown', command: 'action:newMarkdown' },
      { label: '\u65B0\u5EFA\u6587\u4EF6\u5939', command: 'action:newFolder' },
      { label: '-', command: '' },
      { label: '\u91CD\u547D\u540D', command: 'action:rename' },
      { label: '\u5220\u9664\u5230\u56DE\u6536\u7AD9', command: 'action:delete' },
      { label: '-', command: '' },
      { label: '\u5728\u6587\u4EF6\u7BA1\u7406\u5668\u4E2D\u663E\u793A', command: 'action:revealInExplorer' },
    ],
  },
  {
    label: '\u7F16\u8F91',
    items: [
      { label: '\u64A4\u9500', command: 'native:undo' },
      { label: '\u91CD\u505A', command: 'native:redo' },
      { label: '-', command: '' },
      { label: '\u526A\u5207', command: 'native:cut' },
      { label: '\u590D\u5236', command: 'native:copy' },
      { label: '\u7C98\u8D34', command: 'native:paste' },
      { label: '\u5168\u9009', command: 'native:selectAll' },
      { label: '-', command: '' },
      { label: '\u67E5\u627E', command: 'action:find' },
    ],
  },
  {
    label: '\u89C6\u56FE',
    items: [
      { label: '\u5207\u6362\u6D3B\u52A8\u680F', command: 'view:toggleActivityBar' },
      { label: '\u5207\u6362\u4FA7\u680F', command: 'view:toggleSideBar' },
      { label: '\u5207\u6362\u5E95\u90E8\u9762\u677F', command: 'view:toggleBottomPanel' },
      { label: '-', command: '' },
      { label: '\u653E\u5927', command: 'native:zoomIn' },
      { label: '\u7F29\u5C0F', command: 'native:zoomOut' },
      { label: '\u91CD\u7F6E\u7F29\u653E', command: 'native:resetZoom' },
    ],
  },
  {
    label: '\u77E5\u8BC6\u5E93',
    items: [
      { label: '\u91CD\u65B0\u626B\u63CF', command: 'navigate:files:rescan' },
      { label: '\u91CD\u5EFA\u7D22\u5F15', command: 'navigate:files:rebuildIndex' },
    ],
  },
  {
    label: '\u5BFC\u5165',
    items: [
      { label: '\u5BFC\u5165\u6587\u6863\u2026', command: 'action:importDocument' },
    ],
  },
  {
    label: 'AI Research',
    items: [
      { label: '\u6253\u5F00 AI \u7814\u7A76\u5DE5\u4F5C\u53F0', command: 'navigate:ai' },
      { label: '\u6E05\u9664\u4E0A\u4E0B\u6587', command: 'action:clearContext' },
    ],
  },
  {
    label: '\u56FE\u8C31',
    items: [
      { label: '\u6253\u5F00\u56FE\u8C31\u4E3B\u89C6\u56FE', command: 'navigate:graph' },
      { label: '-', command: '' },
      { label: '\u5F53\u524D\u6587\u4EF6\u56FE\u8C31', command: 'graph:scope:current-file' },
      { label: '\u6587\u4EF6\u5939 / \u9879\u76EE\u56FE\u8C31', command: 'graph:scope:folder-project' },
      { label: '\u6574\u4E2A Vault \u56FE\u8C31', command: 'graph:scope:whole-vault' },
      { label: '-', command: '' },
      { label: '\u5207\u6362\u5E03\u5C40\uFF1AForce', command: 'graph:layout:force-directed' },
      { label: '\u5207\u6362\u5E03\u5C40\uFF1AHierarchical', command: 'graph:layout:hierarchical' },
      { label: '\u5207\u6362\u5E03\u5C40\uFF1ACircular', command: 'graph:layout:circular' },
      { label: '-', command: '' },
      { label: '\u91CD\u7F6E\u56FE\u8C31\u89C6\u56FE', command: 'graph:action:resetView' },
    ],
  },
  {
    label: 'Artifact',
    items: [
      { label: '\u6253\u5F00 Artifact \u9762\u677F', command: 'navigate:artifacts' },
    ],
  },
  {
    label: '\u5BFC\u51FA',
    items: [
      { label: '\u5BFC\u51FA\u4E3A DOCX', command: 'navigate:artifacts:export' },
      { label: '\u5BFC\u51FA\u4E3A HTML', command: 'navigate:artifacts:export' },
    ],
  },
  {
    label: '\u8BBE\u7F6E',
    items: [
      { label: '\u6253\u5F00\u8BBE\u7F6E\u4E2D\u5FC3', command: 'navigate:settings' },
      { label: '\u4E3B\u9898\u8BBE\u7F6E', command: 'navigate:settings:theme' },
    ],
  },
  {
    label: '\u5E2E\u52A9',
    items: [
      { label: 'Schola \u5E2E\u52A9', command: 'navigate:help' },
    ],
  },
];

// ── CustomMenuBar ──

export interface CustomMenuBarProps {
  readonly callbacks: MenuCommandCallbacks;
}

export function CustomMenuBar({ callbacks }: CustomMenuBarProps): ReactElement {
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setOpenMenu(null), []);

  // Close on outside click
  useEffect(() => {
    if (openMenu === null) return;
    const handleClick = (e: MouseEvent): void => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenu, closeMenu]);

  const dispatch = useCallback(
    (command: string): void => {
      closeMenu();
      if (!command) return;

      if (command.startsWith('navigate:')) {
        const parts = command.split(':');
        const activity = parts[1] as MenuNavigateActivityId;
        const section = parts[2] ?? undefined;
        const action = parts[3] ?? undefined;
        callbacks.onNavigate(activity, section, action);
        return;
      }

      if (command.startsWith('action:')) {
        const action = command.split(':')[1];
        callbacks.onAction(action);
        return;
      }

      if (command.startsWith('view:')) {
        const panel = command.split(':')[1];
        callbacks.onViewToggle(panel);
        return;
      }

      if (command.startsWith('graph:scope:')) {
        const scope = command.split(':')[2];
        callbacks.onGraphScope(scope as GraphScope);
        return;
      }

      if (command.startsWith('graph:layout:')) {
        const layout = command.split(':')[2].replace('-', '_') as GraphLayoutAlgorithm;
        callbacks.onGraphLayout(layout);
        return;
      }

      if (command.startsWith('graph:action:')) {
        const action = command.split(':')[2];
        callbacks.onGraphAction(action);
        return;
      }

      // native commands: handled by Electron menu accelerators, no-op here
    },
    [callbacks, closeMenu],
  );

  return (
    <div className="schola-menubar" ref={barRef} data-testid="custom-menubar">
      {MENU_DEFS.map((menu, idx) => (
        <div key={menu.label} className="menubar-item-container">
          <button
            type="button"
            className={`menubar-item${openMenu === idx ? ' menubar-item-active' : ''}`}
            data-testid={`menubar-${menu.label}`}
            onClick={() => setOpenMenu(openMenu === idx ? null : idx)}
            onMouseEnter={() => {
              if (openMenu !== null) setOpenMenu(idx);
            }}
          >
            {menu.label}
          </button>
          {openMenu === idx && (
            <div className="menubar-dropdown" data-testid={`menubar-dropdown-${menu.label}`}>
              {menu.items.map((item) =>
                item.label === '-' ? (
                  <div key={`sep-${item.command || idx}`} className="menubar-dropdown-separator" />
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    className="menubar-dropdown-item"
                    data-testid={`menubar-action-${item.command}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      dispatch(item.command);
                    }}
                  >
                    {item.label}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
