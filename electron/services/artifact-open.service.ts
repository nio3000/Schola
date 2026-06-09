/**
 * Artifact open / reveal service — Phase 3-2.
 *
 * Provides path validation and controlled shell operations for
 * generated Markdown (notes/imported/*.md) and export artifacts
 * (_exports/.../output.{docx,html,tex,pdf}).
 *
 * ⚠️  shell.openPath / shell.showItemInFolder are ONLY called here
 *     in the main process — never exposed to the renderer.
 */

import { shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveVaultPath, isExcludedSystemPath } from '../security/path-guard';
import { getVaultRootPath } from './vault.service';

// ── Types ───────────────────────────────────────

export type ArtifactKind = 'generated-markdown' | 'export-artifact';

export type ArtifactOpenErrorCode =
  | 'VAULT_NOT_OPEN'
  | 'INVALID_PATH'
  | 'OUTSIDE_ALLOWED_ROOT'
  | 'UNSUPPORTED_EXTENSION'
  | 'FILE_NOT_FOUND'
  | 'OPEN_FAILED'
  | 'INTERNAL_ERROR';

export interface ArtifactOpenSuccess {
  readonly ok: true;
}

export interface ArtifactOpenFailure {
  readonly ok: false;
  readonly errorCode: ArtifactOpenErrorCode;
  readonly message: string;
}

export type ArtifactOpenResult = ArtifactOpenSuccess | ArtifactOpenFailure;

// ── Extension whitelists ────────────────────────

const GENERATED_MARKDOWN_EXTENSIONS = new Set(['.md']);
const EXPORT_ARTIFACT_EXTENSIONS = new Set(['.docx', '.html', '.tex', '.pdf']);

// ── Unsafe extension blacklist ──────────────────

const UNSAFE_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.ps1', '.sh', '.app', '.dmg',
  '.vbs', '.msi', '.scr', '.pif', '.com',
]);

// ── Path validation ─────────────────────────────

function fail(code: ArtifactOpenErrorCode, message: string): ArtifactOpenFailure {
  return { ok: false, errorCode: code, message };
}

function validateBasicPath(relativePath: unknown): string | ArtifactOpenFailure {
  if (typeof relativePath !== 'string' || relativePath.trim().length === 0) {
    return fail('INVALID_PATH', 'Path must be a non-empty string.');
  }

  // Reject absolute paths
  if (path.isAbsolute(relativePath) || relativePath.startsWith('/')) {
    return fail('INVALID_PATH', 'Path must be a vault-relative path, not absolute.');
  }

  // Reject Windows absolute paths (e.g. C:\...)
  if (/^[A-Za-z]:[/\\]/.test(relativePath)) {
    return fail('INVALID_PATH', 'Path must be a vault-relative path, not absolute.');
  }

  // Reject path traversal
  if (relativePath.includes('..')) {
    return fail('INVALID_PATH', 'Path traversal is not allowed.');
  }

  // Reject URLs
  if (/^(https?|file):\/\//i.test(relativePath)) {
    return fail('INVALID_PATH', 'URLs are not allowed.');
  }

  // Reject null byte
  if (relativePath.includes('\0')) {
    return fail('INVALID_PATH', 'Path contains invalid characters.');
  }

  return relativePath;
}

/**
 * Validate that a path is a legit generated Markdown file
 * inside notes/imported/.
 */
export function validateGeneratedMarkdownPath(
  vaultId: string,
  relativePath: unknown,
): string | ArtifactOpenFailure {
  const basic = validateBasicPath(relativePath);
  if (typeof basic !== 'string') return basic;

  // Must be under notes/imported/
  const normalized = basic.replace(/\\/g, '/');
  if (!normalized.startsWith('notes/imported/')) {
    return fail('OUTSIDE_ALLOWED_ROOT', 'Only generated Markdown files in notes/imported/ can be opened.');
  }

  // Must have .md extension
  const ext = path.extname(normalized).toLowerCase();
  if (!GENERATED_MARKDOWN_EXTENSIONS.has(ext)) {
    return fail('UNSUPPORTED_EXTENSION', 'Only Markdown files (.md) can be opened.');
  }

  // Must not be in excluded system paths
  if (isExcludedSystemPath(normalized)) {
    return fail('OUTSIDE_ALLOWED_ROOT', 'This path is excluded from the vault.');
  }

  // Resolve and check inside vault
  const rootPath = getVaultRootPath(vaultId);
  if (!rootPath) {
    return fail('VAULT_NOT_OPEN', 'No vault is currently open.');
  }

  let absPath: string;
  try {
    absPath = resolveVaultPath(rootPath, normalized);
  } catch {
    return fail('OUTSIDE_ALLOWED_ROOT', 'Path is outside the vault.');
  }

  return absPath;
}

/**
 * Validate that a path is a legit export artifact inside _exports/.
 */
export function validateExportArtifactPath(
  vaultId: string,
  relativePath: unknown,
): string | ArtifactOpenFailure {
  const basic = validateBasicPath(relativePath);
  if (typeof basic !== 'string') return basic;

  // Must be under _exports/ (direct child only, no subdirectories)
  const normalized = basic.replace(/\\/g, '/');
  if (!normalized.startsWith('_exports/')) {
    return fail('OUTSIDE_ALLOWED_ROOT', 'Only export artifacts in _exports/ can be opened.');
  }
  // Reject nested subdirectories under _exports/
  const afterPrefix = normalized.slice('_exports/'.length);
  if (afterPrefix.includes('/')) {
    return fail('OUTSIDE_ALLOWED_ROOT', 'Export artifacts must be directly inside _exports/, not in subdirectories.');
  }

  // Check extension
  const ext = path.extname(normalized).toLowerCase();
  if (!EXPORT_ARTIFACT_EXTENSIONS.has(ext)) {
    return fail('UNSUPPORTED_EXTENSION', 'Only .docx, .html, .tex, and .pdf export artifacts can be opened.');
  }

  // Reject unsafe extensions (defense-in-depth)
  if (UNSAFE_EXTENSIONS.has(ext)) {
    return fail('UNSUPPORTED_EXTENSION', 'This file type cannot be opened.');
  }

  // Resolve and check inside vault
  const rootPath = getVaultRootPath(vaultId);
  if (!rootPath) {
    return fail('VAULT_NOT_OPEN', 'No vault is currently open.');
  }

  let absPath: string;
  try {
    absPath = resolveVaultPath(rootPath, normalized);
  } catch {
    return fail('OUTSIDE_ALLOWED_ROOT', 'Path is outside the vault.');
  }

  return absPath;
}

// ── File existence check ────────────────────────

async function ensureFileExists(absPath: string): Promise<ArtifactOpenFailure | null> {
  try {
    const stat = await fs.stat(absPath);
    if (!stat.isFile()) {
      return fail('FILE_NOT_FOUND', 'The specified path is not a file.');
    }
    return null;
  } catch {
    return fail('FILE_NOT_FOUND', 'File not found.');
  }
}

// ── Open artifact ───────────────────────────────

export async function openArtifact(
  vaultId: string,
  kind: ArtifactKind,
  relativePath: unknown,
): Promise<ArtifactOpenResult> {
  const validated = kind === 'generated-markdown'
    ? validateGeneratedMarkdownPath(vaultId, relativePath)
    : validateExportArtifactPath(vaultId, relativePath);

  if (typeof validated !== 'string') return validated;

  const existsErr = await ensureFileExists(validated);
  if (existsErr) return existsErr;

  try {
    const error = await shell.openPath(validated);
    if (error) {
      return fail('OPEN_FAILED', 'Could not open the file. ' + (error.slice(0, 200)));
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return fail('OPEN_FAILED', message.slice(0, 200));
  }
}

// ── Reveal artifact ─────────────────────────────

export async function revealArtifact(
  vaultId: string,
  kind: ArtifactKind,
  relativePath: unknown,
): Promise<ArtifactOpenResult> {
  const validated = kind === 'generated-markdown'
    ? validateGeneratedMarkdownPath(vaultId, relativePath)
    : validateExportArtifactPath(vaultId, relativePath);

  if (typeof validated !== 'string') return validated;

  const existsErr = await ensureFileExists(validated);
  if (existsErr) return existsErr;

  try {
    shell.showItemInFolder(validated);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return fail('OPEN_FAILED', message.slice(0, 200));
  }
}
