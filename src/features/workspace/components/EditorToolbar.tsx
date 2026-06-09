/**
 * EditorToolbar — Phase 5 / EDITOR-PREVIEW-SPLIT-R4.
 *
 * VS Code-like icon toolbar for Editor Region.
 * Icons are self-made inline SVGs — no external icon library.
 */
import type { ReactElement } from 'react';
import type { EditorViewMode } from '../WorkspaceShell';

export interface EditorToolbarProps {
  readonly hasOpenFile: boolean;
  readonly editorMode: EditorViewMode;
  readonly onTogglePreview: () => void;
  readonly onToggleSplit: () => void;
  readonly onOpenGraph: () => void;
  readonly onOpenAI: () => void;
  readonly onImport: () => void;
}

// ── Self-made inline SVG icons ──

function PreviewIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h5l2 2h5v8H2V3Z" />
      <circle cx="8" cy="9.5" r="2" />
      <path d="M2 13.5c1.5-2 3.5-3.5 6-3.5s4.5 1.5 6 3.5" />
    </svg>
  );
}

function SplitIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2" width="6" height="12" rx="1" />
      <rect x="9" y="2" width="6" height="12" rx="1" />
      <line x1="8" y1="2" x2="8" y2="14" strokeWidth="1" />
    </svg>
  );
}

function GraphIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="3" cy="11" r="1.5" />
      <circle cx="8" cy="6" r="1.5" />
      <circle cx="13" cy="3" r="1.5" />
      <line x1="4.3" y1="9.8" x2="6.8" y2="7" />
      <line x1="9.2" y1="5" x2="11.7" y2="3.8" />
    </svg>
  );
}

function AIIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L9.5 5.5l4 1-3 3 .5 4.5L8 12l-3 2 .5-4.5-3-3 4-1L8 1.5Z" />
    </svg>
  );
}

function ExportIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v9" />
      <polyline points="5,5 8,2 11,5" />
      <path d="M2.5 9.5v3a1 1 0 001 1h9a1 1 0 001-1v-3" />
    </svg>
  );
}

function ImportIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 11V2" />
      <polyline points="5,5 8,2 11,5" />
      <path d="M2.5 8v4.5a1 1 0 001 1h9a1 1 0 001-1V8" />
    </svg>
  );
}

const ICONS: Record<string, () => ReactElement> = {
  preview: PreviewIcon,
  split: SplitIcon,
  graph: GraphIcon,
  ai: AIIcon,
  import: ImportIcon,
  export: ExportIcon,
};

interface ToolbarAction {
  readonly id: string;
  readonly label: string;
  readonly tooltip: string;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
}

const ACTIONS: readonly ToolbarAction[] = [
  { id: 'preview', label: '预览', tooltip: '切换 Markdown Preview' },
  { id: 'split', label: '分屏', tooltip: 'Editor + Preview 左右分屏' },
  { id: 'import', label: '导入', tooltip: '导入文档 (PDF / DOCX / Markdown)' },
  { id: 'graph', label: '图谱', tooltip: '打开当前文件图谱' },
  { id: 'ai', label: 'AI', tooltip: 'AI Assist' },
  { id: 'export', label: '导出', tooltip: '导出 — 后续完成', disabled: true, disabledReason: '后续完成' },
];

export function EditorToolbar({
  hasOpenFile,
  editorMode,
  onTogglePreview,
  onToggleSplit,
  onOpenGraph,
  onOpenAI,
  onImport,
}: EditorToolbarProps): ReactElement {
  const isActive = (id: string): boolean => {
    if (id === 'preview') return editorMode === 'preview' || editorMode === 'split';
    if (id === 'split') return editorMode === 'split';
    return false;
  };

  const handler = (id: string): void => {
    switch (id) {
      case 'preview': onTogglePreview(); break;
      case 'split': onToggleSplit(); break;
      case 'graph': onOpenGraph(); break;
      case 'ai': onOpenAI(); break;
      case 'export':
      case 'more':
        break;
    }
  };

  return (
    <div className="schola-editor-toolbar" data-testid="editor-toolbar" role="toolbar" aria-label="编辑器工具栏">
      {ACTIONS.map((action) => {
        const IconComponent = ICONS[action.id];
        const disabled = action.disabled || (action.id !== 'import' && !hasOpenFile);
        return (
          <button
            key={action.id}
            type="button"
            className={
              'schola-editor-toolbar-btn' +
              (disabled ? ' schola-editor-toolbar-btn-disabled' : '') +
              (isActive(action.id) ? ' schola-editor-toolbar-btn-active' : '')
            }
            title={
              action.disabled
                ? `${action.tooltip}（${action.disabledReason}）`
                : !hasOpenFile
                  ? `${action.tooltip}（未打开文件）`
                  : action.tooltip
            }
            aria-label={action.tooltip}
            disabled={disabled}
            data-testid={`editor-toolbar-${action.id}`}
            onClick={() => handler(action.id)}
          >
            <span className="schola-editor-toolbar-icon">
              {IconComponent ? <IconComponent /> : action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
