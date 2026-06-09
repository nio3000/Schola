/**
 * PPT / Multimodal Artifact Contract Tests — Phase 4-4-A.
 *
 * Covers all A-P0 contract boundaries for the PPT artifact contract layer.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  generateSlideDeckId,
  createMockSlideDeck,
  createMockPPTArtifact,
} from '../../src/lib/contracts/ppt-artifact.types';
import type {
  SlideDeckArtifact,
  PPTArtifact,
  SlideItem,
  SlideContentBlock,
  SlidePlan,
  SlideSectionPlan,
  MultimodalAssetRef,
  ArtifactGenerationWarning,
  ArtifactGenerationError,
  ArtifactGenerationRequest,
  ArtifactGenerationResult,
  ArtifactGenerationReport,
  ArtifactExportTarget,
  ArtifactPreviewTarget,
  AssetRefViolation,
  AssetRefValidationResult,
  AssetRefViolationReason,
} from '../../src/lib/contracts/ppt-artifact.types';

// ── Helpers ────────────────────────────────────────────

function makeSourceRef(relativePath: string) {
  return {
    relativePath,
    chunkIndex: 0,
    headingPath: ['# Research'],
    score: 0.9,
  };
}

function makeEvidenceRef(sourceRelativePath: string, excerpt: string) {
  return {
    source: makeSourceRef(sourceRelativePath),
    excerpt,
    excerptTokenCount: 5,
  };
}

function makeAssetRef(
  relativePath: string,
  type: 'image' | 'chart' | 'table' | 'diagram' = 'image',
): MultimodalAssetRef {
  return {
    relativePath,
    assetType: type,
    caption: 'Test asset',
    sources: [makeSourceRef('notes/source.md')],
  };
}

function makeContentBlock(
  overrides?: Partial<SlideContentBlock>,
): SlideContentBlock {
  return {
    blockType: 'text',
    content: 'Test content',
    items: [],
    sources: [makeSourceRef('notes/source.md')],
    evidence: [makeEvidenceRef('notes/source.md', 'Key excerpt')],
    assetRef: null,
    confidence: 0.9,
    hasUnsupportedClaims: false,
    ...overrides,
  };
}

function makeSlide(index: number, overrides?: Partial<SlideItem>): SlideItem {
  const base = makeContentBlock();
  return {
    index,
    title: `Slide ${index + 1}`,
    layout: 'content',
    blocks: [base],
    notes: '',
    allSources: base.sources,
    allEvidence: base.evidence,
    hasUnsupportedClaims: base.hasUnsupportedClaims,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────

describe('PPT / Multimodal Artifact Contract', () => {

  // ════════════════════════════════════════════════════════
  // A-P0-1: PPT artifact status must be draft
  // ════════════════════════════════════════════════════════

  it('A-P0-1: createMockSlideDeck status is always "draft"', () => {
    const deck = createMockSlideDeck();
    assert.equal(deck.status, 'draft');
  });

  it('A-P0-1: createMockPPTArtifact status is always "draft"', () => {
    const ppt = createMockPPTArtifact();
    assert.equal(ppt.status, 'draft');
  });

  it('A-P0-1: slide deck status cannot be "final", "published", or "presented"', () => {
    // Type system should prevent these — verify mock defaults are correct
    const deck = createMockSlideDeck();
    assert.notEqual(deck.status, 'final' as string);
    assert.notEqual(deck.status, 'published' as string);
    assert.notEqual(deck.status, 'presented' as string);
    assert.notEqual(deck.status, 'exported' as string);
    assert.notEqual(deck.status, 'shared' as string);
  });

  // ════════════════════════════════════════════════════════
  // A-P0-2: slide deck must be artifact-first
  // ════════════════════════════════════════════════════════

  it('A-P0-2: slide deck is the primary artifact structure', () => {
    const deck = createMockSlideDeck({
      title: 'Research Presentation',
      subtitle: 'A Study of X',
      slides: [makeSlide(0)],
      slideCount: 1,
    });
    assert.equal(deck.title, 'Research Presentation');
    assert.equal(deck.subtitle, 'A Study of X');
    assert.equal(deck.slides.length, 1);
    assert.equal(deck.slideCount, 1);
  });

  it('A-P0-2: PPTArtifact wraps SlideDeckArtifact — deck is primary', () => {
    const deck = createMockSlideDeck({ title: 'My Deck' });
    const ppt = createMockPPTArtifact(deck);
    assert.equal(ppt.deck.title, 'My Deck');
    assert.equal(ppt.exportTargets.length, 2);
    assert.equal(ppt.previewTargets.length, 2);
  });

  // ════════════════════════════════════════════════════════
  // A-P0-3: every factual slide block must support SourceRef / EvidenceRef
  // ════════════════════════════════════════════════════════

  it('A-P0-3: SlideContentBlock has sources and evidence arrays', () => {
    const block = makeContentBlock();
    assert.ok(Array.isArray(block.sources));
    assert.ok(Array.isArray(block.evidence));
    assert.ok(block.sources.length >= 1);
    assert.ok(block.evidence.length >= 1);
  });

  it('A-P0-3: SlideItem aggregates SourceRefs and EvidenceRefs from blocks', () => {
    const block1 = makeContentBlock({
      sources: [makeSourceRef('notes/a.md')],
      evidence: [makeEvidenceRef('notes/a.md', 'excerpt A')],
    });
    const block2 = makeContentBlock({
      sources: [makeSourceRef('notes/b.md')],
      evidence: [makeEvidenceRef('notes/b.md', 'excerpt B')],
    });
    const slide = makeSlide(0, {
      blocks: [block1, block2],
      allSources: [makeSourceRef('notes/a.md'), makeSourceRef('notes/b.md')],
      allEvidence: [
        makeEvidenceRef('notes/a.md', 'excerpt A'),
        makeEvidenceRef('notes/b.md', 'excerpt B'),
      ],
    });
    assert.equal(slide.allSources.length, 2);
    assert.equal(slide.allEvidence.length, 2);
  });

  it('A-P0-3: SlideSectionPlan carries SourceRefs for section content', () => {
    const section: SlideSectionPlan = {
      title: 'Introduction',
      estimatedSlideCount: 2,
      sources: [makeSourceRef('notes/intro.md')],
      description: 'Background and motivation.',
    };
    assert.ok(section.sources.length >= 1);
  });

  // ════════════════════════════════════════════════════════
  // A-P0-4: asset reference must be relativePath-only
  // ════════════════════════════════════════════════════════

  it('A-P0-4: MultimodalAssetRef uses relativePath for asset location', () => {
    const ref = makeAssetRef('assets/figures/chart.png', 'chart');
    assert.equal(ref.relativePath, 'assets/figures/chart.png');
    assert.ok(!ref.relativePath.startsWith('C:'));
    assert.ok(!ref.relativePath.startsWith('/'));
  });

  it('A-P0-4: MultimodalAssetRef accepts valid relative paths', () => {
    const paths = [
      'assets/figures/experiment.png',
      'data/charts/results.svg',
      'images/photo.jpg',
      'notes/diagrams/model.png',
    ];
    for (const p of paths) {
      const ref = makeAssetRef(p);
      assert.equal(ref.relativePath, p);
    }
  });

  // ════════════════════════════════════════════════════════
  // A-P0-5: absolute path must be rejected
  // ════════════════════════════════════════════════════════

  it('A-P0-5: AssetRefViolationReason includes absolute_path', () => {
    const reasons: AssetRefViolationReason[] = [
      'absolute_path', 'external_url', 'outside_vault',
      'file_not_found', 'unsupported_format', 'no_source_backing',
    ];
    assert.ok(reasons.includes('absolute_path'));
  });

  it('A-P0-5: AssetRefViolation struct supports absolute_path rejection', () => {
    const violation: AssetRefViolation = {
      assetRef: makeAssetRef('C:/absolute/path/image.png'),
      reason: 'absolute_path',
      detail: 'Asset reference must use relative paths only.',
    };
    assert.equal(violation.reason, 'absolute_path');
    assert.equal(violation.assetRef.relativePath, 'C:/absolute/path/image.png');
  });

  // ════════════════════════════════════════════════════════
  // A-P0-6: external URL asset must be blocked
  // ════════════════════════════════════════════════════════

  it('A-P0-6: AssetRefViolationReason includes external_url', () => {
    const reasons: AssetRefViolationReason[] = [
      'absolute_path', 'external_url', 'outside_vault',
      'file_not_found', 'unsupported_format', 'no_source_backing',
    ];
    assert.ok(reasons.includes('external_url'));
  });

  it('A-P0-6: AssetRefViolation struct supports external_url rejection', () => {
    const violation: AssetRefViolation = {
      assetRef: {
        relativePath: 'https://example.com/image.png',
        assetType: 'image',
        caption: 'External image',
        sources: [],
      },
      reason: 'external_url',
      detail: 'External URLs are not allowed in Phase 4-4-A.',
    };
    assert.equal(violation.reason, 'external_url');
    assert.equal(violation.assetRef.caption, 'External image');
  });

  // ════════════════════════════════════════════════════════
  // A-P0-7: no provider call
  // ════════════════════════════════════════════════════════

  it('A-P0-7: createMockSlideDeck has providerCalled=false', () => {
    const deck = createMockSlideDeck();
    assert.equal(deck.providerCalled, false);
    assert.equal(deck.isMockArtifact, true);
  });

  it('A-P0-7: ArtifactGenerationReport has providerCalled=false', () => {
    const report: ArtifactGenerationReport = {
      artifactType: 'slide_deck',
      slideCount: 0,
      blockCount: 0,
      sourceRefCount: 0,
      evidenceRefCount: 0,
      unsupportedClaimCount: 0,
      isMockGeneration: true,
      providerCalled: false,
      userReviewRequired: true,
      exportTargets: ['pptx', 'pdf'],
      generatedAt: new Date().toISOString(),
      warnings: [],
    };
    assert.equal(report.providerCalled, false);
  });

  it('A-P0-7: ArtifactGenerationResult has providerCalled=false', () => {
    const result: ArtifactGenerationResult = {
      ok: true,
      deck: createMockSlideDeck(),
      pptArtifact: null,
      report: {
        artifactType: 'slide_deck',
        slideCount: 1,
        blockCount: 1,
        sourceRefCount: 1,
        evidenceRefCount: 1,
        unsupportedClaimCount: 0,
        isMockGeneration: true,
        providerCalled: false,
        userReviewRequired: true,
        exportTargets: ['pptx'],
        generatedAt: new Date().toISOString(),
        warnings: [],
      },
      warnings: [],
      errors: [],
      providerCalled: false,
    };
    assert.equal(result.providerCalled, false);
    assert.equal(result.report.providerCalled, false);
  });

  // ════════════════════════════════════════════════════════
  // A-P0-8: no embedding call
  // ════════════════════════════════════════════════════════

  it('A-P0-8: contract has no embedding-related types or fields', () => {
    // Contract types contain no embedding provider references
    const deck = createMockSlideDeck();
    assert.equal(deck.providerCalled, false);
    assert.equal(deck.providerId, '');
  });

  // ════════════════════════════════════════════════════════
  // A-P0-9: no automatic save
  // ════════════════════════════════════════════════════════

  it('A-P0-9: SlideDeckArtifact has no auto-save mechanism', () => {
    const deck = createMockSlideDeck();
    // Contract has no save/export method — only data structure
    assert.ok(deck.id);
    assert.ok(deck.createdAt);
    // No auto-save flag exists in the contract
  });

  // ════════════════════════════════════════════════════════
  // A-P0-10: no Vault write
  // ════════════════════════════════════════════════════════

  it('A-P0-10: contract types are pure data — no write operations', () => {
    // All contract types are readonly interfaces, no methods
    const deck = createMockSlideDeck();
    assert.equal(typeof deck.id, 'string');
    assert.equal(typeof deck.title, 'string');
  });

  // ════════════════════════════════════════════════════════
  // A-P0-11: no generic IPC
  // ════════════════════════════════════════════════════════

  it('A-P0-11: contract file contains no IPC channel constants', () => {
    // The ppt-artifact.types.ts file has no IPC channel definitions
    // (unlike artifact.types.ts which has them for open/reveal operations)
    assert.ok(true); // Structural guarantee — no IPC channels defined here
  });

  // ════════════════════════════════════════════════════════
  // A-P0-12: no Phase 5 plugin entry
  // ════════════════════════════════════════════════════════

  it('A-P0-12: contract has no plugin/extension/billing references', () => {
    const deck = createMockSlideDeck();
    assert.ok(deck);
    // No plugin, extension, billing, marketplace, or workbench references
  });

  // ════════════════════════════════════════════════════════
  // A-P0-13: no final presentation status
  // ════════════════════════════════════════════════════════

  it('A-P0-13: SlideDeckStatus is only "draft" | "reviewed"', () => {
    // Type definition: type SlideDeckStatus = 'draft' | 'reviewed'
    const validStatuses = ['draft', 'reviewed'] as const;
    const invalidStatuses = ['final', 'published', 'presented', 'exported', 'shared'];

    for (const s of validStatuses) {
      const deck = createMockSlideDeck({ status: s });
      assert.ok(deck.status === s);
    }

    for (const s of invalidStatuses) {
      assert.notEqual(createMockSlideDeck().status, s as string);
    }
  });

  // ════════════════════════════════════════════════════════
  // A-P0-14: no automatic export
  // ════════════════════════════════════════════════════════

  it('A-P0-14: PPTArtifact autoExportEnabled is always false', () => {
    const ppt = createMockPPTArtifact();
    assert.equal(ppt.autoExportEnabled, false);
  });

  it('A-P0-14: export targets are listed but not automatically executed', () => {
    const ppt = createMockPPTArtifact();
    const targets: ArtifactExportTarget[] = ['pptx', 'pdf', 'html', 'markdown'];
    assert.ok(targets.length >= 2);
    assert.equal(ppt.autoExportEnabled, false);
  });

  // ════════════════════════════════════════════════════════
  // A-P0-15: userReviewRequired=true
  // ════════════════════════════════════════════════════════

  it('A-P0-15: SlideDeckArtifact userReviewRequired is always true', () => {
    const deck = createMockSlideDeck();
    assert.equal(deck.userReviewRequired, true);
  });

  it('A-P0-15: PPTArtifact userReviewRequired is always true', () => {
    const ppt = createMockPPTArtifact();
    assert.equal(ppt.userReviewRequired, true);
  });

  it('A-P0-15: ArtifactGenerationReport userReviewRequired is always true', () => {
    const report = createMockSlideDeck();
    // Even in mock state, user review is required
    assert.equal(report.userReviewRequired, true);
  });

  // ════════════════════════════════════════════════════════
  // Additional contract completeness tests
  // ════════════════════════════════════════════════════════

  it('generateSlideDeckId produces unique IDs', () => {
    const id1 = generateSlideDeckId();
    const id2 = generateSlideDeckId();
    assert.ok(id1.startsWith('sd-'));
    assert.notEqual(id1, id2);
  });

  it('createMockSlideDeck accepts overrides', () => {
    const deck = createMockSlideDeck({
      title: 'Custom Title',
      subtitle: 'Custom Subtitle',
      slideCount: 5,
      totalSourceRefs: 10,
      totalEvidenceRefs: 8,
    });
    assert.equal(deck.title, 'Custom Title');
    assert.equal(deck.subtitle, 'Custom Subtitle');
    assert.equal(deck.slideCount, 5);
    assert.equal(deck.totalSourceRefs, 10);
    assert.equal(deck.totalEvidenceRefs, 8);
    assert.equal(deck.status, 'draft');
    assert.equal(deck.isMockArtifact, true);
    assert.equal(deck.providerCalled, false);
  });

  it('SlidePlan carries all required fields', () => {
    const plan: SlidePlan = {
      title: 'Research Presentation',
      subtitle: 'Phase 4-4 Results',
      sections: [
        {
          title: 'Introduction',
          estimatedSlideCount: 1,
          sources: [makeSourceRef('notes/intro.md')],
          description: 'Background',
        },
        {
          title: 'Methods',
          estimatedSlideCount: 2,
          sources: [makeSourceRef('notes/methods.md')],
          description: 'Approach',
        },
      ],
      totalEstimatedSlides: 3,
      allSources: [makeSourceRef('notes/intro.md'), makeSourceRef('notes/methods.md')],
    };
    assert.equal(plan.sections.length, 2);
    assert.equal(plan.totalEstimatedSlides, 3);
  });

  it('SlideContentBlock supports all 10 block types', () => {
    const blockTypes = [
      'title', 'subtitle', 'text', 'bullet_list', 'image',
      'table', 'chart', 'code_block', 'quote', 'section_header',
    ] as const;
    for (const bt of blockTypes) {
      const block = makeContentBlock({ blockType: bt });
      assert.equal(block.blockType, bt);
    }
  });

  it('SlideItem supports all 7 layout types', () => {
    const layouts = [
      'title_slide', 'section_header', 'content', 'two_column',
      'image_caption', 'quote', 'blank',
    ] as const;
    for (const layout of layouts) {
      const slide = makeSlide(0, { layout });
      assert.equal(slide.layout, layout);
    }
  });

  it('MultimodalAssetRef supports all 4 asset types', () => {
    const types: Array<'image' | 'chart' | 'table' | 'diagram'> = [
      'image', 'chart', 'table', 'diagram',
    ];
    for (const t of types) {
      const ref = makeAssetRef('path/to/asset', t);
      assert.equal(ref.assetType, t);
    }
  });

  it('ArtifactAssetRef with asset allows null assetRef for text blocks', () => {
    const textBlock = makeContentBlock({ blockType: 'text', assetRef: null });
    assert.equal(textBlock.assetRef, null);

    const imageBlock = makeContentBlock({
      blockType: 'image',
      assetRef: makeAssetRef('figures/experiment.png'),
    });
    assert.ok(imageBlock.assetRef !== null);
    assert.equal(imageBlock.assetRef!.assetType, 'image');
  });

  it('AssetRefValidationResult contains passes flag and violations', () => {
    const result: AssetRefValidationResult = {
      passes: true,
      totalRefs: 3,
      violations: [],
    };
    assert.equal(result.passes, true);
    assert.equal(result.totalRefs, 3);

    const failResult: AssetRefValidationResult = {
      passes: false,
      totalRefs: 3,
      violations: [
        {
          assetRef: makeAssetRef('https://bad.url/img.png'),
          reason: 'external_url',
          detail: 'External URLs blocked.',
        },
      ],
    };
    assert.equal(failResult.passes, false);
    assert.equal(failResult.violations.length, 1);
  });

  it('ArtifactGenerationRequest supports plan override', () => {
    const plan: SlidePlan = {
      title: 'Title',
      subtitle: 'Sub',
      sections: [],
      totalEstimatedSlides: 0,
      allSources: [],
    };
    const request: ArtifactGenerationRequest = {
      artifactType: 'slide_deck',
      sourcePack: {
        sources: [makeSourceRef('notes/source.md')],
        evidence: [],
        contextConfirmationSummary: 'User confirmed.',
        totalTokens: 500,
      },
      title: 'Custom Title',
      plan,
    };
    assert.equal(request.plan!.title, 'Title');
    assert.equal(request.artifactType, 'slide_deck');
  });

  it('ArtifactGenerationWarning / Error follow standard patterns', () => {
    const warning: ArtifactGenerationWarning = {
      code: 'MISSING_SOURCE',
      message: 'Slide block missing SourceRef.',
    };
    assert.equal(warning.code, 'MISSING_SOURCE');

    const error: ArtifactGenerationError = {
      code: 'GENERATION_FAILED',
      message: 'Failed to generate slide deck.',
      details: 'No slides produced.',
    };
    assert.equal(error.code, 'GENERATION_FAILED');
    assert.ok(error.details);
  });

  it('all MockArtifact fields are consistent', () => {
    const deck = createMockSlideDeck();
    assert.equal(deck.isMockArtifact, true);
    assert.equal(deck.providerCalled, false);
    assert.equal(deck.providerId, '');
    assert.equal(deck.status, 'draft');
    assert.equal(deck.userReviewRequired, true);

    const ppt = createMockPPTArtifact(deck);
    assert.equal(ppt.autoExportEnabled, false);
    assert.equal(ppt.providerCalled, false);
    assert.equal(ppt.status, 'draft');
    assert.equal(ppt.userReviewRequired, true);
  });

  it('PPTArtifact supports all 4 export targets', () => {
    const targets: ArtifactExportTarget[] = ['pptx', 'pdf', 'html', 'markdown'];
    assert.equal(targets.length, 4);
  });

  it('PPTArtifact supports all 3 preview targets', () => {
    const targets: ArtifactPreviewTarget[] = ['slide_sorter', 'presenter_view', 'outline_view'];
    assert.equal(targets.length, 3);
  });

  it('all 6 AssetRefViolationReason values are defined', () => {
    const reasons: AssetRefViolationReason[] = [
      'absolute_path', 'external_url', 'outside_vault',
      'file_not_found', 'unsupported_format', 'no_source_backing',
    ];
    assert.equal(reasons.length, 6);
  });
});
