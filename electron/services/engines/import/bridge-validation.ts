/**
 * Bridge output validation — Phase 3-4-C2-a / C2-b / D-R5-P1.
 *
 * Pure validation functions for the docling_convert.py bridge stdout JSON.
 * Located in electron/services/engines/import/ — main-process-internal only.
 * NOT accessible from the renderer.
 *
 * Separated from docling.engine.ts so tests can import without transitive
 * runtime dependencies (vault.service, path-guard, child_process).
 *
 * Phase 3-4-D-R5-P1: added internal diagnostic error codes and extended
 * sanitize patterns to cover MarkItDown and Python.
 */

// ── Bare filename check ─────────────────────────

const BARE_FILENAME_RE = /^[^/\\]+$/;

export function isBareFilename(name: string): boolean {
  return BARE_FILENAME_RE.test(name) && !name.includes('..');
}

// ── Bridge output types ─────────────────────────

interface BridgeFigure {
  id: string;
  page: number;
  caption: string | null;
  filename: string;
  confidence: 'high' | 'medium' | 'low';
}

interface BridgeOutput {
  ok: boolean;
  pageCount?: number;
  figures?: BridgeFigure[];
  tables?: Array<{
    id: string;
    page: number;
    markdownRef: string | null;
    filename: string | null;
    confidence: 'high' | 'medium' | 'low';
  }>;
  equations?: Array<{
    id: string;
    page: number;
    latex: string | null;
    filename: string | null;
    confidence: 'high' | 'medium' | 'low';
  }>;
  confidence?: {
    text: 'high' | 'medium' | 'low';
    equations: 'high' | 'medium' | 'low';
    tables: 'high' | 'medium' | 'low';
    figures: 'high' | 'medium' | 'low';
    references: 'high' | 'medium' | 'low';
  };
  error?: string;
}

// ── Validation ──────────────────────────────────

export function validateBridgeOutput(raw: unknown): BridgeOutput {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Bridge output is not a JSON object');
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.ok !== 'boolean') {
    throw new Error('Bridge output missing required boolean field: ok');
  }
  if (obj.figures !== undefined) {
    if (!Array.isArray(obj.figures)) throw new Error('Bridge output figures must be an array');
    for (const f of obj.figures) {
      if (typeof f.filename !== 'string' || !isBareFilename(f.filename)) {
        throw new Error(`Invalid figure filename: ${String(f.filename)}`);
      }
    }
  }
  if (obj.tables !== undefined) {
    if (!Array.isArray(obj.tables)) throw new Error('Bridge output tables must be an array');
    for (const t of obj.tables) {
      if (t.filename !== null && (typeof t.filename !== 'string' || !isBareFilename(t.filename))) {
        throw new Error(`Invalid table filename: ${String(t.filename)}`);
      }
    }
  }
  if (obj.equations !== undefined) {
    if (!Array.isArray(obj.equations)) throw new Error('Bridge output equations must be an array');
    for (const e of obj.equations) {
      if (e.filename !== null && (typeof e.filename !== 'string' || !isBareFilename(e.filename))) {
        throw new Error(`Invalid equation filename: ${String(e.filename)}`);
      }
    }
  }
  return obj as unknown as BridgeOutput;
}

// ── Error sanitization ──────────────────────────

const SANITIZE_PATTERNS: Array<[RegExp, string]> = [
  // Absolute paths
  [/C:\\[^\s]*/gi, '[path]'],
  [/\/usr\/[^\s]*/g, '[path]'],
  [/\/home\/[^\s]*/g, '[path]'],
  [/\/Users\/[^\s]*/g, '[path]'],
  // Engine / tool names
  [/\b[Dd]ocling\b/g, 'conversion engine'],
  [/\b[Mm]inerU\b/g, 'conversion engine'],
  [/\b[Mm]arker\b/g, 'conversion engine'],
  [/\bdots\.?ocr\b/gi, 'conversion engine'],
  [/\b[Mm]ark[Ii]t[Dd]own\b/g, 'conversion engine'],
  [/\bPython\b/g, 'the runtime'],
  [/\bpdfplumber\b/gi, '[internal dependency]'],
  [/\bpdfminer\b/gi, '[internal dependency]'],
  [/\bpypdfium\d*\b/gi, '[internal dependency]'],
  [/\brapidocr\b/gi, '[internal dependency]'],
  [/\bonnxruntime\b/gi, '[internal dependency]'],
  // Installation commands
  [/\bpip3?\s+(install|uninstall|freeze|list|show)\b[^\n]*/gi, '[installation command]'],
  // Technical diagnostics
  [/\btraceback\b[^\n]*/gi, '[diagnostic]'],
  [/\bsite-packages\b[^\n]*/gi, '[path]'],
  [/\bstderr\b/gi, 'diagnostic output'],
  // Module paths
  [/site-packages[^\s]*/gi, '[path]'],
  // Library internals (Phase 3-4-D-R5-P1)
  [/\bpdfminer\b/gi, '[internal dependency]'],
  [/\bpdfplumber\b/gi, '[internal dependency]'],
  [/\bpypdfium\d*\b/gi, '[internal dependency]'],
  // Generic path patterns
  [/[A-Za-z]:\\[^\s]{4,}/g, '[path]'],
  [/\/[a-zA-Z_]+\/[a-zA-Z_]+[^\s]{4,}/g, '[path]'],
];

export function sanitizeErrorMessage(raw: string): string {
  let s = raw;
  for (const [pattern, replacement] of SANITIZE_PATTERNS) {
    s = s.replace(pattern, replacement);
  }
  return s.slice(0, 500);
}

// ── Internal diagnostic error codes (Phase 3-4-D-R5-P1) ──

export const DIAGNOSTIC_ERROR_CODES = {
  QUICK_CONVERSION_FAILED: 'QUICK_CONVERSION_FAILED',
  PRECISION_CONVERSION_FAILED: 'PRECISION_CONVERSION_FAILED',
  PRECISION_OUTPUT_EMPTY: 'PRECISION_OUTPUT_EMPTY',
  PRECISION_BRIDGE_INVALID_JSON: 'PRECISION_BRIDGE_INVALID_JSON',
  PRECISION_MODEL_NOT_READY: 'PRECISION_MODEL_NOT_READY',
  PRECISION_TIMEOUT: 'PRECISION_TIMEOUT',
  // Phase 3-4-H2: paper_quality diagnostic codes
  PAPER_QUALITY_CONVERSION_FAILED: 'PAPER_QUALITY_CONVERSION_FAILED',
  PAPER_QUALITY_ASSETS_FAILED: 'PAPER_QUALITY_ASSETS_FAILED',
  PAPER_QUALITY_METADATA_FAILED: 'PAPER_QUALITY_METADATA_FAILED',
} as const;

// ── UI-facing error messages (Phase 3-4-D-R5-P1) ──

export const UI_ERROR_MESSAGES = {
  QUICK_FAILED: '快速导入失败。请尝试论文导入，或检查文件格式后重试。',
  QUICK_NO_OUTPUT: '快速导入未能生成有效内容。',
  QUICK_NOT_AVAILABLE: '快速导入暂不可用。',
  PRECISION_FAILED: '论文导入失败。可稍后重试，或改用快速导入。',
  PRECISION_NO_OUTPUT: '论文导入未能生成有效内容。',
  PRECISION_NOT_AVAILABLE: '论文导入暂不可用。',
  PRECISION_MODEL_NOT_READY: '论文导入所需模型尚未准备好，请联网后重试。',
  PRECISION_INVALID_OUTPUT: '论文导入返回无效数据。',
  PRECISION_TIMED_OUT: '论文导入超时，文档可能过大。',
  IMPORT_FAILED: '导入失败。',
  // Phase 3-4-H2: paper_quality diagnostics
  PAPER_QUALITY_FAILED: '论文导入未能完成，原始文件已保留，可尝试快速导入。',
  PAPER_QUALITY_NO_OUTPUT: '论文导入未能生成有效内容。',
  PAPER_QUALITY_NOT_AVAILABLE: '论文导入暂不可用。',
  PAPER_QUALITY_ASSETS_FAILED: '导入资源写入失败，部分功能可能不可用。',
  PAPER_QUALITY_METADATA_FAILED: '导入元数据保存失败。',
} as const;

// ── Internal diagnostic error codes (Phase 3-4-D-R5-P1) ──

/**
 * Internal error codes for import diagnostics.
 *
 * These codes are safe to write to companion JSON and main-process console.
 * They MUST NOT contain paths, tracebacks, or engine-specific identifiers.
 * UI-facing messages should use user-friendly text derived from these codes.
 */
export const IMPORT_ERROR_CODES = {
  QUICK_CONVERSION_FAILED: 'QUICK_CONVERSION_FAILED',
  PRECISION_CONVERSION_FAILED: 'PRECISION_CONVERSION_FAILED',
  PRECISION_OUTPUT_EMPTY: 'PRECISION_OUTPUT_EMPTY',
  PRECISION_BRIDGE_INVALID_JSON: 'PRECISION_BRIDGE_INVALID_JSON',
  PRECISION_MODEL_NOT_READY: 'PRECISION_MODEL_NOT_READY',
  PRECISION_TIMEOUT: 'PRECISION_TIMEOUT',
  ENGINE_NOT_AVAILABLE: 'ENGINE_NOT_AVAILABLE',
  RUNTIME_MISSING_DEPENDENCY: 'RUNTIME_MISSING_DEPENDENCY',
  // Phase 3-4-H2: paper_quality error codes
  PAPER_QUALITY_CONVERSION_FAILED: 'PAPER_QUALITY_CONVERSION_FAILED',
  PAPER_QUALITY_ASSETS_FAILED: 'PAPER_QUALITY_ASSETS_FAILED',
  PAPER_QUALITY_METADATA_FAILED: 'PAPER_QUALITY_METADATA_FAILED',
} as const;

export type ImportErrorCode = (typeof IMPORT_ERROR_CODES)[keyof typeof IMPORT_ERROR_CODES];

/**
 * Map internal error codes to user-facing Chinese messages.
 * Returns null for codes that should use a default message.
 */
export function getUserFacingErrorMessage(code: string, mode: 'quick' | 'paper_quality' | 'precision'): string {
  if (code === IMPORT_ERROR_CODES.QUICK_CONVERSION_FAILED || code === IMPORT_ERROR_CODES.RUNTIME_MISSING_DEPENDENCY) {
    return '快速导入失败。请尝试论文导入，或检查文件格式后重试。';
  }
  if (code === IMPORT_ERROR_CODES.PRECISION_CONVERSION_FAILED || code === IMPORT_ERROR_CODES.PRECISION_OUTPUT_EMPTY || code === IMPORT_ERROR_CODES.PRECISION_BRIDGE_INVALID_JSON) {
    return '论文导入失败。可稍后重试，或改用快速导入。';
  }
  if (code === IMPORT_ERROR_CODES.PRECISION_MODEL_NOT_READY) {
    return '论文导入所需模型尚未准备好，请联网后重试。';
  }
  if (code === IMPORT_ERROR_CODES.PRECISION_TIMEOUT) {
    return '论文导入超时。文档可能过大，请尝试快速导入。';
  }
  // Phase 3-4-H2: paper_quality diagnostics
  if (code === IMPORT_ERROR_CODES.PAPER_QUALITY_CONVERSION_FAILED || code === IMPORT_ERROR_CODES.PAPER_QUALITY_METADATA_FAILED) {
    return '论文导入未能完成，原始文件已保留，可尝试快速导入。';
  }
  if (code === IMPORT_ERROR_CODES.PAPER_QUALITY_ASSETS_FAILED) {
    return '导入资源写入失败，部分功能可能不可用。';
  }
  // Default mode-specific fallback
  return mode === 'precision'
    ? '论文导入失败。可稍后重试，或改用快速导入。'
    : (mode === 'paper_quality'
      ? '论文导入未能完成，原始文件已保留，可尝试快速导入。'
      : '快速导入失败。请尝试论文导入，或检查文件格式后重试。');
}

/**
 * Export SANITIZE_PATTERNS for testing.
 * Tests must verify that forbidden terms are removed from output.
 */
export const FORBIDDEN_UI_TERMS: readonly string[] = [
  'MarkItDown',
  'markitdown',
  'Docling',
  'docling',
  'Python',
  'traceback',
  'Traceback',
  'site-packages',
  'stderr',
  'C:\\',
  '/Users/',
  '/home/',
  '/usr/',
  'pdfplumber',
  'pdfminer',
  'pypdfium',
  'pypdfium2',
  'rapidocr',
  'onnxruntime',
];
