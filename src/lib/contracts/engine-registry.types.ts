/**
 * Engine registry types — Phase 3-1-A.
 *
 * Defines the reserved engine registries, default engines, and engine
 * profiles.  Reserved engines are type-system placeholders only:
 * they are never installed, never called, never shown in UI, and never
 * registered as IPC handlers.
 */

import type { ImportEngine, ImportMode } from './import.types';
import type { ExportEngine, ExportEngineCapability } from './export.types';

// ── Engine Profiles ─────────────────────────────

export interface ImportEngineProfile {
  readonly engine: ImportEngine;
  readonly displayName: string;
  readonly status: 'enabled' | 'reserved' | 'deprecated';  // Phase 4-0-B: +'deprecated'
  readonly supportedFormats: readonly string[];
  readonly capabilities: readonly string[];
  readonly requiresExternalRuntime: boolean;

  // Phase 3-4-B: optional extensions
  /** Import mode(s) this engine supports. */
  readonly mode?: ImportMode;
  /** Description of this engine's quality characteristics. */
  readonly qualityNotes?: readonly string[];
}

export interface ExportEngineProfile {
  readonly engine: ExportEngine;
  readonly displayName: string;
  readonly status: 'enabled' | 'reserved';
  readonly supportedFormats: readonly string[];
  readonly capabilities: readonly ExportEngineCapability[];
  readonly requiresExternalRuntime: boolean;
}

// ── Core Import Engine Registries ───────────────

/**
 * Core enabled import engines — Phase 3-4-I / Phase 3-4-Lite.
 *
 * These engines are the built-in default engines for their respective
 * import modes.  Unlike reserved engines, they are actively probed and
 * used when available.
 */
export const CORE_IMPORT_ENGINES: Record<string, ImportEngineProfile> = {
  markitdown: {
    engine: 'markitdown',
    displayName: 'MarkItDown',
    status: 'enabled',
    supportedFormats: ['pdf', 'docx', 'pptx', 'xlsx', 'html'],
    capabilities: ['text-extraction', 'table-extraction', 'image-extraction', 'heading-detection', 'list-detection', 'hyperlink-detection'],
    requiresExternalRuntime: true,
    mode: 'quick',
    qualityNotes: ['Fast general-purpose import', 'Suitable for simple documents'],
  },
  baseline_paper: {
    engine: 'baseline_paper',
    displayName: 'Baseline Paper',
    status: 'enabled',
    supportedFormats: ['pdf'],
    capabilities: ['text-extraction', 'heading-detection'],
    requiresExternalRuntime: false,
    mode: 'paper_quality',
    qualityNotes: [
      'Built-in lightweight PDF text extraction',
      'Always available — no external runtime required',
      'Honest quality: figures, tables, and formulas marked as unknown',
      'Users should verify against the original PDF for complex content',
    ],
  },
  pymupdf4llm: {
    engine: 'pymupdf4llm',
    displayName: 'PyMuPDF4LLM (deprecated)',
    status: 'deprecated',  // Phase 4-0-B-IMP-3 — removed from active route
    supportedFormats: ['pdf'],
    capabilities: ['text-extraction', 'table-extraction', 'image-extraction', 'heading-detection', 'layout-aware', 'reference-extraction'],
    requiresExternalRuntime: true,
    mode: 'paper_enhanced',
    qualityNotes: ['DEPRECATED — will be replaced by Marker/MinerU. No longer an active import route.'],
  },
};

// ── Reserved Engine Registries ──────────────────

/**
 * Reserved import engines.
 *
 * Phase 2 / Phase 3-1: these engines exist ONLY in the type system.
 * They are never installed, never called, never shown in UI,
 * and never registered as IPC handlers.
 * Any attempt to use them must return ENGINE_NOT_AVAILABLE.
 */
export const RESERVED_IMPORT_ENGINES: Record<string, ImportEngineProfile> = {
  docling_reserved: {
    engine: 'docling_reserved',
    displayName: 'Docling',
    status: 'reserved',
    supportedFormats: ['pdf', 'docx', 'pptx', 'html'],
    capabilities: ['text-extraction', 'table-extraction', 'heading-detection', 'ocr', 'layout-aware', 'figure-extraction', 'reference-extraction'],
    requiresExternalRuntime: true,
    mode: 'precision',
    qualityNotes: ['Layout-aware parsing', 'Figure/table extraction', 'Reading-order recovery'],
  },
  mineru_reserved: {
    engine: 'mineru_reserved',
    displayName: 'MinerU',
    status: 'reserved',
    supportedFormats: ['pdf'],
    capabilities: ['text-extraction', 'table-extraction', 'ocr', 'layout-aware', 'chinese-layout'],
    requiresExternalRuntime: true,
    mode: 'precision',
    qualityNotes: ['Chinese-optimized layout', 'Complex Chinese typesetting', 'Table extraction'],
  },
  marker_reserved: {
    engine: 'marker_reserved',
    displayName: 'Marker',
    status: 'reserved',
    supportedFormats: ['pdf'],
    capabilities: ['text-extraction', 'heading-detection', 'ocr', 'layout-aware', 'equation-extraction'],
    requiresExternalRuntime: true,
    mode: 'precision',
    qualityNotes: ['Formula-to-LaTeX conversion', 'Theorem/proof environment detection'],
  },
  dots_ocr_reserved: {
    engine: 'dots_ocr_reserved',
    displayName: 'dots.ocr',
    status: 'reserved',
    supportedFormats: ['pdf'],
    capabilities: ['ocr', 'layout-aware'],
    requiresExternalRuntime: true,
    mode: 'ocr',
    qualityNotes: ['Scanned PDF OCR', 'Image-based PDF text extraction'],
  },
};

/**
 * Reserved export engines.
 *
 * Same constraints as reserved import engines above.
 */
export const RESERVED_EXPORT_ENGINES: Record<string, ExportEngineProfile> = {
  weasyprint_reserved: {
    engine: 'weasyprint_reserved',
    displayName: 'WeasyPrint',
    status: 'reserved',
    supportedFormats: ['pdf'],
    capabilities: ['pdf-output', 'html-output', 'template-support'],
    requiresExternalRuntime: true,
  },
  typst_reserved: {
    engine: 'typst_reserved',
    displayName: 'Typst',
    status: 'reserved',
    supportedFormats: ['pdf'],
    capabilities: ['pdf-output', 'math-rendering', 'template-support', 'cross-reference'],
    requiresExternalRuntime: true,
  },
  princexml_reserved: {
    engine: 'princexml_reserved',
    displayName: 'PrinceXML',
    status: 'reserved',
    supportedFormats: ['pdf'],
    capabilities: ['pdf-output', 'template-support', 'cross-reference'],
    requiresExternalRuntime: true,
  },
};

// ── Default Engines ─────────────────────────────

/** Phase 2 / Phase 3-1: the single enabled import engine. */
export const DEFAULT_IMPORT_ENGINE: ImportEngine = 'markitdown';

/** Phase 2 / Phase 3-1: the single enabled export engine. */
export const DEFAULT_EXPORT_ENGINE: ExportEngine = 'pandoc';
