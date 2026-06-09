import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { DragEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactElement } from 'react';
import type { FileEntry, VaultInfo } from '../../../lib/contracts/vault.types';
import { getDroppedFilePath } from '../../../lib/platform/schola-api';
import { FileTree } from './FileTree';
import { SearchTrigger } from '../../search/components/SearchTrigger';
import { RENDERER_START_AT, perfLog } from '../../../lib/platform/perf';

export interface VaultPanelProps {
  readonly activeVault: VaultInfo | null;
  readonly fileTree: readonly FileEntry[];
  readonly selectedFile: string | null;
  readonly status: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  readonly message: string;
  readonly onOpenVault: () => Promise<void>;
  readonly onOpenVaultByPath?: (rootPath: string) => Promise<void>;
  readonly onCloseVault: () => Promise<void>;
  readonly onSelectFile: (relativePath: string) => void;
  readonly onCreateNote: (
    parentRelativePath: string,
    fileName: string,
  ) => Promise<{ readonly ok: true; readonly relativePath: string } | { readonly ok: false; readonly message: string }>;
  readonly onCreateFolder: (
    parentRelativePath: string,
    folderName: string,
  ) => Promise<{ readonly ok: true; readonly relativePath: string } | { readonly ok: false; readonly message: string }>;
  readonly onOpenSearch?: () => void;
  readonly onImportFile?: (mode?: 'quick' | 'enhanced') => void;
  readonly importAvailableModes?: { enhanced: boolean } | null;
  readonly onExportFile?: (relativePath: string, format: string) => void;
  readonly onRenameNote?: (
    relativePath: string,
    newName: string,
  ) => Promise<{ readonly ok: true; readonly oldRelativePath: string; readonly newRelativePath: string } | { readonly ok: false; readonly message: string }>;
  readonly onRenameFolder?: (
    relativePath: string,
    newName: string,
  ) => Promise<{ readonly ok: true; readonly oldRelativePath: string; readonly newRelativePath: string } | { readonly ok: false; readonly message: string }>;
  readonly dirtyFiles?: ReadonlySet<string>;
  readonly onDeleteNote?: (
    relativePath: string,
  ) => Promise<{ readonly ok: true } | { readonly ok: false; readonly code?: string; readonly message: string }>;
  readonly onDeleteNotePermanent?: (
    relativePath: string,
  ) => Promise<{ readonly ok: true } | { readonly ok: false; readonly code?: string; readonly message: string }>;
  readonly onDeleteFolder?: (
    relativePath: string,
  ) => Promise<{ readonly ok: true } | { readonly ok: false; readonly code?: string; readonly message: string }>;
  readonly onDeleteFolderPermanent?: (
    relativePath: string,
  ) => Promise<{ readonly ok: true } | { readonly ok: false; readonly code?: string; readonly message: string }>;
  readonly onMoveNote?: (
    relativePath: string,
    targetParentRelativePath: string,
  ) => Promise<{ readonly ok: true; readonly oldRelativePath: string; readonly newRelativePath: string } | { readonly ok: false; readonly message: string }>;
  readonly onMoveFolder?: (
    relativePath: string,
    targetParentRelativePath: string,
  ) => Promise<{ readonly ok: true; readonly oldRelativePath: string; readonly newRelativePath: string } | { readonly ok: false; readonly message: string }>;
}

interface ExplorerContextMenu {
  readonly parentRelativePath: string;
  readonly entryRelativePath: string | null;
  readonly x: number;
  readonly y: number;
}

interface CreateDialogState {
  readonly kind: 'file' | 'folder';
  readonly parentRelativePath: string;
}

interface RenameDialogState {
  readonly kind: 'file' | 'folder';
  readonly relativePath: string;
  readonly originalName: string;
}

interface MoveDialogState {
  readonly kind: 'file' | 'folder';
  readonly relativePath: string;
  readonly displayName: string;
  readonly currentParentRelativePath: string;
  selectedTargetParentRelativePath: string;
}

function buildRootEntries(
  vaultName: string,
  entries: readonly FileEntry[],
): FileEntry[] {
  return [
    {
      id: '',
      name: vaultName,
      relativePath: '',
      type: 'directory' as const,
      children: entries,
    },
  ];
}

function collectDefaultExpandedPaths(entries: readonly FileEntry[], depth: number = 0): string[] {
  const paths: string[] = [];

  for (const entry of entries) {
    if (entry.type !== 'directory') {
      continue;
    }

    if (depth <= 1) {
      paths.push(entry.relativePath);
    }

    if (entry.children) {
      paths.push(...collectDefaultExpandedPaths(entry.children, depth + 1));
    }
  }

  return paths;
}

function getPathChain(relativePath: string): string[] {
  if (!relativePath) {
    return [''];
  }

  const parts = relativePath.split('/').filter(Boolean);
  return ['', ...parts.map((_, index) => parts.slice(0, index + 1).join('/'))];
}

export function VaultPanel({
  activeVault,
  fileTree,
  message,
  onCloseVault,
  onCreateFolder,
  onCreateNote,
  onOpenSearch,
  onOpenVault,
  onOpenVaultByPath,
  onRenameFolder,
  onRenameNote,
  onSelectFile,
  selectedFile,
  status,
  dirtyFiles,
  onDeleteFolder,
  onDeleteFolderPermanent,
  onDeleteNote,
  onDeleteNotePermanent,
  onMoveFolder,
  onMoveNote,
  onImportFile,
  importAvailableModes,
  onExportFile,
}: VaultPanelProps): ReactElement {
  const [dragOver, setDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<ExplorerContextMenu | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [createDialog, setCreateDialog] = useState<CreateDialogState | null>(null);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    readonly relativePath: string;
    readonly entryName: string;
    readonly kind: 'file' | 'folder';
    readonly isPermanent: boolean;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [moveDialog, setMoveDialog] = useState<MoveDialogState | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    if (!activeVault) {
      return new Set(['']);
    }
    return new Set(collectDefaultExpandedPaths(buildRootEntries(activeVault.name, fileTree)));
  });

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const createDialogInputRef = useRef<HTMLInputElement>(null);

  const rootEntries = activeVault ? buildRootEntries(activeVault.name, fileTree) : [];

  useEffect(() => {
    if (!contextMenu && !createDialog && !renameDialog && !deleteDialog && !moveDialog) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      if (contextMenu && contextMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      // Don't close context menu when clicking on create/rename/delete dialog
      if (createDialog || renameDialog || deleteDialog || moveDialog) {
        return;
      }
      setContextMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (moveDialog) {
          setMoveDialog(null);
          setMoveError(null);
          return;
        }
        if (deleteDialog) {
          setDeleteDialog(null);
          setDeleteError(null);
          return;
        }
        if (renameDialog) {
          setRenameDialog(null);
          setRenameName('');
          setRenameError(null);
          return;
        }
        if (createDialog) {
          setCreateDialog(null);
          setCreateName('');
          setCreateError(null);
          return;
        }
        if (contextMenu) {
          setContextMenu(null);
        }
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, createDialog, renameDialog, deleteDialog, moveDialog]);

  // ── Performance: fileTreeVisible timing ──
  const fileTreeLoggedRef = useRef(false);
  useEffect(() => {
    if (activeVault && fileTree.length > 0 && !fileTreeLoggedRef.current) {
      fileTreeLoggedRef.current = true;
      perfLog(`[perf:renderer] fileTreeVisible=${Date.now() - RENDERER_START_AT}ms files=${fileTree.length}`);
    }
    // Reset when vault changes so we log again on next vault open.
    if (!activeVault) {
      fileTreeLoggedRef.current = false;
    }
  }, [activeVault, fileTree]);

  const expandPathChain = useCallback((relativePath: string): void => {
    setExpandedPaths((current) => {
      const next = new Set(current);

      for (const path of getPathChain(relativePath)) {
        next.add(path);
      }

      return next;
    });
  }, []);

  const handleToggleExpand = useCallback((path: string): void => {
    setExpandedPaths((current) => {
      const next = new Set(current);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  }, []);

  const openContextMenu = useCallback((parentRelativePath: string, entryRelativePath: string | null, x: number, y: number): void => {
    if (!activeVault) {
      return;
    }

    setOperationError(null);
    setContextMenu({ parentRelativePath, entryRelativePath, x, y });
  }, [activeVault]);

  const handleOpenCreateMenu = useCallback(
    (parentRelativePath: string, entryRelativePath: string | null, event: ReactMouseEvent<HTMLButtonElement>): void => {
      openContextMenu(parentRelativePath, entryRelativePath, event.clientX, event.clientY);
    },
    [openContextMenu],
  );

  const handleBlankContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>): void => {
      if (!activeVault) {
        return;
      }

      event.preventDefault();
      openContextMenu('', null, event.clientX, event.clientY);
    },
    [activeVault, openContextMenu],
  );

  const handleCreateNote = useCallback((): void => {
    if (!contextMenu) {
      return;
    }

    const parentRelativePath = contextMenu.parentRelativePath;
    setContextMenu(null);
    setCreateDialog({ kind: 'file', parentRelativePath });
    setCreateName('');
    setCreateError(null);
  }, [contextMenu]);

  const handleCreateFolder = useCallback((): void => {
    if (!contextMenu) {
      return;
    }

    const parentRelativePath = contextMenu.parentRelativePath;
    setContextMenu(null);
    setCreateDialog({ kind: 'folder', parentRelativePath });
    setCreateName('');
    setCreateError(null);
  }, [contextMenu]);

  const handleConfirmCreate = useCallback(async (): Promise<void> => {
    if (!createDialog) {
      return;
    }

    const trimmedName = createName.trim();

    if (!trimmedName) {
      setCreateError('名称不能为空。');
      return;
    }

    setCreating(true);
    setCreateError(null);

    if (createDialog.kind === 'file') {
      let fileName = trimmedName;
      if (!fileName.endsWith('.md')) {
        fileName = `${fileName}.md`;
      }

      const result = await onCreateNote(createDialog.parentRelativePath, fileName);

      if (result.ok) {
        setCreateDialog(null);
        setCreateName('');
        setCreateError(null);
        setCreating(false);
        setOperationError(null);
        expandPathChain(createDialog.parentRelativePath);
        return;
      }

      setCreateError(result.message);
    } else {
      const result = await onCreateFolder(createDialog.parentRelativePath, trimmedName);

      if (result.ok) {
        setCreateDialog(null);
        setCreateName('');
        setCreateError(null);
        setCreating(false);
        setOperationError(null);
        expandPathChain(createDialog.parentRelativePath);
        return;
      }

      setCreateError(result.message);
    }

    setCreating(false);
  }, [createDialog, createName, onCreateNote, onCreateFolder, expandPathChain]);

  const handleCancelCreate = useCallback((): void => {
    setCreateDialog(null);
    setCreateName('');
    setCreateError(null);
  }, []);

  // ── Rename ──

  /** Strip extension from a Markdown file name for the rename input. */
  function nameWithoutExt(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.md')) return fileName.slice(0, -3);
    if (lower.endsWith('.markdown')) return fileName.slice(0, -9);
    return fileName;
  }

  const handleOpenRename = useCallback((): void => {
    if (!contextMenu || !activeVault) {
      return;
    }

    const entryPath = contextMenu.entryRelativePath;
    if (!entryPath) {
      setOperationError('无法重命名根目录。');
      return;
    }

    setContextMenu(null);

    // Check if this is a file or directory by searching the fileTree
    function findEntryType(
      entries: readonly FileEntry[],
      target: string,
    ): 'file' | 'directory' | null {
      for (const entry of entries) {
        if (entry.relativePath === target) {
          return entry.type;
        }
        if (entry.children) {
          const found = findEntryType(entry.children, target);
          if (found) return found;
        }
      }
      return null;
    }

    const entryType = findEntryType(fileTree, entryPath);
    if (!entryType) {
      setOperationError('未找到目标条目。');
      return;
    }

    const renameKind = entryType === 'directory' ? 'folder' : 'file';

    // Find the entry name
    function findEntryName(
      entries: readonly FileEntry[],
      target: string,
    ): string | null {
      for (const entry of entries) {
        if (entry.relativePath === target) {
          return entry.name;
        }
        if (entry.children) {
          const found = findEntryName(entry.children, target);
          if (found !== null) return found;
        }
      }
      return null;
    }

    const entryName = findEntryName(fileTree, entryPath) ?? '';

    setRenameDialog({ kind: renameKind, relativePath: entryPath, originalName: entryName });
    setRenameName(renameKind === 'file' ? nameWithoutExt(entryName) : entryName);
    setRenameError(null);
    setOperationError(null);
  }, [contextMenu, activeVault, fileTree]);

  const handleConfirmRename = useCallback(async (): Promise<void> => {
    if (!renameDialog || !activeVault) {
      return;
    }

    const trimmedName = renameName.trim();

    if (!trimmedName) {
      setRenameError('名称不能为空。');
      return;
    }

    if (trimmedName === '.' || trimmedName === '..') {
      setRenameError('名称无效。');
      return;
    }

    if (trimmedName.includes('/') || trimmedName.includes('\\')) {
      setRenameError('名称不能包含路径分隔符。');
      return;
    }

    // Check for unsaved changes
    if (renameDialog.kind === 'file') {
      if (dirtyFiles?.has(renameDialog.relativePath)) {
        setRenameError('当前文件有未保存的修改，请先保存后再重命名。');
        return;
      }
    } else {
      // Folder rename: check any open dirty file under this folder
      const prefix = `${renameDialog.relativePath}/`;
      const dirtyUnder = dirtyFiles
        ? [...dirtyFiles].some((f) => f.startsWith(prefix))
        : false;
      if (dirtyUnder) {
        setRenameError('该文件夹中有未保存的文件，请先保存后再重命名。');
        return;
      }
    }

    setRenaming(true);
    setRenameError(null);

    if (renameDialog.kind === 'file') {
      const result = await onRenameNote?.(renameDialog.relativePath, trimmedName);

      if (result?.ok) {
        setRenameDialog(null);
        setRenameName('');
        setRenameError(null);
        setRenaming(false);
        setOperationError(null);
        return;
      }

      setRenameError(result?.message ?? '重命名失败。');
    } else {
      const result = await onRenameFolder?.(renameDialog.relativePath, trimmedName);

      if (result?.ok) {
        setRenameDialog(null);
        setRenameName('');
        setRenameError(null);
        setRenaming(false);
        setOperationError(null);
        return;
      }

      setRenameError(result?.message ?? '重命名失败。');
    }

    setRenaming(false);
  }, [renameDialog, renameName, onRenameNote, onRenameFolder, activeVault, dirtyFiles]);

  const handleCancelRename = useCallback((): void => {
    setRenameDialog(null);
    setRenameName('');
    setRenameError(null);
  }, []);

  const handleRenameDialogKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>): void => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void handleConfirmRename();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        handleCancelRename();
      }
    },
    [handleConfirmRename, handleCancelRename],
  );

  // Auto-focus rename dialog input
  const renameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (renameDialog && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameDialog]);

  // ── Delete ──

  const handleOpenDelete = useCallback((): void => {
    if (!contextMenu || !activeVault) {
      return;
    }

    const entryPath = contextMenu.entryRelativePath;
    if (!entryPath) {
      setOperationError('无法删除根目录。');
      return;
    }

    // Find entry name
    function findEntryName(
      entries: readonly FileEntry[],
      target: string,
    ): string | null {
      for (const entry of entries) {
        if (entry.relativePath === target) {
          return entry.name;
        }
        if (entry.children) {
          const found = findEntryName(entry.children, target);
          if (found !== null) return found;
        }
      }
      return null;
    }

    const entryName = findEntryName(fileTree, entryPath) ?? '';

    // Determine kind
    function findEntryType(
      entries: readonly FileEntry[],
      target: string,
    ): 'file' | 'directory' | null {
      for (const entry of entries) {
        if (entry.relativePath === target) {
          return entry.type;
        }
        if (entry.children) {
          const found = findEntryType(entry.children, target);
          if (found) return found;
        }
      }
      return null;
    }

    const entryType = findEntryType(fileTree, entryPath);
    if (!entryType) {
      setOperationError('未找到目标条目。');
      return;
    }

    const kind = entryType === 'directory' ? 'folder' : 'file';

    // Check dirty state
    if (kind === 'file') {
      if (dirtyFiles?.has(entryPath)) {
        setOperationError('当前文件有未保存的修改，请先保存后再删除。');
        return;
      }
    } else {
      const prefix = `${entryPath}/`;
      const dirtyUnder = dirtyFiles
        ? [...dirtyFiles].some((f) => f.startsWith(prefix))
        : false;
      if (dirtyUnder) {
        setOperationError('该文件夹中有未保存的文件，请先保存或关闭后再删除。');
        return;
      }
    }

    setContextMenu(null);
    setDeleteDialog({ relativePath: entryPath, entryName, kind, isPermanent: false });
    setDeleteError(null);
    setOperationError(null);
  }, [contextMenu, activeVault, fileTree, dirtyFiles]);

  const handleConfirmDelete = useCallback(async (): Promise<void> => {
    if (!deleteDialog || !activeVault) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    if (deleteDialog.kind === 'file') {
      const result = deleteDialog.isPermanent
        ? await onDeleteNotePermanent?.(deleteDialog.relativePath)
        : await onDeleteNote?.(deleteDialog.relativePath);

      if (result?.ok) {
        setDeleteDialog(null);
        setDeleting(false);
        setDeleteError(null);
        setOperationError(null);
        return;
      }

      if (!deleteDialog.isPermanent && result?.code === 'TRASH_FAILED') {
        setDeleteDialog((prev) => (prev ? { ...prev, isPermanent: true } : null));
        setDeleting(false);
        return;
      }

      setDeleteError(result?.message ?? '删除失败。');
    } else {
      const result = deleteDialog.isPermanent
        ? await onDeleteFolderPermanent?.(deleteDialog.relativePath)
        : await onDeleteFolder?.(deleteDialog.relativePath);

      if (result?.ok) {
        setDeleteDialog(null);
        setDeleting(false);
        setDeleteError(null);
        setOperationError(null);
        return;
      }

      if (!deleteDialog.isPermanent && result?.code === 'TRASH_FAILED') {
        setDeleteDialog((prev) => (prev ? { ...prev, isPermanent: true } : null));
        setDeleting(false);
        return;
      }

      setDeleteError(result?.message ?? '删除失败。');
    }

    setDeleting(false);
  }, [deleteDialog, onDeleteNote, onDeleteNotePermanent, onDeleteFolder, onDeleteFolderPermanent, activeVault]);

  const handleCancelDelete = useCallback((): void => {
    setDeleteDialog(null);
    setDeleteError(null);
  }, []);

  // ── Move ──

  /** Current parent relativePath of an entry (empty for root-level items) */
  function getParentPath(entryPath: string): string {
    const idx = entryPath.lastIndexOf('/');
    return idx === -1 ? '' : entryPath.slice(0, idx);
  }

  const handleOpenMove = useCallback((): void => {
    if (!contextMenu || !activeVault) return;
    const entryPath = contextMenu.entryRelativePath;
    if (!entryPath) return;

    function findEntryName(entries: readonly FileEntry[], target: string): string | null {
      for (const entry of entries) {
        if (entry.relativePath === target) return entry.name;
        if (entry.children) { const f = findEntryName(entry.children, target); if (f !== null) return f; }
      }
      return null;
    }

    function findEntryType(entries: readonly FileEntry[], target: string): 'file' | 'directory' | null {
      for (const entry of entries) {
        if (entry.relativePath === target) return entry.type;
        if (entry.children) { const f = findEntryType(entry.children, target); if (f) return f; }
      }
      return null;
    }

    const entryName = findEntryName(fileTree, entryPath) ?? '';
    const entryType = findEntryType(fileTree, entryPath);
    if (!entryType) return;
    const kind = entryType === 'directory' ? 'folder' : 'file';

    // Dirty check
    if (kind === 'file') {
      if (dirtyFiles?.has(entryPath)) { setOperationError('当前文件有未保存的修改，请先保存后再移动。'); return; }
    } else {
      const prefix = `${entryPath}/`;
      if (dirtyFiles && [...dirtyFiles].some((f) => f.startsWith(prefix))) { setOperationError('该文件夹中有未保存的文件，请先保存或关闭后再移动。'); return; }
    }

    const currentParent = getParentPath(entryPath);
    setContextMenu(null);
    setMoveDialog({ kind, relativePath: entryPath, displayName: entryName, currentParentRelativePath: currentParent, selectedTargetParentRelativePath: currentParent });
    setMoveError(null);
  }, [contextMenu, activeVault, fileTree, dirtyFiles]);

  /** Collect directory paths from fileTree, excluding self and descendants */
  function collectDirectories(entries: readonly FileEntry[], excludePrefix: string | null): readonly { relativePath: string; name: string; depth: number }[] {
    const dirs: { relativePath: string; name: string; depth: number }[] = [];
    function walk(items: readonly FileEntry[], depth: number) {
      for (const entry of items) {
        if (entry.type !== 'directory') continue;
        if (excludePrefix && (entry.relativePath === excludePrefix || entry.relativePath.startsWith(`${excludePrefix}/`))) continue;
        dirs.push({ relativePath: entry.relativePath, name: entry.name, depth });
        if (entry.children) walk(entry.children, depth + 1);
      }
    }
    walk(entries, 0);
    return dirs;
  }

  const handleConfirmMove = useCallback(async (): Promise<void> => {
    if (!moveDialog || !activeVault) return;
    const target = moveDialog.selectedTargetParentRelativePath;

    if (target === moveDialog.currentParentRelativePath) {
      setMoveError('已在目标位置。');
      return;
    }

    setMoving(true);
    setMoveError(null);

    if (moveDialog.kind === 'file') {
      const result = await onMoveNote?.(moveDialog.relativePath, target);
      if (result?.ok) { setMoveDialog(null); setMoving(false); return; }
      setMoveError(result?.message ?? '移动失败。');
    } else {
      const result = await onMoveFolder?.(moveDialog.relativePath, target);
      if (result?.ok) { setMoveDialog(null); setMoving(false); return; }
      setMoveError(result?.message ?? '移动失败。');
    }
    setMoving(false);
  }, [moveDialog, onMoveNote, onMoveFolder, activeVault]);

  const handleCancelMove = useCallback((): void => { setMoveDialog(null); setMoveError(null); }, []);

  const handleCreateDialogKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>): void => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void handleConfirmCreate();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        handleCancelCreate();
      }
    },
    [handleConfirmCreate, handleCancelCreate],
  );

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (createDialog && createDialogInputRef.current) {
      createDialogInputRef.current.focus();
    }
  }, [createDialog]);

  const handleDragOver = useCallback((event: DragEvent): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'link';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent): void => {
    // Only clear when leaving the panel boundary, not child elements
    if (event.currentTarget === event.target) {
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent): void => {
      event.preventDefault();
      setDragOver(false);

      // Use Electron webUtils.getPathForFile via preload helper
      const file = event.dataTransfer.files[0];
      if (file) {
        const droppedPath = getDroppedFilePath(file);
        if (droppedPath) {
          void onOpenVaultByPath?.(droppedPath);
          return;
        }
      }

      // Fallback: plain text path (for e2e testing)
      const textPath = event.dataTransfer.getData('text/plain');
      if (textPath) {
        void onOpenVaultByPath?.(textPath);
      }
    },
    [onOpenVaultByPath],
  );

  const clampedMenuPosition = useMemo(() => {
    if (!contextMenu) {
      return null;
    }

    const menuWidth = 180;
    const menuHeight = 220;
    const padding = 8;

    const clampedX = Math.min(
      Math.max(padding, contextMenu.x),
      window.innerWidth - menuWidth - padding,
    );
    const clampedY = Math.min(
      Math.max(padding, contextMenu.y),
      window.innerHeight - menuHeight - padding,
    );

    return { x: clampedX, y: clampedY };
  }, [contextMenu]);

  return (
    <section
      className="vault-panel schola-scrollbar"
      aria-label="File explorer"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      <div className="vault-toolbar">
        <h2 className="vault-toolbar-title" data-testid="vault-panel-title">
          资源管理器
        </h2>
        <div className="vault-toolbar-right">
          {activeVault ? (
            <span className="vault-toolbar-count" data-testid="vault-file-count">
              {activeVault.noteCount} file{activeVault.noteCount !== 1 ? 's' : ''}
            </span>
          ) : null}
          <div className="vault-actions">
            {activeVault && onOpenSearch ? (
              <SearchTrigger onOpenSearch={onOpenSearch} />
            ) : null}
            {activeVault ? (
              <button
                type="button"
                data-testid="close-vault"
                title="Close Vault"
                aria-label="Close Vault"
                onClick={onCloseVault}
                disabled={status === 'loading'}
                className="vault-action-btn"
              >
                ✕
              </button>
            ) : (
              <button
                type="button"
                data-testid="open-vault"
                title="Open Vault"
                onClick={onOpenVault}
                disabled={status === 'loading'}
                className="vault-action-btn vault-action-btn-primary"
              >
                Open
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status line */}
      {activeVault ? (
        <div className="vault-status" data-status={status} data-testid="vault-status">
          <span className="status-dot" aria-hidden="true" />
          <p>{message}</p>
        </div>
      ) : null}

      {operationError ? (
        <div className="vault-operation-error" data-testid="vault-operation-error" role="status">
          {operationError}
        </div>
      ) : null}

      {/* File tree */}
      <div
        className={`file-tree-card schola-scrollbar${dragOver ? ' file-tree-card-drag-over' : ''}`}
        data-testid="file-tree-card"
        onContextMenu={handleBlankContextMenu}
      >
        {activeVault && fileTree.length > 0 ? (
          <FileTree
            entries={rootEntries}
            expandedPaths={expandedPaths}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            onToggleExpand={handleToggleExpand}
            onOpenCreateMenu={handleOpenCreateMenu}
          />
        ) : (
          <p className="empty-state">
            {activeVault ? 'No Markdown files loaded.' : '拖入文件夹以打开知识库'}
          </p>
        )}
      </div>

      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="explorer-context-menu"
          data-testid="explorer-context-menu"
          role="menu"
          style={{ left: clampedMenuPosition!.x, top: clampedMenuPosition!.y }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          <button
            type="button"
            className="explorer-context-menu-item"
            data-testid="context-menu-create-file"
            role="menuitem"
            onMouseDown={() => void handleCreateNote()}
          >
            新建 Markdown 文件
          </button>
          <button
            type="button"
            className="explorer-context-menu-item"
            data-testid="context-menu-create-folder"
            role="menuitem"
            onMouseDown={() => void handleCreateFolder()}
          >
            新建文件夹
          </button>
          {contextMenu.entryRelativePath && contextMenu.entryRelativePath.endsWith('.md') && onExportFile ? (
            <>
              <div className="explorer-context-menu-separator" />
              <div className="explorer-context-menu-label">导出</div>
              <button type="button" className="explorer-context-menu-item" role="menuitem"
                onMouseDown={() => { onExportFile(contextMenu.entryRelativePath!, 'docx'); setContextMenu(null); }}
                data-testid="context-menu-export-docx">DOCX</button>
              <button type="button" className="explorer-context-menu-item" role="menuitem"
                onMouseDown={() => { onExportFile(contextMenu.entryRelativePath!, 'html'); setContextMenu(null); }}
                data-testid="context-menu-export-html">HTML</button>
              <button type="button" className="explorer-context-menu-item" role="menuitem"
                onMouseDown={() => { onExportFile(contextMenu.entryRelativePath!, 'latex'); setContextMenu(null); }}
                data-testid="context-menu-export-latex">LaTeX</button>
              <button type="button" className="explorer-context-menu-item" role="menuitem"
                onMouseDown={() => { onExportFile(contextMenu.entryRelativePath!, 'pdf'); setContextMenu(null); }}
                data-testid="context-menu-export-pdf">PDF</button>
            </>
          ) : null}
          {(!contextMenu.entryRelativePath || (contextMenu.entryRelativePath && !contextMenu.entryRelativePath.endsWith('.md'))) && onImportFile ? (
            <>
              <div className="explorer-context-menu-separator" />
              <div className="explorer-context-menu-submenu" data-testid="context-menu-import-submenu">
                <span className="explorer-context-menu-item explorer-context-menu-item--label">导入文件</span>
                <button type="button" className="explorer-context-menu-item" role="menuitem"
                  onMouseDown={() => { onImportFile('quick'); setContextMenu(null); }}
                  data-testid="context-menu-import-quick">快速导入</button>
                {/* Phase 4-0-B: enhanced import — PDF only, currently disabled */}
                {contextMenu.entryRelativePath?.endsWith('.pdf') ? (
                  <button type="button" className="explorer-context-menu-item" role="menuitem"
                    disabled={!importAvailableModes?.enhanced}
                    onMouseDown={() => {
                      if (importAvailableModes?.enhanced) { onImportFile('enhanced'); setContextMenu(null); }
                    }}
                    data-testid="context-menu-import-enhanced">
                    增强导入{!importAvailableModes?.enhanced ? '（暂不可用）' : ''}
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
          {contextMenu.entryRelativePath ? (
            <><button
              type="button"
              className="explorer-context-menu-item"
              data-testid="context-menu-rename"
              role="menuitem"
              onMouseDown={() => void handleOpenRename()}
            >
              重命名
            </button>
            <button
              type="button"
              className="explorer-context-menu-item explorer-context-menu-item-danger"
              data-testid="context-menu-delete"
              role="menuitem"
              onMouseDown={() => void handleOpenDelete()}
            >
              删除
            </button>
            <button
              type="button"
              className="explorer-context-menu-item"
              data-testid="context-menu-move"
              role="menuitem"
              onMouseDown={() => void handleOpenMove()}
            >
              移动到...
            </button></>
          ) : null}
        </div>
      ) : null}

      {/* Create item dialog */}
      {createDialog ? (
        <div
          className="create-dialog-overlay"
          data-testid="create-dialog-overlay"
          onMouseDown={handleCancelCreate}
        >
          <div
            className="create-dialog"
            data-testid="create-dialog"
            role="dialog"
            aria-label={createDialog.kind === 'file' ? '新建 Markdown 文件' : '新建文件夹'}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3 className="create-dialog-title">
              {createDialog.kind === 'file' ? '新建 Markdown 文件' : '新建文件夹'}
            </h3>
            <input
              ref={createDialogInputRef}
              type="text"
              className="create-dialog-input"
              data-testid="create-dialog-input"
              value={createName}
              onChange={(event) => {
                setCreateName(event.target.value);
                if (createError) {
                  setCreateError(null);
                }
              }}
              onKeyDown={handleCreateDialogKeyDown}
              placeholder={createDialog.kind === 'file' ? '请输入文件名' : '请输入文件夹名'}
              disabled={creating}
              autoComplete="off"
              spellCheck={false}
            />
            {createError ? (
              <p className="create-dialog-error" data-testid="create-dialog-error" role="alert">
                {createError}
              </p>
            ) : null}
            <div className="create-dialog-actions">
              <button
                type="button"
                className="create-dialog-btn create-dialog-btn-cancel"
                data-testid="create-dialog-cancel"
                onClick={handleCancelCreate}
                disabled={creating}
              >
                取消
              </button>
              <button
                type="button"
                className="create-dialog-btn create-dialog-btn-confirm"
                data-testid="create-dialog-confirm"
                onClick={() => void handleConfirmCreate()}
                disabled={creating}
              >
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Rename dialog */}
      {renameDialog ? (
        <div
          className="create-dialog-overlay"
          data-testid="rename-dialog-overlay"
          onMouseDown={handleCancelRename}
        >
          <div
            className="create-dialog"
            data-testid="rename-dialog"
            role="dialog"
            aria-label="重命名"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3 className="create-dialog-title">重命名</h3>
            <input
              ref={renameInputRef}
              type="text"
              className="create-dialog-input"
              data-testid="rename-dialog-input"
              value={renameName}
              onChange={(event) => {
                setRenameName(event.target.value);
                if (renameError) {
                  setRenameError(null);
                }
              }}
              onKeyDown={handleRenameDialogKeyDown}
              placeholder={renameDialog.kind === 'file' ? '请输入新文件名' : '请输入新文件夹名'}
              disabled={renaming}
              autoComplete="off"
              spellCheck={false}
            />
            {renameError ? (
              <p className="create-dialog-error" data-testid="rename-dialog-error" role="alert">
                {renameError}
              </p>
            ) : null}
            <div className="create-dialog-actions">
              <button
                type="button"
                className="create-dialog-btn create-dialog-btn-cancel"
                data-testid="rename-dialog-cancel"
                onClick={handleCancelRename}
                disabled={renaming}
              >
                取消
              </button>
              <button
                type="button"
                className="create-dialog-btn create-dialog-btn-confirm"
                data-testid="rename-dialog-confirm"
                onClick={() => void handleConfirmRename()}
                disabled={renaming}
              >
                {renaming ? '重命名中...' : '重命名'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete confirm dialog */}
      {deleteDialog ? (
        <div
          className="create-dialog-overlay"
          data-testid="delete-dialog-overlay"
          onMouseDown={handleCancelDelete}
        >
          <div
            className="create-dialog"
            data-testid="delete-dialog"
            role="dialog"
            aria-label="删除"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3 className="create-dialog-title">
              {deleteDialog.isPermanent ? '永久删除' : `删除${deleteDialog.kind === 'file' ? '文件' : '文件夹'}`}
            </h3>
            <p className="delete-dialog-message" data-testid="delete-dialog-message">
              {deleteDialog.isPermanent
                ? `无法移动到回收站。是否永久删除 "${deleteDialog.entryName}"？此操作不可恢复。`
                : deleteDialog.kind === 'file'
                  ? `确定要删除 "${deleteDialog.entryName}" 吗？文件将被移动到系统回收站。`
                  : `确定要删除文件夹 "${deleteDialog.entryName}" 及其中的所有文件吗？文件夹将被移动到系统回收站。`}
            </p>
            {deleteError ? (
              <p className="create-dialog-error" data-testid="delete-dialog-error" role="alert">
                {deleteError}
              </p>
            ) : null}
            <div className="create-dialog-actions">
              <button
                type="button"
                className="create-dialog-btn create-dialog-btn-cancel"
                data-testid="delete-dialog-cancel"
                onClick={handleCancelDelete}
                disabled={deleting}
              >
                取消
              </button>
              <button
                type="button"
                className={`create-dialog-btn ${deleteDialog.isPermanent ? 'create-dialog-btn-danger' : 'create-dialog-btn-confirm'}`}
                data-testid="delete-dialog-confirm"
                onClick={() => void handleConfirmDelete()}
                disabled={deleting}
              >
                {deleting ? '删除中...' : deleteDialog.isPermanent ? '永久删除' : '删除'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Move dialog */}
      {moveDialog ? (
        <div className="create-dialog-overlay" data-testid="move-dialog-overlay" onMouseDown={handleCancelMove}>
          <div className="move-dialog-panel" data-testid="move-dialog" role="dialog" aria-label="移动到" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="create-dialog-title">移动到...</h3>
            <p className="move-dialog-source" data-testid="move-dialog-source">
              <span className="move-dialog-source-label">源：</span>
              <span className="move-dialog-source-name">{moveDialog.displayName}</span>
            </p>
            <p className="move-dialog-label">目标文件夹：</p>
            <div className="move-dialog-tree" data-testid="move-dialog-tree" role="listbox">
              <button
                type="button"
                className={`move-dialog-tree-item${moveDialog.selectedTargetParentRelativePath === '' ? ' move-dialog-tree-item-selected' : ''}`}
                role="option"
                aria-selected={moveDialog.selectedTargetParentRelativePath === ''}
                data-testid="move-target-root"
                onClick={() => setMoveDialog((p) => p ? { ...p, selectedTargetParentRelativePath: '' } : null)}
              >
                <span className="move-dialog-tree-name">当前知识库根目录</span>
              </button>
              {collectDirectories(
                fileTree,
                moveDialog.kind === 'folder' ? moveDialog.relativePath : null,
              ).map((dir) => (
                <button
                  key={dir.relativePath}
                  type="button"
                  className={`move-dialog-tree-item${moveDialog.selectedTargetParentRelativePath === dir.relativePath ? ' move-dialog-tree-item-selected' : ''}`}
                  role="option"
                  aria-selected={moveDialog.selectedTargetParentRelativePath === dir.relativePath}
                  data-testid={`move-target-${dir.name}`}
                  style={{ paddingLeft: `${16 + dir.depth * 20}px` }}
                  onClick={() => setMoveDialog((p) => p ? { ...p, selectedTargetParentRelativePath: dir.relativePath } : null)}
                >
                  <span className="move-dialog-tree-name">{dir.name}</span>
                </button>
              ))}
            </div>
            {moveError ? <p className="create-dialog-error" data-testid="move-dialog-error" role="alert">{moveError}</p> : null}
            <div className="create-dialog-actions">
              <button type="button" className="create-dialog-btn create-dialog-btn-cancel" data-testid="move-dialog-cancel" onClick={handleCancelMove} disabled={moving}>取消</button>
              <button type="button" className="create-dialog-btn create-dialog-btn-confirm" data-testid="move-dialog-confirm" onClick={() => void handleConfirmMove()} disabled={moving || moveDialog.selectedTargetParentRelativePath === moveDialog.currentParentRelativePath}>
                {moving ? '移动中...' : '移动'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Drop overlay hint */}
      {dragOver ? (
        <div className="vault-drop-hint">
          <span>拖入文件夹以打开知识库</span>
        </div>
      ) : null}
    </section>
  );
}
