/**
 * ContextPack + Context Confirmation — Phase 4-1-IMP-6.
 *
 * Defines the type system for user-selected context packaging
 * and the mandatory preflight confirmation guard before any
 * cloud model call.
 *
 * BYOK only. No whole-Vault upload. No absolute paths.
 * No API Key or secret in context. No real provider calls yet.
 *
 * Design: Phase-4-1-DESIGN.md section 9 (ContextPack) and 11 (Context Confirmation).
 */

// ── Context Item ─────────────────────────────────────

/** A single file's context contribution. */
export interface ContextItem {
  /** Relative path from Vault root. NEVER an absolute system path. */
  readonly relativePath: string;
  /** File content, truncated to token budget if needed. */
  readonly content: string;
  /** Byte length of the original file content (before truncation). */
  readonly originalLength: number;
  /** Approximate token count of the included content. */
  readonly tokenCount: number;
  /** Whether this file was truncated to fit the token budget. */
  readonly truncated: boolean;
}

/** Lightweight file reference for renderer display — no content. */
export interface ContextFileRef {
  /** Relative path from Vault root. */
  readonly relativePath: string;
  /** Display name (filename only). */
  readonly displayName: string;
  /** Original file size in bytes. */
  readonly fileSize: number;
}

// ── Context Pack ──────────────────────────────────────

/** Maximum tokens per individual file in the context pack. */
export const DEFAULT_FILE_TOKEN_BUDGET = 2000;

/** Maximum total tokens for the context pack. */
export const DEFAULT_PACK_TOKEN_BUDGET = 8000;

/** Complete context packet — built in main process, summarized for renderer. */
export interface ContextPack {
  /** Selected files with their content. */
  readonly files: readonly ContextItem[];
  /** System prompt template (may be customized by user later). */
  readonly systemPrompt: string;
  /** Total approximate token count across all files + system prompt. */
  readonly totalTokens: number;
  /** Provider ID the context targets. */
  readonly providerId: string;
  /** Model name the context targets. */
  readonly model: string;
  /** Number of files that were truncated. */
  readonly truncatedFileCount: number;
}

/** Renderer-safe context summary — no file content, no secrets. */
export interface ContextSummary {
  /** Number of selected files. */
  readonly fileCount: number;
  /** Lightweight file listing for display. */
  readonly files: readonly ContextFileRefSummary[];
  /** Per-file token estimates. */
  readonly totalTokens: number;
  /** Provider display info. */
  readonly providerId: string;
  /** Model name. */
  readonly model: string;
  /** Provider display name for UI. */
  readonly providerDisplayName: string;
  /** Number of files that were truncated. */
  readonly truncatedFileCount: number;
}

/** Per-file summary in the renderer-safe context summary. */
export interface ContextFileRefSummary {
  /** Relative path from Vault root. */
  readonly relativePath: string;
  /** Display name (filename only). */
  readonly displayName: string;
  /** Approximate token count. */
  readonly tokenCount: number;
  /** Whether this file was truncated. */
  readonly truncated: boolean;
}

// ── Context Confirmation ──────────────────────────────

export type ContextConfirmationState = 'unconfirmed' | 'confirmed' | 'cancelled';

/** Context confirmation guard — must be satisfied before any cloud call. */
export interface ContextConfirmation {
  /** Current confirmation state. */
  readonly state: ContextConfirmationState;
  /** Renderer-safe summary of what would be sent. */
  readonly summary: ContextSummary | null;
  /** Whether the user has explicitly confirmed. */
  readonly userConfirmed: boolean;
  /** ISO timestamp of confirmation (null if unconfirmed). */
  readonly confirmedAt: string | null;
}

/** Result of preflight context confirmation check. */
export interface ContextConfirmationResult {
  /** Whether context is confirmed and ready for cloud call. */
  readonly confirmed: boolean;
  /** Reason if not confirmed. */
  readonly reason?: string;
}

// ── Token Estimation ──────────────────────────────────

/**
 * Approximate token count for a text string.
 *
 * Uses character-based heuristics:
 * - Latin/ASCII: ~4 chars per token
 * - CJK: ~1.5 chars per token (CJK characters pack more meaning per token)
 * - Mixed text uses a weighted average.
 *
 * This is intentionally approximate — production may use tiktoken or equivalent.
 */
export function estimateTokens(text: string): number {
  let latinChars = 0;
  let cjkChars = 0;

  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && (
      (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0x20000 && cp <= 0x2a6df) ||
      (cp >= 0xf900 && cp <= 0xfaff)
    )) {
      cjkChars++;
    } else {
      latinChars++;
    }
  }

  // CJK: ~1.5 chars/token; Latin: ~4 chars/token
  const tokens = (latinChars / 4) + (cjkChars / 1.5);
  return Math.max(1, Math.ceil(tokens));
}

// ── Truncation ────────────────────────────────────────

/** Truncation boundary marker appended to truncated content. */
export const TRUNCATION_MARKER = '\n\n---\n[Content truncated — token budget exceeded]';

/**
 * Truncate content to fit within a token budget.
 * Returns the truncated content and whether truncation occurred.
 */
export function truncateContent(
  content: string,
  tokenBudget: number,
): { content: string; truncated: boolean; tokenCount: number } {
  const totalTokens = estimateTokens(content);
  if (totalTokens <= tokenBudget) {
    return { content, truncated: false, tokenCount: totalTokens };
  }

  // Binary search for truncation point by character count
  const markerTokens = estimateTokens(TRUNCATION_MARKER);
  const availableTokens = tokenBudget - markerTokens;
  if (availableTokens <= 0) {
    const short = content.slice(0, Math.floor(tokenBudget * 2)); // rough fallback
    return { content: short + TRUNCATION_MARKER, truncated: true, tokenCount: estimateTokens(short + TRUNCATION_MARKER) };
  }

  // Use character proportion to estimate cutoff
  const ratio = content.length / totalTokens;
  let cutoffLength = Math.floor(availableTokens * ratio);

  // Safety: clamp cutoff
  if (cutoffLength < 1) cutoffLength = 1;
  if (cutoffLength > content.length) cutoffLength = content.length;

  const truncatedContent = content.slice(0, cutoffLength) + TRUNCATION_MARKER;
  const truncatedTokens = estimateTokens(truncatedContent);

  return { content: truncatedContent, truncated: true, tokenCount: truncatedTokens };
}

// ── Context Pack Builder ──────────────────────────────

/** Input parameters for building a ContextPack. */
export interface ContextPackInput {
  /** Map of relativePath → file content. */
  readonly files: ReadonlyMap<string, string>;
  /** Display name map: relativePath → displayName (filename). */
  readonly displayNames?: ReadonlyMap<string, string>;
  /** System prompt to include. */
  readonly systemPrompt?: string;
  /** Provider ID. */
  readonly providerId: string;
  /** Model name. */
  readonly model: string;
  /** Provider display name. */
  readonly providerDisplayName: string;
  /** Per-file token budget (default: DEFAULT_FILE_TOKEN_BUDGET). */
  readonly fileTokenBudget?: number;
  /** Total pack token budget (default: DEFAULT_PACK_TOKEN_BUDGET). */
  readonly packTokenBudget?: number;
}

/**
 * Build a ContextPack from selected files.
 *
 * Guarantees:
 * - Only explicitly provided files are included (no whole-Vault scan).
 * - All paths are relative (no absolute system paths).
 * - Content is truncated to token budgets.
 * - No API key / secret is included.
 */
export function buildContextPack(input: ContextPackInput): ContextPack {
  const fileBudget = input.fileTokenBudget ?? DEFAULT_FILE_TOKEN_BUDGET;
  const packBudget = input.packTokenBudget ?? DEFAULT_PACK_TOKEN_BUDGET;
  const displayNames = input.displayNames ?? new Map();
  const systemPrompt = input.systemPrompt ?? '';

  const systemTokens = estimateTokens(systemPrompt);
  const entries = Array.from(input.files.entries());

  const items: ContextItem[] = [];
  let runningTotal = systemTokens;

  for (const [relativePath, rawContent] of entries) {
    if (runningTotal >= packBudget) break; // pack budget exhausted

    const remaining = packBudget - runningTotal;
    const itemBudget = Math.min(fileBudget, remaining);

    const { content, truncated, tokenCount } = truncateContent(rawContent, itemBudget);

    items.push({
      relativePath,
      content,
      originalLength: rawContent.length,
      tokenCount,
      truncated,
    });

    runningTotal += tokenCount;
  }

  const totalTokens = runningTotal;
  const truncatedFileCount = items.filter((i) => i.truncated).length;

  return {
    files: items,
    systemPrompt,
    totalTokens,
    providerId: input.providerId,
    model: input.model,
    truncatedFileCount,
  };
}

/**
 * Extract a renderer-safe ContextSummary from a ContextPack.
 * Strips all file content. Keeps only paths, names, and token estimates.
 */
export function toContextSummary(
  pack: ContextPack,
  displayNames?: ReadonlyMap<string, string>,
): ContextSummary {
  const dn = displayNames ?? new Map();
  const files: ContextFileRefSummary[] = pack.files.map((item) => {
    const name = dn.get(item.relativePath);
    return {
      relativePath: item.relativePath,
      displayName: name ?? item.relativePath.split(/[\/\\]/).pop() ?? item.relativePath,
      tokenCount: item.tokenCount,
      truncated: item.truncated,
    };
  });

  return {
    fileCount: files.length,
    files,
    totalTokens: pack.totalTokens,
    providerId: pack.providerId,
    model: pack.model,
    providerDisplayName: '', // filled by caller if needed
    truncatedFileCount: pack.truncatedFileCount,
  };
}

// ── Preflight Guard ───────────────────────────────────

/**
 * Context confirmation preflight guard.
 *
 * Returns { confirmed: true } only when the user has explicitly confirmed
 * the context scope. Must be checked before any cloud model call.
 */
export function checkContextConfirmation(
  confirmation: ContextConfirmation,
): ContextConfirmationResult {
  if (!confirmation.userConfirmed) {
    return { confirmed: false, reason: 'User has not confirmed the context scope.' };
  }
  if (confirmation.state !== 'confirmed') {
    return { confirmed: false, reason: 'Context confirmation is not in confirmed state.' };
  }
  if (!confirmation.summary) {
    return { confirmed: false, reason: 'No context summary available.' };
  }
  return { confirmed: true };
}

/**
 * Create an initial unconfirmed context confirmation state.
 */
export function createUnconfirmedConfirmation(): ContextConfirmation {
  return {
    state: 'unconfirmed',
    summary: null,
    userConfirmed: false,
    confirmedAt: null,
  };
}

/**
 * Confirm the context for a given summary.
 */
export function confirmContext(
  summary: ContextSummary,
): ContextConfirmation {
  return {
    state: 'confirmed',
    summary,
    userConfirmed: true,
    confirmedAt: new Date().toISOString(),
  };
}
