/**
 * AI Research Context Service — Phase 5-2.
 *
 * Builds in-memory Research ContextPacks from files explicitly selected by the user.
 * No persistence, no provider invocation, no API key exposure, and no whole-Vault scan.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { AIModelInfo } from '../../src/lib/contracts/ai-provider.types';
import type {
  BuildContextPackInput,
  ContextPackFileEntry,
  ContextSourceRef,
  ContextSourceType,
  ContextTokenEstimate,
  EvidenceRef,
  ProviderReadiness,
  ResearchContextPack,
  ResearchContextPreview,
} from '../../src/lib/contracts/ai-research.types';
import type { MaskedSecretStatus, ProviderConfig } from '../../src/lib/contracts/settings.types';
import type { ProviderPreset } from '../../src/lib/contracts/provider-preset.types';
import { getProviderPreset, PROVIDER_PRESETS } from '../../src/lib/contracts/provider-preset.types';
import { assertString, assertVaultId, assertRelativePath } from '../lib/ipc-validation';
import {
  assertPathInsideRoot,
  isExcludedSystemPath,
  resolveVaultPath,
} from '../security/path-guard';
import { getProviderKeyStatus } from '../services/provider-key-store.service';
import { getProviderConfig } from '../services/settings-store.service';
import { getVaultRootPath } from './vault.service';

const DEFAULT_CONTEXT_TOKEN_BUDGET = 16_000;
const DEFAULT_FILE_TOKEN_BUDGET = 4_000;
const DEFAULT_SYSTEM_TOKENS = 800;
const MAX_MARKDOWN_HEADINGS = 64;
const MAX_HEADING_LENGTH = 180;

/** Phase 5-5-C-IMP-1: ContextPack builder limits. */
export const MAX_FILES = 20;
const FORMAT_READ_LIMITS: Record<ContextSourceType, number> = {
  markdown: 32_768,  // 32KB
  pdf:      0,       // IMP-2: real text extraction via pdfjs-dist
  html:     32_768,  // 32KB
  txt:      32_768,  // 32KB
  csv:      16_384,  // 16KB
  docx:     0,       // IMP-2: real text extraction via word-extractor
  xlsx:     0,       // IMP-2: real text extraction via xlsx
  doc:      0,       // IMP-2: real text extraction via word-extractor (legacy)
  xls:      0,       // IMP-2: real text extraction via xlsx (legacy)
  pptx:     0,       // metadata only
  other:    0,       // metadata only
};

const CJK_PATTERN = /[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/g;
const WINDOWS_DRIVE_PATH_PATTERN = /^[a-zA-Z]:[\\/]/;
const UNC_PATH_PATTERN = /^(?:\\\\|\/\/)/;

const contextPacks = new Map<string, ResearchContextPack>();
const contextPackSourceRefs = new Map<string, readonly ContextSourceRef[]>();
/** Phase 5-5-C-IMP-2: Store file contents keyed by packId + relativePath for provider generation. */
const contextPackContents = new Map<string, Map<string, string>>();

const QUOTE_PREVIEW_LIMIT = 180;

type TokenEstimateInput =
  | string
  | Buffer
  | ContextSourceRef
  | ContextPackFileEntry
  | {
      readonly content?: string;
      readonly fileSize?: number;
      readonly tokenCount?: number;
    };

interface SelectedFileReadResult {
  readonly sourceRef: ContextSourceRef;
  readonly content: string | Buffer;
  readonly size: number;
}

export function getProviderReadiness(providerId?: string): ProviderReadiness[] {
  const presets = providerId ? [requireProviderPreset(providerId)] : PROVIDER_PRESETS;
  return presets.map(buildProviderReadiness);
}

export function buildContextPack(input: BuildContextPackInput): ResearchContextPreview {
  assertElectronFileAccessAvailable();
  const vaultId = assertVaultId(input.vaultId);
  const providerId = assertString(input.providerId, 'providerId');
  const model = assertString(input.model, 'model');
  const tokenBudget = normalizeTokenBudget(input.tokenBudget);

  if (!Array.isArray(input.selectedSources) || input.selectedSources.length === 0) {
    throw new Error('INVALID_INPUT: selectedSources must contain at least one user-selected file.');
  }

  if (input.selectedSources.length > MAX_FILES) {
    throw new Error(`INVALID_INPUT: maximum ${MAX_FILES} files allowed per ContextPack.`);
  }

  const rootPath = getVaultRootPath(vaultId);
  const systemTokens = getSystemTokenBudget(tokenBudget);
  let fileTokens = 0;
  const entries: ContextPackFileEntry[] = [];
  const selectedSourceRefs: ContextSourceRef[] = [];
  const contentStore = new Map<string, string>();

  for (const selectedSource of input.selectedSources) {
    const readResult = readSelectedSource(rootPath, selectedSource);
    const rawTokens = estimateSourceTokens(
      readResult.sourceRef.sourceType,
      readResult.content,
      readResult.size,
    );
    const remainingPackTokens = Math.max(0, tokenBudget - systemTokens - fileTokens);
    const tokenCount = Math.min(rawTokens, DEFAULT_FILE_TOKEN_BUDGET, remainingPackTokens);
    const truncated = rawTokens > tokenCount;
    const metadata = buildSourceMetadata(readResult.sourceRef, readResult.content);

    entries.push({
      relativePath: readResult.sourceRef.relativePath,
      displayName: readResult.sourceRef.displayName,
      sourceType: readResult.sourceRef.sourceType,
      tokenCount,
      truncated,
      ...metadata,
    });
    selectedSourceRefs.push(readResult.sourceRef);

    // Phase 5-5-C-IMP-2: Store content for provider generation.
    // Only text content (string) is stored; Buffer content is stored as empty string.
    const contentStr = typeof readResult.content === 'string' ? readResult.content : '';
    contentStore.set(readResult.sourceRef.relativePath, contentStr);

    fileTokens += tokenCount;
  }

  const tokenEstimate: ContextTokenEstimate = {
    fileTokens,
    systemTokens,
    totalTokens: fileTokens + systemTokens,
    budget: tokenBudget,
    exceedsBudget: fileTokens + systemTokens > tokenBudget,
  };
  const pack: ResearchContextPack = {
    id: crypto.randomUUID(),
    files: entries,
    tokenEstimate,
    providerId,
    model,
    truncatedFileCount: entries.filter((entry) => entry.truncated).length,
    userSelectedOnly: true,
  };

  contextPacks.set(pack.id, pack);
  contextPackSourceRefs.set(pack.id, selectedSourceRefs);
  // Phase 5-5-C-IMP-2: Store file contents for provider generation.
  contextPackContents.set(pack.id, contentStore);

  return toPreview(pack, selectedSourceRefs);
}

export function previewContextPack(contextPackId: string): ResearchContextPreview {
  const packId = assertString(contextPackId, 'contextPackId');
  const pack = contextPacks.get(packId);
  if (!pack) {
    throw new Error('CONTEXT_PACK_NOT_FOUND: ContextPack is not available in memory.');
  }

  return toPreview(pack, contextPackSourceRefs.get(packId) ?? toSourceRefs(pack));
}

/**
 * Phase 5-5-C-IMP-2: Get the stored file contents for a ContextPack.
 * Returns a Map of relativePath → text content.
 * Only text-based files have content; binary/pdf files have empty strings.
 */
export function getContextPackContent(
  contextPackId: string,
): Map<string, string> | undefined {
  return contextPackContents.get(contextPackId);
}

export function getContextPackSourceRefs(contextPackId: string): readonly ContextSourceRef[] {
  const packId = assertString(contextPackId, 'contextPackId');
  const refs = contextPackSourceRefs.get(packId);
  if (!refs) {
    throw new Error('CONTEXT_PACK_NOT_FOUND: ContextPack is not available in memory.');
  }
  return refs;
}

export function buildEvidenceRefsForContextPack(
  contextPackId: string,
  modelContent: string,
): readonly EvidenceRef[] {
  const packId = assertString(contextPackId, 'contextPackId');
  const refs = contextPackSourceRefs.get(packId) ?? [];
  const contentMap = contextPackContents.get(packId) ?? new Map<string, string>();
  const evidence: EvidenceRef[] = [];

  refs.forEach((source, index) => {
    const content = contentMap.get(source.relativePath) ?? '';
    const textBacked = content.trim().length > 0;
    evidence.push({
      id: `evidence-${packId}-${index + 1}`,
      kind: 'source-backed',
      label: textBacked ? '上下文来源' : '上下文来源（metadata-only）',
      sourceId: `${packId}:${source.relativePath}`,
      relativePath: source.relativePath,
      displayName: source.displayName,
      sourceType: source.sourceType,
      quotePreview: textBacked ? buildQuotePreview(content) : undefined,
      confidence: textBacked ? 'high' : 'medium',
      note: textBacked
        ? '基于用户确认发送的 ContextPack 正文生成，需人工复核。'
        : '该资源本阶段仅作为 metadata-only 来源，不生成正文 quotePreview。',
      sourceRef: {
        relativePath: source.relativePath,
        displayName: source.displayName,
      },
    });
  });

  if (modelContent.trim().length > 0) {
    evidence.push({
      id: `evidence-${packId}-model-inferred`,
      kind: 'model-inferred',
      label: '模型综合推断',
      confidence: 'medium',
      note: '此项由模型综合上下文生成，不能直接追溯到某一条原文证据。',
      modelInferredNote: '此项为模型综合推断，非原文直接引用。请人工核验。',
    });
  }

  return evidence;
}

export function estimateTokens(
  files: readonly TokenEstimateInput[],
  budget = DEFAULT_CONTEXT_TOKEN_BUDGET,
): ContextTokenEstimate {
  const tokenBudget = normalizeTokenBudget(budget);
  const systemTokens = getSystemTokenBudget(tokenBudget);
  const fileTokens = files.reduce((total, file) => total + estimateTokenInput(file), 0);
  const totalTokens = fileTokens + systemTokens;

  return {
    fileTokens,
    systemTokens,
    totalTokens,
    budget: tokenBudget,
    exceedsBudget: totalTokens > tokenBudget,
  };
}

function requireProviderPreset(providerId: string): ProviderPreset {
  assertString(providerId, 'providerId');
  const preset = getProviderPreset(providerId);
  if (!preset) {
    throw new Error('UNKNOWN_PROVIDER: provider preset was not found.');
  }
  return preset;
}

function buildProviderReadiness(preset: ProviderPreset): ProviderReadiness {
  const config = getProviderConfig(preset.id);
  const keyStatus = getProviderKeyStatus(preset.id)[0];
  const enabled = config?.enabled ?? preset.billingMode === 'local-free';
  const keyConfigured = isKeyConfigured(keyStatus);
  const localFreeReady = preset.billingMode === 'local-free' && enabled;
  const models = buildModelList(preset, config);
  const blockedReason = getProviderBlockedReason(
    preset,
    enabled,
    keyConfigured,
    localFreeReady,
    models,
  );

  return {
    providerId: preset.id,
    preset,
    enabled,
    keyConfigured,
    localFreeReady,
    models,
    ready: blockedReason === undefined,
    ...(blockedReason ? { blockedReason } : {}),
  };
}

function isKeyConfigured(status: MaskedSecretStatus | undefined): boolean {
  return status?.status === 'configured' || status?.status === 'memory-only';
}

function buildModelList(
  preset: ProviderPreset,
  config: ProviderConfig | null,
): readonly AIModelInfo[] {
  const customModels = config?.customModels
    ?.map((model) => model.trim())
    .filter((model) => model.length > 0);
  const modelIds =
    customModels && customModels.length > 0
      ? customModels
      : preset.defaultModel.trim().length > 0
        ? [preset.defaultModel]
        : [];

  return Array.from(new Set(modelIds)).map((modelId) => ({
    id: modelId,
    providerId: preset.id,
    displayName: modelId,
    contextWindow: DEFAULT_CONTEXT_TOKEN_BUDGET,
    capabilities: preset.capabilities,
  }));
}

function getProviderBlockedReason(
  preset: ProviderPreset,
  enabled: boolean,
  keyConfigured: boolean,
  localFreeReady: boolean,
  models: readonly AIModelInfo[],
): string | undefined {
  if (!enabled) {
    return 'provider_disabled';
  }

  if (models.length === 0) {
    return 'no_model_configured';
  }

  if (preset.billingMode === 'local-free') {
    return localFreeReady ? undefined : 'local_free_not_available';
  }

  if (preset.billingMode === 'byok' && !keyConfigured) {
    return 'no_api_key';
  }

  return undefined;
}

function assertElectronFileAccessAvailable(): void {
  if (typeof app?.isReady !== 'function') {
    return;
  }

  if (!app.isReady() && process.env.NODE_ENV !== 'test') {
    throw new Error('APP_NOT_READY: Electron app must be ready before reading Vault files.');
  }
}

function readSelectedSource(rootPath: string, source: ContextSourceRef): SelectedFileReadResult {
  const relativePath = normalizeSourceRelativePath(source.relativePath);
  const sourceType = normalizeSourceType(source.sourceType);
  const displayName = sanitizeDisplayName(source.displayName, relativePath);
  const absolutePath = resolveSafeVaultFile(rootPath, relativePath);
  const stat = getVaultFileStat(absolutePath, relativePath);

  if (!stat.isFile()) {
    throw new Error(`INVALID_SOURCE: "${relativePath}" is not a file.`);
  }

  const sourceRef: ContextSourceRef = {
    relativePath,
    displayName,
    sourceType,
    fileSize: stat.size,
  };

  const rawContent = readVaultFileContent(absolutePath, relativePath, sourceType);
  const readLimit = FORMAT_READ_LIMITS[sourceType];
  const content = applyReadLimit(rawContent, readLimit);

  return {
    sourceRef,
    content,
    size: stat.size,
  };
}

/** Apply per-format read limit to content, truncating if needed. */
function applyReadLimit(content: string | Buffer, limit: number): string | Buffer {
  if (limit <= 0) return '';
  if (Buffer.isBuffer(content)) {
    return content.length > limit ? content.subarray(0, limit) : content;
  }
  return content.length > limit ? content.slice(0, limit) : content;
}

function normalizeSourceRelativePath(input: unknown): string {
  const relativePath = assertRelativePath(input).trim().replace(/\\/g, '/');

  if (
    path.isAbsolute(relativePath) ||
    WINDOWS_DRIVE_PATH_PATTERN.test(relativePath) ||
    UNC_PATH_PATTERN.test(relativePath)
  ) {
    throw new Error('INVALID_SOURCE: selected source path must be Vault-relative.');
  }

  const segments = relativePath.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new Error('INVALID_SOURCE: selected source path must stay inside the Vault.');
  }

  if (segments.some((segment) => segment.startsWith('.')) || isExcludedSystemPath(relativePath)) {
    throw new Error('INVALID_SOURCE: hidden or system Vault files are not allowed.');
  }

  return segments.join('/');
}

function normalizeSourceType(sourceType: string): ContextSourceType {
  const valid: Set<string> = new Set([
    'markdown', 'pdf', 'html', 'txt', 'csv',
    'docx', 'xlsx', 'doc', 'xls', 'pptx', 'other', 'note',
  ]);
  if (!valid.has(sourceType)) return 'other';
  if (sourceType === 'note') return 'markdown';
  return sourceType as ContextSourceType;
}

function sanitizeDisplayName(displayName: string, relativePath: string): string {
  const fallback = path.posix.basename(relativePath);
  const normalized =
    displayName.trim().length > 0 ? displayName.trim().replace(/\\/g, '/') : fallback;
  const baseName = path.posix.basename(normalized);
  return baseName.length > 0 ? baseName : fallback;
}

function resolveSafeVaultFile(rootPath: string, relativePath: string): string {
  try {
    const absolutePath = resolveVaultPath(rootPath, relativePath);
    const realRootPath = fs.realpathSync(rootPath);
    const realFilePath = fs.realpathSync(absolutePath);
    assertPathInsideRoot(realRootPath, realFilePath);
    return realFilePath;
  } catch {
    throw new Error(`INVALID_SOURCE: "${relativePath}" is not a readable Vault file.`);
  }
}

function getVaultFileStat(absolutePath: string, relativePath: string): fs.Stats {
  try {
    return fs.statSync(absolutePath);
  } catch {
    throw new Error(`INVALID_SOURCE: "${relativePath}" is not a readable Vault file.`);
  }
}

function readVaultFileContent(
  absolutePath: string,
  relativePath: string,
  sourceType: ContextSourceType,
): string | Buffer {
  try {
    const readLimit = FORMAT_READ_LIMITS[sourceType];
    switch (sourceType) {
      case 'pdf':
      case 'docx':
      case 'xlsx':
      case 'doc':
      case 'xls':
        return ''; // Phase 5-5-C-IMP-1: metadata only. Real text extraction → IMP-2 (pdfjs-dist / word-extractor / xlsx)
      case 'html': {
        const rawHtml = readLimitedUtf8(absolutePath, readLimit);
        return stripHtmlTags(rawHtml);
      }
      case 'pptx':
      case 'other':
        return ''; // Metadata only, no body content
      default:
        return readLimitedUtf8(absolutePath, readLimit);
    }
  } catch {
    throw new Error(`READ_SOURCE_FAILED: "${relativePath}" could not be read.`);
  }
}

function readLimitedUtf8(absolutePath: string, limit: number): string {
  if (limit <= 0) return '';
  const fd = fs.openSync(absolutePath, 'r');
  try {
    const buffer = Buffer.alloc(limit);
    const bytesRead = fs.readSync(fd, buffer, 0, limit, 0);
    return buffer.subarray(0, bytesRead).toString('utf-8');
  } finally {
    fs.closeSync(fd);
  }
}

/** Strip HTML tags, scripts, and styles from HTML content for context extraction. */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildSourceMetadata(
  sourceRef: ContextSourceRef,
  content: string | Buffer,
): Partial<Pick<ContextPackFileEntry, 'pdfPageRange' | 'markdownHeadings' | 'sheetRange'>> {
  if (sourceRef.sourceType === 'pdf' && Buffer.isBuffer(content)) {
    const pageCount = extractPdfPageCount(content);
    return pageCount ? { pdfPageRange: `1-${pageCount}` } : {};
  }

  if (typeof content === 'string' && shouldExtractMarkdownHeadings(sourceRef)) {
    const markdownHeadings = extractMarkdownHeadings(content);
    return markdownHeadings.length > 0 ? { markdownHeadings } : {};
  }

  if ((sourceRef.sourceType === 'csv' || sourceRef.sourceType === 'xlsx' || sourceRef.sourceType === 'xls') && typeof content === 'string') {
    const lineCount = content.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
    return lineCount > 0 ? { sheetRange: `1-${lineCount} rows` } : {};
  }

  return {};
}

function shouldExtractMarkdownHeadings(sourceRef: ContextSourceRef): boolean {
  const extension = path.extname(sourceRef.relativePath).toLowerCase();
  return (
    sourceRef.sourceType === 'markdown' || extension === '.md' || extension === '.markdown'
  );
}

function extractMarkdownHeadings(content: string): readonly string[] {
  const headings: string[] = [];

  for (const line of content.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;

    const heading = `${match[1]} ${match[2].replace(/\s+#+\s*$/, '').trim()}`;
    headings.push(heading.slice(0, MAX_HEADING_LENGTH));
    if (headings.length >= MAX_MARKDOWN_HEADINGS) break;
  }

  return headings;
}

function extractPdfPageCount(content: Buffer): number | null {
  const pdfText = content.toString('latin1');
  const counts: number[] = [];
  const countPattern = /\/Count\s+(\d+)/g;
  let countMatch: RegExpExecArray | null;

  while ((countMatch = countPattern.exec(pdfText)) !== null) {
    const count = Number.parseInt(countMatch[1], 10);
    if (Number.isInteger(count) && count > 0) {
      counts.push(count);
    }
  }

  if (counts.length > 0) {
    return Math.max(...counts);
  }

  const pageMatches = pdfText.match(/\/Type\s*\/Page(?!s)\b/g);
  return pageMatches && pageMatches.length > 0 ? pageMatches.length : null;
}

function normalizeTokenBudget(tokenBudget: number | undefined): number {
  if (tokenBudget === undefined) {
    return DEFAULT_CONTEXT_TOKEN_BUDGET;
  }

  if (!Number.isFinite(tokenBudget) || tokenBudget <= 0) {
    throw new Error('INVALID_INPUT: tokenBudget must be a positive number.');
  }

  return Math.floor(tokenBudget);
}

function getSystemTokenBudget(tokenBudget: number): number {
  return Math.min(DEFAULT_SYSTEM_TOKENS, tokenBudget);
}

function estimateSourceTokens(
  sourceType: ContextSourceType,
  content: string | Buffer,
  size: number,
): number {
  if (sourceType === 'pptx' || sourceType === 'other') {
    return 0; // Metadata only, no body tokens
  }
  if (sourceType === 'pdf') {
    return estimateByteTokens(size);
  }
  return typeof content === 'string'
    ? estimateTextTokens(content)
    : estimateByteTokens(content.length);
}

function estimateTokenInput(file: TokenEstimateInput): number {
  if (typeof file === 'string') {
    return estimateTextTokens(file);
  }

  if (Buffer.isBuffer(file)) {
    return estimateByteTokens(file.length);
  }

  if ('tokenCount' in file && typeof file.tokenCount === 'number') {
    return normalizeTokenCount(file.tokenCount);
  }

  if ('content' in file && typeof file.content === 'string') {
    return estimateTextTokens(file.content);
  }

  if ('fileSize' in file && typeof file.fileSize === 'number') {
    return estimateByteTokens(file.fileSize);
  }

  return 0;
}

function estimateTextTokens(content: string): number {
  if (content.length === 0) {
    return 0;
  }

  const cjkCount = content.match(CJK_PATTERN)?.length ?? 0;
  const nonCjkCount = Math.max(0, content.length - cjkCount);
  return Math.max(1, Math.ceil(nonCjkCount / 4 + cjkCount / 1.5));
}

function estimateByteTokens(size: number): number {
  if (!Number.isFinite(size) || size <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(size / 4));
}

function normalizeTokenCount(tokenCount: number): number {
  if (!Number.isFinite(tokenCount) || tokenCount <= 0) {
    return 0;
  }
  return Math.ceil(tokenCount);
}

function toPreview(
  pack: ResearchContextPack,
  selectedSourceRefs: readonly ContextSourceRef[],
): ResearchContextPreview {
  return {
    packId: pack.id,
    fileCount: pack.files.length,
    selectedSourceRefs,
    tokenEstimate: pack.tokenEstimate,
    providerId: pack.providerId,
    model: pack.model,
    truncatedFileCount: pack.truncatedFileCount,
    warnings: buildPreviewWarnings(pack),
  };
}

function toSourceRefs(pack: ResearchContextPack): readonly ContextSourceRef[] {
  return pack.files.map((file) => ({
    relativePath: file.relativePath,
    displayName: file.displayName,
    sourceType: file.sourceType,
    fileSize: 0,
  }));
}

function buildPreviewWarnings(pack: ResearchContextPack): readonly string[] {
  const warnings: string[] = [];

  for (const file of pack.files) {
    if (file.truncated) {
      warnings.push(`Truncated "${file.displayName}" to fit the context token budget.`);
    }
  }

  if (pack.tokenEstimate.exceedsBudget) {
    warnings.push('ContextPack token estimate exceeds the configured token budget.');
  }

  return warnings;
}

function buildQuotePreview(content: string): string {
  return content
    .replace(/sk-[a-zA-Z0-9_-]{12,}/g, '[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9_-]+/g, 'Bearer [REDACTED]')
    .replace(/Authorization:\s*.+/gi, 'Authorization: [REDACTED]')
    .replace(/[A-Za-z]:\\[^\s,;]*/g, '[PATH]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, QUOTE_PREVIEW_LIMIT);
}
