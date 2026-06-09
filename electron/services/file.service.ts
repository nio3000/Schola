import { shell } from 'electron';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../src/lib/contracts/vault.types';
import type {
  CreateFileOperationErrorCode,
  CreateFolderInput,
  CreateFolderResult,
  CreateNoteInput,
  CreateNoteResult,
  DeleteEntryInput,
  DeleteErrorCode,
  DeleteFailure,
  DeleteFolderOutcome,
  DeleteNoteOutcome,
  FileOperationFailure,
  MoveEntryInput,
  MoveErrorCode,
  MoveFailure,
  MoveFolderResult,
  MoveNoteResult,
  NoteContent,
  RenameEntryInput,
  RenameErrorCode,
  RenameFailure,
  RenameFolderResult,
  RenameNoteResult,
  SaveNoteResult,
} from '../../src/lib/contracts/note.types';
import { resolveVaultPath } from '../security/path-guard';
import { getVaultRootPath } from './vault.service';

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const SKIPPED_DIRECTORY_NAMES = new Set(['.git', 'node_modules']);
const WINDOWS_RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);
const WINDOWS_INVALID_NAME_CHARS = /[<>:"|?*]/;

export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

function operationFailure(code: CreateFileOperationErrorCode, message: string): FileOperationFailure {
  return { ok: false, code, message };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function isAbsolutePath(value: string): boolean {
  return path.isAbsolute(value) || path.win32.isAbsolute(value) || path.posix.isAbsolute(value);
}

function isPathInsideRoot(rootPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(rootPath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function validateParentRelativePath(parentRelativePath: string): FileOperationFailure | null {
  if (typeof parentRelativePath !== 'string') {
    return operationFailure('INVALID_PARENT_PATH', 'parentRelativePath must be a string.');
  }

  if (parentRelativePath === '') {
    return null;
  }

  if (
    parentRelativePath.trim() !== parentRelativePath ||
    parentRelativePath.includes('\0') ||
    parentRelativePath.includes('\\') ||
    parentRelativePath.includes('//') ||
    isAbsolutePath(parentRelativePath)
  ) {
    return operationFailure('INVALID_PARENT_PATH', 'parentRelativePath must be a vault-relative folder path.');
  }

  const segments = parentRelativePath.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    return operationFailure('PATH_OUTSIDE_VAULT', 'parentRelativePath must not escape the vault.');
  }

  if (segments.some((segment) => segment.startsWith('.') || SKIPPED_DIRECTORY_NAMES.has(segment))) {
    return operationFailure('INVALID_PARENT_PATH', 'parentRelativePath points to a hidden or skipped folder.');
  }

  return null;
}

function validateSinglePathName(name: string, label: 'fileName' | 'folderName'): FileOperationFailure | null {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return operationFailure('INVALID_NAME', `${label} must be a non-empty string.`);
  }

  const trimmedName = name.trim();
  const baseName = trimmedName.split('.')[0]?.toUpperCase() ?? '';

  if (
    trimmedName !== name ||
    trimmedName === '.' ||
    trimmedName === '..' ||
    trimmedName.startsWith('.') ||
    trimmedName.endsWith('.') ||
    trimmedName.includes('/') ||
    trimmedName.includes('\\') ||
    trimmedName.includes('\0') ||
    WINDOWS_INVALID_NAME_CHARS.test(trimmedName) ||
    WINDOWS_RESERVED_NAMES.has(baseName)
  ) {
    return operationFailure('INVALID_NAME', `${label} contains invalid path characters.`);
  }

  return null;
}

function normalizeMarkdownFileName(fileName: string): string | FileOperationFailure {
  const nameError = validateSinglePathName(fileName, 'fileName');
  if (nameError) {
    return nameError;
  }

  const extension = path.posix.extname(fileName).toLowerCase();
  if (extension.length === 0) {
    return `${fileName}.md`;
  }

  if (!MARKDOWN_EXTENSIONS.has(extension)) {
    return operationFailure('INVALID_NAME', 'fileName must use .md or .markdown.');
  }

  return fileName;
}

async function resolveExistingParentDirectory(
  rootPath: string,
  parentRelativePath: string,
): Promise<string | FileOperationFailure> {
  const parentError = validateParentRelativePath(parentRelativePath);
  if (parentError) {
    return parentError;
  }

  let parentAbsolutePath: string;
  try {
    parentAbsolutePath = resolveVaultPath(rootPath, parentRelativePath);
  } catch {
    return operationFailure('PATH_OUTSIDE_VAULT', 'parentRelativePath escapes the vault.');
  }

  try {
    const stat = await fs.stat(parentAbsolutePath);
    if (!stat.isDirectory()) {
      return operationFailure('PARENT_NOT_DIRECTORY', 'parentRelativePath must point to a folder.');
    }

    const realRootPath = await fs.realpath(rootPath);
    const realParentPath = await fs.realpath(parentAbsolutePath);
    if (!isPathInsideRoot(realRootPath, realParentPath)) {
      return operationFailure('PATH_OUTSIDE_VAULT', 'parentRelativePath escapes the vault.');
    }
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return operationFailure('PARENT_NOT_FOUND', 'parentRelativePath does not exist.');
    }

    return operationFailure('INVALID_PARENT_PATH', 'Unable to access parentRelativePath.');
  }

  return parentAbsolutePath;
}

function buildChildRelativePath(parentRelativePath: string, name: string): string {
  return parentRelativePath === '' ? name : `${parentRelativePath}/${name}`;
}

export async function readNote(vaultId: string, relativePath: string): Promise<NoteContent> {
  const rootPath = getVaultRootPath(vaultId);
  const absolutePath = resolveVaultPath(rootPath, relativePath);
  const content = await fs.readFile(absolutePath, 'utf-8');

  return {
    content,
    hash: hashContent(content),
    relativePath,
  };
}

export async function saveNote(
  vaultId: string,
  relativePath: string,
  content: string,
  expectedHash: string | null,
): Promise<SaveNoteResult> {
  const rootPath = getVaultRootPath(vaultId);
  const absolutePath = resolveVaultPath(rootPath, relativePath);

  if (expectedHash !== null) {
    const currentContent = await fs.readFile(absolutePath, 'utf-8');
    const currentHash = hashContent(currentContent);

    if (currentHash !== expectedHash) {
      throw new Error('HASH_CONFLICT: File has been modified externally.');
    }
  }

  await fs.writeFile(absolutePath, content, 'utf-8');

  return {
    hash: hashContent(content),
    relativePath,
  };
}

export async function createNote(vaultId: string, input: CreateNoteInput): Promise<CreateNoteResult> {
  let rootPath: string;
  try {
    rootPath = getVaultRootPath(vaultId);
  } catch {
    return operationFailure('VAULT_NOT_OPEN', 'Vault is not open.');
  }

  const normalizedFileName = normalizeMarkdownFileName(input.fileName);
  if (typeof normalizedFileName !== 'string') {
    return normalizedFileName;
  }

  const parentAbsolutePath = await resolveExistingParentDirectory(rootPath, input.parentRelativePath);
  if (typeof parentAbsolutePath !== 'string') {
    return parentAbsolutePath;
  }

  const relativePath = buildChildRelativePath(input.parentRelativePath, normalizedFileName);
  let absolutePath: string;
  try {
    absolutePath = resolveVaultPath(rootPath, relativePath);
  } catch {
    return operationFailure('PATH_OUTSIDE_VAULT', 'Target note path escapes the vault.');
  }

  const initialContent = input.initialContent ?? '';
  if (typeof initialContent !== 'string') {
    return operationFailure('INVALID_NAME', 'initialContent must be a string when provided.');
  }

  let handle: FileHandle | null = null;
  try {
    handle = await fs.open(absolutePath, 'wx');
    await handle.writeFile(initialContent, 'utf-8');
    await handle.close();
    handle = null;

    const stat = await fs.stat(absolutePath);
    const entry: FileEntry = {
      id: relativePath,
      name: normalizedFileName,
      relativePath,
      type: 'file',
      mtime: stat.mtimeMs,
      size: stat.size,
    };

    return {
      ok: true,
      entry,
      relativePath,
      hash: hashContent(initialContent),
    };
  } catch (error) {
    if (isNodeError(error) && error.code === 'EEXIST') {
      return operationFailure('FILE_ALREADY_EXISTS', 'A file or folder with this name already exists.');
    }

    if (isNodeError(error) && error.code === 'ENOENT') {
      return operationFailure('PARENT_NOT_FOUND', 'parentRelativePath does not exist.');
    }

    return operationFailure('CREATE_NOTE_FAILED', 'Failed to create Markdown file.');
  } finally {
    if (handle) {
      await handle.close();
    }
  }
}

export async function createFolder(vaultId: string, input: CreateFolderInput): Promise<CreateFolderResult> {
  let rootPath: string;
  try {
    rootPath = getVaultRootPath(vaultId);
  } catch {
    return operationFailure('VAULT_NOT_OPEN', 'Vault is not open.');
  }

  const nameError = validateSinglePathName(input.folderName, 'folderName');
  if (nameError) {
    return nameError;
  }

  if (SKIPPED_DIRECTORY_NAMES.has(input.folderName)) {
    return operationFailure('INVALID_NAME', 'folderName is reserved by the vault scanner.');
  }

  const parentAbsolutePath = await resolveExistingParentDirectory(rootPath, input.parentRelativePath);
  if (typeof parentAbsolutePath !== 'string') {
    return parentAbsolutePath;
  }

  const relativePath = buildChildRelativePath(input.parentRelativePath, input.folderName);
  let absolutePath: string;
  try {
    absolutePath = resolveVaultPath(rootPath, relativePath);
  } catch {
    return operationFailure('PATH_OUTSIDE_VAULT', 'Target folder path escapes the vault.');
  }

  try {
    await fs.mkdir(absolutePath);

    return {
      ok: true,
      entry: {
        id: relativePath,
        name: input.folderName,
        relativePath,
        type: 'directory',
        children: [],
      },
      relativePath,
    };
  } catch (error) {
    if (isNodeError(error) && error.code === 'EEXIST') {
      return operationFailure('FOLDER_ALREADY_EXISTS', 'A file or folder with this name already exists.');
    }

    if (isNodeError(error) && error.code === 'ENOENT') {
      return operationFailure('PARENT_NOT_FOUND', 'parentRelativePath does not exist.');
    }

    return operationFailure('CREATE_FOLDER_FAILED', 'Failed to create folder.');
  }
}

// ─────────────────────────────────────────────
// Rename
// ─────────────────────────────────────────────

function renameFailure(code: RenameErrorCode, message: string): RenameFailure {
  return { ok: false, code, message };
}

/**
 * Normalize a new file name for renaming: if the user did not supply
 * a Markdown extension, preserve the original extension of the file
 * being renamed.
 */
function normalizeRenameName(newName: string, originalExtension: string): string | RenameFailure {
  const nameError = validateSinglePathName(newName, 'fileName');
  if (nameError) {
    return renameFailure('INVALID_NAME', nameError.message);
  }

  const userExtension = path.posix.extname(newName).toLowerCase();

  if (userExtension.length === 0) {
    return `${newName}${originalExtension}`;
  }

  if (MARKDOWN_EXTENSIONS.has(userExtension)) {
    return newName;
  }

  return renameFailure('INVALID_NAME', 'File name must use .md or .markdown.');
}

export async function renameNote(
  vaultId: string,
  input: RenameEntryInput,
): Promise<RenameNoteResult> {
  let rootPath: string;
  try {
    rootPath = getVaultRootPath(vaultId);
  } catch {
    return renameFailure('INVALID_PATH', 'Vault is not open.');
  }

  if (input.relativePath.length === 0) {
    return renameFailure('CANNOT_RENAME_ROOT', 'Cannot rename the vault root directory.');
  }

  // Resolve old absolute path
  let oldAbsolutePath: string;
  try {
    oldAbsolutePath = resolveVaultPath(rootPath, input.relativePath);
  } catch {
    return renameFailure('PATH_OUTSIDE_VAULT', 'Relative path escapes the vault.');
  }

  // Stat the existing entry
  let oldStat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    oldStat = await fs.stat(oldAbsolutePath);
  } catch {
    return renameFailure('ENTRY_NOT_FOUND', 'The target file does not exist.');
  }

  if (!oldStat.isFile()) {
    return renameFailure('UNSUPPORTED_ENTRY_TYPE', 'Only Markdown files can be renamed.');
  }

  const oldExt = path.posix.extname(input.relativePath).toLowerCase();
  if (!MARKDOWN_EXTENSIONS.has(oldExt)) {
    return renameFailure('UNSUPPORTED_ENTRY_TYPE', 'Only Markdown files can be renamed.');
  }

  // Normalize new name
  const normalizedName = normalizeRenameName(input.newName, oldExt);
  if (typeof normalizedName !== 'string') {
    return normalizedName;
  }

  // Build new relative path
  const dirPart = path.posix.dirname(input.relativePath);
  const newRelativePath = dirPart === '.' ? normalizedName : `${dirPart}/${normalizedName}`;

  // Resolve new absolute path
  let newAbsolutePath: string;
  try {
    newAbsolutePath = resolveVaultPath(rootPath, newRelativePath);
  } catch {
    return renameFailure('PATH_OUTSIDE_VAULT', 'New path escapes the vault.');
  }

  // Check parent is still a directory (belt-and-suspenders)
  try {
    const parentStat = await fs.stat(path.dirname(newAbsolutePath));
    if (!parentStat.isDirectory()) {
      return renameFailure('PARENT_NOT_DIRECTORY', 'Parent path is not a directory.');
    }
  } catch {
    return renameFailure('ENTRY_NOT_FOUND', 'Parent directory no longer exists.');
  }

  // Check target does not already exist
  try {
    await fs.stat(newAbsolutePath);
    return renameFailure('TARGET_ALREADY_EXISTS', 'A file or folder with this name already exists.');
  } catch (error) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      return renameFailure('RENAME_FAILED', 'Unable to check target path.');
    }
  }

  // Perform the rename
  try {
    await fs.rename(oldAbsolutePath, newAbsolutePath);
  } catch (error) {
    const message = isNodeError(error) ? `${error.code}: ${error.message}` : 'Rename failed.';
    return renameFailure('RENAME_FAILED', message);
  }

  // Read content for hash
  let content: string;
  try {
    content = await fs.readFile(newAbsolutePath, 'utf-8');
  } catch {
    return renameFailure('RENAME_FAILED', 'Renamed file could not be read.');
  }

  const newStat = await fs.stat(newAbsolutePath);

  return {
    ok: true,
    oldRelativePath: input.relativePath,
    newRelativePath,
    entry: {
      id: newRelativePath,
      name: normalizedName,
      relativePath: newRelativePath,
      type: 'file',
      mtime: newStat.mtimeMs,
      size: newStat.size,
    },
    hash: hashContent(content),
  };
}

export async function renameFolder(
  vaultId: string,
  input: RenameEntryInput,
): Promise<RenameFolderResult> {
  let rootPath: string;
  try {
    rootPath = getVaultRootPath(vaultId);
  } catch {
    return renameFailure('INVALID_PATH', 'Vault is not open.');
  }

  if (input.relativePath.length === 0) {
    return renameFailure('CANNOT_RENAME_ROOT', 'Cannot rename the vault root directory.');
  }

  // Resolve old absolute path
  let oldAbsolutePath: string;
  try {
    oldAbsolutePath = resolveVaultPath(rootPath, input.relativePath);
  } catch {
    return renameFailure('PATH_OUTSIDE_VAULT', 'Relative path escapes the vault.');
  }

  // Stat the existing entry
  let oldStat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    oldStat = await fs.stat(oldAbsolutePath);
  } catch {
    return renameFailure('ENTRY_NOT_FOUND', 'The target folder does not exist.');
  }

  if (!oldStat.isDirectory()) {
    return renameFailure('UNSUPPORTED_ENTRY_TYPE', 'Only folders can be renamed with renameFolder.');
  }

  // Validate folder name
  const nameError = validateSinglePathName(input.newName, 'folderName');
  if (nameError) {
    return renameFailure('INVALID_NAME', nameError.message);
  }

  if (SKIPPED_DIRECTORY_NAMES.has(input.newName)) {
    return renameFailure('INVALID_NAME', 'New folder name is reserved by the vault scanner.');
  }

  // Build new relative path
  const dirPart = path.posix.dirname(input.relativePath);
  const newRelativePath = dirPart === '.' ? input.newName : `${dirPart}/${input.newName}`;

  // Resolve new absolute path
  let newAbsolutePath: string;
  try {
    newAbsolutePath = resolveVaultPath(rootPath, newRelativePath);
  } catch {
    return renameFailure('PATH_OUTSIDE_VAULT', 'New path escapes the vault.');
  }

  // Check parent is still a directory
  try {
    const parentStat = await fs.stat(path.dirname(newAbsolutePath));
    if (!parentStat.isDirectory()) {
      return renameFailure('PARENT_NOT_DIRECTORY', 'Parent path is not a directory.');
    }
  } catch {
    return renameFailure('ENTRY_NOT_FOUND', 'Parent directory no longer exists.');
  }

  // Check target does not already exist
  try {
    await fs.stat(newAbsolutePath);
    return renameFailure('TARGET_ALREADY_EXISTS', 'A file or folder with this name already exists.');
  } catch (error) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      return renameFailure('RENAME_FAILED', 'Unable to check target path.');
    }
  }

  // Perform the rename
  try {
    await fs.rename(oldAbsolutePath, newAbsolutePath);
  } catch (error) {
    const message = isNodeError(error) ? `${error.code}: ${error.message}` : 'Rename failed.';
    return renameFailure('RENAME_FAILED', message);
  }

  return {
    ok: true,
    oldRelativePath: input.relativePath,
    newRelativePath,
    entry: {
      id: newRelativePath,
      name: input.newName,
      relativePath: newRelativePath,
      type: 'directory',
      children: [],
    },
  };
}

// ─────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────

function deleteFailure(code: DeleteErrorCode, message: string): DeleteFailure {
  return { ok: false, code, message };
}

async function deleteEntryTrash(
  rootPath: string,
  relativePath: string,
): Promise<{ movedToTrash: true } | DeleteFailure> {
  const absolutePath = resolveVaultPath(rootPath, relativePath);
  try {
    await shell.trashItem(absolutePath);
    return { movedToTrash: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to move item to trash.';
    return deleteFailure('TRASH_FAILED', message);
  }
}

async function deleteEntryPermanent(
  rootPath: string,
  relativePath: string,
  isDirectory: boolean,
): Promise<DeleteFailure | null> {
  const absolutePath = resolveVaultPath(rootPath, relativePath);
  try {
    await fs.rm(absolutePath, { recursive: isDirectory, force: false });
    return null;
  } catch (error) {
    if (isNodeError(error)) {
      if (error.code === 'ENOENT') {
        return deleteFailure('ENTRY_NOT_FOUND', 'The entry no longer exists.');
      }
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        return deleteFailure('PERMISSION_DENIED', 'Permission denied.');
      }
      if (error.code === 'ENOTEMPTY') {
        return deleteFailure('DIRECTORY_NOT_EMPTY', 'Directory is not empty.');
      }
    }
    const message = isNodeError(error) ? `${error.code}: ${error.message}` : 'Delete failed.';
    return deleteFailure('DELETE_FAILED', message);
  }
}

async function readEntryHash(absolutePath: string): Promise<string | DeleteFailure> {
  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    return hashContent(content);
  } catch {
    return deleteFailure('DELETE_FAILED', 'Could not compute hash of the file to be deleted.');
  }
}

export async function deleteNote(
  vaultId: string,
  input: DeleteEntryInput,
): Promise<DeleteNoteOutcome> {
  let rootPath: string;
  try {
    rootPath = getVaultRootPath(vaultId);
  } catch {
    return deleteFailure('INVALID_PATH', 'Vault is not open.');
  }

  if (input.relativePath.length === 0) {
    return deleteFailure('CANNOT_DELETE_ROOT', 'Cannot delete the vault root directory.');
  }

  // Resolve and validate the entry
  let absolutePath: string;
  try {
    absolutePath = resolveVaultPath(rootPath, input.relativePath);
  } catch {
    return deleteFailure('PATH_OUTSIDE_VAULT', 'Path escapes the vault.');
  }

  // Verify it's a Markdown file
  const ext = path.posix.extname(input.relativePath).toLowerCase();
  if (!MARKDOWN_EXTENSIONS.has(ext)) {
    return deleteFailure('UNSUPPORTED_ENTRY_TYPE', 'Only Markdown files can be deleted with deleteNote.');
  }

  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(absolutePath);
  } catch {
    return deleteFailure('ENTRY_NOT_FOUND', 'The target file does not exist.');
  }

  if (!stat.isFile()) {
    return deleteFailure('UNSUPPORTED_ENTRY_TYPE', 'Target is not a file.');
  }

  // Read content for hash BEFORE deletion
  const hashOrFailure = await readEntryHash(absolutePath);
  if (typeof hashOrFailure !== 'string') {
    return hashOrFailure;
  }

  // Try trash first
  const trashResult = await deleteEntryTrash(rootPath, input.relativePath);
  if ('movedToTrash' in trashResult) {
    return {
      ok: true,
      deletedRelativePath: input.relativePath,
      movedToTrash: true,
    hash: hashOrFailure,
    };
   }

  return trashResult;
}

export async function deleteNotePermanent(
  vaultId: string,
  input: DeleteEntryInput,
): Promise<DeleteNoteOutcome> {
  let rootPath: string;
  try {
    rootPath = getVaultRootPath(vaultId);
  } catch {
    return deleteFailure('INVALID_PATH', 'Vault is not open.');
  }

  if (input.relativePath.length === 0) {
    return deleteFailure('CANNOT_DELETE_ROOT', 'Cannot delete the vault root directory.');
  }

  let absolutePath: string;
  try {
    absolutePath = resolveVaultPath(rootPath, input.relativePath);
  } catch {
    return deleteFailure('PATH_OUTSIDE_VAULT', 'Path escapes the vault.');
  }

  const ext = path.posix.extname(input.relativePath).toLowerCase();
  if (!MARKDOWN_EXTENSIONS.has(ext)) {
    return deleteFailure('UNSUPPORTED_ENTRY_TYPE', 'Only Markdown files can be deleted with deleteNotePermanent.');
  }

  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(absolutePath);
  } catch {
    return deleteFailure('ENTRY_NOT_FOUND', 'The target file does not exist.');
  }

  if (!stat.isFile()) {
    return deleteFailure('UNSUPPORTED_ENTRY_TYPE', 'Target is not a file.');
  }

  // Read hash before deleting
  const hashOrFailure = await readEntryHash(absolutePath);
  if (typeof hashOrFailure !== 'string') {
    return hashOrFailure;
  }

  const permError = await deleteEntryPermanent(rootPath, input.relativePath, false);
  if (permError) {
    return permError;
  }

  return {
    ok: true,
    deletedRelativePath: input.relativePath,
    movedToTrash: false,
    hash: hashOrFailure,
  };
}

export async function deleteFolder(
  vaultId: string,
  input: DeleteEntryInput,
): Promise<DeleteFolderOutcome> {
  let rootPath: string;
  try {
    rootPath = getVaultRootPath(vaultId);
  } catch {
    return deleteFailure('INVALID_PATH', 'Vault is not open.');
  }

  if (input.relativePath.length === 0) {
    return deleteFailure('CANNOT_DELETE_ROOT', 'Cannot delete the vault root directory.');
  }

  let absolutePath: string;
  try {
    absolutePath = resolveVaultPath(rootPath, input.relativePath);
  } catch {
    return deleteFailure('PATH_OUTSIDE_VAULT', 'Path escapes the vault.');
  }

  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(absolutePath);
  } catch {
    return deleteFailure('ENTRY_NOT_FOUND', 'The target folder does not exist.');
  }

  if (!stat.isDirectory()) {
    return deleteFailure('UNSUPPORTED_ENTRY_TYPE', 'Target is not a directory.');
  }

  // Try trash first
  const trashResult = await deleteEntryTrash(rootPath, input.relativePath);
  if ('movedToTrash' in trashResult) {
    return {
      ok: true,
      deletedRelativePath: input.relativePath,
      movedToTrash: true,
    };
  }

  return trashResult;
}

export async function deleteFolderPermanent(
  vaultId: string,
  input: DeleteEntryInput,
): Promise<DeleteFolderOutcome> {
  let rootPath: string;
  try {
    rootPath = getVaultRootPath(vaultId);
  } catch {
    return deleteFailure('INVALID_PATH', 'Vault is not open.');
  }

  if (input.relativePath.length === 0) {
    return deleteFailure('CANNOT_DELETE_ROOT', 'Cannot delete the vault root directory.');
  }

  let absolutePath: string;
  try {
    absolutePath = resolveVaultPath(rootPath, input.relativePath);
  } catch {
    return deleteFailure('PATH_OUTSIDE_VAULT', 'Path escapes the vault.');
  }

  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(absolutePath);
  } catch {
    return deleteFailure('ENTRY_NOT_FOUND', 'The target folder does not exist.');
  }

  if (!stat.isDirectory()) {
    return deleteFailure('UNSUPPORTED_ENTRY_TYPE', 'Target is not a directory.');
  }

  const permError = await deleteEntryPermanent(rootPath, input.relativePath, true);
  if (permError) {
    return permError;
  }

  return {
    ok: true,
    deletedRelativePath: input.relativePath,
    movedToTrash: false,
  };
}

// ─────────────────────────────────────────────
// Move
// ─────────────────────────────────────────────

function moveFailure(code: MoveErrorCode, message: string): MoveFailure {
  return { ok: false, code, message };
}

export async function moveNote(
  vaultId: string,
  input: MoveEntryInput,
): Promise<MoveNoteResult> {
  let rootPath: string;
  try {
    rootPath = getVaultRootPath(vaultId);
  } catch {
    return moveFailure('INVALID_PATH', 'Vault is not open.');
  }

  if (input.relativePath.length === 0) {
    return moveFailure('CANNOT_MOVE_ROOT', 'Cannot move the vault root directory.');
  }

  // Validate source
  let oldAbsolutePath: string;
  try {
    oldAbsolutePath = resolveVaultPath(rootPath, input.relativePath);
  } catch {
    return moveFailure('PATH_OUTSIDE_VAULT', 'Source path escapes the vault.');
  }

  const ext = path.posix.extname(input.relativePath).toLowerCase();
  if (!MARKDOWN_EXTENSIONS.has(ext)) {
    return moveFailure('UNSUPPORTED_ENTRY_TYPE', 'Only Markdown files can be moved with moveNote.');
  }

  let oldStat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    oldStat = await fs.stat(oldAbsolutePath);
  } catch {
    return moveFailure('ENTRY_NOT_FOUND', 'The source file does not exist.');
  }

  if (!oldStat.isFile()) {
    return moveFailure('UNSUPPORTED_ENTRY_TYPE', 'Source is not a file.');
  }

  // Validate target parent
  let targetAbsolutePath: string;
  try {
    targetAbsolutePath = resolveVaultPath(rootPath, input.targetParentRelativePath || '.');
  } catch {
    return moveFailure('TARGET_OUTSIDE_VAULT', 'Target parent path escapes the vault.');
  }

  let targetStat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    targetStat = await fs.stat(targetAbsolutePath);
  } catch {
    return moveFailure('TARGET_NOT_FOUND', 'Target parent directory does not exist.');
  }

  if (!targetStat.isDirectory()) {
    return moveFailure('TARGET_NOT_DIRECTORY', 'Target parent is not a directory.');
  }

  // Build new path
  const entryName = path.posix.basename(input.relativePath);
  const newRelativePath = input.targetParentRelativePath === '' || input.targetParentRelativePath === '.'
    ? entryName
    : `${input.targetParentRelativePath}/${entryName}`;

  let newAbsolutePath: string;
  try {
    newAbsolutePath = resolveVaultPath(rootPath, newRelativePath);
  } catch {
    return moveFailure('TARGET_OUTSIDE_VAULT', 'New path escapes the vault.');
  }

  // Check target conflict
  try {
    await fs.stat(newAbsolutePath);
    return moveFailure('TARGET_ALREADY_EXISTS', 'A file or folder with this name already exists at the target.');
  } catch (error) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      return moveFailure('MOVE_FAILED', 'Unable to check target path.');
    }
  }

  // Read content for hash BEFORE move
  let content: string;
  try {
    content = await fs.readFile(oldAbsolutePath, 'utf-8');
  } catch {
    return moveFailure('MOVE_FAILED', 'Could not read file for hash before move.');
  }
  const hash = hashContent(content);

  // Perform the move
  try {
    await fs.rename(oldAbsolutePath, newAbsolutePath);
  } catch (error) {
    const message = isNodeError(error) ? `${error.code}: ${error.message}` : 'Move failed.';
    return moveFailure('MOVE_FAILED', message);
  }

  const newStat = await fs.stat(newAbsolutePath);

  return {
    ok: true,
    oldRelativePath: input.relativePath,
    newRelativePath,
    entry: {
      id: newRelativePath,
      name: entryName,
      relativePath: newRelativePath,
      type: 'file',
      mtime: newStat.mtimeMs,
      size: newStat.size,
    },
    hash: hash,
  };
}

export async function moveFolder(
  vaultId: string,
  input: MoveEntryInput,
): Promise<MoveFolderResult> {
  let rootPath: string;
  try {
    rootPath = getVaultRootPath(vaultId);
  } catch {
    return moveFailure('INVALID_PATH', 'Vault is not open.');
  }

  if (input.relativePath.length === 0) {
    return moveFailure('CANNOT_MOVE_ROOT', 'Cannot move the vault root directory.');
  }

  // Validate source
  let oldAbsolutePath: string;
  try {
    oldAbsolutePath = resolveVaultPath(rootPath, input.relativePath);
  } catch {
    return moveFailure('PATH_OUTSIDE_VAULT', 'Source path escapes the vault.');
  }

  let oldStat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    oldStat = await fs.stat(oldAbsolutePath);
  } catch {
    return moveFailure('ENTRY_NOT_FOUND', 'The source folder does not exist.');
  }

  if (!oldStat.isDirectory()) {
    return moveFailure('UNSUPPORTED_ENTRY_TYPE', 'Source is not a directory.');
  }

  // Validate target parent
  let targetAbsolutePath: string;
  try {
    targetAbsolutePath = resolveVaultPath(rootPath, input.targetParentRelativePath || '.');
  } catch {
    return moveFailure('TARGET_OUTSIDE_VAULT', 'Target parent path escapes the vault.');
  }

  let targetStat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    targetStat = await fs.stat(targetAbsolutePath);
  } catch {
    return moveFailure('TARGET_NOT_FOUND', 'Target parent directory does not exist.');
  }

  if (!targetStat.isDirectory()) {
    return moveFailure('TARGET_NOT_DIRECTORY', 'Target parent is not a directory.');
  }

  // Build new path
  const entryName = path.posix.basename(input.relativePath);
  const newRelativePath = input.targetParentRelativePath === '' || input.targetParentRelativePath === '.'
    ? entryName
    : `${input.targetParentRelativePath}/${entryName}`;

  // Self / descendant guard
  if (newRelativePath === input.relativePath) {
    return moveFailure('CANNOT_MOVE_INTO_SELF', 'Cannot move a folder into itself.');
  }

  if (newRelativePath.startsWith(`${input.relativePath}/`)) {
    return moveFailure('CANNOT_MOVE_INTO_DESCENDANT', 'Cannot move a folder into one of its own subdirectories.');
  }

  let newAbsolutePath: string;
  try {
    newAbsolutePath = resolveVaultPath(rootPath, newRelativePath);
  } catch {
    return moveFailure('TARGET_OUTSIDE_VAULT', 'New path escapes the vault.');
  }

  // Check target conflict
  try {
    await fs.stat(newAbsolutePath);
    return moveFailure('TARGET_ALREADY_EXISTS', 'A file or folder with this name already exists at the target.');
  } catch (error) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      return moveFailure('MOVE_FAILED', 'Unable to check target path.');
    }
  }

  // Perform the move
  try {
    await fs.rename(oldAbsolutePath, newAbsolutePath);
  } catch (error) {
    const message = isNodeError(error) ? `${error.code}: ${error.message}` : 'Move failed.';
    return moveFailure('MOVE_FAILED', message);
  }

  return {
    ok: true,
    oldRelativePath: input.relativePath,
    newRelativePath,
    entry: {
      id: newRelativePath,
      name: entryName,
      relativePath: newRelativePath,
      type: 'directory',
      children: [],
    },
  };
}

// ── moveFolder end
