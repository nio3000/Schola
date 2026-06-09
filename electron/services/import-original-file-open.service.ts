/**
 * Import original file open / reveal service — Phase 3-4-H3.
 *
 * Provides strict path validation and controlled shell operations for
 * opening / revealing the original imported PDF file stored at
 * attachments/imports/{jobId}_{safeName}.pdf.
 *
 * ⚠️  shell.openPath / shell.showItemInFolder are ONLY called here
 *     in the main process — never exposed to the renderer.
 * ⚠️  All error messages are sanitized — no system paths, sourcePath,
 *     tracebacks, or engine names are returned.
 */

import { shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveVaultPath } from '../security/path-guard';
import { getVaultRootPath } from './vault.service';

// ── Result types ─────────────────────────────────

export interface OpenOriginalFileSuccess {
  readonly ok: true;
}

export interface OpenOriginalFileFailure {
  readonly ok: false;
  readonly error: string;
}

export type OpenOriginalFileResult = OpenOriginalFileSuccess | OpenOriginalFileFailure;

// ── Constants ────────────────────────────────────

/** Encoded traversal patterns */
const ENCODED_TRAVERSAL_PATTERNS = [
  /%2e%2e/i,    // URL-encoded ..
  /%252e/i,     // double URL-encoded .
  /%c0%ae/i,    // UTF-8 overlong encoding
  /%uff0e/i,    // fullwidth dot
];

// ── Helpers ──────────────────────────────────────

function fail(error: string): OpenOriginalFileFailure {
  return { ok: false, error };
}

/**
 * Validate and resolve an original import PDF reference.
 *
 * 19-step path guard:
 *   1. Type check (string, non-empty)
 *   2. Separator normalization (\ → /)
 *   3. Reject absolute paths
 *   4. Reject URL schemes
 *   5. Reject .. traversal
 *   6. Reject encoded traversal
 *   7. Reject null byte
 *   8. Segment count (exactly 3: attachments / imports / {jobId}_{safeName}.pdf)
 *   9. Prefix check (attachments/imports/)
 *  10. jobId format validation
 *  11. safeName format validation
 *  12. Extension check (.pdf, case-insensitive)
 *  13. Reject empty extension
 *  14. Reject double extension (.pdf.exe)
 *  15. Vault path resolution
 *  16. Vault containment check
 *  17. Realpath check (symlink escape defense)
 *  18. File existence + isFile
 *  19. Error sanitize (no paths in result)
 *
 * @returns Absolute resolved path on success, or failure with sanitized error.
 */
async function validateImportOriginalPdfRef(
  vaultId: string,
  originalFileRef: unknown,
): Promise<string | OpenOriginalFileFailure> {
  // ── STEP 1: Type check ──
  if (typeof originalFileRef !== 'string' || originalFileRef.trim().length === 0) {
    return fail('文件路径无效。');
  }

  // ── STEP 2: Separator normalization ──
  let normalized = originalFileRef.replace(/\\/g, '/');
  // Collapse duplicate slashes
  normalized = normalized.replace(/\/+/g, '/');

  // ── STEP 3: Reject absolute paths ──
  if (path.isAbsolute(normalized) || normalized.startsWith('/')) {
    return fail('文件路径无效。');
  }
  if (/^[A-Za-z]:[/\\]/.test(normalized)) {
    return fail('文件路径无效。');
  }

  // ── STEP 4: Reject URL schemes ──
  if (/^(https?|file|data|ftp):\/\//i.test(normalized)) {
    return fail('文件路径无效。');
  }

  // ── STEP 5: Reject .. traversal ──
  if (normalized.includes('..')) {
    return fail('文件路径无效。');
  }

  // ── STEP 6: Reject encoded traversal ──
  for (const pattern of ENCODED_TRAVERSAL_PATTERNS) {
    if (pattern.test(normalized)) {
      return fail('文件路径无效。');
    }
  }

  // ── STEP 7: Reject null byte ──
  if (normalized.includes('\0')) {
    return fail('文件路径无效。');
  }

  // ── STEP 8: Segment count ──
  // Expected: attachments / imports / {jobId}_{safeName}.pdf
  // That is exactly 3 segments (no jobId subdirectory).
  const segments = normalized.split('/');
  if (segments.length !== 3) {
    return fail('找不到原始导入文件。');
  }
  const [root0, root1, fileNameSegment] = segments;

  // ── STEP 9: Prefix check ──
  if (root0 !== 'attachments' || root1 !== 'imports') {
    return fail('找不到原始导入文件。');
  }

  // ── STEP 10-11: Combined filename validation ──
  // Filename format: {jobId}_{safeName}.pdf
  // jobId part: 8-80 chars, alphanumeric with _ and -
  // safeName part: 1-180 chars, alphanumeric, CJK, underscore, space, hyphen
  // (NO dots — dots are only for the extension separator)
  // Regex: start with jobId (8-80), then underscore, then safeName (NO dots, 1-180), then .pdf (case-insensitive)
  const IMPORT_ATTACHMENT_RE = /^([a-zA-Z0-9_-]{8,80})_([a-zA-Z0-9\u4e00-\u9fff_ -]{1,180})\.pdf$/i;
  const match = IMPORT_ATTACHMENT_RE.exec(fileNameSegment);
  if (!match) {
    return fail('文件类型不支持。');
  }
  // match[1] = jobId portion, match[2] = safeName portion

  // ── Hidden filename (starts with dot) ──
  if (fileNameSegment.startsWith('.')) {
    return fail('文件类型不支持。');
  }
  // Must not contain / or \ (defense-in-depth)
  if (fileNameSegment.includes('/') || fileNameSegment.includes('\\')) {
    return fail('文件类型不支持。');
  }

  // ── STEP 12: Extension check (case-insensitive) ──
  const ext = path.extname(fileNameSegment).toLowerCase();
  if (ext !== '.pdf') {
    return fail('文件类型不支持。');
  }

  // ── STEP 13: Reject empty extension ──
  // Covered by STEP 12 — ext !== '.pdf' catches empty extension

  // ── STEP 14: Reject double extension ──
  // Use the original (non-lowercased) extension for basename so that
  // case-variant extensions like .PDF are correctly stripped.
  const originalExt = path.extname(fileNameSegment);
  const baseNoExt = path.basename(fileNameSegment, originalExt);
  if (baseNoExt === '' || baseNoExt === '.' || baseNoExt.includes('.')) {
    return fail('文件类型不支持。');
  }

  // ── STEP 15: Vault path resolution ──
  const rootPath = getVaultRootPath(vaultId);
  if (!rootPath) {
    return fail('没有打开的 Vault。');
  }

  let absPath: string;
  try {
    absPath = resolveVaultPath(rootPath, normalized);
  } catch {
    return fail('找不到原始导入文件。');
  }

  // ── STEP 16: Vault containment ──
  // Resolved path must be inside attachments/imports/
  const normalizedAbs = absPath.replace(/\\/g, '/');
  const expectedDir = 'attachments/imports';
  if (!normalizedAbs.includes('/' + expectedDir + '/')) {
    return fail('找不到原始导入文件。');
  }

  // ── STEP 17: Realpath check (symlink escape defense) ──
  let realAbsPath: string;
  try {
    realAbsPath = await fs.realpath(absPath);
  } catch {
    // File doesn't exist at this point yet — will be caught by STEP 18
    realAbsPath = absPath;
  }

  if (realAbsPath) {
    const normalizedReal = realAbsPath.replace(/\\/g, '/');
    // Real path must still be inside the vault root
    const rootNorm = rootPath.replace(/\\/g, '/');
    if (!normalizedReal.startsWith(rootNorm)) {
      return fail('找不到原始导入文件。');
    }
    // Real path must still be inside attachments/imports/
    if (!normalizedReal.includes('/' + expectedDir + '/')) {
      return fail('找不到原始导入文件。');
    }
  }

  // ── STEP 18: File existence + isFile ──
  try {
    const stat = await fs.stat(absPath);
    if (!stat.isFile()) {
      return fail('找不到原始导入文件。');
    }
  } catch {
    return fail('原始文件可能已移动或删除。');
  }

  // ── STEP 19: Success — return resolved path ──
  return absPath;
}

// ── Open original file ───────────────────────────

/**
 * Open the original imported PDF in the system default application.
 *
 * Expected input: attachments/imports/{jobId}_{safeName}.pdf (vault-relative).
 * Uses shell.openPath in the main process — NEVER shell.openExternal.
 */
export async function openOriginalImportFile(
  vaultId: string,
  originalFileRef: unknown,
): Promise<OpenOriginalFileResult> {
  const validated = await validateImportOriginalPdfRef(vaultId, originalFileRef);
  if (typeof validated !== 'string') return validated;

  try {
    const error = await shell.openPath(validated);
    if (error) {
      // error from shell.openPath is a technical string — sanitize it
      return fail('无法打开原始文件。文件可能已移动或删除。');
    }
    return { ok: true };
  } catch {
    return fail('无法打开原始文件。');
  }
}

// ── Reveal original file ─────────────────────────

/**
 * Reveal the original imported PDF in the OS file manager.
 *
 * Expected input: attachments/imports/{jobId}_{safeName}.pdf (vault-relative).
 * Uses shell.showItemInFolder in the main process.
 */
export async function revealOriginalImportFile(
  vaultId: string,
  originalFileRef: unknown,
): Promise<OpenOriginalFileResult> {
  const validated = await validateImportOriginalPdfRef(vaultId, originalFileRef);
  if (typeof validated !== 'string') return validated;

  try {
    shell.showItemInFolder(validated);
    return { ok: true };
  } catch {
    return fail('无法定位原始文件。文件可能已移动或删除。');
  }
}
