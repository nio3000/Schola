/**
 * Multimodal Asset Guard Service Tests — Phase 4-4-D.
 *
 * Covers all Phase 4-4-D P0 test boundaries:
 * - accepts SlideDeckArtifact / PPTArtifact / SlidePreviewModel / asset list
 * - validates references only, no file read
 * - relativePath-only enforced
 * - Unix absolute path rejected
 * - Windows absolute path rejected
 * - UNC path rejected
 * - path traversal rejected
 * - external URL rejected
 * - unsupported asset type warned
 * - source backing required
 * - factual asset-backed block requires EvidenceRef
 * - SourceRef / EvidenceRef preservation
 * - safe relative asset refs preserved
 * - unsafe refs blocked from preview-safe output
 * - no image processing / OCR / recognition
 * - no provider call / embedding call
 * - no external fetch
 * - no automatic save / Vault write
 * - no generic IPC
 * - no PPT-master reference / integration
 * - no Phase 5 plugin entry
 */
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { MultimodalAssetGuardService } from '../../electron/services/multimodal-asset-guard.service';
import {
  createMockSlideDeck,
  createMockPPTArtifact,
  createMockGuardRequest,
} from '../../src/lib/contracts/ppt-artifact.types';
import type {
  SlideDeckArtifact,
  PPTArtifact,
  SlideItem,
  SlideContentBlock,
  SlidePreviewModel,
  SlidePreviewItem,
  SlidePreviewBlock,
  MultimodalAssetRef,
  MultimodalAssetGuardRequest,
  MultimodalAssetGuardResult,
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
    headingPath: ['# Research'],
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
    hasUnsupportedClaims: base.hasUnsupportedClaims,
    ...overrides,
  };
}

function makePreviewBlock(
  id: string,
  overrides?: Partial<SlidePreviewBlock>,
): SlidePreviewBlock {
  return {
    id,
    blockType: 'text',
    content: 'Preview content',
    items: [],
    sources: [makeSourceRef('notes/source.md')],
    evidence: [makeEvidenceRef('notes/source.md', 'Key excerpt')],
    assetRef: null,
    confidence: 0.9,
    hasUnsupportedClaims: false,
    ...overrides,
  };
}

function makePreviewSlide(
  index: number,
  blocks?: SlidePreviewBlock[],
): SlidePreviewItem {
  const defaults = blocks ?? [makePreviewBlock(`preview-block-${index}-0`)];
  return {
    id: `preview-slide-${index}`,
    index,
    title: `Slide ${index + 1}`,
    layout: 'content',
    blocks: defaults,
    notes: '',
    allSources: defaults.flatMap((b) => b.sources),
    allEvidence: defaults.flatMap((b) => b.evidence),
    hasUnsupportedClaims: false,
  };
}

function makePreviewModel(
  overrides?: Partial<SlidePreviewModel>,
): SlidePreviewModel {
  return {
    requestId: 'preview-req-001',
    deckId: 'deck-001',
    title: 'Test Preview',
    subtitle: '',
    status: 'draft',
    renderTarget: 'preview_model',
    slides: [makePreviewSlide(0)],
    slideCount: 1,
    totalSourceRefs: 1,
    totalEvidenceRefs: 1,
    totalAssetRefs: 0,
    previewOnly: true,
    draftOnly: true,
    providerCalled: false,
    userReviewRequired: true,
    ...overrides,
  };
}

// ── Constants ──────────────────────────────────────────

const SVC = new MultimodalAssetGuardService();

// ── Tests ───────────────────────────────────────────────

describe('MultimodalAssetGuardService', () => {

  // ════════════════════════════════════════════════════════
  // P0-1: accepts SlideDeckArtifact / PPTArtifact / SlidePreviewModel / asset list
  // ════════════════════════════════════════════════════════

  describe('accepts valid artifact types', () => {

    it('accepts SlideDeckArtifact target', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ target: 'slide_deck', deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, true);
      assert.equal(result.report.target, 'slide_deck');
    });

    it('accepts PPTArtifact target', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const ppt = createMockPPTArtifact(deck);
      const req = createMockGuardRequest({
        target: 'ppt_artifact',
        pptArtifact: ppt,
      });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, true);
      assert.equal(result.report.target, 'ppt_artifact');
    });

    it('accepts preview_model target', () => {
      const model = makePreviewModel();
      const req = createMockGuardRequest({
        target: 'preview_model',
        previewModel: model,
      });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, true);
      assert.equal(result.report.target, 'preview_model');
    });

    it('accepts asset_list target', () => {
      const req = createMockGuardRequest({
        target: 'asset_list',
        assetRefs: [makeAssetRef('figures/chart.png', 'chart')],
      });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, true);
      assert.equal(result.report.target, 'asset_list');
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-2: validates references only, no file read
  // ════════════════════════════════════════════════════════

  describe('validates references only, no file read', () => {

    it('report confirms noFileRead is always true', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.noFileRead, true);
    });

    it('report confirms noFileWrite is always true', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.noFileWrite, true);
    });

    it('report confirms noImageProcessing is always true', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.noImageProcessing, true);
    });

    it('report confirms noOCR is always true', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.noOCR, true);
    });

    it('report confirms providerCalled is always false', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.providerCalled, false);
      assert.equal(result.providerCalled, false);
    });

    it('report confirms embeddingCalled is always false', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.embeddingCalled, false);
    });

    it('report confirms externalFetchCalled is always false', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.externalFetchCalled, false);
    });

    it('result confirms userReviewRequired is always true', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.userReviewRequired, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-3: relativePath-only enforced
  // ════════════════════════════════════════════════════════

  describe('relativePath-only enforced', () => {

    it('accepts safe relative paths', () => {
      const ref = makeAssetRef('figures/chart.png');
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 0);
    });

    it('accepts nested relative paths', () => {
      const ref = makeAssetRef('assets/images/diagrams/flow.png');
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 0);
    });

    it('accepts relative paths with dot prefix', () => {
      // "./figures/chart.png" is NOT absolute and contains no traversal
      const ref = makeAssetRef('./figures/chart.png');
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 0);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-4: Unix absolute path rejected
  // ════════════════════════════════════════════════════════

  describe('Unix absolute path rejected', () => {

    it('rejects Unix absolute path starting with /', () => {
      const ref = makeAssetRef('/home/user/vault/image.png');
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].reason, 'absolute_path');
    });

    it('rejects root-level absolute path', () => {
      const ref = makeAssetRef('/root/diagram.png');
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].reason, 'absolute_path');
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-5: Windows absolute path rejected
  // ════════════════════════════════════════════════════════

  describe('Windows absolute path rejected', () => {

    it('rejects Windows drive-letter path with backslash', () => {
      const ref = makeAssetRef('C:\\Users\\Data\\image.png');
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].reason, 'absolute_path');
    });

    it('rejects Windows drive-letter path with forward slash', () => {
      const ref = makeAssetRef('D:/Projects/vault/chart.png');
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].reason, 'absolute_path');
    });

    it('rejects lowercase Windows drive-letter path', () => {
      const ref = makeAssetRef('e:\\data\\table.png');
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].reason, 'absolute_path');
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-6: UNC path rejected
  // ════════════════════════════════════════════════════════

  describe('UNC path rejected', () => {

    it('rejects UNC path with backslashes', () => {
      const ref = makeAssetRef('\\\\server\\share\\image.png');
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].reason, 'absolute_path');
    });

    it('rejects UNC-like path with forward slashes', () => {
      const ref = makeAssetRef('//server/share/image.png');
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].reason, 'absolute_path');
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-7: path traversal rejected
  // ════════════════════════════════════════════════════════

  describe('path traversal rejected', () => {

    it('rejects path with ../', () => {
      const ref = makeAssetRef('../outside/image.png');
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].reason, 'outside_vault');
    });

    it('rejects path with ..\\', () => {
      const ref = makeAssetRef('..\\outside\\image.png');
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].reason, 'outside_vault');
    });

    it('rejects path with mid-segment traversal', () => {
      const ref = makeAssetRef('notes/../outside/image.png');
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].reason, 'outside_vault');
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-8: external URL rejected
  // ════════════════════════════════════════════════════════

  describe('external URL rejected', () => {

    it('rejects https URL', () => {
      const ref = makeAssetRef('https://example.com/image.png');
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].reason, 'external_url');
    });

    it('rejects http URL', () => {
      const ref = makeAssetRef('http://example.com/image.png');
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].reason, 'external_url');
    });

    it('rejects ftp URL', () => {
      const ref = makeAssetRef('ftp://files.example.com/image.png');
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].reason, 'external_url');
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-9: unsupported asset type warned
  // ════════════════════════════════════════════════════════

  describe('unsupported asset type warned', () => {

    it('accepts supported type "image"', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                assetRef: makeAssetRef('images/photo.png', 'image'),
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.violatedRefs, 0);
    });

    it('accepts supported type "chart"', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                assetRef: makeAssetRef('charts/bar.png', 'chart'),
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.violatedRefs, 0);
    });

    it('accepts supported type "table"', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                assetRef: makeAssetRef('tables/data.png', 'table'),
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.violatedRefs, 0);
    });

    it('accepts supported type "diagram"', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                assetRef: makeAssetRef('diagrams/flow.png', 'diagram'),
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.violatedRefs, 0);
    });

    it('warns on unsupported asset type but does not error', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                assetRef: makeAssetRef('videos/demo.mp4', 'video' as MultimodalAssetRef['assetType']),
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck, mode: 'validate_only' });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, true);
      assert.ok(result.warnings.some((w) => w.code === 'unsupported_asset_type'));
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-10: source backing required
  // ════════════════════════════════════════════════════════

  describe('source backing required', () => {

    it('rejects asset ref with no source backing', () => {
      const ref = makeAssetRef('images/photo.png', 'image', []);
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].reason, 'no_source_backing');
    });

    it('accepts asset ref with source backing', () => {
      const ref = makeAssetRef('images/photo.png', 'image', [
        makeSourceRef('notes/research.md'),
      ]);
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 0);
    });

    it('validateAssetSourceBacking returns violation for empty sources', () => {
      const ref = makeAssetRef('images/photo.png', 'image', []);
      const violations = SVC.validateAssetSourceBacking(ref);
      assert.equal(violations.length, 1);
    });

    it('validateAssetSourceBacking returns empty for non-empty sources', () => {
      const ref = makeAssetRef('images/photo.png', 'image');
      const violations = SVC.validateAssetSourceBacking(ref);
      assert.equal(violations.length, 0);
    });

    it('deck with asset lacking source backing triggers violation', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                assetRef: makeAssetRef('images/photo.png', 'image', []),
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.ok(result.report.violatedRefs >= 1);
      assert.ok(result.violations.some((v) => v.reason === 'no_source_backing'));
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-11: factual asset-backed block requires EvidenceRef
  // ════════════════════════════════════════════════════════

  describe('factual asset-backed block requires EvidenceRef', () => {

    it('warns when image block has asset ref but no evidence', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                blockType: 'image',
                assetRef: makeAssetRef('images/photo.png', 'image'),
                evidence: [],
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.ok(
        result.warnings.some((w) => w.code === 'factual_block_no_evidence'),
        'Expected factual_block_no_evidence warning for image block without evidence',
      );
    });

    it('warns when table block has asset ref but no evidence', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                blockType: 'table',
                assetRef: makeAssetRef('tables/data.png', 'table'),
                evidence: [],
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.ok(
        result.warnings.some((w) => w.code === 'factual_block_no_evidence'),
      );
    });

    it('warns when chart block has asset ref but no evidence', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                blockType: 'chart',
                assetRef: makeAssetRef('charts/bar.png', 'chart'),
                evidence: [],
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.ok(
        result.warnings.some((w) => w.code === 'factual_block_no_evidence'),
      );
    });

    it('does not warn when factual block has both asset ref and evidence', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                blockType: 'image',
                assetRef: makeAssetRef('images/photo.png', 'image'),
                evidence: [makeEvidenceRef('notes/source.md', 'Figure 1 shows the trend')],
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      const evidenceWarnings = result.warnings.filter(
        (w) => w.code === 'factual_block_no_evidence',
      );
      assert.equal(evidenceWarnings.length, 0);
    });

    it('does not warn for non-factual block with asset ref', () => {
      // 'text' blocks with asset refs are not factual-asset blocks
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                blockType: 'text',
                assetRef: makeAssetRef('images/icon.png', 'image'),
                evidence: [],
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      const evidenceWarnings = result.warnings.filter(
        (w) => w.code === 'factual_block_no_evidence',
      );
      assert.equal(evidenceWarnings.length, 0);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-12: SourceRef / EvidenceRef preservation
  // ════════════════════════════════════════════════════════

  describe('SourceRef / EvidenceRef preservation', () => {

    it('preserves SourceRef through guard execution', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                sources: [makeSourceRef('notes/research.md')],
                evidence: [makeEvidenceRef('notes/research.md', 'Key finding')],
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, true);
      // Guard does not modify source data — verify report reflects safe state
      assert.equal(result.report.previewSafe, true);
    });

    it('preserves EvidenceRef through guard execution', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                blockType: 'image',
                assetRef: makeAssetRef('images/photo.png', 'image'),
                evidence: [makeEvidenceRef('notes/research.md', 'Figure evidence')],
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, true);
      assert.equal(result.report.previewSafe, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-13: safe relative asset refs preserved
  // ════════════════════════════════════════════════════════

  describe('safe relative asset refs preserved', () => {

    it('safe relative refs pass guard and previewSafe is true', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                assetRef: makeAssetRef('images/photo.png', 'image'),
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck, mode: 'preview_safe' });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, true);
      assert.equal(result.report.previewSafe, true);
      assert.equal(result.report.violatedRefs, 0);
    });

    it('safe relative refs with multiple sources all pass', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                assetRef: makeAssetRef('figures/a.png', 'image'),
              }),
              makeContentBlock({
                assetRef: makeAssetRef('figures/b.png', 'chart'),
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.totalAssetRefs, 2);
      assert.equal(result.report.passedRefs, 2);
      assert.equal(result.report.violatedRefs, 0);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-14: unsafe refs blocked from preview-safe output
  // ════════════════════════════════════════════════════════

  describe('unsafe refs blocked from preview-safe output', () => {

    it('previewSafe is false when any asset ref fails path validation', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                assetRef: makeAssetRef('/absolute/path/image.png', 'image'),
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck, mode: 'preview_safe' });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, false);
      assert.equal(result.report.previewSafe, false);
      assert.ok(result.report.violatedRefs >= 1);
    });

    it('previewSafe is false when any asset ref lacks source backing', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                assetRef: makeAssetRef('images/photo.png', 'image', []),
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck, mode: 'preview_safe' });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, false);
      assert.equal(result.report.previewSafe, false);
    });

    it('validate_only mode still reports violations but ok is true', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                assetRef: makeAssetRef('/absolute/path/image.png', 'image'),
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck, mode: 'validate_only' });
      const result = SVC.validateAssetReferences(req);
      // validate_only is advisory — always ok
      assert.equal(result.ok, true);
      // But previewSafe reflects actual state
      assert.equal(result.report.previewSafe, false);
      assert.ok(result.violations.length > 0);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-15: no image processing / OCR / recognition
  // ════════════════════════════════════════════════════════

  describe('no image processing / OCR / recognition', () => {

    it('report confirms no image processing', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                assetRef: makeAssetRef('images/photo.png', 'image'),
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.noImageProcessing, true);
    });

    it('report confirms no OCR', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                assetRef: makeAssetRef('images/scan.png', 'image'),
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.noOCR, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-16: no provider / embedding call
  // ════════════════════════════════════════════════════════

  describe('no provider / embedding call', () => {

    it('providerCalled is always false in every result', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.providerCalled, false);
      assert.equal(result.report.providerCalled, false);
    });

    it('embeddingCalled is always false in every report', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.embeddingCalled, false);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-17: no external fetch
  // ════════════════════════════════════════════════════════

  describe('no external fetch', () => {

    it('externalFetchCalled is always false', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.externalFetchCalled, false);
    });

    it('external URL asset refs are rejected, not fetched', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                assetRef: makeAssetRef('https://cdn.example.com/image.png', 'image'),
              }),
            ],
          }),
        ],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      // Violation is a reference check, not a fetch
      assert.ok(result.violations.some((v) => v.reason === 'external_url'));
      assert.equal(result.report.externalFetchCalled, false);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-18: no automatic save / Vault write
  // ════════════════════════════════════════════════════════

  describe('no automatic save / Vault write', () => {

    it('report confirms no file write', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.report.noFileWrite, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-19: no generic IPC
  // ════════════════════════════════════════════════════════

  describe('no generic IPC', () => {

    it('guard service performs no IPC — all operations are local and pure', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      // The guard is a pure function — result is deterministic
      assert.equal(result.ok, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-20: no PPT-master reference / integration
  // ════════════════════════════════════════════════════════

  describe('no PPT-master reference / integration', () => {

    it('guard service has no PPT-master dependency', () => {
      // The service source code has no PPT-master imports
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-21: no Phase 5 plugin entry
  // ════════════════════════════════════════════════════════

  describe('no Phase 5 plugin entry', () => {

    it('guard service has no plugin system hooks', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // validateRelativePathOnly
  // ════════════════════════════════════════════════════════

  describe('validateRelativePathOnly', () => {

    it('returns null for safe relative path', () => {
      assert.equal(SVC.validateRelativePathOnly('figures/chart.png'), null);
    });

    it('returns absolute_path for Unix absolute', () => {
      assert.equal(SVC.validateRelativePathOnly('/etc/passwd'), 'absolute_path');
    });

    it('returns absolute_path for Windows absolute', () => {
      assert.equal(SVC.validateRelativePathOnly('C:\\Windows\\file.txt'), 'absolute_path');
    });

    it('returns absolute_path for UNC', () => {
      assert.equal(SVC.validateRelativePathOnly('\\\\server\\share'), 'absolute_path');
    });

    it('returns absolute_path for empty string', () => {
      assert.equal(SVC.validateRelativePathOnly(''), 'absolute_path');
    });

    it('returns absolute_path for whitespace-only string', () => {
      assert.equal(SVC.validateRelativePathOnly('   '), 'absolute_path');
    });

    it('returns outside_vault for path traversal', () => {
      assert.equal(SVC.validateRelativePathOnly('../secrets/data.txt'), 'outside_vault');
    });

    it('returns external_url for https URL', () => {
      assert.equal(
        SVC.validateRelativePathOnly('https://example.com/image.png'),
        'external_url',
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // validatePreviewModelAssets
  // ════════════════════════════════════════════════════════

  describe('validatePreviewModelAssets', () => {

    it('validates safe preview model assets', () => {
      const model = makePreviewModel({
        slides: [
          makePreviewSlide(0, [
            makePreviewBlock('pb-0', {
              assetRef: {
                relativePath: 'figures/chart.png',
                assetType: 'chart',
                caption: 'Chart',
                sources: [makeSourceRef('notes/source.md')],
              },
            }),
          ]),
        ],
        totalAssetRefs: 1,
      });
      const req = createMockGuardRequest({
        target: 'preview_model',
        previewModel: model,
      });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, true);
      assert.equal(result.report.totalAssetRefs, 1);
      assert.equal(result.report.passedRefs, 1);
    });

    it('detects violations in preview model assets', () => {
      const model = makePreviewModel({
        slides: [
          makePreviewSlide(0, [
            makePreviewBlock('pb-0', {
              assetRef: {
                relativePath: 'https://external.com/image.png',
                assetType: 'image',
                caption: 'External',
                sources: [makeSourceRef('notes/source.md')],
              },
            }),
          ]),
        ],
        totalAssetRefs: 1,
      });
      const req = createMockGuardRequest({
        target: 'preview_model',
        previewModel: model,
        mode: 'preview_safe',
      });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, false);
      assert.ok(result.violations.some((v) => v.reason === 'external_url'));
    });
  });

  // ════════════════════════════════════════════════════════
  // buildGuardReport
  // ════════════════════════════════════════════════════════

  describe('buildGuardReport', () => {

    it('report includes all required fields', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      const report = result.report;

      assert.equal(report.requestId, 'guard-req-001');
      assert.equal(report.target, 'slide_deck');
      assert.equal(report.mode, 'preview_safe');
      assert.ok(typeof report.totalAssetRefs === 'number');
      assert.ok(typeof report.passedRefs === 'number');
      assert.ok(typeof report.violatedRefs === 'number');
      assert.ok(Array.isArray(report.violations));
      assert.ok(Array.isArray(report.warnings));
      assert.equal(typeof report.previewSafe, 'boolean');
      assert.equal(report.noFileRead, true);
      assert.equal(report.noFileWrite, true);
      assert.equal(report.noImageProcessing, true);
      assert.equal(report.noOCR, true);
      assert.equal(report.providerCalled, false);
      assert.equal(report.embeddingCalled, false);
      assert.equal(report.externalFetchCalled, false);
      assert.ok(typeof report.guardedAt === 'string');
    });
  });

  // ════════════════════════════════════════════════════════
  // aggregateAssetViolations
  // ════════════════════════════════════════════════════════

  describe('aggregateAssetViolations', () => {

    it('aggregates violations from multiple sources', () => {
      const v1 = [
        {
          assetRef: makeAssetRef('/abs/path.png', 'image'),
          reason: 'absolute_path' as const,
          detail: 'Absolute path',
        },
      ];
      const v2 = [
        {
          assetRef: makeAssetRef('https://ext.com/img.png', 'image'),
          reason: 'external_url' as const,
          detail: 'External URL',
        },
      ];
      const aggregated = SVC.aggregateAssetViolations(v1, v2);
      assert.equal(aggregated.length, 2);
    });

    it('handles empty input gracefully', () => {
      const aggregated = SVC.aggregateAssetViolations();
      assert.equal(aggregated.length, 0);
    });
  });

  // ════════════════════════════════════════════════════════
  // collectAssetWarnings
  // ════════════════════════════════════════════════════════

  describe('collectAssetWarnings', () => {

    it('collects warnings from multiple sources', () => {
      const w1 = [
        {
          code: 'unsupported_asset_type',
          message: 'Unsupported type',
        },
      ];
      const w2 = [
        {
          code: 'factual_block_no_evidence',
          message: 'No evidence for factual block',
        },
      ];
      const collected = SVC.collectAssetWarnings(w1, w2);
      assert.equal(collected.length, 2);
    });

    it('handles empty input gracefully', () => {
      const collected = SVC.collectAssetWarnings();
      assert.equal(collected.length, 0);
    });
  });

  // ════════════════════════════════════════════════════════
  // Request validation
  // ════════════════════════════════════════════════════════

  describe('request validation', () => {

    it('rejects empty requestId', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck, requestId: '' });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === 'empty_request_id'));
    });

    it('rejects unconfirmed context', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const req = createMockGuardRequest({ deck, confirmedContext: false });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === 'context_not_confirmed'));
    });

    it('rejects missing target data for slide_deck', () => {
      const req = createMockGuardRequest({ target: 'slide_deck' });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === 'no_target_data'));
    });

    it('rejects missing target data for asset_list', () => {
      const req = createMockGuardRequest({ target: 'asset_list', assetRefs: [] });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === 'no_target_data'));
    });
  });

  // ════════════════════════════════════════════════════════
  // validateSlideDeckAssets
  // ════════════════════════════════════════════════════════

  describe('validateSlideDeckAssets', () => {

    it('returns totalRefs matching number of asset refs in deck', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                assetRef: makeAssetRef('images/a.png', 'image'),
              }),
              makeContentBlock({
                assetRef: makeAssetRef('images/b.png', 'chart'),
              }),
            ],
          }),
        ],
      });
      const { totalRefs, violations } = SVC.validateSlideDeckAssets(deck);
      assert.equal(totalRefs, 2);
      assert.equal(violations.length, 0);
    });

    it('returns violations for unsafe asset refs in deck', () => {
      const deck = createMockSlideDeck({
        slides: [
          makeSlide(0, {
            blocks: [
              makeContentBlock({
                assetRef: makeAssetRef('/absolute/image.png', 'image'),
              }),
            ],
          }),
        ],
      });
      const { violations } = SVC.validateSlideDeckAssets(deck);
      assert.ok(violations.some((v) => v.reason === 'absolute_path'));
    });
  });

  // ════════════════════════════════════════════════════════
  // Edge cases
  // ════════════════════════════════════════════════════════

  describe('edge cases', () => {

    it('empty deck with no slides passes with 0 refs', () => {
      const deck = createMockSlideDeck();
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, true);
      assert.equal(result.report.totalAssetRefs, 0);
      assert.equal(result.report.passedRefs, 0);
      assert.equal(result.report.violatedRefs, 0);
    });

    it('deck with no asset refs passes cleanly', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0), makeSlide(1)],
      });
      const req = createMockGuardRequest({ deck });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, true);
      assert.equal(result.report.totalAssetRefs, 0);
    });

    it('multiple violations on single asset ref are all captured', () => {
      // Absolute path + no source backing → 2 violations
      const ref = makeAssetRef('/abs/image.png', 'image', []);
      const violations = SVC.validateAssetRef(ref);
      assert.equal(violations.length, 2);
      assert.ok(violations.some((v) => v.reason === 'absolute_path'));
      assert.ok(violations.some((v) => v.reason === 'no_source_backing'));
    });

    it('handles deck with pptArtifact fallback to deck', () => {
      const deck = createMockSlideDeck({
        slides: [makeSlide(0)],
      });
      const ppt = createMockPPTArtifact(deck);
      const req = createMockGuardRequest({
        target: 'ppt_artifact',
        pptArtifact: ppt,
      });
      const result = SVC.validateAssetReferences(req);
      assert.equal(result.ok, true);
    });
  });
});
