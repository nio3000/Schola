/**
 * ContextPack Inspector / Citation Surface Contract — Phase 4-8-IMP-1.
 *
 * Defines the types for the ContextPack Inspector (read-only source/evidence preview)
 * and the Citation Surface (PDF Direct Source Layer read-only citation references).
 *
 * This is the CONTRACT layer only — no services, no renderers, no UI, no provider
 * calls, no context send, no ContextPack runtime, no PDF parser, no OCR,
 * no formula recognition, no external database, no web search.
 *
 * Key invariants:
 * - selectedOnly / readonly / sourceBacked / evidenceBacked: all sources must be selected and read-only
 * - noContextSend / noProviderCall / noVaultWrite: all present and true
 * - runtimeDisabled: no runtime capability available
 * - PDF evidence layer preserved; text extraction is index-only, not a replacement
 * - citation refs are readonly placeholders — no generate/mutate/send/insert methods
 * - no automatic citation generation, no reference list building, no body modification
 * - no external database lookup, no web search
 * - no provider call, no embedding, no Model Gateway, no Task Orchestrator, no RAG
 * - no LangGraph / langchain, no workflow runtime
 * - no Vault write, no generic IPC, no window.electronAPI
 * - no PPT-master, no real export, no Phase 5 entry
 */

// ── Source / Evidence Base Types ─────────────────────────────────

/** The type of a source that can be displayed in the inspector. */
export type SourceType = 'pdf' | 'markdown' | 'note' | 'compiled-note' | 'unknown';

/** The type of an evidence reference that can be cited. */
export type EvidenceType = 'page' | 'region' | 'figure' | 'table' | 'formula' | 'text' | 'compiled-note';

// ── Source Reference ─────────────────────────────────────────

/** A read-only reference to a user-selected source. */
export interface SourceRef {
  readonly sourceId: string;
  readonly title: string;
  readonly type: SourceType;
  readonly selected: boolean;
  readonly selectedOnly: true;
  readonly readonly: true;
  readonly sourceBacked: true;
  readonly evidenceBacked: true;
}

/** A scope descriptor for the selected source set. */
export interface ScopeRef {
  readonly scopeId: string;
  readonly displayName: string;
}

/** An evidence reference linked to a source. */
export interface EvidenceRef {
  readonly evidenceId: string;
  readonly sourceId: string;
  readonly type: EvidenceType;
  readonly label: string;
  readonly readonly: true;
}

// ── PDF Direct Source Layer ────────────────────────────────────

/**
 * PDF direct source reference — the original PDF evidence layer.
 * This is NEVER replaced by text extraction; extraction is only an index.
 */
export interface PDFDirectSourceRef extends SourceRef {
  readonly type: 'pdf';
  readonly layer: 'evidence';
  readonly role: 'evidence';
  readonly originalPreserved: true;
}

/**
 * Text extraction index reference — the index layer derived from PDF.
 * This is NOT a replacement for the original PDF.
 */
export interface TextExtractionIndexRef {
  readonly sourceId: string;
  readonly layer: 'index';
  readonly role: 'index';
  readonly notReplacement: true;
}

/**
 * Compiled note reference — the compiled layer (user/system editable).
 */
export interface CompiledNoteRef {
  readonly noteId: string;
  readonly layer: 'compiled';
  readonly role: 'compiled';
  readonly notReplacement: true;
}

// ── Citation Reference Types (readonly placeholders only) ──────

/** Read-only page citation — NO generate/mutate/send/insert. */
export interface PageCitationRef {
  readonly sourceId: string;
  readonly page: number;
  readonly readonly: true;
}

/** Read-only region citation. */
export interface RegionCitationRef {
  readonly sourceId: string;
  readonly page: number;
  readonly regionId: string;
  readonly readonly: true;
}

/** Read-only figure citation. */
export interface FigureCitationRef {
  readonly sourceId: string;
  readonly page: number;
  readonly figureId: string;
  readonly readonly: true;
}

/** Read-only table citation. */
export interface TableCitationRef {
  readonly sourceId: string;
  readonly page: number;
  readonly tableId: string;
  readonly readonly: true;
}

/** Read-only formula region reference — screenshot / region, not recognition. */
export interface FormulaRegionRef {
  readonly sourceId: string;
  readonly page: number;
  readonly formulaRegionId: string;
  readonly readonly: true;
}

/** Read-only formula screenshot reference. */
export interface FormulaScreenshotRef {
  readonly sourceId: string;
  readonly page: number;
  readonly screenshotRef: string;
  readonly readonly: true;
}

// ── Evidence Coverage ──────────────────────────────────────────

/** Evidence coverage descriptor for a set of sources. */
export interface EvidenceCoverageRef {
  readonly sourceCount: number;
  readonly evidenceRefCount: number;
  readonly unsupportedEvidenceWarning: boolean;
  readonly readonly: true;
}

// ── ContextPack Inspector Model ─────────────────────────────────

/**
 * ContextPack Inspector read-only model.
 * Displays selected source / scope / evidence coverage without context send,
 * without provider call, without Model Gateway, without Vault write.
 */
export interface ContextPackInspectorModel {
  readonly sources: readonly SourceRef[];
  readonly scope: ScopeRef;
  readonly sourceCount: number;
  readonly sourceTypes: readonly SourceType[];
  readonly coverage: EvidenceCoverageRef;
  readonly tokenEstimate: number | null;
  readonly userConfirmed: boolean;
  readonly selectedOnly: true;
  readonly readonly: true;
  readonly noContextSend: true;
  readonly noProviderCall: true;
  readonly noVaultWrite: true;
  readonly runtimeDisabled: true;
}

// ── Citation Surface Model ──────────────────────────────────────

/**
 * Citation Surface read-only model.
 * Displays source evidence citations as readonly placeholders.
 * No automatic citation generation, no reference list building,
 * no body modification, no external database, no web search.
 */
export interface CitationSurfaceModel {
  readonly sourceRefs: readonly SourceRef[];
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly pageRefs: readonly PageCitationRef[];
  readonly regionRefs: readonly RegionCitationRef[];
  readonly figureRefs: readonly FigureCitationRef[];
  readonly tableRefs: readonly TableCitationRef[];
  readonly formulaRefs: readonly FormulaRegionRef[];
  readonly formulaScreenshotRefs: readonly FormulaScreenshotRef[];
  readonly readonly: true;
  readonly citationPlaceholdersOnly: true;
  readonly noAutomaticCitationGeneration: true;
  readonly noReferenceListBuilding: true;
  readonly noBodyModification: true;
  readonly noExternalDatabase: true;
  readonly noWebSearch: true;
  readonly runtimeDisabled: true;
}

// ── Contract Helpers ────────────────────────────────────────────

/** Create a minimal ContextPackInspectorModel for testing / empty state. */
export function createEmptyInspectorModel(): ContextPackInspectorModel {
  return {
    sources: [],
    scope: { scopeId: 'empty', displayName: 'Empty Scope' },
    sourceCount: 0,
    sourceTypes: [],
    coverage: { sourceCount: 0, evidenceRefCount: 0, unsupportedEvidenceWarning: false, readonly: true },
    tokenEstimate: null,
    userConfirmed: false,
    selectedOnly: true,
    readonly: true,
    noContextSend: true,
    noProviderCall: true,
    noVaultWrite: true,
    runtimeDisabled: true,
  };
}

/** Create an empty CitationSurfaceModel for testing. */
export function createEmptyCitationSurface(): CitationSurfaceModel {
  return {
    sourceRefs: [],
    evidenceRefs: [],
    pageRefs: [],
    regionRefs: [],
    figureRefs: [],
    tableRefs: [],
    formulaRefs: [],
    formulaScreenshotRefs: [],
    readonly: true,
    citationPlaceholdersOnly: true,
    noAutomaticCitationGeneration: true,
    noReferenceListBuilding: true,
    noBodyModification: true,
    noExternalDatabase: true,
    noWebSearch: true,
    runtimeDisabled: true,
  };
}

// ── Model Factory Helpers (IMP-2) ───────────────────────────────

/** Create a read-only SourceRef with all guard flags enforced. */
export function createReadonlySourceRef(
  sourceId: string,
  title: string,
  type: SourceType = 'markdown',
): SourceRef {
  return {
    sourceId,
    title,
    type,
    selected: true,
    selectedOnly: true,
    readonly: true,
    sourceBacked: true,
    evidenceBacked: true,
  };
}

/** Create a PDFDirectSourceRef — evidence layer, original preserved. */
export function createPDFDirectSourceRef(sourceId: string, title: string): PDFDirectSourceRef {
  return {
    sourceId,
    title,
    type: 'pdf',
    selected: true,
    selectedOnly: true,
    readonly: true,
    sourceBacked: true,
    evidenceBacked: true,
    layer: 'evidence',
    role: 'evidence',
    originalPreserved: true,
  };
}

/** Create a TextExtractionIndexRef — index layer, NOT a replacement. */
export function createTextExtractionIndexRef(sourceId: string): TextExtractionIndexRef {
  return {
    sourceId,
    layer: 'index',
    role: 'index',
    notReplacement: true,
  };
}

/** Create a CompiledNoteRef — compiled layer, NOT a replacement. */
export function createCompiledNoteRef(noteId: string): CompiledNoteRef {
  return {
    noteId,
    layer: 'compiled',
    role: 'compiled',
    notReplacement: true,
  };
}

/** Create an EvidenceCoverageRef with given counts. */
export function createEvidenceCoverageRef(
  sourceCount: number,
  evidenceRefCount: number,
  unsupportedEvidenceWarning = false,
): EvidenceCoverageRef {
  return {
    sourceCount,
    evidenceRefCount,
    unsupportedEvidenceWarning,
    readonly: true,
  };
}

// ── Interop Fixture Helpers (BATCH-1) ──────────────────────────

/**
 * Create a populated ContextPackInspectorModel fixture with given sources.
 * All guard flags enforced.
 */
export function createInspectorModelFixture(
  sources: readonly SourceRef[],
  tokenEstimate: number | null = null,
): ContextPackInspectorModel {
  const types = new Set<SourceType>();
  for (const s of sources) types.add(s.type);
  return {
    sources,
    scope: { scopeId: 'fixture', displayName: 'Fixture Scope' },
    sourceCount: sources.length,
    sourceTypes: [...types],
    coverage: createEvidenceCoverageRef(sources.length, 0),
    tokenEstimate,
    userConfirmed: false,
    selectedOnly: true,
    readonly: true,
    noContextSend: true,
    noProviderCall: true,
    noVaultWrite: true,
    runtimeDisabled: true,
  };
}

/** Create a CitationSurfaceModel fixture from given source refs and citation refs. */
export function createCitationSurfaceFixture(
  sourceRefs: readonly SourceRef[],
  pageRefs: readonly PageCitationRef[] = [],
): CitationSurfaceModel {
  return {
    sourceRefs,
    evidenceRefs: [],
    pageRefs,
    regionRefs: [],
    figureRefs: [],
    tableRefs: [],
    formulaRefs: [],
    formulaScreenshotRefs: [],
    readonly: true,
    citationPlaceholdersOnly: true,
    noAutomaticCitationGeneration: true,
    noReferenceListBuilding: true,
    noBodyModification: true,
    noExternalDatabase: true,
    noWebSearch: true,
    runtimeDisabled: true,
  };
}

/** Create a PDF evidence bundle with source + index + page citation. */
export function createPDFEvidenceFixture(sourceId: string, title: string, page: number): {
  readonly pdf: PDFDirectSourceRef;
  readonly index: TextExtractionIndexRef;
  readonly page: PageCitationRef;
} {
  return {
    pdf: createPDFDirectSourceRef(sourceId, title),
    index: createTextExtractionIndexRef(sourceId),
    page: { sourceId, page, readonly: true },
  };
}

/** Create an Inspector + Citation Surface interop fixture. */
export function createInspectorCitationInteropFixture(): {
  readonly inspector: ContextPackInspectorModel;
  readonly citation: CitationSurfaceModel;
} {
  const pdf = createPDFDirectSourceRef('pdf-1', 'Research Paper');
  const note = createReadonlySourceRef('note-1', 'Analysis Note', 'note');
  const sources = [pdf, note] as const;
  const page = { sourceId: 'pdf-1', page: 42, readonly: true } as PageCitationRef;
  return {
    inspector: createInspectorModelFixture(sources, null),
    citation: createCitationSurfaceFixture(sources, [page]),
  };
}
