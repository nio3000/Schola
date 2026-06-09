/**
 * ContextPack v2 — Phase 4-2-B.
 *
 * Extends Phase 4-1-IMP-6 ContextPack with:
 * - Multi-mode selection (files, folders, current note, imported literature)
 * - Controlled wikilink expansion (default OFF, maxDepth=1, inside scope only)
 * - Per-model token budgets
 * - Scope-tracking metadata
 *
 * All v1 guarantees remain: selected-only, relativePath-only, no absolute paths,
 * no API Key / secret, no whole-Vault scan, no real provider calls at contract layer.
 *
 * BYOK only. Context scope is explicitly user-selected.
 */

import type { ContextFileRefSummary } from './context-pack.types';

// ── Scope Types ────────────────────────────────────────

/** The kind of selection the user has made for this context. */
export type ContextScopeType =
  | 'files'              // User selected specific files
  | 'folder'             // User selected a folder (shallow: no recursive walk)
  | 'current_note'       // The currently open note in the editor
  | 'imported_literature' // Files under notes/imported/
  | 'combined';          // Multiple scope types combined

/** A selected file reference for v2. */
export interface SelectedFileRef {
  /** Relative path from Vault root. */
  readonly relativePath: string;
  /** Display name (filename only). */
  readonly displayName: string;
}

/** A selected folder reference for v2. */
export interface SelectedFolderRef {
  /** Relative path from Vault root. */
  readonly relativePath: string;
  /** Display name (folder name only). */
  readonly displayName: string;
}

/** The current note reference. */
export interface CurrentNoteRef {
  /** Relative path of the currently open note. */
  readonly relativePath: string;
  /** Display name. */
  readonly displayName: string;
}

/** Imported literature reference (represents the notes/imported/ scope). */
export interface ImportedLiteratureRef {
  /** Scope path prefix (e.g., "notes/imported"). */
  readonly scopePath: string;
  /** Number of imported literature files in scope. */
  readonly fileCount: number;
}

// ── Wikilink Expansion ─────────────────────────────────

/** Options for controlled wikilink expansion. */
export interface WikilinkExpansionOptions {
  /** Whether wikilink expansion is enabled. ALWAYS defaults to false. */
  readonly enabled: boolean;
  /** Maximum depth of wikilink traversal. ALWAYS defaults to 1. */
  readonly maxDepth: number;
  /** Expansion is constrained to files within the selected scope. */
  readonly onlyInsideSelectedScope: boolean;
}

/** Default wikilink expansion options — OFF by default, maxDepth=1. */
export const DEFAULT_WIKILINK_EXPANSION: WikilinkExpansionOptions = {
  enabled: false,
  maxDepth: 1,
  onlyInsideSelectedScope: true,
};

// ── ContextScope ────────────────────────────────────────

/** The full scope description for a ContextPack v2. */
export interface ContextScope {
  /** What kind of selection this represents. */
  readonly type: ContextScopeType;
  /** Explicitly selected files (for 'files' and 'combined' types). */
  readonly selectedFiles: readonly SelectedFileRef[];
  /** Selected folder (for 'folder' type). */
  readonly selectedFolder?: SelectedFolderRef;
  /** Current note (for 'current_note' type). */
  readonly currentNote?: CurrentNoteRef;
  /** Imported literature (for 'imported_literature' type). */
  readonly importedLiterature?: ImportedLiteratureRef;
  /** Wikilink expansion options (always present, see defaults). */
  readonly wikilinkExpansion: WikilinkExpansionOptions;
}

// ── Token Budget by Model ──────────────────────────────

/** Token budget configuration keyed by model family. */
export interface TokenBudgetConfig {
  /** Per-file token budget. */
  readonly fileTokenBudget: number;
  /** Total pack token budget. */
  readonly packTokenBudget: number;
}

/** Default token budgets for common model families. */
export const MODEL_TOKEN_BUDGETS: Record<string, TokenBudgetConfig> = {
  'gpt-4o': { fileTokenBudget: 4000, packTokenBudget: 16000 },
  'gpt-4o-mini': { fileTokenBudget: 4000, packTokenBudget: 16000 },
  'gpt-3.5-turbo': { fileTokenBudget: 2000, packTokenBudget: 8000 },
  'deepseek-chat': { fileTokenBudget: 4000, packTokenBudget: 16000 },
  'deepseek-reasoner': { fileTokenBudget: 4000, packTokenBudget: 16000 },
};

/** Fallback token budget when model is unknown. */
export const DEFAULT_TOKEN_BUDGET: TokenBudgetConfig = {
  fileTokenBudget: 2000,
  packTokenBudget: 8000,
};

/**
 * Resolve token budget for a given model name.
 * Falls back to DEFAULT_TOKEN_BUDGET if model is not in the map.
 */
export function resolveTokenBudget(model: string): TokenBudgetConfig {
  return MODEL_TOKEN_BUDGETS[model] ?? DEFAULT_TOKEN_BUDGET;
}

// ── ContextPack v2 ─────────────────────────────────────

/**
 * ContextPack v2 — extends v1 with scope metadata.
 *
 * All invariants from v1 are preserved:
 * - Only explicitly provided files (no whole-Vault scan)
 * - All paths are relative (no absolute system paths)
 * - Content is truncated to token budgets
 * - No API Key / secret included
 * - No real provider calls at contract layer
 */
export interface ContextPackV2 {
  /** The scope that defines this context selection. */
  readonly scope: ContextScope;
  /** Resolved token budget for the target model. */
  readonly tokenBudget: TokenBudgetConfig;
  /** The v1-style files array (maintained for backward compat). */
  readonly files: readonly ContextFileRefSummary[];
  /** Provider ID. */
  readonly providerId: string;
  /** Model name. */
  readonly model: string;
  /** Provider display name. */
  readonly providerDisplayName: string;
  /** Total approximate token count. */
  readonly totalTokens: number;
  /** Number of files that were truncated. */
  readonly truncatedFileCount: number;
}

// ── Renderer-Safe v2 Summary ───────────────────────────

/** Renderer-safe summary for ContextPack v2 — no file content, no secrets. */
export interface ContextPackV2Summary {
  /** The scope metadata (paths only, no content). */
  readonly scope: ContextScope;
  /** Resolved token budget. */
  readonly tokenBudget: TokenBudgetConfig;
  /** File count. */
  readonly fileCount: number;
  /** Lightweight file listing. */
  readonly files: readonly ContextFileRefSummary[];
  /** Total tokens. */
  readonly totalTokens: number;
  /** Provider display info. */
  readonly providerId: string;
  readonly model: string;
  readonly providerDisplayName: string;
  /** Truncated file count. */
  readonly truncatedFileCount: number;
}

/**
 * Extract a renderer-safe summary from ContextPackV2.
 */
export function toContextPackV2Summary(pack: ContextPackV2): ContextPackV2Summary {
  return {
    scope: pack.scope,
    tokenBudget: pack.tokenBudget,
    fileCount: pack.files.length,
    files: pack.files,
    totalTokens: pack.totalTokens,
    providerId: pack.providerId,
    model: pack.model,
    providerDisplayName: pack.providerDisplayName,
    truncatedFileCount: pack.truncatedFileCount,
  };
}

// ── Validation ──────────────────────────────────────────

/**
 * Validate a ContextPackV2 against P0 constraints.
 */
export function validateContextPackV2(pack: ContextPackV2): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // P0: Scope must be defined
  if (!pack.scope) {
    issues.push('ContextPackV2 scope is required');
  }

  // P0: No absolute paths in any reference
  const allPaths: string[] = [];
  allPaths.push(...pack.scope.selectedFiles.map((f) => f.relativePath));
  if (pack.scope.selectedFolder) allPaths.push(pack.scope.selectedFolder.relativePath);
  if (pack.scope.currentNote) allPaths.push(pack.scope.currentNote.relativePath);
  for (const f of pack.files) allPaths.push(f.relativePath);

  for (const p of allPaths) {
    if (p.includes(':\\')) {
      issues.push(`Windows absolute path detected: "${p}"`);
    }
    if (p.includes('\\\\')) {
      issues.push(`UNC path detected: "${p}"`);
    }
    if (p.startsWith('/') && !p.includes(':\\')) {
      // Unix absolute path — flag if it looks like one (heuristic: starts with / and has no obvious vault structure)
      // We allow / as a relative path start for edge cases, but flag clearly absolute ones.
      if (p.startsWith('/home/') || p.startsWith('/Users/') || p.startsWith('/tmp/') || p.startsWith('/var/')) {
        issues.push(`Unix absolute path detected: "${p}"`);
      }
    }
  }

  // P0: Wikilink expansion constraints
  if (pack.scope.wikilinkExpansion.enabled) {
    if (pack.scope.wikilinkExpansion.maxDepth > 1) {
      issues.push(`Wikilink expansion depth ${pack.scope.wikilinkExpansion.maxDepth} exceeds max allowed (1)`);
    }
    if (!pack.scope.wikilinkExpansion.onlyInsideSelectedScope) {
      issues.push('Wikilink expansion must be constrained to selected scope');
    }
  }

  // P0: Provider and model required
  if (!pack.providerId) issues.push('Provider ID is required');
  if (!pack.model) issues.push('Model name is required');

  // P0: Token budget
  if (pack.totalTokens < 0) issues.push('Negative token count');

  return { valid: issues.length === 0, issues };
}

/**
 * Validate that a scope type is a known value.
 */
export function isValidScopeType(type: string): type is ContextScopeType {
  return ['files', 'folder', 'current_note', 'imported_literature', 'combined'].includes(type);
}

/**
 * Create default wikilink expansion options (always OFF, maxDepth=1, inside scope only).
 */
export function createDefaultWikilinkExpansion(): WikilinkExpansionOptions {
  return { ...DEFAULT_WIKILINK_EXPANSION };
}

/**
 * Create a constrained wikilink expansion with an explicit enabled flag.
 * Max depth is always capped at 1, and onlyInsideSelectedScope is always true.
 */
export function createWikilinkExpansion(enabled: boolean): WikilinkExpansionOptions {
  return {
    enabled,
    maxDepth: 1,
    onlyInsideSelectedScope: true,
  };
}
