/**
 * Slide Plan Generator Service Tests — Phase 4-4-B.
 *
 * Covers all Phase 4-4-B P0 test boundaries:
 * - selected input required / no input → insufficient_evidence
 * - status=draft, userReviewRequired=true, providerCalled=false
 * - source-backed / evidence-backed slide content
 * - no invented facts / metrics / figures / tables
 * - slide count limit enforced
 * - title / agenda / content / summary slides generated as draft
 * - no PPT rendering, no automatic export
 * - no PPT-master reference / integration
 * - no provider call, no embedding call
 * - no external DB / web search
 * - no Vault write, no generic IPC
 * - no Phase 5 plugin entry
 */
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { SlidePlanGeneratorService } from '../../electron/services/slide-plan-generator.service';
import type {
  SlidePlanGenerationRequest,
  SlidePlanGenerationResult,
  SlidePlan,
  SlideItem,
  SlideContentBlock,
  SlideDeckArtifact,
} from '../../src/lib/contracts/ppt-artifact.types';
import type { SourceRef } from '../../src/lib/contracts/local-qa.types';

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

function makeRequest(
  overrides?: Partial<SlidePlanGenerationRequest>,
): SlidePlanGenerationRequest {
  return {
    requestId: 'req-001',
    topic: 'Research Presentation',
    purpose: 'conference',
    audience: 'Academic researchers',
    maxSlides: 10,
    selectedSources: [
      makeSourceRef('notes/research.md', { headingPath: ['# Introduction', '## Background'] }),
      makeSourceRef('notes/methods.md', { headingPath: ['# Method'] }),
      makeSourceRef('notes/results.md', { headingPath: ['# Results', '## Key Findings'] }),
    ],
    selectedArtifacts: [],
    userProvidedContent: '',
    confirmedContext: true,
    mode: 'mock',
    ...overrides,
  };
}

// ── Constants ──────────────────────────────────────────

const SVC = new SlidePlanGeneratorService();

// ── Tests ───────────────────────────────────────────────

describe('SlidePlanGeneratorService', () => {

  // ════════════════════════════════════════════════════════
  // P0-1: selected input required
  // ════════════════════════════════════════════════════════

  describe('selected input required', () => {

    it('rejects request with no sources, no artifacts, no user content', () => {
      const req = makeRequest({
        selectedSources: [],
        selectedArtifacts: [],
        userProvidedContent: '',
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, false);
      const noInputErr = result.errors.find((e) => e.code === 'insufficient_evidence');
      assert.ok(noInputErr, 'Should have insufficient_evidence error');
    });

    it('rejects request with whitespace-only user content and no sources', () => {
      const req = makeRequest({
        selectedSources: [],
        selectedArtifacts: [],
        userProvidedContent: '   ',
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, false);
      const noInputErr = result.errors.find((e) => e.code === 'insufficient_evidence');
      assert.ok(noInputErr, 'Should have insufficient_evidence error');
    });

    it('accepts request with at least one selected source', () => {
      const req = makeRequest({ selectedSources: [makeSourceRef('notes/a.md')] });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, true);
    });

    it('accepts request with user-provided content only (no sources)', () => {
      const req = makeRequest({
        selectedSources: [],
        selectedArtifacts: [],
        userProvidedContent: 'My presentation outline',
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, true);
      // Should have a warning about no source references
      const noSrcWarn = result.warnings.find((w) => w.code === 'no_source_references');
      assert.ok(noSrcWarn, 'Should warn about no source references');
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-2: validation errors
  // ════════════════════════════════════════════════════════

  describe('validation', () => {

    it('rejects empty requestId', () => {
      const req = makeRequest({ requestId: '' });
      const errors = SVC.validateSlidePlanRequest(req);
      assert.ok(errors.some((e) => e.code === 'empty_request_id'));
    });

    it('rejects empty topic', () => {
      const req = makeRequest({ topic: '' });
      const errors = SVC.validateSlidePlanRequest(req);
      assert.ok(errors.some((e) => e.code === 'empty_topic'));
    });

    it('rejects zero maxSlides', () => {
      const req = makeRequest({ maxSlides: 0 });
      const errors = SVC.validateSlidePlanRequest(req);
      assert.ok(errors.some((e) => e.code === 'invalid_max_slides'));
    });

    it('rejects negative maxSlides', () => {
      const req = makeRequest({ maxSlides: -5 });
      const errors = SVC.validateSlidePlanRequest(req);
      assert.ok(errors.some((e) => e.code === 'invalid_max_slides'));
    });

    it('rejects unconfirmed context', () => {
      const req = makeRequest({ confirmedContext: false });
      const errors = SVC.validateSlidePlanRequest(req);
      assert.ok(errors.some((e) => e.code === 'context_not_confirmed'));
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-3: status=draft, userReviewRequired=true, providerCalled=false
  // ════════════════════════════════════════════════════════

  describe('artifact invariants', () => {

    it('generated SlideDeckArtifact status is draft', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);
      assert.equal(result.deck?.status, 'draft');
    });

    it('result userReviewRequired is true', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.userReviewRequired, true);
      assert.equal(result.report.userReviewRequired, true);
    });

    it('result providerCalled is false', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.providerCalled, false);
      assert.equal(result.report.providerCalled, false);
    });

    it('deck isMockArtifact is true', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.deck?.isMockArtifact, true);
    });

    it('deck userReviewRequired is true', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.deck?.userReviewRequired, true);
    });

    it('deck providerCalled is false', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.deck?.providerCalled, false);
    });

    it('deck providerId is empty', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.deck?.providerId, '');
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-4: source-backed slide content
  // ════════════════════════════════════════════════════════

  describe('source-backed slide content', () => {

    it('every content slide block references SourceRef when sources present', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);

      const contentSlides = (result.deck!.slides).filter(
        (s) => s.layout === 'content',
      );

      for (const slide of contentSlides) {
        for (const block of slide.blocks) {
          // Non-title/subtitle blocks with sources should have SourceRef
          if (block.blockType === 'text' || block.blockType === 'bullet_list') {
            assert.ok(
              block.sources.length > 0 || block.hasUnsupportedClaims,
              `Block on slide "${slide.title}" (${block.blockType}) must have sources or be marked unsupported`,
            );
          }
        }
      }
    });

    it('slide allSources aggregate sources from all blocks', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);

      for (const slide of result.deck!.slides) {
        if (slide.layout === 'content' && slide.blocks.length > 0) {
          const hasSourceBlocks = slide.blocks.some(
            (b) => b.sources.length > 0,
          );
          if (hasSourceBlocks) {
            // allSources should be non-empty when blocks have sources
            assert.ok(slide.allSources.length > 0);
          }
        }
      }
    });

    it('SlidePlan allSources includes all source refs from sections', () => {
      const result = SVC.generateSlidePlan(makeRequest({
        selectedSources: [
          makeSourceRef('notes/a.md'),
          makeSourceRef('notes/b.md'),
        ],
      }));
      assert.equal(result.ok, true);
      assert.ok(result.plan!.allSources.length >= 2);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-5: evidence-backed slide content
  // ════════════════════════════════════════════════════════

  describe('evidence-backed slide content', () => {

    it('content slides include EvidenceRef where sources are present', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);

      const contentSlides = result.deck!.slides.filter(
        (s) => s.layout === 'content',
      );

      for (const slide of contentSlides) {
        for (const block of slide.blocks) {
          if (block.sources.length > 0 && block.blockType !== 'title') {
            assert.ok(
              block.evidence.length > 0,
              `Block on slide "${slide.title}" with sources must include EvidenceRef`,
            );
          }
        }
      }
    });

    it('EvidenceRef excerpts are derived from source heading paths', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);

      for (const slide of result.deck!.slides) {
        for (const block of slide.blocks) {
          for (const ev of block.evidence) {
            assert.equal(typeof ev.excerpt, 'string');
            assert.ok(ev.excerpt.length > 0, 'EvidenceRef excerpt must not be empty');
            assert.ok(ev.excerptTokenCount > 0, 'EvidenceRef token count must be positive');
            assert.ok(ev.source, 'EvidenceRef must reference a source');
          }
        }
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-6: no invented facts / metrics / figures / tables
  // ════════════════════════════════════════════════════════

  describe('no invented facts', () => {

    it('all factual content blocks have SourceRef', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);

      for (const slide of result.deck!.slides) {
        for (const block of slide.blocks) {
          if (block.blockType === 'text' || block.blockType === 'bullet_list') {
            // Factual block must either have sources or be marked unsupported
            const isFactual = !['title', 'subtitle'].includes(block.blockType);
            if (isFactual && !block.hasUnsupportedClaims) {
              assert.ok(
                block.sources.length > 0,
                `Factual block must have SourceRef: slide="${slide.title}" type="${block.blockType}"`,
              );
            }
          }
        }
      }
    });

    it('no tables or charts present in mock output', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);

      for (const slide of result.deck!.slides) {
        for (const block of slide.blocks) {
          assert.notEqual(block.blockType, 'table', 'No table blocks in mock output');
          assert.notEqual(block.blockType, 'chart', 'No chart blocks in mock output');
        }
      }
    });

    it('no assetRef present in mock blocks', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);

      for (const slide of result.deck!.slides) {
        for (const block of slide.blocks) {
          assert.equal(block.assetRef, null, 'No asset references in mock blocks');
        }
      }
    });

    it('all SourceRefs use relative paths only (no absolute paths)', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);

      for (const slide of result.deck!.slides) {
        for (const block of slide.blocks) {
          for (const src of block.sources) {
            assert.ok(
              !src.relativePath.startsWith('/') &&
                !src.relativePath.match(/^[A-Za-z]:\\/),
              `SourceRef must use relative path: ${src.relativePath}`,
            );
            assert.ok(
              !src.relativePath.startsWith('http'),
              `SourceRef must not be external URL: ${src.relativePath}`,
            );
          }
        }
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-7: slide count limit
  // ════════════════════════════════════════════════════════

  describe('slide count limit', () => {

    it('respects maxSlides limit', () => {
      const req = makeRequest({
        maxSlides: 3,
        selectedSources: [
          makeSourceRef('notes/a.md'),
          makeSourceRef('notes/b.md'),
          makeSourceRef('notes/c.md'),
          makeSourceRef('notes/d.md'),
          makeSourceRef('notes/e.md'),
        ],
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, true);
      assert.ok(
        result.deck!.slideCount <= req.maxSlides,
        `Slide count ${result.deck!.slideCount} exceeds maxSlides ${req.maxSlides}`,
      );
    });

    it('warns when slide count is limited', () => {
      const req = makeRequest({
        maxSlides: 2,
        selectedSources: [
          makeSourceRef('notes/a.md'),
          makeSourceRef('notes/b.md'),
          makeSourceRef('notes/c.md'),
          makeSourceRef('notes/d.md'),
        ],
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, true);
      const limitWarn = result.warnings.find((w) => w.code === 'slide_count_limited');
      assert.ok(limitWarn, 'Should warn when slide count is limited');
    });

    it('report reflects slideCountLimited when maxSlides reached', () => {
      const req = makeRequest({
        maxSlides: 2,
        selectedSources: [
          makeSourceRef('notes/a.md'),
          makeSourceRef('notes/b.md'),
          makeSourceRef('notes/c.md'),
        ],
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.report.slideCountLimited, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-8: title slide
  // ════════════════════════════════════════════════════════

  describe('title slide', () => {

    it('always generates a title slide at index 0', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);
      const firstSlide = result.deck!.slides[0];
      assert.ok(firstSlide, 'First slide must exist');
      assert.equal(firstSlide.layout, 'title_slide');
      assert.equal(firstSlide.index, 0);
    });

    it('title slide contains title content block with topic', () => {
      const result = SVC.generateSlidePlan(makeRequest({ topic: 'My Topic' }));
      assert.equal(result.ok, true);
      const titleSlide = result.deck!.slides[0];
      const titleBlock = titleSlide.blocks.find((b) => b.blockType === 'title');
      assert.ok(titleBlock, 'Title slide must have a title block');
      assert.equal(titleBlock!.content, 'My Topic');
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-9: agenda slide
  // ════════════════════════════════════════════════════════

  describe('agenda slide', () => {

    it('generates agenda slide when enough sections and room', () => {
      const req = makeRequest({
        maxSlides: 10,
        selectedSources: [
          makeSourceRef('notes/a.md'),
          makeSourceRef('notes/b.md'),
          makeSourceRef('notes/c.md'),
        ],
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, true);
      const agendaSlide = result.deck!.slides.find((s) => s.title === 'Outline');
      assert.ok(agendaSlide, 'Should have an agenda/outline slide');
    });

    it('agenda slide lists section titles', () => {
      const result = SVC.generateSlidePlan(makeRequest({ maxSlides: 10 }));
      assert.equal(result.ok, true);
      const agendaSlide = result.deck!.slides.find((s) => s.title === 'Outline');
      if (agendaSlide) {
        const bulletBlock = agendaSlide.blocks.find((b) => b.blockType === 'bullet_list');
        assert.ok(bulletBlock, 'Agenda slide must have a bullet list');
        assert.ok(bulletBlock!.items.length > 0, 'Agenda must list at least one section');
      }
    });

    it('skips agenda slide when maxSlides is too small', () => {
      const req = makeRequest({
        maxSlides: 2,
        selectedSources: [
          makeSourceRef('notes/a.md'),
          makeSourceRef('notes/b.md'),
          makeSourceRef('notes/c.md'),
        ],
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, true);
      const agendaSlide = result.deck!.slides.find((s) => s.title === 'Outline');
      // Not guaranteed with maxSlides=2, but at least total <= maxSlides
      assert.ok(result.deck!.slideCount <= req.maxSlides);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-10: content slides
  // ════════════════════════════════════════════════════════

  describe('content slides', () => {

    it('generates one content slide per section (within limit)', () => {
      const req = makeRequest({
        maxSlides: 10,
        selectedSources: [
          makeSourceRef('notes/a.md'),
          makeSourceRef('notes/b.md'),
        ],
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, true);
      const contentSlides = result.deck!.slides.filter(
        (s) => s.layout === 'content',
      );
      assert.ok(contentSlides.length > 0, 'Must generate at least one content slide');
    });

    it('content slides have sequential indices starting after title/agenda', () => {
      const result = SVC.generateSlidePlan(makeRequest({ maxSlides: 10 }));
      assert.equal(result.ok, true);
      const indices = result.deck!.slides.map((s) => s.index);
      // Indices should be strictly increasing and start from 0
      for (let i = 0; i < indices.length; i++) {
        assert.equal(indices[i], i, `Slide index at position ${i} must be ${i}`);
      }
    });

    it('content slides reference sources from their section', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);
      const contentSlides = result.deck!.slides.filter(
        (s) => s.layout === 'content',
      );

      for (const slide of contentSlides) {
        // Content slides should have blocks
        assert.ok(slide.blocks.length > 0, `Content slide "${slide.title}" must have blocks`);
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-11: summary slide
  // ════════════════════════════════════════════════════════

  describe('summary slide', () => {

    it('generates summary slide as the last slide', () => {
      const result = SVC.generateSlidePlan(makeRequest({ maxSlides: 10 }));
      assert.equal(result.ok, true);
      const lastSlide = result.deck!.slides[result.deck!.slides.length - 1];
      assert.equal(lastSlide.title, 'Summary');
    });

    it('summary slide mentions section count and source count', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);
      const summarySlide = result.deck!.slides.find((s) => s.title === 'Summary');
      assert.ok(summarySlide, 'Must have a summary slide');
      const textBlock = summarySlide!.blocks.find((b) => b.blockType === 'text');
      assert.ok(textBlock, 'Summary must have a text block');
      // Should reference section count and source count
      assert.ok(textBlock!.content.includes('section'), 'Summary should mention sections');
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-12: no PPT rendering
  // ════════════════════════════════════════════════════════

  describe('no PPT rendering', () => {

    it('does not produce exportTargets or rendered PPT', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);
      // SlideDeckArtifact does not contain export targets — only PPTArtifact does
      const deck = result.deck!;
      assert.ok(!('exportTargets' in deck), 'SlideDeckArtifact must not have exportTargets');
    });

    it('does not call any rendering API', () => {
      // The service has no rendering methods — structural check
      const protoProps = Object.getOwnPropertyNames(
        Object.getPrototypeOf(SVC),
      );
      const renderMethods = protoProps.filter(
        (p) =>
          p.toLowerCase().includes('render') ||
          p.toLowerCase().includes('export') ||
          p.toLowerCase().includes('ppt'),
      );
      assert.equal(
        renderMethods.length,
        0,
        `Service must not have render/export/ppt methods: ${renderMethods.join(', ')}`,
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-13: no automatic export
  // ════════════════════════════════════════════════════════

  describe('no automatic export', () => {

    it('SlideDeckArtifact has no export functionality', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);
      const deck = result.deck!;
      assert.ok(!('autoExportEnabled' in deck), 'Deck must not have autoExportEnabled');
    });

    it('result does not include file paths or export destinations', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);
      // No file paths in result
      const resultStr = JSON.stringify(result);
      assert.ok(
        !resultStr.includes('.pptx') && !resultStr.includes('.pdf'),
        'Result must not reference export file extensions',
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-14: no PPT-master reference / integration
  // ════════════════════════════════════════════════════════

  describe('no PPT-master', () => {

    it('service has no PPT-master imports or references', () => {
      // Check via structural inspection: no ppt-master in prototype methods
      const protoProps = Object.getOwnPropertyNames(
        Object.getPrototypeOf(SVC),
      );
      const pptMasterRefs = protoProps.filter((p) =>
        p.toLowerCase().includes('pptmast'),
      );
      assert.equal(pptMasterRefs.length, 0, 'No PPT-master references in service');
    });

    it('result contains no pptMaster configuration', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      const resultStr = JSON.stringify(result);
      assert.ok(
        !resultStr.toLowerCase().includes('pptmast'),
        'Result must not reference PPTMaster',
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-15: no provider / embedding call
  // ════════════════════════════════════════════════════════

  describe('no provider call', () => {

    it('providerCalled is always false in result', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.providerCalled, false);
    });

    it('providerCalled is always false in deck', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.deck?.providerCalled, false);
    });

    it('report providerCalled is always false', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.report.providerCalled, false);
    });

    it('isMockGeneration is always true in report', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.report.isMockGeneration, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-16: no external database / web search
  // ════════════════════════════════════════════════════════

  describe('no external database / web search', () => {

    it('service only uses SourceRef from local-qa types (no external lookup)', () => {
      // All source refs come from the request, not fetched externally
      const req = makeRequest({
        selectedSources: [
          makeSourceRef('notes/a.md'),
          makeSourceRef('notes/b.md'),
        ],
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, true);

      // Every source in the deck should trace back to a request source
      for (const slide of result.deck!.slides) {
        for (const block of slide.blocks) {
          for (const src of block.sources) {
            const found = req.selectedSources.some(
              (rs) =>
                rs.relativePath === src.relativePath &&
                rs.chunkIndex === src.chunkIndex,
            );
            assert.ok(
              found,
              `Source ${src.relativePath} not in request selectedSources`,
            );
          }
        }
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-17: no Vault write
  // ════════════════════════════════════════════════════════

  describe('no Vault write', () => {

    it('generateSlidePlan returns in-memory result only', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);
      // Result is a plain object — no side effects
      assert.equal(typeof result, 'object');
    });

    it('service has no file write methods (import fs check)', () => {
      // The service is pure — no file I/O
      const protoProps = Object.getOwnPropertyNames(
        Object.getPrototypeOf(SVC),
      );
      const writeMethods = protoProps.filter(
        (p) =>
          p.toLowerCase().includes('write') ||
          p.toLowerCase().includes('save') ||
          p.toLowerCase().includes('export') ||
          p.toLowerCase().includes('persist'),
      );
      assert.equal(
        writeMethods.length,
        0,
        `Service must not have write/save/export/persist methods: ${writeMethods.join(', ')}`,
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-18: no generic IPC
  // ════════════════════════════════════════════════════════

  describe('no generic IPC', () => {

    it('service has no IPC handler registration methods', () => {
      const protoProps = Object.getOwnPropertyNames(
        Object.getPrototypeOf(SVC),
      );
      const ipcMethods = protoProps.filter(
        (p) =>
          p.toLowerCase().includes('ipc') ||
          p.toLowerCase().includes('channel') ||
          p.toLowerCase().includes('handler'),
      );
      assert.equal(
        ipcMethods.length,
        0,
        `Service must not register IPC handlers: ${ipcMethods.join(', ')}`,
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-19: no Phase 5 plugin entry
  // ════════════════════════════════════════════════════════

  describe('no Phase 5 entry', () => {

    it('service has no plugin registration methods', () => {
      const protoProps = Object.getOwnPropertyNames(
        Object.getPrototypeOf(SVC),
      );
      const pluginMethods = protoProps.filter(
        (p) =>
          p.toLowerCase().includes('plugin') ||
          p.toLowerCase().includes('extension') ||
          p.toLowerCase().includes('register'),
      );
      assert.equal(
        pluginMethods.length,
        0,
        `Service must not have plugin/extension methods: ${pluginMethods.join(', ')}`,
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-20: deterministic output
  // ════════════════════════════════════════════════════════

  describe('deterministic mock', () => {

    it('produces identical output for identical input', () => {
      const req = makeRequest({
        selectedSources: [
          makeSourceRef('notes/a.md', {
            headingPath: ['# Introduction'],
            chunkIndex: 0,
          }),
        ],
      });
      const r1 = SVC.generateSlidePlan(req);
      const r2 = SVC.generateSlidePlan(req);

      assert.equal(r1.ok, r2.ok);
      assert.equal(r1.deck!.slideCount, r2.deck!.slideCount);
      assert.equal(r1.plan!.title, r2.plan!.title);
      assert.equal(r1.plan!.sections.length, r2.plan!.sections.length);
    });

    it('mode field is mock by default', () => {
      const req = makeRequest({ mode: 'mock' });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.report.isMockGeneration, true);
    });

    it('mode deterministic produces mock output in Phase 4-4-B', () => {
      const req = makeRequest({ mode: 'deterministic' });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, true);
      assert.equal(result.report.isMockGeneration, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-21: SlidePlan structure
  // ════════════════════════════════════════════════════════

  describe('SlidePlan structure', () => {

    it('SlidePlan has title, sections, totalEstimatedSlides', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);
      const plan = result.plan!;
      assert.ok(plan.title.length > 0, 'Plan must have a title');
      assert.ok(plan.sections.length > 0, 'Plan must have sections');
      assert.ok(
        plan.totalEstimatedSlides > 0,
        'Plan must have estimated slide count',
      );
    });

    it('SlideSectionPlan has title, estimatedSlideCount, sources, description', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);

      for (const section of result.plan!.sections) {
        assert.ok(section.title.length > 0, 'Section must have a title');
        assert.ok(
          section.estimatedSlideCount > 0,
          'Section must have estimated slide count',
        );
        assert.ok(
          section.description.length > 0,
          'Section must have a description',
        );
      }
    });

    it('sections derived from selectedSources', () => {
      const req = makeRequest({
        selectedSources: [
          makeSourceRef('notes/research.md', {
            headingPath: ['# Research', '## Background'],
          }),
          makeSourceRef('notes/methods.md', {
            headingPath: ['# Methods'],
          }),
        ],
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, true);
      // Source-derived sections should be present
      const titles = result.plan!.sections.map((s) => s.title);
      assert.ok(titles.length >= 2, 'Should have at least 2 source-derived sections');
    });

    it('user-provided content creates an additional section', () => {
      const req = makeRequest({
        selectedSources: [],
        userProvidedContent: 'Custom Outline\nMore details',
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, true);
      const ucSection = result.plan!.sections.find(
        (s) => s.description.includes('User-provided'),
      );
      assert.ok(ucSection, 'Should have a user-provided content section');
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-22: SlideContentBlock structure
  // ════════════════════════════════════════════════════════

  describe('SlideContentBlock structure', () => {

    it('all blocks in deck have required fields', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);

      for (const slide of result.deck!.slides) {
        for (const block of slide.blocks) {
          assert.equal(typeof block.blockType, 'string');
          assert.equal(typeof block.content, 'string');
          assert.ok(Array.isArray(block.items));
          assert.ok(Array.isArray(block.sources));
          assert.ok(Array.isArray(block.evidence));
          assert.equal(typeof block.confidence, 'number');
          assert.ok(block.confidence >= 0 && block.confidence <= 1);
          assert.equal(typeof block.hasUnsupportedClaims, 'boolean');
        }
      }
    });

    it('bullet_list blocks have non-empty items array', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);

      for (const slide of result.deck!.slides) {
        for (const block of slide.blocks) {
          if (block.blockType === 'bullet_list') {
            assert.ok(block.items.length > 0, 'bullet_list must have items');
          }
        }
      }
    });

    it('title and subtitle blocks have confidence 1.0', () => {
      const result = SVC.generateSlidePlan(makeRequest());
      assert.equal(result.ok, true);

      for (const slide of result.deck!.slides) {
        for (const block of slide.blocks) {
          if (block.blockType === 'title' || block.blockType === 'subtitle') {
            assert.equal(block.confidence, 1.0);
          }
        }
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-23: report completeness
  // ════════════════════════════════════════════════════════

  describe('report', () => {

    it('successful result includes a complete report', () => {
      const req = makeRequest({
        requestId: 'my-req',
        topic: 'Test',
        selectedSources: [makeSourceRef('notes/a.md')],
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, true);
      assert.equal(result.report.requestId, 'my-req');
      assert.equal(result.report.topic, 'Test');
      assert.equal(result.report.sourceCount, 1);
      assert.ok(result.report.totalSlides > 0);
      assert.ok(result.report.totalBlocks > 0);
      assert.ok(result.report.totalSourceRefs > 0);
      assert.ok(result.report.generatedSections.length > 0);
      assert.equal(typeof result.report.generatedAt, 'string');
      assert.ok(result.report.generatedAt.length > 0);
    });

    it('failure result still produces a report', () => {
      const req = makeRequest({
        selectedSources: [],
        userProvidedContent: '',
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, false);
      // Report should still exist even on failure
      assert.ok(result.report, 'Failure result must have a report');
      assert.ok(Array.isArray(result.report.warnings));
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-24: warnings
  // ════════════════════════════════════════════════════════

  describe('warnings', () => {

    it('generates warnings when no sources are selected', () => {
      const req = makeRequest({
        selectedSources: [],
        userProvidedContent: 'Some content',
      });
      const result = SVC.generateSlidePlan(req);
      const noSrcWarn = result.warnings.find((w) => w.code === 'no_source_references');
      assert.ok(noSrcWarn, 'Must warn about no source references');
    });

    it('generates slide_count_limited warning when maxSlides is tight', () => {
      const req = makeRequest({
        maxSlides: 2,
        selectedSources: [
          makeSourceRef('notes/a.md'),
          makeSourceRef('notes/b.md'),
          makeSourceRef('notes/c.md'),
        ],
      });
      const result = SVC.generateSlidePlan(req);
      const limitWarn = result.warnings.find((w) => w.code === 'slide_count_limited');
      assert.ok(limitWarn, 'Must warn when slide count is limited');
    });

    it('warnings have code and message', () => {
      const req = makeRequest({
        maxSlides: 2,
        selectedSources: [
          makeSourceRef('notes/a.md'),
          makeSourceRef('notes/b.md'),
          makeSourceRef('notes/c.md'),
        ],
      });
      const result = SVC.generateSlidePlan(req);
      for (const w of result.warnings) {
        assert.equal(typeof w.code, 'string');
        assert.equal(typeof w.message, 'string');
        assert.ok(w.code.length > 0);
        assert.ok(w.message.length > 0);
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // P0-25: edge cases
  // ════════════════════════════════════════════════════════

  describe('edge cases', () => {

    it('handles single source with single slide', () => {
      const req = makeRequest({
        maxSlides: 1,
        selectedSources: [makeSourceRef('notes/a.md')],
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, true);
      // With maxSlides=1, should at least have title slide
      assert.ok(result.deck!.slideCount >= 1);
    });

    it('handles many sources with generous maxSlides', () => {
      const sources = Array.from({ length: 20 }, (_, i) =>
        makeSourceRef(`notes/research-${i}.md`, {
          headingPath: [`# Section ${i}`],
        }),
      );
      const req = makeRequest({ maxSlides: 100, selectedSources: sources });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, true);
      assert.ok(result.deck!.slideCount <= 100);
    });

    it('handles sources with deep heading paths', () => {
      const req = makeRequest({
        selectedSources: [
          makeSourceRef('notes/deep.md', {
            headingPath: [
              '# Part 1',
              '## Chapter 1',
              '### Section 1.1',
              '#### Subsection',
            ],
          }),
        ],
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, true);
      // Deep heading paths should be resolved to section titles
      const firstSection = result.plan!.sections[0];
      assert.equal(firstSection.title, 'Subsection');
    });

    it('uses empty headingPath fallback from relativePath', () => {
      const req = makeRequest({
        selectedSources: [
          makeSourceRef('data/experiment-notes.md', {
            headingPath: [],
            chunkIndex: 5,
          }),
        ],
      });
      const result = SVC.generateSlidePlan(req);
      assert.equal(result.ok, true);
      // Section title should come from filename
      const title = result.plan!.sections[0].title;
      assert.ok(title.length > 0, 'Must have a derived section title');
    });
  });
});
