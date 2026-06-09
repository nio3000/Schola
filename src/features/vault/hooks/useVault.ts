import { useCallback, useEffect, useState } from 'react';
import type { FileEntry, VaultInfo } from '../../../lib/contracts/vault.types';
import {
  closeVault,
  createFolder,
  createNote,
  deleteFolder,
  deleteFolderPermanent,
  deleteNote,
  createVault,
  deleteNotePermanent,
  getRecentVaults,
  moveFolder,
  moveNote,
  openVault,
  openVaultByPath,
  renameFolder,
  renameNote,
  scanVault,
} from '../../../lib/platform/schola-api';

interface VaultState {
  readonly activeVault: VaultInfo | null;
  readonly recentVaults: readonly VaultInfo[];
  readonly fileTree: readonly FileEntry[];
  readonly selectedFile: string | null;
  readonly status: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  readonly message: string;
}

export type CreateNoteActionResult =
  | { readonly ok: true; readonly relativePath: string }
  | { readonly ok: false; readonly message: string };

export type CreateFolderActionResult =
  | { readonly ok: true; readonly relativePath: string }
  | { readonly ok: false; readonly message: string };

export type RenameActionResult =
  | { readonly ok: true; readonly oldRelativePath: string; readonly newRelativePath: string }
  | { readonly ok: false; readonly message: string };

export type DeleteActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code?: string; readonly message: string };

export type MoveActionResult =
  | { readonly ok: true; readonly oldRelativePath: string; readonly newRelativePath: string }
  | { readonly ok: false; readonly message: string };

const initialState: VaultState = {
  activeVault: null,
  recentVaults: [],
  fileTree: [],
  selectedFile: null,
  status: 'idle',
  message: '请选择一个包含 Markdown 文件的本地文件夹。',
};

function countFiles(entries: readonly FileEntry[]): number {
  return entries.reduce((total, entry) => {
    if (entry.type === 'file') {
      return total + 1;
    }

    return total + countFiles(entry.children ?? []);
  }, 0);
}

function getVaultStatus(fileTree: readonly FileEntry[]): VaultState['status'] {
  return fileTree.length > 0 ? 'ready' : 'empty';
}

function getVaultReadyMessage(fileTree: readonly FileEntry[]): string {
  return fileTree.length > 0 ? 'Vault 已打开。' : 'Vault 中没有 Markdown 文件。';
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useVault(): VaultState & {
  readonly handleOpenVault: () => Promise<void>;
  readonly handleOpenVaultByPath: (rootPath: string) => Promise<void>;
  readonly handleCreateVault: () => Promise<void>;
  readonly handleCloseVault: () => Promise<void>;
  readonly handleSelectFile: (relativePath: string | null) => void;
  readonly handleCreateNote: (parentRelativePath: string, fileName: string) => Promise<CreateNoteActionResult>;
  readonly handleCreateFolder: (parentRelativePath: string, folderName: string) => Promise<CreateFolderActionResult>;
  readonly handleRenameNote: (relativePath: string, newName: string) => Promise<RenameActionResult>;
  readonly handleRenameFolder: (relativePath: string, newName: string) => Promise<RenameActionResult>;
  readonly handleDeleteNote: (relativePath: string) => Promise<DeleteActionResult>;
  readonly handleDeleteNotePermanent: (relativePath: string) => Promise<DeleteActionResult>;
  readonly handleDeleteFolder: (relativePath: string) => Promise<DeleteActionResult>;
  readonly handleDeleteFolderPermanent: (relativePath: string) => Promise<DeleteActionResult>;
  readonly handleMoveNote: (relativePath: string, targetParentRelativePath: string) => Promise<MoveActionResult>;
  readonly handleMoveFolder: (relativePath: string, targetParentRelativePath: string) => Promise<MoveActionResult>;
  readonly handleRefreshVault: () => Promise<void>;
} {
  const [state, setState] = useState<VaultState>(initialState);

  useEffect(() => {
    let isActive = true;

    async function loadRecentVaults(): Promise<void> {
      try {
        const vaults = await getRecentVaults();

        if (isActive) {
          setState((current) => ({ ...current, recentVaults: vaults }));
        }
      } catch (error) {
        if (isActive) {
          setState((current) => ({
            ...current,
            status: 'error',
            message: error instanceof Error ? error.message : '无法读取最近 Vault。',
          }));
        }
      }
    }

    void loadRecentVaults();

    return () => {
      isActive = false;
    };
  }, []);

  const handleOpenVault = useCallback(async (): Promise<void> => {
    setState((current) => ({ ...current, status: 'loading', message: '正在打开 Vault...' }));

    try {
      const vault = await openVault();

      if (!vault) {
        setState((current) => ({ ...current, status: 'idle', message: '已取消打开 Vault。', selectedFile: null }));
        return;
      }

      const fileTree = await scanVault(vault.id);
      const recentVaults = await getRecentVaults();

      setState({
        activeVault: vault,
        recentVaults,
        fileTree,
        selectedFile: null,
        status: getVaultStatus(fileTree),
        message: getVaultReadyMessage(fileTree),
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        status: 'error',
        message: getErrorMessage(error, '打开 Vault 失败。'),
      }));
    }
  }, []);

  const handleOpenVaultByPath = useCallback(async (rootPath: string): Promise<void> => {
    setState((current) => ({ ...current, status: 'loading', message: '正在打开 Vault...' }));

    try {
      const vault = await openVaultByPath(rootPath);
      const fileTree = await scanVault(vault.id);
      const recentVaults = await getRecentVaults();

      setState({
        activeVault: vault,
        recentVaults,
        fileTree,
        selectedFile: null,
        status: getVaultStatus(fileTree),
        message: getVaultReadyMessage(fileTree),
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        status: 'error',
        message: getErrorMessage(error, '打开 Vault 失败。'),
      }));
    }
  }, []);

  const handleCreateVault = useCallback(async (): Promise<void> => {
    setState((current) => ({ ...current, status: 'loading', message: '正在创建知识库...' }));

    try {
      const result = await createVault();

      if (result.cancelled || !result.ok || !result.vault) {
        setState((current) => ({
          ...current,
          status: 'idle',
          message: result.message ?? '已取消创建知识库。',
          selectedFile: null,
        }));
        return;
      }

      const fileTree = await scanVault(result.vault.id);
      const recentVaults = await getRecentVaults();

      setState({
        activeVault: result.vault,
        recentVaults,
        fileTree,
        selectedFile: null,
        status: getVaultStatus(fileTree),
        message: getVaultReadyMessage(fileTree),
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        status: 'error',
        message: getErrorMessage(error, '创建知识库失败。'),
      }));
    }
  }, []);

  const handleCloseVault = useCallback(async (): Promise<void> => {
    if (!state.activeVault) {
      return;
    }

    try {
      await closeVault(state.activeVault.id);
      const recentVaults = await getRecentVaults();
      setState({ ...initialState, recentVaults, message: 'Vault 已关闭。' });
    } catch (error) {
      setState((current) => ({
        ...current,
        status: 'error',
        message: getErrorMessage(error, '关闭 Vault 失败。'),
      }));
    }
  }, [state.activeVault]);

  const handleSelectFile = useCallback((relativePath: string | null): void => {
    setState((current) => ({ ...current, selectedFile: relativePath }));
  }, []);

  const handleCreateNote = useCallback(
    async (parentRelativePath: string, fileName: string): Promise<CreateNoteActionResult> => {
      if (!state.activeVault) {
        return { ok: false, message: '未打开 Vault。' };
      }

      const vault = state.activeVault;
      setState((current) => ({ ...current, status: 'loading', message: '正在创建 Markdown 文件...' }));

      try {
        const createdFile = await createNote(vault.id, { parentRelativePath, fileName });
        if (!createdFile.ok) {
          setState((current) => ({
            ...current,
            status: 'error',
            message: createdFile.message,
          }));

          return { ok: false, message: createdFile.message };
        }

        const fileTree = await scanVault(vault.id);

        setState((current) => ({
          ...current,
          activeVault: { ...vault, noteCount: countFiles(fileTree) },
          fileTree,
          status: getVaultStatus(fileTree),
          message: `已创建 ${createdFile.relativePath}。`,
        }));

        return { ok: true, relativePath: createdFile.relativePath };
      } catch (error) {
        const message = getErrorMessage(error, '创建 Markdown 文件失败。');

        setState((current) => ({
          ...current,
          status: 'error',
          message,
        }));

        return { ok: false, message };
      }
    },
    [state.activeVault],
  );

  const handleCreateFolder = useCallback(
    async (parentRelativePath: string, folderName: string): Promise<CreateFolderActionResult> => {
      if (!state.activeVault) {
        return { ok: false, message: '未打开 Vault。' };
      }

      const vault = state.activeVault;
      setState((current) => ({ ...current, status: 'loading', message: '正在创建文件夹...' }));

      try {
        const createdFolder = await createFolder(vault.id, { parentRelativePath, folderName });
        if (!createdFolder.ok) {
          setState((current) => ({
            ...current,
            status: 'error',
            message: createdFolder.message,
          }));

          return { ok: false, message: createdFolder.message };
        }

        const fileTree = await scanVault(vault.id);

        setState((current) => ({
          ...current,
          activeVault: { ...vault, noteCount: countFiles(fileTree) },
          fileTree,
          status: getVaultStatus(fileTree),
          message: `已创建文件夹 ${folderName}。`,
        }));

        return { ok: true, relativePath: createdFolder.relativePath };
      } catch (error) {
        const message = getErrorMessage(error, '创建文件夹失败。');

        setState((current) => ({
          ...current,
          status: 'error',
          message,
        }));

        return { ok: false, message };
      }
    },
    [state.activeVault],
  );

  const handleRenameNote = useCallback(
    async (relativePath: string, newName: string): Promise<RenameActionResult> => {
      if (!state.activeVault) {
        return { ok: false, message: '未打开 Vault。' };
      }

      const vault = state.activeVault;
      setState((current) => ({ ...current, status: 'loading', message: '正在重命名...' }));

      try {
        const result = await renameNote(vault.id, { relativePath, newName });
        if (!result.ok) {
          setState((current) => ({ ...current, status: 'error', message: result.message }));
          return { ok: false, message: result.message };
        }

        const fileTree = await scanVault(vault.id);

        setState((current) => ({
          ...current,
          activeVault: { ...vault, noteCount: countFiles(fileTree) },
          fileTree,
          status: getVaultStatus(fileTree),
          message: '文件已重命名。',
        }));

        return { ok: true, oldRelativePath: result.oldRelativePath, newRelativePath: result.newRelativePath };
      } catch (error) {
        const message = getErrorMessage(error, '重命名失败。');
        setState((current) => ({ ...current, status: 'error', message }));
        return { ok: false, message };
      }
    },
    [state.activeVault],
  );

  const handleRenameFolder = useCallback(
    async (relativePath: string, newName: string): Promise<RenameActionResult> => {
      if (!state.activeVault) {
        return { ok: false, message: '未打开 Vault。' };
      }

      const vault = state.activeVault;
      setState((current) => ({ ...current, status: 'loading', message: '正在重命名文件夹...' }));

      try {
        const result = await renameFolder(vault.id, { relativePath, newName });
        if (!result.ok) {
          setState((current) => ({ ...current, status: 'error', message: result.message }));
          return { ok: false, message: result.message };
        }

        const fileTree = await scanVault(vault.id);

        setState((current) => ({
          ...current,
          activeVault: { ...vault, noteCount: countFiles(fileTree) },
          fileTree,
          status: getVaultStatus(fileTree),
          message: '文件夹已重命名。',
        }));

        return { ok: true, oldRelativePath: result.oldRelativePath, newRelativePath: result.newRelativePath };
      } catch (error) {
        const message = getErrorMessage(error, '重命名文件夹失败。');
        setState((current) => ({ ...current, status: 'error', message }));
        return { ok: false, message };
      }
    },
    [state.activeVault],
  );

  const handleDeleteNote = useCallback(
    async (relativePath: string): Promise<DeleteActionResult> => {
      if (!state.activeVault) {
        return { ok: false, message: '未打开 Vault。' };
      }
      const vault = state.activeVault;
      setState((current) => ({ ...current, status: 'loading', message: '正在删除...' }));
      try {
        const result = await deleteNote(vault.id, { relativePath });
        if (!result.ok) return { ok: false, code: result.code, message: result.message };
        const fileTree = await scanVault(vault.id);
        setState((current) => ({ ...current, activeVault: { ...vault, noteCount: countFiles(fileTree) }, fileTree, status: getVaultStatus(fileTree), message: '文件已删除。' }));
        return { ok: true };
      } catch (error) {
        return { ok: false, message: getErrorMessage(error, '删除失败。') };
      }
    },
    [state.activeVault],
  );

  const handleDeleteNotePermanent = useCallback(
    async (relativePath: string): Promise<DeleteActionResult> => {
      if (!state.activeVault) return { ok: false, message: '未打开 Vault。' };
      const vault = state.activeVault;
      setState((current) => ({ ...current, status: 'loading', message: '正在永久删除...' }));
      try {
        const result = await deleteNotePermanent(vault.id, { relativePath });
        if (!result.ok) return { ok: false, code: result.code, message: result.message };
        const fileTree = await scanVault(vault.id);
        setState((current) => ({ ...current, activeVault: { ...vault, noteCount: countFiles(fileTree) }, fileTree, status: getVaultStatus(fileTree), message: '文件已永久删除。' }));
        return { ok: true };
      } catch (error) {
        return { ok: false, message: getErrorMessage(error, '永久删除失败。') };
      }
    },
    [state.activeVault],
  );

  const handleDeleteFolder = useCallback(
    async (relativePath: string): Promise<DeleteActionResult> => {
      if (!state.activeVault) return { ok: false, message: '未打开 Vault。' };
      const vault = state.activeVault;
      setState((current) => ({ ...current, status: 'loading', message: '正在删除文件夹...' }));
      try {
        const result = await deleteFolder(vault.id, { relativePath });
        if (!result.ok) return { ok: false, code: result.code, message: result.message };
        const fileTree = await scanVault(vault.id);
        setState((current) => ({ ...current, activeVault: { ...vault, noteCount: countFiles(fileTree) }, fileTree, status: getVaultStatus(fileTree), message: '文件夹已删除。' }));
        return { ok: true };
      } catch (error) {
        return { ok: false, message: getErrorMessage(error, '删除文件夹失败。') };
      }
    },
    [state.activeVault],
  );

  const handleDeleteFolderPermanent = useCallback(
    async (relativePath: string): Promise<DeleteActionResult> => {
      if (!state.activeVault) return { ok: false, message: '未打开 Vault。' };
      const vault = state.activeVault;
      setState((current) => ({ ...current, status: 'loading', message: '正在永久删除文件夹...' }));
      try {
        const result = await deleteFolderPermanent(vault.id, { relativePath });
        if (!result.ok) return { ok: false, code: result.code, message: result.message };
        const fileTree = await scanVault(vault.id);
        setState((current) => ({ ...current, activeVault: { ...vault, noteCount: countFiles(fileTree) }, fileTree, status: getVaultStatus(fileTree), message: '文件夹已永久删除。' }));
        return { ok: true };
      } catch (error) {
        return { ok: false, message: getErrorMessage(error, '永久删除文件夹失败。') };
      }
    },
    [state.activeVault],
  );

  const handleMoveNote = useCallback(
    async (relativePath: string, targetParentRelativePath: string): Promise<MoveActionResult> => {
      if (!state.activeVault) return { ok: false, message: '未打开 Vault。' };
      const vault = state.activeVault;
      setState((current) => ({ ...current, status: 'loading', message: '正在移动...' }));
      try {
        const result = await moveNote(vault.id, { relativePath, targetParentRelativePath });
        if (!result.ok) return { ok: false, message: result.message };
        const fileTree = await scanVault(vault.id);
        setState((current) => ({ ...current, activeVault: { ...vault, noteCount: countFiles(fileTree) }, fileTree, status: getVaultStatus(fileTree), message: '文件已移动。' }));
        return { ok: true, oldRelativePath: result.oldRelativePath, newRelativePath: result.newRelativePath };
      } catch (error) { return { ok: false, message: getErrorMessage(error, '移动失败。') }; }
    }, [state.activeVault],
  );

  const handleMoveFolder = useCallback(
    async (relativePath: string, targetParentRelativePath: string): Promise<MoveActionResult> => {
      if (!state.activeVault) return { ok: false, message: '未打开 Vault。' };
      const vault = state.activeVault;
      setState((current) => ({ ...current, status: 'loading', message: '正在移动文件夹...' }));
      try {
        const result = await moveFolder(vault.id, { relativePath, targetParentRelativePath });
        if (!result.ok) return { ok: false, message: result.message };
        const fileTree = await scanVault(vault.id);
        setState((current) => ({ ...current, activeVault: { ...vault, noteCount: countFiles(fileTree) }, fileTree, status: getVaultStatus(fileTree), message: '文件夹已移动。' }));
        return { ok: true, oldRelativePath: result.oldRelativePath, newRelativePath: result.newRelativePath };
      } catch (error) { return { ok: false, message: getErrorMessage(error, '移动文件夹失败。') }; }
    }, [state.activeVault],
  );

  const handleRefreshVault = useCallback(async (): Promise<void> => {
    if (!state.activeVault) return;
    const vault = state.activeVault;
    try {
      const fileTree = await scanVault(vault.id);
      setState((current) => ({
        ...current,
        activeVault: { ...vault, noteCount: countFiles(fileTree) },
        fileTree,
        status: getVaultStatus(fileTree),
        message: 'Vault 已刷新。',
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: 'error',
        message: getErrorMessage(error, '刷新 Vault 失败。'),
      }));
    }
  }, [state.activeVault]);

  return {
    ...state,
    handleOpenVault,
    handleOpenVaultByPath,
    handleCreateVault,
    handleCloseVault,
    handleSelectFile,
    handleCreateNote,
    handleCreateFolder,
    handleRenameNote,
    handleRenameFolder,
    handleDeleteNote,
    handleDeleteNotePermanent,
    handleDeleteFolder,
    handleDeleteFolderPermanent,
    handleMoveNote,
    handleMoveFolder,
    handleRefreshVault,
  };
}
