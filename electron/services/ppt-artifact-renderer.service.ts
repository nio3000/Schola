/**
 * PPTArtifactRendererService — Phase 4-4-C.
 *
 * Converts existing draft slide artifacts into deterministic internal preview
 * models. This service is pure and read-only: it performs no file generation,
 * export, provider call, network access, IPC, or Vault write.
 */
import type {
  MultimodalAssetRef,
  PPTArtifact,
  PPTArtifactRenderError,
  PPTArtifactRenderReport,
  PPTArtifactRenderRequest,
  PPTArtifactRenderResult,
  PPTArtifactRenderWarning,
  SlideContentBlock,
  SlideDeckArtifact,
  SlideItem,
  SlidePreviewAssetRef,
  SlidePreviewBlock,
  SlidePreviewItem,
  SlidePreviewModel,
} from '../../src/lib/contracts/ppt-artifact.types';

const ERROR_CODES = {
  EMPTY_REQUEST_ID: 'empty_request_id',
  CONTEXT_NOT_CONFIRMED: 'context_not_confirmed',
  NON_DRAFT_ARTIFACT: 'non_draft_artifact',
  PROVIDER_CALLED: 'provider_called_artifact',
  AUTO_EXPORT_ENABLED: 'auto_export_enabled',
  ABSOLUTE_ASSET_PATH: 'absolute_asset_path',
  EXTERNAL_ASSET_URL: 'external_asset_url',
  ASSET_WITHOUT_SOURCE: 'asset_without_source',
} as const;

const WARNING_CODES = {
  EMPTY_DECK: 'empty_deck',
  UNSUPPORTED_CLAIMS: 'unsupported_claims',
} as const;

function isPPTArtifact(artifact: SlideDeckArtifact | PPTArtifact): artifact is PPTArtifact {
  return 'deck' in artifact;
}

function getDeck(artifact: SlideDeckArtifact | PPTArtifact): SlideDeckArtifact {
  return isPPTArtifact(artifact) ? artifact.deck : artifact;
}

function isAbsolutePath(relativePath: string): boolean {
  return (
    relativePath.startsWith('/') ||
    relativePath.startsWith('\\') ||
    /^[A-Za-z]:[\\/]/.test(relativePath)
  );
}

function isExternalUrl(relativePath: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(relativePath);
}

function countBlocks(slides: readonly SlidePreviewItem[]): number {
  return slides.reduce((total, slide) => total + slide.blocks.length, 0);
}

function countAssets(slides: readonly SlidePreviewItem[]): number {
  return slides.reduce(
    (total, slide) => total + slide.blocks.filter((block) => block.assetRef !== null).length,
    0,
  );
}

// ── PPTArtifactRendererService ──────────────────────────

export class PPTArtifactRendererService {
  /** Render a draft artifact into an internal preview model. */
  renderSlideDeckArtifact(request: PPTArtifactRenderRequest): PPTArtifactRenderResult {
    const errors = [
      ...this.validateRenderableDeck(request),
      ...this.validateRenderableAssets(request),
    ];

    if (errors.length > 0) {
      return this.failureResult(request, errors);
    }

    const deck = getDeck(request.artifact);
    const preview = this.buildSlidePreviewModel(request, deck);
    const warnings = this.collectRendererWarnings(deck);
    const report = this.buildRendererReport(request, preview, warnings);

    return {
      ok: true,
      preview,
      report,
      warnings,
      errors: [],
      providerCalled: false,
      userReviewRequired: true,
    };
  }

  /** Validate artifact-level renderability. */
  validateRenderableDeck(request: PPTArtifactRenderRequest): PPTArtifactRenderError[] {
    const errors: PPTArtifactRenderError[] = [];
    const deck = getDeck(request.artifact);

    if (!request.requestId || request.requestId.trim().length === 0) {
      errors.push({
        code: ERROR_CODES.EMPTY_REQUEST_ID,
        message: 'requestId is required and must not be empty.',
      });
    }

    if (!request.confirmedContext) {
      errors.push({
        code: ERROR_CODES.CONTEXT_NOT_CONFIRMED,
        message: 'Context must be confirmed by the user before rendering.',
      });
    }

    if (deck.status !== 'draft') {
      errors.push({
        code: ERROR_CODES.NON_DRAFT_ARTIFACT,
        message: 'Only draft slide deck artifacts can be rendered as previews.',
        details: `Received deck status: ${deck.status}.`,
      });
    }

    if (isPPTArtifact(request.artifact) && request.artifact.status !== 'draft') {
      errors.push({
        code: ERROR_CODES.NON_DRAFT_ARTIFACT,
        message: 'Only draft PPT artifacts can be rendered as previews.',
        details: `Received PPT artifact status: ${request.artifact.status}.`,
      });
    }

    if (deck.providerCalled || (isPPTArtifact(request.artifact) && request.artifact.providerCalled)) {
      errors.push({
        code: ERROR_CODES.PROVIDER_CALLED,
        message: 'Renderer only accepts artifacts that did not call a provider.',
      });
    }

    if (isPPTArtifact(request.artifact) && request.artifact.autoExportEnabled) {
      errors.push({
        code: ERROR_CODES.AUTO_EXPORT_ENABLED,
        message: 'Renderer rejects artifacts with automatic export enabled.',
      });
    }

    return errors;
  }

  /** Validate every asset reference before building preview output. */
  validateRenderableAssets(request: PPTArtifactRenderRequest): PPTArtifactRenderError[] {
    const errors: PPTArtifactRenderError[] = [];
    const deck = getDeck(request.artifact);

    for (const slide of deck.slides) {
      slide.blocks.forEach((block, blockIndex) => {
        if (!block.assetRef) {
          return;
        }

        const asset = block.assetRef;
        if (isAbsolutePath(asset.relativePath)) {
          errors.push({
            code: ERROR_CODES.ABSOLUTE_ASSET_PATH,
            message: 'Asset references must use relative paths only.',
            slideIndex: slide.index,
            blockIndex,
            assetRelativePath: asset.relativePath,
          });
        }

        if (isExternalUrl(asset.relativePath)) {
          errors.push({
            code: ERROR_CODES.EXTERNAL_ASSET_URL,
            message: 'External asset URLs cannot be rendered in preview output.',
            slideIndex: slide.index,
            blockIndex,
            assetRelativePath: asset.relativePath,
          });
        }

        if (asset.sources.length === 0) {
          errors.push({
            code: ERROR_CODES.ASSET_WITHOUT_SOURCE,
            message: 'Asset references must preserve source backing.',
            slideIndex: slide.index,
            blockIndex,
            assetRelativePath: asset.relativePath,
          });
        }
      });
    }

    return errors;
  }

  /** Build the top-level serializable preview model. */
  buildSlidePreviewModel(
    request: PPTArtifactRenderRequest,
    deck: SlideDeckArtifact,
  ): SlidePreviewModel {
    const slides = deck.slides.map((slide) => this.renderSlidePreview(slide));

    return {
      requestId: request.requestId,
      deckId: deck.id,
      title: deck.title,
      subtitle: deck.subtitle,
      status: 'draft',
      renderTarget: request.renderTarget,
      slides,
      slideCount: slides.length,
      totalSourceRefs: slides.reduce((total, slide) => total + slide.allSources.length, 0),
      totalEvidenceRefs: slides.reduce((total, slide) => total + slide.allEvidence.length, 0),
      totalAssetRefs: countAssets(slides),
      previewOnly: true,
      draftOnly: true,
      providerCalled: false,
      userReviewRequired: true,
    };
  }

  /** Render a source slide into a preview slide item. */
  renderSlidePreview(slide: SlideItem): SlidePreviewItem {
    return {
      id: `slide-preview-${slide.index}`,
      index: slide.index,
      title: slide.title,
      layout: slide.layout,
      blocks: slide.blocks.map((block, blockIndex) =>
        this.renderSlideContentBlock(block, slide.index, blockIndex),
      ),
      notes: slide.notes,
      allSources: slide.allSources,
      allEvidence: slide.allEvidence,
      hasUnsupportedClaims: slide.hasUnsupportedClaims,
    };
  }

  /** Render a source content block into a preview block. */
  renderSlideContentBlock(
    block: SlideContentBlock,
    slideIndex: number,
    blockIndex: number,
  ): SlidePreviewBlock {
    return {
      id: `slide-preview-${slideIndex}-block-${blockIndex}`,
      blockType: block.blockType,
      content: block.content,
      items: block.items,
      sources: block.sources,
      evidence: block.evidence,
      assetRef: block.assetRef ? this.renderAssetRef(block.assetRef) : null,
      confidence: block.confidence,
      hasUnsupportedClaims: block.hasUnsupportedClaims,
    };
  }

  /** Build the render report after a successful preview render. */
  buildRendererReport(
    request: PPTArtifactRenderRequest,
    preview: SlidePreviewModel,
    warnings: readonly PPTArtifactRenderWarning[],
  ): PPTArtifactRenderReport {
    return {
      requestId: request.requestId,
      deckId: preview.deckId,
      renderTarget: request.renderTarget,
      totalSlides: preview.slideCount,
      totalBlocks: countBlocks(preview.slides),
      totalSourceRefs: preview.totalSourceRefs,
      totalEvidenceRefs: preview.totalEvidenceRefs,
      totalAssetRefs: preview.totalAssetRefs,
      previewOnly: true,
      draftOnly: true,
      providerCalled: false,
      userReviewRequired: true,
      renderedAt: new Date().toISOString(),
      warnings: warnings.map((warning) => warning.message),
    };
  }

  /** Collect non-blocking render warnings. */
  collectRendererWarnings(deck: SlideDeckArtifact): PPTArtifactRenderWarning[] {
    const warnings: PPTArtifactRenderWarning[] = [];

    if (deck.slides.length === 0) {
      warnings.push({
        code: WARNING_CODES.EMPTY_DECK,
        message: 'Deck contains no slides to preview.',
      });
    }

    for (const slide of deck.slides) {
      if (slide.hasUnsupportedClaims) {
        warnings.push({
          code: WARNING_CODES.UNSUPPORTED_CLAIMS,
          message: `Slide ${slide.index} contains unsupported claims and requires review.`,
          slideIndex: slide.index,
        });
      }
    }

    return warnings;
  }

  private renderAssetRef(assetRef: MultimodalAssetRef): SlidePreviewAssetRef {
    return {
      relativePath: assetRef.relativePath,
      assetType: assetRef.assetType,
      caption: assetRef.caption,
      sources: assetRef.sources,
    };
  }

  private failureResult(
    request: PPTArtifactRenderRequest,
    errors: readonly PPTArtifactRenderError[],
  ): PPTArtifactRenderResult {
    const deck = getDeck(request.artifact);
    const report: PPTArtifactRenderReport = {
      requestId: request.requestId,
      deckId: deck.id,
      renderTarget: request.renderTarget,
      totalSlides: 0,
      totalBlocks: 0,
      totalSourceRefs: 0,
      totalEvidenceRefs: 0,
      totalAssetRefs: 0,
      previewOnly: true,
      draftOnly: true,
      providerCalled: false,
      userReviewRequired: true,
      renderedAt: new Date().toISOString(),
      warnings: [],
    };

    return {
      ok: false,
      preview: null,
      report,
      warnings: [],
      errors,
      providerCalled: false,
      userReviewRequired: true,
    };
  }
}
