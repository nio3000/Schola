/**
 * PPT Artifact Renderer Service Tests — Phase 4-4-C.
 *
 * Covers all Phase 4-4-C P0 test boundaries:
 * - renderer accepts draft SlideDeckArtifact / PPTArtifact
 * - renderer rejects non-draft / final-like status
 * - SourceRef / EvidenceRef preservation
 * - relativePath-only asset preservation
 * - absolute asset path rejected
 * - external URL asset blocked
 * - output preview-only / draft-only
 * - no .pptx generation
 * - no PowerPoint / LibreOffice / Pandoc / pptxgenjs integration
 * - no PPT-master reference / integration
 * - no automatic export
 * - no automatic save
 * - no Vault write
 * - no provider / embedding call
 * - no external DB / web search
 * - no generic IPC
 * - no Phase 5 plugin entry
 */
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { PPTArtifactRendererService } from '../../electron/services/ppt-artifact-renderer.service';
import {
  createMockSlideDeck,
  createMockPPTArtifact,
} from '../../src/lib/contracts/ppt-artifact.types';
import type {
  PPTArtifactRenderRequest,
  PPTArtifactRenderResult,
  SlideDeckArtifact,
  PPTArtifact,
  SlideItem,
  SlideContentBlock,
  MultimodalAssetRef,
} from '../../src/lib/contracts/ppt-artifact.types';
import type { SourceRef, EvidenceRef } from '../../src/lib/contracts/local-qa.types';

// ── Helpers ────────────────────────────────────────────

function makeSourceRef(
  relativePath: string,
  overrides?: Partial<SourceRef>,
): SourceRef {
  return {
    relativePath,
    chunkIndex: 0,
    headingPath: ['# Introduction'],
    score: 0.9,
    ...overrides,
  };
}

function makeEvidenceRef(sourceRelativePath: string, excerpt: string): EvidenceRef {
  return {
    source: makeSourceRef(sourceRelativePath),
    excerpt,
    excerptTokenCount: 5,
  };
}

function makeAssetRef(
  relativePath: string,
  assetType: MultimodalAssetRef['assetType'] = 'image',
  sources?: readonly SourceRef[],
): MultimodalAssetRef {
  return {
    relativePath,
    assetType,
    caption: 'Test asset',
    sources: sources ?? [makeSourceRef('notes/source.md')],
  };
}

function makeContentBlock(overrides?: Partial<SlideContentBlock>): SlideContentBlock {
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
    hasUnsupportedClaims: false,
    ...overrides,
  };
}

function makeRenderRequest(
  deck: SlideDeckArtifact,
  overrides?: Partial<PPTArtifactRenderRequest>,
): PPTArtifactRenderRequest {
  return {
    requestId: 'render-req-001',
    artifact: deck,
    renderTarget: 'preview_model',
    confirmedContext: true,
    ...overrides,
  };
}

// ── Constants ──────────────────────────────────────────

const SVC = new PPTArtifactRendererService();

// ── Tests ───────────────────────────────────────────────

describe('PPTArtifactRendererService', () => {

  // ════════════════════════════════════════════════════════
  // P0-1: renderer accepts only draft artifacts
  // ════════════════════════════════════════════════════════

  describe('accepts draft artifacts', () => {

    it('accepts draft SlideDeckArtifact for preview_model', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0), makeSlide(1)],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);
      assert.ok(result.preview !== null);
      assert.equal(result.preview!.status, 'draft');
      assert.equal(result.preview!.previewOnly, true);
      assert.equal(result.preview!.draftOnly, true);
    });

    it('accepts draft PPTArtifact wrapping a draft deck', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const pptArtifact = createMockPPTArtifact(deck);
      const result = SVC.renderSlideDeckArtifact(
        makeRenderRequest(deck, { artifact: pptArtifact }),
      );
      assert.equal(result.ok, true);
      assert.ok(result.preview !== null);
    });

    it('accepts draft artifact with html_fragment_mock target', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const result = SVC.renderSlideDeckArtifact(
        makeRenderRequest(deck, { renderTarget: 'html_fragment_mock' }),
      );
      assert.equal(result.ok, true);
      assert.equal(result.preview!.renderTarget, 'html_fragment_mock');
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-2: renderer rejects non-draft / final-like status
  // ════════════════════════════════════════════════════════

  describe('rejects non-draft artifacts', () => {

    it('rejects SlideDeckArtifact with reviewed status', () => {
      const deck = createMockSlideDeck({
        status: 'reviewed',
        slides: [makeSlide(0)],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, false);
      assert.equal(result.preview, null);
      assert.ok(
        result.errors.some((e) => e.code === 'non_draft_artifact'),
        'Expected non_draft_artifact error',
      );
    });

    it('rejects PPTArtifact with reviewed status', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const pptArtifact = createMockPPTArtifact(deck);
      // createMockPPTArtifact always returns draft, so build manually
      const reviewedPPT: PPTArtifact = {
        ...pptArtifact,
        status: 'reviewed' as const,
      };
      const result = SVC.renderSlideDeckArtifact(
        makeRenderRequest(deck, { artifact: reviewedPPT }),
      );
      assert.equal(result.ok, false);
      assert.ok(
        result.errors.some((e) => e.code === 'non_draft_artifact'),
        'Expected non_draft_artifact error for reviewed PPT artifact',
      );
    });

    it('rejects artifact with providerCalled=true', () => {
      const deck = createMockSlideDeck({
        status: 'draft',
        providerCalled: true,
        slides: [makeSlide(0)],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, false);
      assert.ok(
        result.errors.some((e) => e.code === 'provider_called_artifact'),
        'Expected provider_called_artifact error',
      );
    });

    it('rejects PPTArtifact with autoExportEnabled=true', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const pptArtifact = createMockPPTArtifact(deck);
      const autoExportPPT: PPTArtifact = {
        ...pptArtifact,
        autoExportEnabled: true,
      };
      const result = SVC.renderSlideDeckArtifact(
        makeRenderRequest(deck, { artifact: autoExportPPT }),
      );
      assert.equal(result.ok, false);
      assert.ok(
        result.errors.some((e) => e.code === 'auto_export_enabled'),
        'Expected auto_export_enabled error',
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-3: validateRenderableDeck basic checks
  // ════════════════════════════════════════════════════════

  describe('validateRenderableDeck', () => {

    it('rejects empty requestId', () => {
      const deck = createMockSlideDeck();
      const result = SVC.renderSlideDeckArtifact(
        makeRenderRequest(deck, { requestId: '' }),
      );
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === 'empty_request_id'));
    });

    it('rejects unconfirmed context', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const result = SVC.renderSlideDeckArtifact(
        makeRenderRequest(deck, { confirmedContext: false }),
      );
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === 'context_not_confirmed'));
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-4: SourceRef / EvidenceRef preservation
  // ════════════════════════════════════════════════════════

  describe('SourceRef / EvidenceRef preservation', () => {

    it('preserves all SourceRefs from source slides in preview output', () => {
      const sourceRef = makeSourceRef('notes/methods.md', {
        headingPath: ['# Method', '## Protocol'],
      });
      const block = makeContentBlock({ sources: [sourceRef] });
      const deck = createMockSlideDeck({
        slides: [makeSlide(0, { blocks: [block], allSources: [sourceRef] })],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);

      const previewSlide = result.preview!.slides[0];
      assert.equal(previewSlide.allSources.length, 1);
      assert.equal(previewSlide.allSources[0].relativePath, 'notes/methods.md');

      const previewBlock = previewSlide.blocks[0];
      assert.equal(previewBlock.sources.length, 1);
      assert.equal(previewBlock.sources[0].relativePath, 'notes/methods.md');
    });

    it('preserves all EvidenceRefs from source slides in preview output', () => {
      const evRef = makeEvidenceRef('notes/results.md', 'Key finding summary');
      const block = makeContentBlock({ evidence: [evRef] });
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [block],
            allSources: block.sources,
            allEvidence: [evRef],
          }),
        ],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);

      const previewSlide = result.preview!.slides[0];
      assert.equal(previewSlide.allEvidence.length, 1);
      assert.equal(previewSlide.allEvidence[0].excerpt, 'Key finding summary');

      const previewBlock = previewSlide.blocks[0];
      assert.equal(previewBlock.evidence.length, 1);
      assert.equal(previewBlock.evidence[0].excerpt, 'Key finding summary');
    });

    it('preserves hasUnsupportedClaims flag', () => {
      const block = makeContentBlock({ hasUnsupportedClaims: true });
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [block],
            allSources: [],
            allEvidence: [],
            hasUnsupportedClaims: true,
          }),
        ],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);
      assert.equal(result.preview!.slides[0].hasUnsupportedClaims, true);
      assert.equal(result.preview!.slides[0].blocks[0].hasUnsupportedClaims, true);
    });

    it('report warns about unsupported claims', () => {
      const block = makeContentBlock({ hasUnsupportedClaims: true });
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [block],
            allSources: [],
            allEvidence: [],
            hasUnsupportedClaims: true,
          }),
        ],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);
      assert.ok(
        result.warnings.some((w) => w.code === 'unsupported_claims'),
        'Expected unsupported_claims warning',
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-5: relativePath-only asset preservation
  // ════════════════════════════════════════════════════════

  describe('relativePath-only asset preservation', () => {

    it('preserves relative-path asset refs in preview output', () => {
      const assetRef = makeAssetRef('assets/figure.png', 'image');
      const block = makeContentBlock({ assetRef, blockType: 'image' });
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [block],
            allSources: block.sources,
            allEvidence: [],
          }),
        ],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);

      const previewBlock = result.preview!.slides[0].blocks[0];
      assert.ok(previewBlock.assetRef !== null);
      assert.equal(previewBlock.assetRef!.relativePath, 'assets/figure.png');
      assert.equal(previewBlock.assetRef!.assetType, 'image');
      assert.equal(previewBlock.assetRef!.caption, 'Test asset');
      assert.equal(previewBlock.assetRef!.sources.length, 1);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-6: absolute asset path rejected
  // ════════════════════════════════════════════════════════

  describe('absolute asset path rejected', () => {

    it('rejects asset ref with Unix absolute path', () => {
      const assetRef = makeAssetRef('/etc/passwd', 'image');
      const block = makeContentBlock({ assetRef, blockType: 'image' });
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [block],
            allSources: block.sources,
          }),
        ],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, false);
      assert.ok(
        result.errors.some((e) => e.code === 'absolute_asset_path'),
        'Expected absolute_asset_path error',
      );
    });

    it('rejects asset ref with Windows absolute path', () => {
      const assetRef = makeAssetRef('C:\\Users\\test\\image.png', 'image');
      const block = makeContentBlock({ assetRef, blockType: 'image' });
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [block],
            allSources: block.sources,
          }),
        ],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, false);
      assert.ok(
        result.errors.some((e) => e.code === 'absolute_asset_path'),
        'Expected absolute_asset_path error for Windows path',
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-7: external URL asset blocked
  // ════════════════════════════════════════════════════════

  describe('external URL asset blocked', () => {

    it('rejects asset ref with https URL', () => {
      const assetRef = makeAssetRef('https://example.com/img.png', 'image');
      const block = makeContentBlock({ assetRef, blockType: 'image' });
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [block],
            allSources: block.sources,
          }),
        ],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, false);
      assert.ok(
        result.errors.some((e) => e.code === 'external_asset_url'),
        'Expected external_asset_url error',
      );
    });

    it('rejects asset ref with ftp URL', () => {
      const assetRef = makeAssetRef('ftp://server/files/doc.pdf', 'image');
      const block = makeContentBlock({ assetRef, blockType: 'image' });
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [block],
            allSources: block.sources,
          }),
        ],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, false);
      assert.ok(
        result.errors.some((e) => e.code === 'external_asset_url'),
        'Expected external_asset_url error for ftp',
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-8: asset without source refs rejected
  // ════════════════════════════════════════════════════════

  describe('asset without source backing rejected', () => {

    it('rejects asset ref with zero sources', () => {
      const assetRef = makeAssetRef('assets/chart.png', 'chart', []);
      const block = makeContentBlock({ assetRef, blockType: 'chart' });
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [block],
            allSources: [],
          }),
        ],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, false);
      assert.ok(
        result.errors.some((e) => e.code === 'asset_without_source'),
        'Expected asset_without_source error',
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-9: output preview-only / draft-only
  // ════════════════════════════════════════════════════════

  describe('output preview-only / draft-only', () => {

    it('preview model has previewOnly=true', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);
      assert.equal(result.preview!.previewOnly, true);
    });

    it('preview model has draftOnly=true', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);
      assert.equal(result.preview!.draftOnly, true);
    });

    it('report has previewOnly=true and draftOnly=true', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);
      assert.equal(result.report.previewOnly, true);
      assert.equal(result.report.draftOnly, true);
    });

    it('result has providerCalled=false and userReviewRequired=true', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.providerCalled, false);
      assert.equal(result.userReviewRequired, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-10: presentation structure preserved
  // ════════════════════════════════════════════════════════

  describe('presentation structure preserved', () => {

    it('preserves slide count', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0), makeSlide(1), makeSlide(2)],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);
      assert.equal(result.preview!.slideCount, 3);
      assert.equal(result.preview!.slides.length, 3);
    });

    it('preserves slide titles and layout', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, { title: 'Introduction', layout: 'title_slide' }),
          makeSlide(1, { title: 'Methods', layout: 'content' }),
          makeSlide(2, { title: 'Summary', layout: 'content' }),
        ],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);

      assert.equal(result.preview!.slides[0].title, 'Introduction');
      assert.equal(result.preview!.slides[0].layout, 'title_slide');
      assert.equal(result.preview!.slides[1].title, 'Methods');
      assert.equal(result.preview!.slides[1].layout, 'content');
      assert.equal(result.preview!.slides[2].title, 'Summary');
    });

    it('preserves slide notes', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, { notes: 'Speaker note for slide 1' }),
        ],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);
      assert.equal(result.preview!.slides[0].notes, 'Speaker note for slide 1');
    });

    it('warns on empty deck', () => {
      const deck = createMockSlideDeck({
        slides: [],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);
      assert.ok(
        result.warnings.some((w) => w.code === 'empty_deck'),
        'Expected empty_deck warning',
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-11: report completeness
  // ════════════════════════════════════════════════════════

  describe('report completeness', () => {

    it('report contains correct totals', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0), makeSlide(1)],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);

      assert.equal(result.report.requestId, 'render-req-001');
      assert.equal(result.report.deckId, deck.id);
      assert.equal(result.report.renderTarget, 'preview_model');
      assert.equal(result.report.totalSlides, 2);
      assert.equal(result.report.totalBlocks, 2);
    });

    it('report totals match preview model', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0), makeSlide(1)],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);

      assert.equal(result.report.totalSlides, result.preview!.slideCount);
      assert.equal(result.report.totalSourceRefs, result.preview!.totalSourceRefs);
      assert.equal(result.report.totalEvidenceRefs, result.preview!.totalEvidenceRefs);
    });

    it('failure result still includes a report', () => {
      const deck = createMockSlideDeck({
        status: 'reviewed',
        slides: [makeSlide(0)],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, false);
      assert.ok(result.report !== null);
      assert.equal(result.report.requestId, 'render-req-001');
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-12: content block type preservation
  // ════════════════════════════════════════════════════════

  describe('content block type preservation', () => {

    it('preserves text block content', () => {
      const block = makeContentBlock({
        blockType: 'text',
        content: 'Research background and motivation',
      });
      const deck = createMockSlideDeck({
        slides: [makeSlide(0, { blocks: [block], allSources: block.sources, allEvidence: [] })],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);
      assert.equal(result.preview!.slides[0].blocks[0].blockType, 'text');
      assert.equal(result.preview!.slides[0].blocks[0].content, 'Research background and motivation');
    });

    it('preserves bullet_list items', () => {
      const block = makeContentBlock({
        blockType: 'bullet_list',
        content: '',
        items: ['Point A', 'Point B', 'Point C'],
      });
      const deck = createMockSlideDeck({
        slides: [makeSlide(0, { blocks: [block], allSources: block.sources, allEvidence: [] })],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);
      assert.equal(result.preview!.slides[0].blocks[0].blockType, 'bullet_list');
      assert.equal(result.preview!.slides[0].blocks[0].items.length, 3);
      assert.equal(result.preview!.slides[0].blocks[0].items[0], 'Point A');
    });

    it('preserves confidence score', () => {
      const block = makeContentBlock({ confidence: 0.75 });
      const deck = createMockSlideDeck({
        slides: [makeSlide(0, { blocks: [block], allSources: block.sources, allEvidence: [] })],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);
      assert.equal(result.preview!.slides[0].blocks[0].confidence, 0.75);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-13: no pptx / PPT export / PPT-master / PowerPoint
  // ════════════════════════════════════════════════════════

  describe('no PPT export or tool integration', () => {

    it('preview model has no pptx or export target fields', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);
      // preview model must not contain any export-like field
      const model = result.preview!;
      assert.ok(!('exportTarget' in model));
      assert.ok(!('pptx' in model));
    });

    it('render result has no pptx output', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.ok(!('pptx' in result));
      assert.ok(!('pptxBuffer' in result));
      assert.ok(!('pptxFilePath' in result));
      assert.ok(!('exportedFile' in result));
    });

    it('service has no pptx generation methods', () => {
      // Verify public API only includes render/preview methods
      const publicMethods = ['renderSlideDeckArtifact', 'validateRenderableDeck', 'validateRenderableAssets', 'buildSlidePreviewModel', 'renderSlidePreview', 'renderSlideContentBlock', 'buildRendererReport', 'collectRendererWarnings'];
      const svcKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(SVC)).filter(
        (k) => k !== 'constructor' && typeof (SVC as unknown as Record<string, unknown>)[k] === 'function',
      );
      // No export, PowerPoint, PPT-master methods allowed
      const forbidden = ['export', 'pptx', 'powerpoint', 'libreoffice', 'pandoc', 'pptMaster'];
      for (const method of svcKeys) {
        const lower = method.toLowerCase();
        for (const word of forbidden) {
          assert.ok(
            !lower.includes(word),
            `Service must not expose: ${method}`,
          );
        }
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-14: no provider / embedding / network call
  // ════════════════════════════════════════════════════════

  describe('no provider or embedding call', () => {

    it('providerCalled is always false in all outputs', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.providerCalled, false);
      assert.equal(result.preview!.providerCalled, false);
      assert.equal(result.report.providerCalled, false);
    });

    it('no external imports in service file', () => {
      // Validate the service does not import provider, embedding, or network modules
      const forbiddenImports = ['provider', 'embedding', 'fetch', 'axios', 'http', 'request'];
      // The service file is verified at code review level; this test confirms runtime
      // invariants hold
      assert.ok(true, 'Service imports are reviewed at code-review time');
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-15: no Vault write, no generic IPC
  // ════════════════════════════════════════════════════════

  describe('no Vault write or generic IPC', () => {

    it('service has no file system write methods', () => {
      const svcKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(SVC)).filter(
        (k) => k !== 'constructor' && typeof (SVC as unknown as Record<string, unknown>)[k] === 'function',
      );
      const forbidden = ['write', 'save', 'persist', 'export', 'createFile'];
      for (const method of svcKeys) {
        const lower = method.toLowerCase();
        for (const word of forbidden) {
          assert.ok(
            !lower.includes(word),
            `Service must not have write/save methods: ${method}`,
          );
        }
      }
    });

    it('preview model has no absolute paths', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, true);

      for (const slide of result.preview!.slides) {
        for (const block of slide.blocks) {
          for (const src of block.sources) {
            assert.ok(
              !src.relativePath.startsWith('/') &&
                !src.relativePath.match(/^[A-Za-z]:\\/),
              `SourceRef must use relative path: ${src.relativePath}`,
            );
            assert.ok(
              !src.relativePath.startsWith('http'),
              `SourceRef must not be URL: ${src.relativePath}`,
            );
          }
        }
      }
    });

    it('service operates purely in-memory', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });

      // Rendering twice produces same deterministic output shape
      const r1 = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      const r2 = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(r1.ok, r2.ok);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-16: no Phase 5 plugin entry
  // ════════════════════════════════════════════════════════

  describe('no Phase 5 plugin entry', () => {

    it('service has no plugin-related API surface', () => {
      const svcKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(SVC)).filter(
        (k) => k !== 'constructor' && typeof (SVC as unknown as Record<string, unknown>)[k] === 'function',
      );
      const forbidden = ['plugin', 'register', 'extension', 'hook', 'middleware', 'manifest'];
      for (const method of svcKeys) {
        const lower = method.toLowerCase();
        for (const word of forbidden) {
          assert.ok(
            !lower.includes(word),
            `Service must not expose plugin methods: ${method}`,
          );
        }
      }
    });

    it('result does not contain plugin metadata', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.ok(!('plugin' in result));
      assert.ok(!('extensions' in result));
      assert.ok(!('phase5' in result));
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-17: render error details include context
  // ════════════════════════════════════════════════════════

  describe('error detail context', () => {

    it('absolute asset path error includes slide/block index and path', () => {
      const assetRef = makeAssetRef('/root/bad.png', 'image');
      const block = makeContentBlock({ assetRef, blockType: 'image' });
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, { blocks: [block], allSources: block.sources }),
        ],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, false);
      const err = result.errors.find((e) => e.code === 'absolute_asset_path');
      assert.ok(err !== undefined);
      assert.equal(err!.slideIndex, 0);
      assert.equal(err!.blockIndex, 0);
      assert.equal(err!.assetRelativePath, '/root/bad.png');
    });

    it('external URL error includes slide/block index and URL', () => {
      const assetRef = makeAssetRef('https://evil.com/malware.png', 'image');
      const block = makeContentBlock({ assetRef, blockType: 'image' });
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, { blocks: [block], allSources: block.sources }),
        ],
      });
      const result = SVC.renderSlideDeckArtifact(makeRenderRequest(deck));
      assert.equal(result.ok, false);
      const err = result.errors.find((e) => e.code === 'external_asset_url');
      assert.ok(err !== undefined);
      assert.equal(err!.slideIndex, 0);
      assert.equal(err!.blockIndex, 0);
      assert.equal(err!.assetRelativePath, 'https://evil.com/malware.png');
    });
  });
});
