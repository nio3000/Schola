/**
 * WorkspaceShell — Phase 5 / LEGACY-FEATURE-RECONNECT-R5.
 *
 * UNIQUE workspace shell. Single source of truth for layout.
 * Receives complete VaultState + handlers from useVault via App.tsx.
 *
 * Integrates real components:
 *   EditorPanel, PreviewPanel, GraphMainView, AIResearchMainView, SettingsCenter
 */
import { useState, useMemo, useCallback, useEffect, useRef, type CSSProperties, type ReactElement } from 'react';
import type { EditorView } from '@codemirror/view';
import type { VaultInfo, FileEntry } from '../../lib/contracts/vault.types';
import type { HelpOpenResult } from '../../lib/contracts/app.types';
import type {
  CreateNoteActionResult,
  CreateFolderActionResult,
  RenameActionResult,
  DeleteActionResult,
  MoveActionResult,
} from '../vault/hooks/useVault';
import { TopBar } from './TopBar';
import { CustomMenuBar } from './CustomMenuBar';
import { ActivityBar } from './ActivityBar';
import type { ActivityId } from './ActivityBar';
import { SideBar } from './SideBar';
import { BottomPanel } from './BottomPanel';
import { StatusBar } from './StatusBar';
import { EditorToolbar } from './components/EditorToolbar';
import { MarkdownToolbar } from '../editor/components/MarkdownToolbar';
import { SettingsModal } from '../settings/components/SettingsModal';
import { SettingsCenter } from '../settings/SettingsCenter';
import { WelcomePage } from './WelcomePage';
import { EmptyEditor } from './EmptyEditor';
import { FileTabs } from './FileTabs';
import { EditorPanel } from '../editor/EditorPanel';
import { PreviewPanel } from '../preview/PreviewPanel';
import { GraphMainView } from '../graph/components/GraphMainView';
import { AIResearchMainView } from '../ai-research/AIResearchMainView';
import { SearchPanel } from '../search/components/SearchPanel';
import { ArtifactEmptyView, PluginPreviewOnlyView } from './views/ProductizedEmptyViews';
import { useMenuCommands } from './hooks/useMenuCommands';
import type { MenuCommandCallbacks, MenuNavigateActivityId } from './hooks/useMenuCommands';
import { useResizeHandle } from './hooks/useResizablePanels';
import type { GraphScope } from '../graph/lib/graphTypes';
import type { SearchMatch } from '../search/lib/searchIndex';
import type { SqliteSearchMatchType } from '../../lib/contracts/search-query.types';
import { readNote, sqliteSearch, selectImportSource, createImportJob, getImportJobStatus } from '../../lib/platform/schola-api';
import { readStoredTheme } from '../preview/previewThemes';

export type EditorViewMode = 'editor' | 'preview' | 'split';

const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 480;
const SPLIT_DEFAULT_RATIO = 0.5;
const SPLIT_MIN_RATIO = 0.3;
const SPLIT_MAX_RATIO = 0.7;
const BOTTOM_PANEL_DEFAULT_HEIGHT = 220;
const BOTTOM_PANEL_MIN_HEIGHT = 120;
const BOTTOM_PANEL_MAX_VIEWPORT_RATIO = 0.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface WorkspaceShellProps {
  readonly activeVault: VaultInfo | null;
  readonly recentVaults: readonly VaultInfo[];
  readonly fileTree: readonly FileEntry[];
  readonly selectedFile: string | null;
  readonly hasVault: boolean;
  readonly vaultStatus: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  readonly vaultMessage: string;
  readonly appReady: boolean;
  readonly appError: string | null;
  readonly isOpening: boolean;
  readonly onOpenVault: () => Promise<void>;
  readonly onCreateVault: () => Promise<void>;
  readonly onOpenVaultByPath: (rootPath: string) => Promise<void>;
  readonly onCloseVault: () => Promise<void>;
  readonly onSelectFile: (relativePath: string | null) => void;
  readonly onOpenHelp: () => Promise<HelpOpenResult>;
  readonly onCreateNote: (parentRelativePath: string, fileName: string) => Promise<CreateNoteActionResult>;
  readonly onCreateFolder: (parentRelativePath: string, folderName: string) => Promise<CreateFolderActionResult>;
  readonly onRenameNote: (relativePath: string, newName: string) => Promise<RenameActionResult>;
  readonly onRenameFolder: (relativePath: string, newName: string) => Promise<RenameActionResult>;
  readonly onDeleteNote: (relativePath: string) => Promise<DeleteActionResult>;
  readonly onDeleteFolder: (relativePath: string) => Promise<DeleteActionResult>;
  readonly onMoveNote: (relativePath: string, targetParentRelativePath: string) => Promise<MoveActionResult>;
  readonly onMoveFolder: (relativePath: string, targetParentRelativePath: string) => Promise<MoveActionResult>;
  readonly onRefreshVault: () => Promise<void>;
}

export function WorkspaceShell({
  activeVault,
  recentVaults,
  fileTree,
  selectedFile,
  hasVault,
  vaultStatus,
  vaultMessage,
  appReady,
  appError,
  isOpening,
  onOpenVault,
  onCreateVault,
  onOpenVaultByPath,
  onCloseVault,
  onSelectFile,
  onOpenHelp,
  onCreateNote,
  onCreateFolder,
  onRenameNote,
  onRenameFolder,
  onDeleteNote,
  onDeleteFolder,
  onMoveNote,
  onMoveFolder,
  onRefreshVault,
}: WorkspaceShellProps): ReactElement {
  const [activeActivity, setActiveActivity] = useState<ActivityId>('files');
  const [editorMode, setEditorMode] = useState<EditorViewMode>('editor');
  const [fileContent, setFileContent] = useState('');
  const [fileContentPath, setFileContentPath] = useState<string | null>(null);
  const [fileContentError, setFileContentError] = useState<string | null>(null);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [graphScope, setGraphScope] = useState<GraphScope>('current-file');
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [splitRatio, setSplitRatio] = useState(SPLIT_DEFAULT_RATIO);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(BOTTOM_PANEL_DEFAULT_HEIGHT);
  const [importPhase, setImportPhase] = useState<'idle' | 'importing' | 'completed' | 'failed'>('idle');
  const [previewTheme, setPreviewTheme] = useState(() => readStoredTheme());
  const handlePreviewThemeChange = useCallback((theme: string) => { setPreviewTheme(theme as Parameters<typeof setPreviewTheme>[0]); }, []);
  const editorViewRef = useRef<EditorView | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importFileName, setImportFileName] = useState('');
  const importPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  // ── Search state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<readonly SearchMatch[]>([]);
  const [searchSource, setSearchSource] = useState<'sqlite' | 'memory'>('sqlite');
  const [searchFallbackReason, setSearchFallbackReason] = useState('');

  const hasOpenFile = Boolean(selectedFile);
  const vaultId = activeVault?.id ?? null;

  useEffect(() => {
    if (!vaultId || !selectedFile) {
      setFileContent('');
      setFileContentPath(null);
      setFileContentError(null);
      return;
    }

    let isActive = true;
    setFileContentError(null);

    readNote(vaultId, selectedFile)
      .then((result) => {
        if (!isActive) return;
        setFileContent(result.content);
        setFileContentPath(selectedFile);
      })
      .catch((err) => {
        if (!isActive) return;
        setFileContent('');
        setFileContentPath(selectedFile);
        setFileContentError(err instanceof Error ? err.message : '无法读取当前 Markdown 文件。');
      });

    return () => {
      isActive = false;
    };
  }, [vaultId, selectedFile]);

  // ── Menu command routing ──
  const menuCallbacks: MenuCommandCallbacks = useMemo(
    () => ({
      onNavigate: (activity: MenuNavigateActivityId, _section?: string, action?: string) => {
        if (activity === 'files' && action === 'openVault') { void onOpenVault(); return; }
        if (activity === 'files' && action === 'closeVault') { void onCloseVault(); return; }
        if (activity === 'search') { setSearchModalOpen(true); return; }
        if (activity === 'settings') { setSettingsModalOpen(true); return; }
        if (activity === 'help') { void onOpenHelp(); return; }
        setActiveActivity(activity);
      },
      onAction: (action: string) => {
        if (action === 'importDocument') {
          void (async () => {
            try {
              const vaultId = activeVault?.id;
              if (!vaultId) return;
              const sourceResult = await selectImportSource();
              if (!sourceResult || !sourceResult.ok) return;
              setImportFileName(sourceResult.sourceFileName);
              setImportPhase('importing');
              setImportProgress(0);
              const result = await createImportJob({
                vaultId,
                selectedSourceToken: sourceResult.selectedSourceToken,
                sourceFormat: sourceResult.sourceFormat,
                mode: 'quick',
              });
              if (!result.ok) { setImportPhase('failed'); return; }
              // Poll for completion
              let polls = 0;
              importPollRef.current = setInterval(async () => {
                polls++;
                const statusResult = await getImportJobStatus(vaultId, result.jobId);
                if (!statusResult.ok || polls > 60) {
                  clearInterval(importPollRef.current!);
                  importPollRef.current = null;
                  if (statusResult.ok && statusResult.status.phase === 'completed') {
                    setImportPhase('completed');
                    void onRefreshVault();
                    setTimeout(() => setImportPhase('idle'), 3000);
                  } else {
                    setImportPhase('failed');
                    setTimeout(() => setImportPhase('idle'), 5000);
                  }
                  return;
                }
                const job = statusResult.status;
                setImportProgress(job.progress);
                if (job.phase === 'completed') {
                  clearInterval(importPollRef.current!);
                  importPollRef.current = null;
                  setImportPhase('completed');
                  void onRefreshVault();
                  setTimeout(() => setImportPhase('idle'), 3000);
                } else if (job.phase === 'failed' || job.phase === 'cancelled') {
                  clearInterval(importPollRef.current!);
                  importPollRef.current = null;
                  setImportPhase('failed');
                  setTimeout(() => setImportPhase('idle'), 5000);
                }
              }, 1000);
            } catch { setImportPhase('failed'); setTimeout(() => setImportPhase('idle'), 5000); }
          })();
        }
        if (action === 'find') {
          setSearchModalOpen(true);
        }
      },
      onViewToggle: (panel: string) => {
        if (panel === 'bottomPanel') setBottomPanelOpen((p) => !p);
      },
      onGraphScope: (scope: GraphScope) => { setGraphScope(scope); },
      onGraphLayout: () => {},
      onGraphAction: () => {},
    }),
    [onOpenVault, onCloseVault, onOpenHelp],
  );
  useMenuCommands(menuCallbacks);

  const handleSelectFile = useCallback((path: string) => {
    onSelectFile(path);
    setEditorMode('editor');
    setFileContentError(null);
    setOpenFiles((files) => files.includes(path) ? files : [...files, path]);
  }, [onSelectFile]);

  const handleImport = useCallback(() => {
    void (async () => {
      try {
        const vaultId = activeVault?.id;
        if (!vaultId) return;
        const sourceResult = await selectImportSource();
        if (!sourceResult || !sourceResult.ok) return;
        setImportFileName(sourceResult.sourceFileName);
        setImportPhase('importing');
        setImportProgress(0);
        const result = await createImportJob({
          vaultId,
          selectedSourceToken: sourceResult.selectedSourceToken,
          sourceFormat: sourceResult.sourceFormat,
          mode: 'quick',
        });
        if (!result.ok) { setImportPhase('failed'); setTimeout(() => setImportPhase('idle'), 5000); return; }
        let polls = 0;
        importPollRef.current = setInterval(async () => {
          polls++;
          const statusResult = await getImportJobStatus(vaultId, result.jobId);
          if (!statusResult.ok || polls > 60) {
            clearInterval(importPollRef.current!);
            importPollRef.current = null;
            if (statusResult.ok && statusResult.status.phase === 'completed') {
              setImportPhase('completed');
              void onRefreshVault();
              setTimeout(() => setImportPhase('idle'), 3000);
            } else {
              setImportPhase('failed');
              setTimeout(() => setImportPhase('idle'), 5000);
            }
            return;
          }
          const job = statusResult.status;
          setImportProgress(job.progress);
          if (job.phase === 'completed') {
            clearInterval(importPollRef.current!);
            importPollRef.current = null;
            setImportPhase('completed');
            void onRefreshVault();
            setTimeout(() => setImportPhase('idle'), 3000);
          } else if (job.phase === 'failed' || job.phase === 'cancelled') {
            clearInterval(importPollRef.current!);
            importPollRef.current = null;
            setImportPhase('failed');
            setTimeout(() => setImportPhase('idle'), 5000);
          }
        }, 1000);
      } catch { setImportPhase('failed'); setTimeout(() => setImportPhase('idle'), 5000); }
    })();
  }, [activeVault?.id, onRefreshVault]);

  const handleTogglePreview = useCallback(() => {
    setEditorMode((m) => (m === 'preview' ? 'editor' : 'preview'));
  }, []);

  const handleToggleSplit = useCallback(() => {
    setEditorMode((m) => (m === 'split' ? 'editor' : 'split'));
  }, []);

  const handleEditorContentChange = useCallback((content: string) => {
    setFileContent(content);
    setFileContentPath(selectedFile);
    setFileContentError(null);
  }, [selectedFile]);

  const sidebarResizeHandle = useResizeHandle({
    onDelta: (deltaX) => {
      setSidebarWidth((width) => clamp(width + deltaX, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH));
    },
    onDoubleClick: () => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH),
  });

  const splitResizeHandle = useResizeHandle({
    onDelta: (deltaX) => {
      const containerWidth = splitContainerRef.current?.getBoundingClientRect().width ?? window.innerWidth;
      if (containerWidth <= 0) return;
      setSplitRatio((ratio) =>
        clamp(ratio + deltaX / containerWidth, SPLIT_MIN_RATIO, SPLIT_MAX_RATIO),
      );
    },
    onDoubleClick: () => setSplitRatio(SPLIT_DEFAULT_RATIO),
  });

  const bottomPanelResizeHandle = useResizeHandle({
    onDeltaY: (deltaY) => {
      const maxHeight = Math.max(
        BOTTOM_PANEL_MIN_HEIGHT,
        Math.floor(window.innerHeight * BOTTOM_PANEL_MAX_VIEWPORT_RATIO),
      );
      setBottomPanelHeight((height) => clamp(height - deltaY, BOTTOM_PANEL_MIN_HEIGHT, maxHeight));
    },
    onDoubleClick: () => setBottomPanelHeight(BOTTOM_PANEL_DEFAULT_HEIGHT),
  });

  // ── Search handlers ──
  const handleSearchQueryChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (!vaultId || !query.trim()) {
        setSearchMatches([]);
        return;
      }
      sqliteSearch(vaultId, query).then((result) => {
        if (!result.ok) {
          setSearchMatches([]);
          setSearchSource('memory');
          setSearchFallbackReason(result.code);
          return;
        }
        const typeMap: Record<SqliteSearchMatchType, SearchMatch['matchType']> = {
          fileName: 'fileName', path: 'path', directory: 'path',
          title: 'heading', heading: 'heading', wikilink: 'wikilink',
        };
        const lowerQuery = query.toLowerCase().trim();
        const converted: SearchMatch[] = result.matches.map((r, i) => {
          let matchedText = r.matchedText;
          if (r.matchType === 'heading' || r.matchType === 'wikilink') {
            matchedText = r.matchedText.split('\n').find((part) =>
              part.toLowerCase().includes(lowerQuery),
            ) ?? r.matchedText;
          }
          return { relativePath: r.relativePath, matchedText, matchType: typeMap[r.matchType], rank: i + 1 };
        });
        setSearchMatches(converted);
        setSearchSource('sqlite');
        setSearchFallbackReason('');
      }).catch(() => {
        setSearchMatches([]);
        setSearchSource('memory');
        setSearchFallbackReason('query-error');
      });
    },
    [vaultId],
  );

  const handleSearchClose = useCallback(() => {
    setSearchModalOpen(false);
  }, []);

  const handleSearchOpenFile = useCallback(
    (relativePath: string) => {
      onSelectFile(relativePath);
      setEditorMode('editor');
      setFileContentError(null);
      setOpenFiles((files) => files.includes(relativePath) ? files : [...files, relativePath]);
      setSearchModalOpen(false);
    },
    [onSelectFile],
  );

  // ── Shell loading ──
  if (!appReady && !appError) {
    return (
      <div className="workspace-shell" data-testid="workspace-shell">
        <TopBar fileName={null} />
      <CustomMenuBar callbacks={menuCallbacks} />
        <div className="workspace-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div><h1>Schola</h1><p>正在加载…</p></div>
        </div>
        <StatusBar filePath={null} vaultName={null} activeActivity="files" />
      </div>
    );
  }

  // ── No vault: WelcomePage ──
  if (!hasVault) {
    return (
      <div className="workspace-shell" data-testid="workspace-shell">
          <TopBar fileName={null} />
      <CustomMenuBar callbacks={menuCallbacks} />
        {appError && <div className="workspace-error-banner" data-testid="app-error-banner">{appError}</div>}
      {importPhase !== 'idle' && (
        <div className={`workspace-import-banner${importPhase === 'failed' ? ' workspace-import-banner-failed' : ''}${importPhase === 'completed' ? ' workspace-import-banner-completed' : ''}`} data-testid="import-banner">
          {importPhase === 'importing' && (
            <>
              <span className="import-banner-spinner" />
              <span>正在导入 {importFileName} … {Math.round(importProgress * 100)}%</span>
            </>
          )}
          {importPhase === 'completed' && <span>✅ {importFileName} 导入完成，文件树已刷新</span>}
          {importPhase === 'failed' && <span>❌ {importFileName} 导入失败，请重试</span>}
        </div>
      )}
      {importPhase !== 'idle' && (
        <div className={`workspace-import-banner${importPhase === 'failed' ? ' workspace-import-banner-failed' : ''}${importPhase === 'completed' ? ' workspace-import-banner-completed' : ''}`} data-testid="import-banner">
          {importPhase === 'importing' && (
            <>
              <span className="import-banner-spinner" />
              <span>正在导入 {importFileName} … {Math.round(importProgress * 100)}%</span>
            </>
          )}
          {importPhase === 'completed' && <span>✅ {importFileName} 导入完成，文件树已刷新</span>}
          {importPhase === 'failed' && <span>❌ {importFileName} 导入失败，请重试</span>}
        </div>
      )}
        <div className="workspace-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <WelcomePage isOpening={isOpening} recentVaults={recentVaults}
            onOpenVault={onOpenVault} onCreateVault={onCreateVault}
            onOpenVaultByPath={onOpenVaultByPath} onOpenHelp={onOpenHelp} />
        </div>
        <StatusBar filePath={null} vaultName={null} activeActivity="files" />
      </div>
    );
  }

  // ── File view rendering (editor / preview / split) ──
  const renderFileView = (): ReactElement => {
    if (!hasOpenFile) return <EmptyEditor />;

    const currentFileContent = fileContentPath === selectedFile ? fileContent : '';
    const contentErrorPane = fileContentError ? (
      <div className="workspace-file-error" data-testid="workspace-file-error">
        {fileContentError}
      </div>
    ) : null;

    if (editorMode === 'preview') {
      return (
        <div className="preview-standalone" data-testid="preview-standalone" data-current-file={selectedFile ?? ''}>
          <div className="preview-pane-header">
            <span className="preview-pane-label">Preview</span>
            <span className="preview-pane-filename">{selectedFile?.split('/').pop() ?? ''}</span>
          </div>
          <div className="preview-pane-body">
            {contentErrorPane ?? (
              <PreviewPanel content={currentFileContent} fileTree={fileTree} vaultId={vaultId}
                noteRelativePath={selectedFile} onNavigateToFile={handleSelectFile} isVisible onThemeChange={handlePreviewThemeChange} />
            )}
          </div>
        </div>
      );
    }

    if (editorMode === 'split') {
      const splitStyle: CSSProperties = {
        gridTemplateColumns: `minmax(0, ${splitRatio}fr) 6px minmax(0, ${1 - splitRatio}fr)`,
      };

      return (
        <div
          ref={splitContainerRef}
          className="editor-split-container"
          data-testid="editor-split-container"
          style={splitStyle}
        >
          <div className="editor-pane" data-testid="editor-pane">
            <EditorPanel key={`editor-${selectedFile}`} vaultId={vaultId} selectedFile={selectedFile}
              onFileClosed={() => {}} onContentChange={handleEditorContentChange} previewTheme={previewTheme} onEditorViewReady={(view) => { editorViewRef.current = view; }} />
          </div>
          <div
            ref={splitResizeHandle.resizerRef}
            className="split-divider"
            data-testid="split-divider"
            role="separator"
            aria-label="调整编辑器和预览宽度"
            aria-orientation="vertical"
            onPointerDown={splitResizeHandle.onPointerDown}
          />
          <div className="preview-pane" data-testid="preview-pane">
            <div className="preview-pane-header">
              <span className="preview-pane-label">Preview</span>
              <span className="preview-pane-filename">{selectedFile?.split('/').pop() ?? ''}</span>
            </div>
            <div className="preview-pane-body">
              {contentErrorPane ?? (
                <PreviewPanel content={currentFileContent} fileTree={fileTree} vaultId={vaultId}
                  noteRelativePath={selectedFile} onNavigateToFile={handleSelectFile} isVisible onThemeChange={handlePreviewThemeChange} />
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="editor-pane" data-testid="editor-pane">
        <EditorPanel key={`editor-${selectedFile}`} vaultId={vaultId} selectedFile={selectedFile}
          onFileClosed={() => {}} onContentChange={handleEditorContentChange} previewTheme={previewTheme} onEditorViewReady={(view) => { editorViewRef.current = view; }} />
      </div>
    );
  };

  // ── Vault open: full workspace ──
  const workspaceBodyStyle: CSSProperties = {
    gridTemplateColumns: `44px ${sidebarWidth}px 1px minmax(0, 1fr)`,
  };

  return (
    <div className="workspace-shell" data-testid="workspace-shell">
      <TopBar
        fileName={selectedFile}
        onOpenSearch={() => setSearchModalOpen(true)}
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchQueryChange}
      />
      <CustomMenuBar callbacks={menuCallbacks} />
      {appError && <div className="workspace-error-banner" data-testid="app-error-banner">{appError}</div>}
      {importPhase !== 'idle' && (
        <div className={`workspace-import-banner${importPhase === 'failed' ? ' workspace-import-banner-failed' : ''}${importPhase === 'completed' ? ' workspace-import-banner-completed' : ''}`} data-testid="import-banner">
          {importPhase === 'importing' && (
            <>
              <span className="import-banner-spinner" />
              <span>正在导入 {importFileName} … {Math.round(importProgress * 100)}%</span>
            </>
          )}
          {importPhase === 'completed' && <span>✅ {importFileName} 导入完成，文件树已刷新</span>}
          {importPhase === 'failed' && <span>❌ {importFileName} 导入失败，请重试</span>}
        </div>
      )}

      <div className="workspace-body" style={workspaceBodyStyle}>
        <ActivityBar activeActivity={activeActivity}
          onActivityChange={(a) => a === 'settings' ? setSettingsModalOpen(true) : setActiveActivity(a)} />

        <SideBar activeActivity={activeActivity} width={sidebarWidth}
          activeVault={activeVault} fileTree={fileTree} selectedFile={selectedFile}
          status={vaultStatus} message={vaultMessage}
          onOpenVault={onOpenVault} onOpenVaultByPath={onOpenVaultByPath} onCloseVault={onCloseVault}
          onSelectFile={handleSelectFile}
          onCreateNote={onCreateNote} onCreateFolder={onCreateFolder}
          onRenameNote={onRenameNote} onRenameFolder={onRenameFolder}
          onDeleteNote={onDeleteNote} onDeleteFolder={onDeleteFolder}
          onMoveNote={onMoveNote} onMoveFolder={onMoveFolder}
          graph={{ vaultId, isOpen: activeActivity === 'graph', selectedFile, selectedFiles: openFiles,
            scope: graphScope, onOpenMainView: () => setActiveActivity('graph') }}
          onOpenAIResearchWorkbench={() => setActiveActivity('ai')}
          onOpenSettings={() => setSettingsModalOpen(true)} />

        <div
          ref={sidebarResizeHandle.resizerRef}
          className="sidebar-resizer workspace-resizer"
          data-testid="sidebar-resizer"
          role="separator"
          aria-label="调整资源管理器宽度"
          aria-orientation="vertical"
          onPointerDown={sidebarResizeHandle.onPointerDown}
        />

        <div className="workspace-editor-area" data-testid="editor-region">
          <div className="workspace-editor-header">
            <FileTabs openFiles={openFiles} activeFile={selectedFile}
              onSelectTab={(p) => onSelectFile(p)}
              onCloseTab={(p) => {
                setOpenFiles((f) => f.filter((x) => x !== p));
                if (selectedFile === p) {
                  const nextOpenFile = openFiles.find((filePath) => filePath !== p) ?? null;
                  onSelectFile(nextOpenFile);
                  setFileContent('');
                  setFileContentPath(null);
                  setFileContentError(null);
                  if (!nextOpenFile) setEditorMode('editor');
                }
              }} />
            
            <MarkdownToolbar editorViewRef={editorViewRef} disabled={!hasOpenFile} />
<EditorToolbar hasOpenFile={hasOpenFile} editorMode={editorMode}
              onTogglePreview={handleTogglePreview} onToggleSplit={handleToggleSplit}
              onOpenGraph={() => setActiveActivity('graph')}
              onOpenAI={() => setActiveActivity('ai')}
              onImport={handleImport} />
          </div>

          <div className="workspace-editor-canvas">
            {activeActivity === 'ai' ? (
              <AIResearchMainView vaultId={vaultId} fileTree={fileTree} selectedFile={selectedFile} />
            ) : activeActivity === 'graph' ? (
              <GraphMainView vaultId={vaultId} isOpen selectedFile={selectedFile}
                selectedFiles={openFiles} scope={graphScope} onScopeChange={setGraphScope}
                onOpenFile={handleSelectFile} onClose={() => setActiveActivity('files')} />
            ) : activeActivity === 'artifacts' ? (
              <ArtifactEmptyView />
            ) : activeActivity === 'plugins' ? (
              <PluginPreviewOnlyView />
            ) : (
              renderFileView()
            )}
          </div>
        </div>
      </div>

      <BottomPanel
        isOpen={bottomPanelOpen}
        height={bottomPanelHeight}
        onToggle={() => setBottomPanelOpen((p) => !p)}
        onResizeStart={bottomPanelResizeHandle.onPointerDown}
        resizerRef={bottomPanelResizeHandle.resizerRef}
      />
      <StatusBar filePath={selectedFile} vaultName={activeVault?.name ?? null} activeActivity={activeActivity} />
      {searchModalOpen ? (
        <SearchPanel
          query={searchQuery}
          matches={searchMatches}
          searchSource={searchSource}
          searchFallbackReason={searchFallbackReason}
          searchIndexReady
          onOpenFile={handleSearchOpenFile}
          onClose={handleSearchClose}
        />
      ) : null}
      <SettingsModal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)}>
        <SettingsCenter />
      </SettingsModal>
    </div>
  );
}
