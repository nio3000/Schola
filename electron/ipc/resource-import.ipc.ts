/**
 * Resource import IPC handler — Phase 5-4A-IMP-5.
 * Opens file dialog, copies to resources/<kind>/, generates metadata sidecar.
 * Main opens dialog — renderer never passes system paths.
 */
import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  RESOURCE_IMPORT_CHANNEL,
} from '../../src/lib/contracts/import-export-ipc.types';
import type {
  ImportResourceInput,
  ImportResourceResult,
  ImportResourceSuccess,
} from '../../src/lib/contracts/resource.types';
import { resolveVaultPath } from '../security/path-guard';
import { getVaultRootPath } from '../services/vault.service';
import { assertVaultId } from '../lib/ipc-validation';
import { safeResourceName } from '../../src/lib/contracts/resource-classifier';

// ── Helpers ──────────────────────────────────────

function getExtension(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}

function kindFromExtension(ext: string): string {
  const m: Record<string, string> = {
    '.md': 'markdown', '.markdown': 'markdown',
    '.pdf': 'pdf', '.html': 'html', '.htm': 'html',
    '.docx': 'docx', '.pptx': 'pptx', '.xlsx': 'xlsx',
    '.csv': 'csv', '.txt': 'txt',
    '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image', '.gif': 'image',
  };
  return m[ext] ?? 'other';
}

function subdirForKind(kind: string): string {
  const m: Record<string, string> = {
    markdown: 'notes', pdf: 'resources/pdf', html: 'resources/html',
    docx: 'resources/docx', pptx: 'resources/pptx', xlsx: 'resources/xlsx',
    csv: 'resources/csv', txt: 'resources/txt', image: 'resources/images',
    other: 'resources/other',
  };
  return m[kind] ?? 'resources/other';
}

// safeName is now safeResourceName from resource-classifier

async function findAvailablePath(baseDir: string, name: string): Promise<string> {
  let candidate = path.join(baseDir, name);
  if (!(await fileExists(candidate))) return candidate;
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  for (let i = 1; i < 1000; i++) {
    candidate = path.join(baseDir, `${base}_(${i})${ext}`);
    if (!(await fileExists(candidate))) return candidate;
  }
  // fallback with timestamp
  return path.join(baseDir, `${base}_${Date.now()}${ext}`);
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

function sanitizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Unknown error';
  if (msg.includes(':\\') || msg.includes('/home/') || msg.includes('/Users/'))
    return 'Import failed.';
  return msg.slice(0, 200);
}

// ── Registration ─────────────────────────────────

export function registerResourceImportIpc(): void {
  ipcMain.handle(RESOURCE_IMPORT_CHANNEL, async (_event, raw: unknown): Promise<ImportResourceResult> => {
    try {
      const { vaultId } = (raw as ImportResourceInput) ?? {};
      const vault = assertVaultId(vaultId);
      const root = getVaultRootPath(vault);
      if (!root) return { ok: false, error: 'Vault is not open.' };

      const win = BrowserWindow.getFocusedWindow();
      if (!win) return { ok: false, error: 'No active window.' };

      const result = await dialog.showOpenDialog(win, {
        title: '导入资源',
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, error: 'Import cancelled.' };
      }

      const sourcePath = result.filePaths[0];
      const originalName = path.basename(sourcePath);
      const ext = getExtension(originalName);
      const kind = kindFromExtension(ext);
      const subdir = subdirForKind(kind);

      // Ensure target directory
      const targetDir = resolveVaultPath(root, subdir);
      await fs.mkdir(targetDir, { recursive: true });

      const safe = safeResourceName(originalName);
      const destPath = await findAvailablePath(targetDir, safe);
      const destRel = path.relative(root, destPath).replace(/\\/g, '/');

      // Copy file
      await fs.copyFile(sourcePath, destPath);
      const stat = await fs.stat(destPath);

      // Generate metadata sidecar
      const metaDir = resolveVaultPath(root, '.schola/metadata/resources');
      await fs.mkdir(metaDir, { recursive: true });
      const metaId = `res_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
      const metaPath = path.join(metaDir, `${metaId}.json`);
      const metaRel = path.relative(root, metaPath).replace(/\\/g, '/');

      const metadata = {
        schemaVersion: 1,
        resourceId: metaId,
        vaultId: vault,
        resourceRelativePath: destRel,
        metadataRelativePath: metaRel,
        kind,
        originalName,
        size: stat.size,
        importedAt: Date.now(),
        source: 'imported' as const,
      };

      await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');

      return {
        ok: true,
        resourceRelativePath: destRel,
        metadataRelativePath: metaRel,
        kind: kind as ImportResourceSuccess['kind'],
        originalName,
        size: stat.size,
      };
    } catch (err) {
      return { ok: false, error: sanitizeError(err) };
    }
  });
}
