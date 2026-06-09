/**
 * Context Pack Service — Phase 4-1-IMP-6 + Phase 4-2-B (v2).
 *
 * Manages context confirmation state in the main process.
 * Provides the preflight guard that must pass before any cloud model call.
 *
 * SKELETON — no IPC hooks yet. IPC integration deferred to chat flow implementation.
 * No real provider calls. No Vault writes. No RAG. No secret leak.
 *
 * BYOK only. Context scope is explicitly user-selected files only.
 */
import type {
  ContextConfirmation,
  ContextConfirmationResult,
  ContextPack,
  ContextSummary,
} from '../../src/lib/contracts/context-pack.types';
import {
  checkContextConfirmation,
  createUnconfirmedConfirmation,
  confirmContext,
} from '../../src/lib/contracts/context-pack.types';
import type {
  ContextScope,
  ContextPackV2,
  ContextPackV2Summary,
} from '../../src/lib/contracts/context-pack-v2.types';
import { validateContextPackV2 } from '../../src/lib/contracts/context-pack-v2.types';

// ── In-memory store (per session, cleared on app restart) ──

/** Current context confirmation state. Single confirmation per session. */
let currentConfirmation: ContextConfirmation = createUnconfirmedConfirmation();

// ── Public API ────────────────────────────────────────

/**
 * Get the current context confirmation state.
 * Renderer-safe — only returns confirmation metadata, no file content.
 */
export function getContextConfirmation(): ContextConfirmation {
  return currentConfirmation;
}

/**
 * Set the context confirmation from a renderer-provided context summary.
 * The renderer sends the summary only; the main process stores it as the
 * authoritative confirmation guard.
 */
export function setContextConfirmation(summary: ContextSummary): void {
  currentConfirmation = confirmContext(summary);
}

/**
 * Reset the context confirmation to unconfirmed state.
 * Called when user changes context selection or provider/model.
 */
export function resetContextConfirmation(): void {
  currentConfirmation = createUnconfirmedConfirmation();
}

/**
 * Preflight guard — must be called before any provider chat call.
 *
 * If this returns { confirmed: false }, the provider call MUST NOT proceed.
 * This is the mandatory context-scope user-consent checkpoint.
 *
 * @returns Whether the context has been explicitly confirmed by the user.
 */
export function preflightContextGuard(): ContextConfirmationResult {
  return checkContextConfirmation(currentConfirmation);
}

/**
 * Check if a given ContextPack would pass the confirmation guard.
 * Used by tests and validators — does not modify stored state.
 */
export function validateContextPack(pack: ContextPack): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // P0: Must contain files
  if (pack.files.length === 0) {
    issues.push('ContextPack contains no files');
  }

  // P0: No absolute paths
  for (const item of pack.files) {
    if (!item.relativePath || item.relativePath.includes(':\\')) {
      issues.push(`Absolute path detected: "${item.relativePath}"`);
    }
    if (item.relativePath.includes('\\\\')) {
      issues.push(`UNC path detected: "${item.relativePath}"`);
    }
  }

  // P0: Token budget
  if (pack.totalTokens < 0) {
    issues.push('Negative token count');
  }

  // P0: Provider ID required
  if (!pack.providerId) {
    issues.push('Provider ID is required');
  }

  // P0: Model required
  if (!pack.model) {
    issues.push('Model name is required');
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Clear all context confirmation state. For test teardown.
 */
export function clearContextConfirmation(): void {
  currentConfirmation = createUnconfirmedConfirmation();
}

// ── Phase 4-2-B: ContextPack v2 Extensions ─────────────

/** Track the current v2 scope for confirmation reset logic. */
let currentScope: ContextScope | null = null;

/**
 * Update the stored context scope.
 * If scope has changed, automatically reset confirmation.
 * Called when the user modifies their context selection.
 */
export function setContextScope(scope: ContextScope): boolean {
  const scopeChanged = !currentScope ||
    currentScope.type !== scope.type ||
    currentScope.selectedFiles.length !== scope.selectedFiles.length;

  currentScope = scope;

  if (scopeChanged) {
    resetContextConfirmation();
    return true; // scope changed, confirmation reset
  }
  return false; // scope unchanged
}

/**
 * Get the current context scope.
 */
export function getContextScope(): ContextScope | null {
  return currentScope;
}

/**
 * Validate a ContextPackV2. Delegates to shared contract validation.
 */
export function validateV2ContextPack(pack: ContextPackV2): {
  valid: boolean;
  issues: string[];
} {
  return validateContextPackV2(pack);
}
