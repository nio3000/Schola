import { ipcMain } from 'electron';
import {
  FOLDER_CREATE_CHANNEL,
  FOLDER_DELETE_CHANNEL,
  FOLDER_DELETE_PERMANENT_CHANNEL,
  FOLDER_MOVE_CHANNEL,
  FOLDER_RENAME_CHANNEL,
  NOTE_CREATE_CHANNEL,
  NOTE_DELETE_CHANNEL,
  NOTE_DELETE_PERMANENT_CHANNEL,
  NOTE_MOVE_CHANNEL,
  NOTE_READ_CHANNEL,
  NOTE_RENAME_CHANNEL,
  NOTE_SAVE_CHANNEL,
} from '../../src/lib/contracts/note.types';
import type {
  CreateFolderInput,
  CreateFolderResult,
  CreateNoteInput,
  CreateNoteResult,
  DeleteEntryInput,
  DeleteFailure,
  DeleteFolderOutcome,
  DeleteNoteOutcome,
  FileOperationFailure,
  NoteContent,
  RenameEntryInput,
  RenameErrorCode,
  RenameFailure,
  RenameFolderResult,
  RenameNoteResult,
  SaveNoteResult,
  MoveEntryInput,
  MoveFailure,
  MoveFolderResult,
  MoveNoteResult,
} from '../../src/lib/contracts/note.types';
import { createFolder, createNote, deleteFolder, deleteFolderPermanent, deleteNote, deleteNotePermanent, moveFolder, moveNote, readNote, renameFolder, renameNote, saveNote } from '../services/file.service';
import { assertString } from '../lib/ipc-validation';

function assertStringOrNull(value: unknown, label: string): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string or null.`);
  }

  return value;
}

function operationFailure(code: FileOperationFailure['code'], message: string): FileOperationFailure {
  return { ok: false, code, message };
}

function isFileOperationFailure(value: unknown): value is FileOperationFailure {
  return typeof value === 'object' && value !== null && 'ok' in value && value.ok === false;
}

function parseCreateVaultId(value: unknown): string | FileOperationFailure {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return operationFailure('VAULT_NOT_OPEN', 'vaultId must be a non-empty string.');
  }

  return value;
}

function parseStringAllowEmpty(value: unknown, code: FileOperationFailure['code'], label: string): string | FileOperationFailure {
  if (typeof value !== 'string') {
    return operationFailure(code, `${label} must be a string.`);
  }

  return value;
}

function parseNonEmptyString(value: unknown, code: FileOperationFailure['code'], label: string): string | FileOperationFailure {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return operationFailure(code, `${label} must be a non-empty string.`);
  }

  return value;
}

function parseCreateNoteInput(value: unknown): CreateNoteInput | FileOperationFailure {
  if (typeof value !== 'object' || value === null) {
    return operationFailure('INVALID_PARENT_PATH', 'createNote input must be an object.');
  }

  const input = value as Record<string, unknown>;
  const parentRelativePath = parseStringAllowEmpty(input.parentRelativePath, 'INVALID_PARENT_PATH', 'parentRelativePath');
  if (typeof parentRelativePath !== 'string') {
    return parentRelativePath;
  }

  const fileName = parseNonEmptyString(input.fileName, 'INVALID_NAME', 'fileName');
  if (typeof fileName !== 'string') {
    return fileName;
  }

  const result: CreateNoteInput = {
    parentRelativePath,
    fileName,
  };

  if (input.initialContent !== undefined) {
    const initialContent = parseStringAllowEmpty(input.initialContent, 'INVALID_NAME', 'initialContent');
    if (typeof initialContent !== 'string') {
      return initialContent;
    }

    return {
      ...result,
      initialContent,
    };
  }

  return result;
}

function parseCreateFolderInput(value: unknown): CreateFolderInput | FileOperationFailure {
  if (typeof value !== 'object' || value === null) {
    return operationFailure('INVALID_PARENT_PATH', 'createFolder input must be an object.');
  }

  const input = value as Record<string, unknown>;
  const parentRelativePath = parseStringAllowEmpty(input.parentRelativePath, 'INVALID_PARENT_PATH', 'parentRelativePath');
  if (typeof parentRelativePath !== 'string') {
    return parentRelativePath;
  }

  const folderName = parseNonEmptyString(input.folderName, 'INVALID_NAME', 'folderName');
  if (typeof folderName !== 'string') {
    return folderName;
  }

  return {
    parentRelativePath,
    folderName,
  };
}

export function registerNoteIpc(): void {
  ipcMain.handle(NOTE_READ_CHANNEL, async (_event, vaultId: unknown, relativePath: unknown): Promise<NoteContent> => {
    return readNote(assertString(vaultId, 'vaultId'), assertString(relativePath, 'relativePath'));
  });

  ipcMain.handle(
    NOTE_SAVE_CHANNEL,
    async (_event, vaultId: unknown, relativePath: unknown, content: unknown, expectedHash: unknown): Promise<SaveNoteResult> => {
      return saveNote(
        assertString(vaultId, 'vaultId'),
        assertString(relativePath, 'relativePath'),
        assertString(content, 'content'),
        assertStringOrNull(expectedHash, 'expectedHash'),
      );
    },
  );

  ipcMain.handle(NOTE_CREATE_CHANNEL, async (_event, vaultId: unknown, input: unknown): Promise<CreateNoteResult> => {
    const parsedVaultId = parseCreateVaultId(vaultId);
    if (typeof parsedVaultId !== 'string') {
      return parsedVaultId;
    }

    const parsedInput = parseCreateNoteInput(input);
    if (isFileOperationFailure(parsedInput)) {
      return parsedInput;
    }

    return createNote(parsedVaultId, parsedInput);
  });

  ipcMain.handle(FOLDER_CREATE_CHANNEL, async (_event, vaultId: unknown, input: unknown): Promise<CreateFolderResult> => {
    const parsedVaultId = parseCreateVaultId(vaultId);
    if (typeof parsedVaultId !== 'string') {
      return parsedVaultId;
    }

    const parsedInput = parseCreateFolderInput(input);
    if (isFileOperationFailure(parsedInput)) {
      return parsedInput;
    }

    return createFolder(parsedVaultId, parsedInput);
  });

  ipcMain.handle(NOTE_RENAME_CHANNEL, async (_event, vaultId: unknown, input: unknown): Promise<RenameNoteResult> => {
    const parsedVaultId = parseCreateVaultId(vaultId);
    if (typeof parsedVaultId !== 'string') {
      return renameFailure('INVALID_PATH', parsedVaultId.message);
    }

    const parsedInput = parseRenameInput(input);
    if (isRenameFailure(parsedInput)) {
      return parsedInput;
    }

    return renameNote(parsedVaultId, parsedInput);
  });

  ipcMain.handle(FOLDER_RENAME_CHANNEL, async (_event, vaultId: unknown, input: unknown): Promise<RenameFolderResult> => {
    const parsedVaultId = parseCreateVaultId(vaultId);
    if (typeof parsedVaultId !== 'string') {
      return renameFailure('INVALID_PATH', parsedVaultId.message);
    }

    const parsedInput = parseRenameInput(input);
    if (isRenameFailure(parsedInput)) {
      return parsedInput;
    }

    return renameFolder(parsedVaultId, parsedInput);
  });

  ipcMain.handle(NOTE_DELETE_CHANNEL, async (_event, vaultId: unknown, input: unknown): Promise<DeleteNoteOutcome> => {
    const parsedVaultId = parseCreateVaultId(vaultId);
    if (typeof parsedVaultId !== 'string') {
      return deleteFailure('INVALID_PATH', parsedVaultId.message);
    }

    const parsedInput = parseDeleteInput(input);
    if (isDeleteFailure(parsedInput)) {
      return parsedInput;
    }

    return deleteNote(parsedVaultId, parsedInput);
  });

  ipcMain.handle(NOTE_DELETE_PERMANENT_CHANNEL, async (_event, vaultId: unknown, input: unknown): Promise<DeleteNoteOutcome> => {
    const parsedVaultId = parseCreateVaultId(vaultId);
    if (typeof parsedVaultId !== 'string') {
      return deleteFailure('INVALID_PATH', parsedVaultId.message);
    }

    const parsedInput = parseDeleteInput(input);
    if (isDeleteFailure(parsedInput)) {
      return parsedInput;
    }

    return deleteNotePermanent(parsedVaultId, parsedInput);
  });

  ipcMain.handle(FOLDER_DELETE_CHANNEL, async (_event, vaultId: unknown, input: unknown): Promise<DeleteFolderOutcome> => {
    const parsedVaultId = parseCreateVaultId(vaultId);
    if (typeof parsedVaultId !== 'string') {
      return deleteFailure('INVALID_PATH', parsedVaultId.message);
    }

    const parsedInput = parseDeleteInput(input);
    if (isDeleteFailure(parsedInput)) {
      return parsedInput;
    }

    return deleteFolder(parsedVaultId, parsedInput);
  });

  ipcMain.handle(FOLDER_DELETE_PERMANENT_CHANNEL, async (_event, vaultId: unknown, input: unknown): Promise<DeleteFolderOutcome> => {
    const parsedVaultId = parseCreateVaultId(vaultId);
    if (typeof parsedVaultId !== 'string') {
      return deleteFailure('INVALID_PATH', parsedVaultId.message);
    }

    const parsedInput = parseDeleteInput(input);
    if (isDeleteFailure(parsedInput)) {
      return parsedInput;
    }

    return deleteFolderPermanent(parsedVaultId, parsedInput);
  });

  ipcMain.handle(NOTE_MOVE_CHANNEL, async (_event, vaultId: unknown, input: unknown): Promise<MoveNoteResult> => {
    const parsedVaultId = parseCreateVaultId(vaultId);
    if (typeof parsedVaultId !== 'string') {
      return moveFailure('INVALID_PATH', parsedVaultId.message);
    }

    const parsedInput = parseMoveInput(input);
    if (isMoveFailure(parsedInput)) {
      return parsedInput;
    }

    return moveNote(parsedVaultId, parsedInput);
  });

  ipcMain.handle(FOLDER_MOVE_CHANNEL, async (_event, vaultId: unknown, input: unknown): Promise<MoveFolderResult> => {
    const parsedVaultId = parseCreateVaultId(vaultId);
    if (typeof parsedVaultId !== 'string') {
      return moveFailure('INVALID_PATH', parsedVaultId.message);
    }

    const parsedInput = parseMoveInput(input);
    if (isMoveFailure(parsedInput)) {
      return parsedInput;
    }

    return moveFolder(parsedVaultId, parsedInput);
  });
}

function deleteFailure(code: DeleteFailure['code'], message: string): DeleteFailure {
  return { ok: false, code, message };
}

function isDeleteFailure(value: unknown): value is DeleteFailure {
  return typeof value === 'object' && value !== null && 'ok' in value && value.ok === false;
}

function parseDeleteInput(value: unknown): DeleteEntryInput | DeleteFailure {
  if (typeof value !== 'object' || value === null) {
    return deleteFailure('INVALID_PATH', 'delete input must be an object.');
  }

  const input = value as Record<string, unknown>;

  if (typeof input.relativePath !== 'string' || input.relativePath.trim().length === 0) {
    return deleteFailure('INVALID_PATH', 'relativePath must be a non-empty string.');
  }

  return { relativePath: input.relativePath };
}

function renameFailure(code: RenameErrorCode, message: string): RenameFailure {
  return { ok: false, code, message };
}

function isRenameFailure(value: unknown): value is RenameFailure {
  return typeof value === 'object' && value !== null && 'ok' in value && value.ok === false;
}

function parseRenameInput(value: unknown): RenameEntryInput | RenameFailure {
  if (typeof value !== 'object' || value === null) {
    return renameFailure('INVALID_PATH', 'rename input must be an object.');
  }

  const input = value as Record<string, unknown>;

  if (typeof input.relativePath !== 'string' || input.relativePath.trim().length === 0) {
    return renameFailure('INVALID_PATH', 'relativePath must be a non-empty string.');
  }

  if (typeof input.newName !== 'string' || input.newName.trim().length === 0) {
    return renameFailure('INVALID_NAME', 'newName must be a non-empty string.');
  }

  return { relativePath: input.relativePath, newName: input.newName };
}

function moveFailure(code: MoveFailure['code'], message: string): MoveFailure {
  return { ok: false, code, message };
}

function isMoveFailure(value: unknown): value is MoveFailure {
  return typeof value === 'object' && value !== null && 'ok' in value && value.ok === false;
}

function parseMoveInput(value: unknown): MoveEntryInput | MoveFailure {
  if (typeof value !== 'object' || value === null) {
    return moveFailure('INVALID_PATH', 'move input must be an object.');
  }

  const input = value as Record<string, unknown>;

  if (typeof input.relativePath !== 'string' || input.relativePath.trim().length === 0) {
    return moveFailure('INVALID_PATH', 'relativePath must be a non-empty string.');
  }

  if (typeof input.targetParentRelativePath !== 'string') {
    return moveFailure('INVALID_TARGET_PATH', 'targetParentRelativePath must be a string.');
  }

  return { relativePath: input.relativePath, targetParentRelativePath: input.targetParentRelativePath };
}
