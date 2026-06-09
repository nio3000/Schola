export const VAULT_OPEN_CHANNEL = 'vault:open';
export const VAULT_OPEN_BY_PATH_CHANNEL = 'vault:open-by-path';
export const VAULT_RESOLVE_ASSET_URL_CHANNEL = 'vault:resolve-asset-url';
export const VAULT_LIST_IMAGE_ASSETS_CHANNEL = 'vault:list-image-assets';
export const VAULT_SCAN_CHANNEL = 'vault:scan';
export const VAULT_GET_RECENT_CHANNEL = 'vault:get-recent';
export const VAULT_CLOSE_CHANNEL = 'vault:close';
export const VAULT_CREATE_CHANNEL = 'vault:create';
export const VAULT_FILE_EVENT_CHANNEL = 'vault:file-event';

export interface CreateVaultResult {
  readonly ok: boolean;
  readonly vault?: VaultInfo;
  readonly cancelled?: boolean;
  readonly message?: string;
}

// ── SQLite Retrofit-4-D-P1-QA3: watcher → index sync ──
export const INDEX_SYNC_FILE_EVENTS_CHANNEL = 'index:sync-file-events';

export interface IndexSyncResult {
  readonly ok: boolean;
  readonly syncedCount: number;
  readonly errorCount: number;
}

// ── File watcher types (Phase 2-C) ──

export type FileKind = 'markdown' | 'image' | 'other';

export type VaultFileEvent =
  | {
      readonly type: 'file-added';
      readonly relativePath: string;
      readonly fileKind: FileKind;
    }
  | {
      readonly type: 'file-changed';
      readonly relativePath: string;
      readonly fileKind: FileKind;
    }
  | {
      readonly type: 'file-deleted';
      readonly relativePath: string;
      readonly fileKind: FileKind;
    }
  | {
      readonly type: 'folder-added';
      readonly relativePath: string;
    }
  | {
      readonly type: 'folder-deleted';
      readonly relativePath: string;
    };

export interface VaultInfo {
  readonly id: string;
  readonly name: string;
  readonly rootPath: string;
  readonly noteCount: number;
  readonly openedAt: number;
}

export interface FileEntry {
  readonly id: string;
  readonly name: string;
  readonly relativePath: string;
  readonly type: 'file' | 'directory';
  readonly children?: readonly FileEntry[];
  readonly mtime?: number;
  readonly size?: number;
}

export interface ImageAsset {
  readonly relativePath: string;
  readonly fileName: string;
  readonly extension: string;
}

export interface ScholaVaultApi {
  readonly openVault: () => Promise<VaultInfo | null>;
  readonly openVaultByPath: (rootPath: string) => Promise<VaultInfo>;
  readonly createVault: () => Promise<CreateVaultResult>;
  readonly getDroppedFilePath: (file: File) => string | null;
  readonly resolvePreviewAssetUrl: (
    vaultId: string,
    noteRelativePath: string,
    assetPath: string,
  ) => Promise<string>;
  readonly listImageAssets: (vaultId: string) => Promise<readonly ImageAsset[]>;
  readonly scanVault: (vaultId: string) => Promise<readonly FileEntry[]>;
  readonly getRecentVaults: () => Promise<readonly VaultInfo[]>;
  readonly closeVault: (vaultId: string) => Promise<void>;
  readonly onFileEvent: (callback: (events: readonly VaultFileEvent[]) => void) => () => void;
  readonly syncFileEvents: (
    vaultId: string,
    events: readonly VaultFileEvent[],
  ) => Promise<IndexSyncResult>;
}
