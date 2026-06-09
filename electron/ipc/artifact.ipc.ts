/**
 * Artifact IPC handlers — Phase 3-2.
 *
 * Registers 4 fixed-function artifact IPC channels:
 *   artifact:open-generated-markdown
 *   artifact:reveal-generated-markdown
 *   artifact:open-export-artifact
 *   artifact:reveal-export-artifact
 *
 * ⚠️  shell.openPath / shell.showItemInFolder are NEVER exposed.
 *     Only vault-relative paths within allowed roots are accepted.
 */

import { ipcMain } from 'electron';
import {
  ARTIFACT_OPEN_GENERATED_MARKDOWN_CHANNEL,
  ARTIFACT_REVEAL_GENERATED_MARKDOWN_CHANNEL,
  ARTIFACT_OPEN_EXPORT_ARTIFACT_CHANNEL,
  ARTIFACT_REVEAL_EXPORT_ARTIFACT_CHANNEL,
} from '../../src/lib/contracts/artifact.types';
import {
  openArtifact,
  revealArtifact,
  type ArtifactOpenResult,
} from '../services/artifact-open.service';
import { assertVaultId, assertRelativePath } from '../lib/ipc-validation';

// ── Registration ─────────────────────────────────

export function registerArtifactIpc(): void {
  // ── artifact:open-generated-markdown ─────────
  ipcMain.handle(
    ARTIFACT_OPEN_GENERATED_MARKDOWN_CHANNEL,
    async (_event, vaultId: unknown, relativePath: unknown): Promise<ArtifactOpenResult> => {
      try {
        const vault = assertVaultId(vaultId);
        const rel = assertRelativePath(relativePath);
        return await openArtifact(vault, 'generated-markdown', rel);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.startsWith('INVALID_INPUT')) {
          return { ok: false, errorCode: 'INVALID_PATH', message };
        }
        return { ok: false, errorCode: 'INTERNAL_ERROR', message: message.slice(0, 200) };
      }
    },
  );

  // ── artifact:reveal-generated-markdown ───────
  ipcMain.handle(
    ARTIFACT_REVEAL_GENERATED_MARKDOWN_CHANNEL,
    async (_event, vaultId: unknown, relativePath: unknown): Promise<ArtifactOpenResult> => {
      try {
        const vault = assertVaultId(vaultId);
        const rel = assertRelativePath(relativePath);
        return await revealArtifact(vault, 'generated-markdown', rel);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.startsWith('INVALID_INPUT')) {
          return { ok: false, errorCode: 'INVALID_PATH', message };
        }
        return { ok: false, errorCode: 'INTERNAL_ERROR', message: message.slice(0, 200) };
      }
    },
  );

  // ── artifact:open-export-artifact ────────────
  ipcMain.handle(
    ARTIFACT_OPEN_EXPORT_ARTIFACT_CHANNEL,
    async (_event, vaultId: unknown, relativePath: unknown): Promise<ArtifactOpenResult> => {
      try {
        const vault = assertVaultId(vaultId);
        const rel = assertRelativePath(relativePath);
        return await openArtifact(vault, 'export-artifact', rel);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.startsWith('INVALID_INPUT')) {
          return { ok: false, errorCode: 'INVALID_PATH', message };
        }
        return { ok: false, errorCode: 'INTERNAL_ERROR', message: message.slice(0, 200) };
      }
    },
  );

  // ── artifact:reveal-export-artifact ──────────
  ipcMain.handle(
    ARTIFACT_REVEAL_EXPORT_ARTIFACT_CHANNEL,
    async (_event, vaultId: unknown, relativePath: unknown): Promise<ArtifactOpenResult> => {
      try {
        const vault = assertVaultId(vaultId);
        const rel = assertRelativePath(relativePath);
        return await revealArtifact(vault, 'export-artifact', rel);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.startsWith('INVALID_INPUT')) {
          return { ok: false, errorCode: 'INVALID_PATH', message };
        }
        return { ok: false, errorCode: 'INTERNAL_ERROR', message: message.slice(0, 200) };
      }
    },
  );
}
