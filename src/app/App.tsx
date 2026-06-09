/**
 * App — Phase 5 / LEGACY-FEATURE-RECONNECT-R5.
 *
 * Uses useVault() as the single source of truth for vault state.
 * Passes complete VaultState + all handlers to WorkspaceShell.
 */
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { HelpOpenResult } from '../lib/contracts/app.types';
import { getAppInfo, openHelp } from '../lib/platform/schola-api';
import { useVault } from '../features/vault/hooks/useVault';
import { WorkspaceShell } from '../features/workspace/WorkspaceShell';

export function App(): ReactElement {
  const [ready, setReady] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);

  const {
    activeVault,
    recentVaults,
    fileTree,
    selectedFile,
    status: vaultStatus,
    message: vaultMessage,
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
    handleDeleteFolder,
    handleMoveNote,
    handleMoveFolder,
    handleRefreshVault,
  } = useVault();

  const hasVault = activeVault !== null;

  useEffect(() => {
    let isActive = true;
    getAppInfo()
      .then(() => { if (isActive) setReady(true); })
      .catch((err) => {
        if (isActive) setAppError(err instanceof Error ? err.message : '无法加载应用。');
      });
    return () => { isActive = false; };
  }, []);

  const onOpenVault = async (): Promise<void> => {
    setIsOpening(true);
    setAppError(null);
    try {
      await handleOpenVault();
    } catch (err) {
      setAppError(err instanceof Error ? err.message : '打开知识库失败。');
    } finally {
      setIsOpening(false);
    }
  };

  const onCreateVault = async (): Promise<void> => {
    setIsOpening(true);
    setAppError(null);
    try {
      await handleCreateVault();
    } catch (err) {
      setAppError(err instanceof Error ? err.message : '创建知识库失败。');
    } finally {
      setIsOpening(false);
    }
  };

  const onOpenVaultByPath = async (rootPath: string): Promise<void> => {
    setIsOpening(true);
    setAppError(null);
    try {
      await handleOpenVaultByPath(rootPath);
    } catch (err) {
      setAppError(err instanceof Error ? err.message : '打开知识库失败。');
    } finally {
      setIsOpening(false);
    }
  };

  const onCloseVault = async (): Promise<void> => {
    try { await handleCloseVault(); } catch { /* non-fatal */ }
  };

  const onOpenHelp = async (): Promise<HelpOpenResult> => {
    try { return await openHelp(); }
    catch { return { ok: false, status: 'placeholder' as const, title: '帮助', message: '无法加载帮助信息。' }; }
  };

  return (
    <WorkspaceShell
      activeVault={activeVault}
      recentVaults={recentVaults}
      fileTree={fileTree}
      selectedFile={selectedFile}
      hasVault={hasVault}
      vaultStatus={vaultStatus}
      vaultMessage={vaultMessage}
      appReady={ready}
      appError={appError}
      isOpening={isOpening}
      onOpenVault={onOpenVault}
      onCreateVault={onCreateVault}
      onOpenVaultByPath={onOpenVaultByPath}
      onCloseVault={onCloseVault}
      onSelectFile={handleSelectFile}
      onOpenHelp={onOpenHelp}
      onCreateNote={handleCreateNote}
      onCreateFolder={handleCreateFolder}
      onRenameNote={handleRenameNote}
      onRenameFolder={handleRenameFolder}
      onDeleteNote={handleDeleteNote}
      onDeleteFolder={handleDeleteFolder}
      onMoveNote={handleMoveNote}
      onMoveFolder={handleMoveFolder}
      onRefreshVault={handleRefreshVault}
    />
  );
}
