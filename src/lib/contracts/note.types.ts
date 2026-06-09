import type { FileEntry } from './vault.types';

export const NOTE_READ_CHANNEL = 'note:read';
export const NOTE_SAVE_CHANNEL = 'note:save';
export const NOTE_CREATE_CHANNEL = 'note:create';
export const FOLDER_CREATE_CHANNEL = 'folder:create';
export const NOTE_RENAME_CHANNEL = 'note:rename';
export const FOLDER_RENAME_CHANNEL = 'folder:rename';
export const NOTE_DELETE_CHANNEL = 'note:delete';
export const NOTE_DELETE_PERMANENT_CHANNEL = 'note:delete-permanent';
export const FOLDER_DELETE_CHANNEL = 'folder:delete';
export const FOLDER_DELETE_PERMANENT_CHANNEL = 'folder:delete-permanent';
export const NOTE_MOVE_CHANNEL = 'note:move';
export const FOLDER_MOVE_CHANNEL = 'folder:move';

export type CreateFileOperationErrorCode =
  | 'VAULT_NOT_OPEN'
  | 'INVALID_NAME'
  | 'INVALID_PARENT_PATH'
  | 'PATH_OUTSIDE_VAULT'
  | 'PARENT_NOT_FOUND'
  | 'PARENT_NOT_DIRECTORY'
  | 'FILE_ALREADY_EXISTS'
  | 'FOLDER_ALREADY_EXISTS'
  | 'CREATE_NOTE_FAILED'
  | 'CREATE_FOLDER_FAILED';

export type RenameErrorCode =
  | 'INVALID_PATH'
  | 'INVALID_NAME'
  | 'PATH_OUTSIDE_VAULT'
  | 'ENTRY_NOT_FOUND'
  | 'CANNOT_RENAME_ROOT'
  | 'TARGET_ALREADY_EXISTS'
  | 'PARENT_NOT_DIRECTORY'
  | 'UNSUPPORTED_ENTRY_TYPE'
  | 'RENAME_FAILED';

export type DeleteErrorCode =
  | 'INVALID_PATH'
  | 'PATH_OUTSIDE_VAULT'
  | 'ENTRY_NOT_FOUND'
  | 'CANNOT_DELETE_ROOT'
  | 'UNSUPPORTED_ENTRY_TYPE'
  | 'DELETE_FAILED'
  | 'TRASH_FAILED'
  | 'DIRECTORY_NOT_EMPTY'
  | 'PERMISSION_DENIED';

export type MoveErrorCode =
  | 'INVALID_PATH'
  | 'INVALID_TARGET_PATH'
  | 'PATH_OUTSIDE_VAULT'
  | 'TARGET_OUTSIDE_VAULT'
  | 'ENTRY_NOT_FOUND'
  | 'TARGET_NOT_FOUND'
  | 'TARGET_NOT_DIRECTORY'
  | 'CANNOT_MOVE_ROOT'
  | 'CANNOT_MOVE_INTO_SELF'
  | 'CANNOT_MOVE_INTO_DESCENDANT'
  | 'TARGET_ALREADY_EXISTS'
  | 'UNSUPPORTED_ENTRY_TYPE'
  | 'MOVE_FAILED'
  | 'PERMISSION_DENIED';

export interface NoteContent {
  readonly content: string;
  readonly hash: string;
  readonly relativePath: string;
}

export interface SaveNoteResult {
  readonly hash: string;
  readonly relativePath: string;
}

export interface CreateNoteInput {
  readonly parentRelativePath: string;
  readonly fileName: string;
  readonly initialContent?: string;
}

export interface CreateFolderInput {
  readonly parentRelativePath: string;
  readonly folderName: string;
}

export interface FileOperationFailure {
  readonly ok: false;
  readonly code: CreateFileOperationErrorCode;
  readonly message: string;
}

export interface CreateNoteSuccess {
  readonly ok: true;
  readonly entry: FileEntry;
  readonly relativePath: string;
  readonly hash: string;
}

export interface CreateFolderSuccess {
  readonly ok: true;
  readonly entry: FileEntry;
  readonly relativePath: string;
}

export type CreateNoteResult = CreateNoteSuccess | FileOperationFailure;
export type CreateFolderResult = CreateFolderSuccess | FileOperationFailure;

export interface ScholaNoteApi {
  readonly readNote: (vaultId: string, relativePath: string) => Promise<NoteContent>;
  readonly saveNote: (
    vaultId: string,
    relativePath: string,
    content: string,
    expectedHash: string | null,
  ) => Promise<SaveNoteResult>;
  readonly createNote: (vaultId: string, input: CreateNoteInput) => Promise<CreateNoteResult>;
  readonly createFolder: (vaultId: string, input: CreateFolderInput) => Promise<CreateFolderResult>;
  readonly renameNote: (vaultId: string, input: RenameEntryInput) => Promise<RenameNoteResult>;
  readonly renameFolder: (vaultId: string, input: RenameEntryInput) => Promise<RenameFolderResult>;
  readonly deleteNote: (vaultId: string, input: DeleteEntryInput) => Promise<DeleteNoteOutcome>;
  readonly deleteNotePermanent: (vaultId: string, input: DeleteEntryInput) => Promise<DeleteNoteOutcome>;
  readonly deleteFolder: (vaultId: string, input: DeleteEntryInput) => Promise<DeleteFolderOutcome>;
  readonly deleteFolderPermanent: (vaultId: string, input: DeleteEntryInput) => Promise<DeleteFolderOutcome>;
  readonly moveNote: (vaultId: string, input: MoveEntryInput) => Promise<MoveNoteResult>;
  readonly moveFolder: (vaultId: string, input: MoveEntryInput) => Promise<MoveFolderResult>;
}

// ── Rename types ──

export interface RenameEntryInput {
  readonly relativePath: string;
  readonly newName: string;
}

export interface RenameNoteSuccess {
  readonly ok: true;
  readonly oldRelativePath: string;
  readonly newRelativePath: string;
  readonly entry: FileEntry;
  readonly hash: string;
}

export interface RenameFolderSuccess {
  readonly ok: true;
  readonly oldRelativePath: string;
  readonly newRelativePath: string;
  readonly entry: FileEntry;
}

export interface RenameFailure {
  readonly ok: false;
  readonly code: RenameErrorCode;
  readonly message: string;
}

export type RenameNoteResult = RenameNoteSuccess | RenameFailure;
export type RenameFolderResult = RenameFolderSuccess | RenameFailure;

// ── Delete types ──

export interface DeleteEntryInput {
  readonly relativePath: string;
}

export interface DeleteNoteSuccess {
  readonly ok: true;
  readonly deletedRelativePath: string;
  readonly movedToTrash: boolean;
  readonly hash: string;
}

export interface DeleteFolderSuccess {
  readonly ok: true;
  readonly deletedRelativePath: string;
  readonly movedToTrash: boolean;
}

export interface DeleteFailure {
  readonly ok: false;
  readonly code: DeleteErrorCode;
  readonly message: string;
}

export type DeleteNoteOutcome = DeleteNoteSuccess | DeleteFailure;
export type DeleteFolderOutcome = DeleteFolderSuccess | DeleteFailure;

// ── Move types ──

export interface MoveEntryInput {
  readonly relativePath: string;
  readonly targetParentRelativePath: string;
}

export interface MoveNoteSuccess {
  readonly ok: true;
  readonly oldRelativePath: string;
  readonly newRelativePath: string;
  readonly entry: FileEntry;
  readonly hash: string;
}

export interface MoveFolderSuccess {
  readonly ok: true;
  readonly oldRelativePath: string;
  readonly newRelativePath: string;
  readonly entry: FileEntry;
}

export interface MoveFailure {
  readonly ok: false;
  readonly code: MoveErrorCode;
  readonly message: string;
}

export type MoveNoteResult = MoveNoteSuccess | MoveFailure;
export type MoveFolderResult = MoveFolderSuccess | MoveFailure;
