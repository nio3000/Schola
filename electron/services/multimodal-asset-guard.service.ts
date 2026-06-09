/**
 * MultimodalAssetGuardService — Phase 4-4-D.
 *
 * Provides a deterministic, read-only validation layer for multimodal asset
 * references within slide decks, PPT artifacts, preview models, and raw asset
 * lists.
 *
 * The guard validates references only — it never reads, writes, processes,
 * or fetches asset files. It enforces relative-path-only semantics, blocks
 * path traversal and external URLs, requires source backing for every asset
 * reference, and requires evidence backing for factual asset-bearing blocks.
 *
 * Key invariants:
 * - relativePath-only: no absolute paths, no UNC paths, no external URLs
 * - source-backed: every asset reference must carry at least one SourceRef
 * - evidence-backed: factual blocks with asset references must carry EvidenceRef
 * - preview-safe: guard output flags whether references are safe for preview
 * - no file read/write: guard performs zero filesystem operations
 * - no image processing / OCR / image recognition
 * - no provider call, no embedding call, no external fetch
 * - no generic IPC, no Vault write
 * - no PPT-master reference or integration
 * - no Phase 5 plugin entry
 */
import type {
  AssetGuardMode,
  AssetGuardTarget,
  AssetRefViolation,
  AssetRefViolationReason,
  MultimodalAssetGuardError,
  MultimodalAssetGuardReport,
  MultimodalAssetGuardRequest,
  MultimodalAssetGuardResult,
  MultimodalAssetGuardWarning,
  MultimodalAssetRef,
  PPTArtifact,
  SlideContentBlock,
  SlideDeckArtifact,
  SlidePreviewBlock,
  SlidePreviewItem,
  SlidePreviewModel,
} from '../../src/lib/contracts/ppt-artifact.types';

// ── Constants ──────────────────────────────────────────

const ERROR_CODES = {
  EMPTY_REQUEST_ID: 'empty_request_id',
  CONTEXT_NOT_CONFIRMED: 'context_not_confirmed',
  NO_TARGET_DATA: 'no_target_data',
} as const;

const WARNING_CODES = {
  UNSUPPORTED_ASSET_TYPE: 'unsupported_asset_type',
  FACTUAL_BLOCK_NO_EVIDENCE: 'factual_block_no_evidence',
} as const;

/** Asset types recognized by the guard. */
const SUPPORTED_ASSET_TYPES: ReadonlySet<MultimodalAssetRef['assetType']> = new Set([
  'image',
  'chart',
  'table',
  'diagram',
]);

/** Block types that are considered factual when they carry an asset ref. */
const FACTUAL_ASSET_BLOCK_TYPES: ReadonlySet<string> = new Set([
  'image',
  'table',
  'chart',
]);

// ── Path Validation ────────────────────────────────────

/** Reject Unix absolute paths starting with `/`. */
function isUnixAbsolute(path: string): boolean {
  return path.startsWith('/');
}

/** Reject Windows absolute paths like `C:\\...` or `D:/...`. */
function isWindowsAbsolute(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path);
}

/** Reject UNC / network paths like `\\\\server\\share\\...`. */
function isUncPath(path: string): boolean {
  return path.startsWith('\\\\') || path.startsWith('//');
}

/** Reject path traversal patterns `../` or `..\\`. */
function isPathTraversal(path: string): boolean {
  return /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(path);
}

/** Reject any protocol-based external URL. */
function isExternalUrl(path: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(path);
}

// ── Block / Slide Helpers ──────────────────────────────

/** Extract all asset refs from a slide deck's content blocks. */
function collectDeckAssetRefs(deck: SlideDeckArtifact): {
  assetRef: MultimodalAssetRef;
  slideIndex: number;
  blockIndex: number;
  block: SlideContentBlock;
}[] {
  const refs: {
    assetRef: MultimodalAssetRef;
    slideIndex: number;
    blockIndex: number;
    block: SlideContentBlock;
  }[] = [];

  for (const slide of deck.slides) {
    for (let bi = 0; bi < slide.blocks.length; bi++) {
      const block = slide.blocks[bi];
      if (block.assetRef) {
        refs.push({
          assetRef: block.assetRef,
          slideIndex: slide.index,
          blockIndex: bi,
          block,
        });
      }
    }
  }

  return refs;
}

/** Extract all asset refs from a preview model's content blocks. */
function collectPreviewAssetRefs(model: SlidePreviewModel): {
  assetRef: MultimodalAssetRef;
  slideIndex: number;
  blockIndex: number;
  block: SlidePreviewBlock;
}[] {
  const refs: {
    assetRef: MultimodalAssetRef;
    slideIndex: number;
    blockIndex: number;
    block: SlidePreviewBlock;
  }[] = [];

  for (const slide of model.slides) {
    for (let bi = 0; bi < slide.blocks.length; bi++) {
      const block = slide.blocks[bi];
      if (block.assetRef) {
        refs.push({
          assetRef: {
            relativePath: block.assetRef.relativePath,
            assetType: block.assetRef.assetType,
            caption: block.assetRef.caption,
            sources: block.assetRef.sources,
          },
          slideIndex: slide.index,
          blockIndex: bi,
          block,
        });
      }
    }
  }

  return refs;
}

// ── MultimodalAssetGuardService ────────────────────────

export class MultimodalAssetGuardService {
  /**
   * Main entry point: validate all asset references in the request.
   * Dispatches to target-specific validators based on `request.target`.
   */
  validateAssetReferences(
    request: MultimodalAssetGuardRequest,
  ): MultimodalAssetGuardResult {
    const preErrors = this.validateRequest(request);
    if (preErrors.length > 0) {
      const report = this.emptyReport(request, preErrors.map((e) => e.message));
      return {
        ok: false,
        report,
        violations: [],
        errors: preErrors,
        warnings: [],
        providerCalled: false,
        userReviewRequired: true,
      };
    }

    const violations: AssetRefViolation[] = [];
    const warnings: MultimodalAssetGuardWarning[] = [];

    let totalAssetRefs = 0;

    switch (request.target) {
      case 'slide_deck': {
        if (!request.deck) break;
        const result = this.validateSlideDeckAssets(request.deck);
        violations.push(...result.violations);
        warnings.push(...result.warnings);
        totalAssetRefs = result.totalRefs;
        break;
      }
      case 'ppt_artifact': {
        const artifact = request.pptArtifact ?? null;
        if (!artifact || !artifact.deck) break;
        const result = this.validateSlideDeckAssets(artifact.deck);
        violations.push(...result.violations);
        warnings.push(...result.warnings);
        totalAssetRefs = result.totalRefs;
        break;
      }
      case 'preview_model': {
        if (!request.previewModel) break;
        const result = this.validatePreviewModelAssets(request.previewModel);
        violations.push(...result.violations);
        warnings.push(...result.warnings);
        totalAssetRefs = result.totalRefs;
        break;
      }
      case 'asset_list': {
        if (!request.assetRefs) break;
        const result = this.validateAssetList(request.assetRefs);
        violations.push(...result.violations);
        warnings.push(...result.warnings);
        totalAssetRefs = result.totalRefs;
        break;
      }
      /* no default — exhaustive check handled by type system */
    }

    const report = this.buildGuardReport(request, totalAssetRefs, violations, warnings);
    const ok = this.determineOk(request.mode, violations);

    return {
      ok,
      report,
      violations,
      errors: [],
      warnings,
      providerCalled: false,
      userReviewRequired: true,
    };
  }

  /**
   * Validate all asset references within a SlideDeckArtifact.
   * Checks path safety, source backing, and evidence backing for factual blocks.
   */
  validateSlideDeckAssets(deck: SlideDeckArtifact): {
    violations: AssetRefViolation[];
    warnings: MultimodalAssetGuardWarning[];
    totalRefs: number;
  } {
    const violations: AssetRefViolation[] = [];
    const warnings: MultimodalAssetGuardWarning[] = [];
    const refs = collectDeckAssetRefs(deck);

    for (const { assetRef, slideIndex, blockIndex, block } of refs) {
      const refViolations = this.validateAssetRef(assetRef, slideIndex, blockIndex);
      violations.push(...refViolations);

      const refWarnings = this.validateAssetType(assetRef, slideIndex, blockIndex);
      warnings.push(...refWarnings);

      const evidenceWarnings = this.validateEvidenceBackingForFactualBlock(
        block,
        slideIndex,
        blockIndex,
      );
      warnings.push(...evidenceWarnings);
    }

    return { violations, warnings, totalRefs: refs.length };
  }

  /**
   * Validate all asset references within a SlidePreviewModel.
   */
  validatePreviewModelAssets(model: SlidePreviewModel): {
    violations: AssetRefViolation[];
    warnings: MultimodalAssetGuardWarning[];
    totalRefs: number;
  } {
    const violations: AssetRefViolation[] = [];
    const warnings: MultimodalAssetGuardWarning[] = [];
    const refs = collectPreviewAssetRefs(model);

    for (const { assetRef, slideIndex, blockIndex, block } of refs) {
      const refViolations = this.validateAssetRef(assetRef, slideIndex, blockIndex);
      violations.push(...refViolations);

      const refWarnings = this.validateAssetType(assetRef, slideIndex, blockIndex);
      warnings.push(...refWarnings);

      // Reconstruct a content-block-like interface for evidence checking.
      const syntheticBlock: SlideContentBlock = {
        blockType: block.blockType,
        content: block.content,
        items: block.items,
        sources: assetRef.sources,
        evidence: 'evidence' in block ? (block as SlidePreviewBlock).evidence : [],
        assetRef,
        confidence: 'confidence' in block ? (block as SlidePreviewBlock).confidence : 1,
        hasUnsupportedClaims: 'hasUnsupportedClaims' in block
          ? (block as SlidePreviewBlock).hasUnsupportedClaims
          : false,
      };

      const evidenceWarnings = this.validateEvidenceBackingForFactualBlock(
        syntheticBlock,
        slideIndex,
        blockIndex,
      );
      warnings.push(...evidenceWarnings);
    }

    return { violations, warnings, totalRefs: refs.length };
  }

  /**
   * Validate a bare list of asset references without slide/block context.
   */
  validateAssetList(assetRefs: readonly MultimodalAssetRef[]): {
    violations: AssetRefViolation[];
    warnings: MultimodalAssetGuardWarning[];
    totalRefs: number;
  } {
    const violations: AssetRefViolation[] = [];
    const warnings: MultimodalAssetGuardWarning[] = [];

    for (const assetRef of assetRefs) {
      const refViolations = this.validateAssetRef(assetRef);
      violations.push(...refViolations);

      const refWarnings = this.validateAssetType(assetRef);
      warnings.push(...refWarnings);
    }

    return { violations, warnings, totalRefs: assetRefs.length };
  }

  /**
   * Validate a single MultimodalAssetRef.
   *
   * Checks:
   * 1. relativePath-only (reject absolute, Windows absolute, UNC, traversal, external URL)
   * 2. source backing required
   */
  validateAssetRef(
    assetRef: MultimodalAssetRef,
    slideIndex?: number,
    blockIndex?: number,
  ): AssetRefViolation[] {
    const violations: AssetRefViolation[] = [];

    // ── Path safety ──────────────────────────────────
    const pathViolation = this.validateRelativePathOnly(assetRef.relativePath);
    if (pathViolation) {
      violations.push({
        assetRef,
        reason: pathViolation,
        detail: this.violationDetail(pathViolation, assetRef.relativePath),
      });
    }

    // ── Source backing ───────────────────────────────
    if (assetRef.sources.length === 0) {
      violations.push({
        assetRef,
        reason: 'no_source_backing',
        detail: `Asset reference "${assetRef.caption}" has no source backing.`,
      });
    }

    return violations;
  }

  /**
   * Validate that a relative path is safe:
   * - Not absolute (Unix or Windows)
   * - Not a UNC / network path
   * - No path traversal
   * - Not an external URL
   *
   * Returns the violation reason, or null if the path is safe.
   */
  validateRelativePathOnly(relativePath: string): AssetRefViolationReason | null {
    if (!relativePath || relativePath.trim().length === 0) {
      return 'absolute_path';
    }

    if (isUnixAbsolute(relativePath)) {
      return 'absolute_path';
    }

    if (isWindowsAbsolute(relativePath)) {
      return 'absolute_path';
    }

    if (isUncPath(relativePath)) {
      return 'absolute_path';
    }

    if (isPathTraversal(relativePath)) {
      return 'outside_vault';
    }

    if (isExternalUrl(relativePath)) {
      return 'external_url';
    }

    return null;
  }

  /**
   * Validate that an asset reference carries source backing.
   * Returns a violation if no SourceRefs are attached.
   */
  validateAssetSourceBacking(
    assetRef: MultimodalAssetRef,
    slideIndex?: number,
    blockIndex?: number,
  ): AssetRefViolation[] {
    if (assetRef.sources.length === 0) {
      return [
        {
          assetRef,
          reason: 'no_source_backing',
          detail: `Asset reference "${assetRef.caption}" has no source backing.`,
        },
      ];
    }
    return [];
  }

  /**
   * Validate that a factual block carrying an asset reference also carries
   * evidence backing. Emits a warning (not an error) when evidence is missing.
   */
  validateEvidenceBackingForFactualBlock(
    block: SlideContentBlock,
    slideIndex?: number,
    blockIndex?: number,
  ): MultimodalAssetGuardWarning[] {
    if (!block.assetRef) return [];
    if (!FACTUAL_ASSET_BLOCK_TYPES.has(block.blockType)) return [];

    if (block.evidence.length === 0) {
      return [
        {
          code: WARNING_CODES.FACTUAL_BLOCK_NO_EVIDENCE,
          message: `Factual block "${block.blockType}" on slide ${slideIndex ?? '?'} block ${blockIndex ?? '?'} has an asset reference but no evidence backing.`,
          slideIndex,
          blockIndex,
          assetRelativePath: block.assetRef.relativePath,
        },
      ];
    }

    return [];
  }

  /**
   * Build the guard observability report.
   */
  buildGuardReport(
    request: MultimodalAssetGuardRequest,
    totalAssetRefs: number,
    violations: readonly AssetRefViolation[],
    warnings: readonly MultimodalAssetGuardWarning[],
  ): MultimodalAssetGuardReport {
    const violatedRefs = violations.length;
    const passedRefs = totalAssetRefs - violatedRefs;

    return {
      requestId: request.requestId,
      target: request.target,
      mode: request.mode,
      totalAssetRefs,
      passedRefs: Math.max(0, passedRefs),
      violatedRefs: Math.max(0, violatedRefs),
      violations,
      warnings: warnings.map((w) => w.message),
      previewSafe: violations.length === 0,
      noFileRead: true,
      noFileWrite: true,
      noImageProcessing: true,
      noOCR: true,
      providerCalled: false,
      embeddingCalled: false,
      externalFetchCalled: false,
      guardedAt: new Date().toISOString(),
    };
  }

  /**
   * Aggregate all violations found during guard execution into a flat list.
   */
  aggregateAssetViolations(
    ...violationLists: readonly AssetRefViolation[][]
  ): AssetRefViolation[] {
    return violationLists.flat();
  }

  /**
   * Collect all warnings from guard execution into a flat list.
   */
  collectAssetWarnings(
    ...warningLists: readonly MultimodalAssetGuardWarning[][]
  ): MultimodalAssetGuardWarning[] {
    return warningLists.flat();
  }

  // ── Private Helpers ──────────────────────────────────

  /** Validate the request itself before proceeding. */
  private validateRequest(
    request: MultimodalAssetGuardRequest,
  ): MultimodalAssetGuardError[] {
    const errors: MultimodalAssetGuardError[] = [];

    if (!request.requestId || request.requestId.trim().length === 0) {
      errors.push({
        code: ERROR_CODES.EMPTY_REQUEST_ID,
        message: 'requestId is required and must not be empty.',
      });
    }

    if (!request.confirmedContext) {
      errors.push({
        code: ERROR_CODES.CONTEXT_NOT_CONFIRMED,
        message: 'Context must be confirmed by the user before guard execution.',
      });
    }

    const hasData = this.targetHasData(request);
    if (!hasData) {
      errors.push({
        code: ERROR_CODES.NO_TARGET_DATA,
        message: `No data provided for guard target "${request.target}".`,
      });
    }

    return errors;
  }

  /** Check whether the request carries data matching its target. */
  private targetHasData(request: MultimodalAssetGuardRequest): boolean {
    switch (request.target) {
      case 'slide_deck':
        return request.deck !== undefined;
      case 'ppt_artifact':
        return (request.pptArtifact !== undefined && request.pptArtifact?.deck !== undefined) ||
          request.deck !== undefined;
      case 'preview_model':
        return request.previewModel !== undefined;
      case 'asset_list':
        return request.assetRefs !== undefined && request.assetRefs.length > 0;
      /* no default */
    }
    return false;
  }

  /** Validate unsupported asset type (warning only). */
  private validateAssetType(
    assetRef: MultimodalAssetRef,
    slideIndex?: number,
    blockIndex?: number,
  ): MultimodalAssetGuardWarning[] {
    if (!SUPPORTED_ASSET_TYPES.has(assetRef.assetType)) {
      return [
        {
          code: WARNING_CODES.UNSUPPORTED_ASSET_TYPE,
          message: `Unsupported asset type "${assetRef.assetType}" for "${assetRef.caption}".`,
          slideIndex,
          blockIndex,
          assetRelativePath: assetRef.relativePath,
        },
      ];
    }
    return [];
  }

  /** Build a human-readable detail for a path violation. */
  private violationDetail(
    reason: AssetRefViolationReason,
    path: string,
  ): string {
    switch (reason) {
      case 'absolute_path':
        return `Path "${path}" is absolute. Only Vault-relative paths are allowed.`;
      case 'external_url':
        return `Path "${path}" is an external URL. External URLs are not allowed.`;
      case 'outside_vault':
        return `Path "${path}" traverses outside the Vault via "..".`;
      default:
        return `Path "${path}" violated rule "${reason}".`;
    }
  }

  /**
   * Determine ok status based on mode.
   * - validate_only: always report, always ok=true (guard is advisory)
   * - preview_safe: ok=false if any violations exist
   */
  private determineOk(mode: AssetGuardMode, violations: readonly AssetRefViolation[]): boolean {
    if (mode === 'validate_only') return true;
    return violations.length === 0;
  }

  /** Build an empty report when the request itself is invalid. */
  private emptyReport(
    request: MultimodalAssetGuardRequest,
    warningMessages: readonly string[],
  ): MultimodalAssetGuardReport {
    return {
      requestId: request.requestId,
      target: request.target,
      mode: request.mode,
      totalAssetRefs: 0,
      passedRefs: 0,
      violatedRefs: 0,
      violations: [],
      warnings: [...warningMessages],
      previewSafe: false,
      noFileRead: true,
      noFileWrite: true,
      noImageProcessing: true,
      noOCR: true,
      providerCalled: false,
      embeddingCalled: false,
      externalFetchCalled: false,
      guardedAt: new Date().toISOString(),
    };
  }
}
