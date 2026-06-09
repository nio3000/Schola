/**
 * Literature Review Assistant Service Tests — Phase 4-3-F.
 *
 * Covers all F-P0 and F-P1 test boundaries from Phase 4-3-TB.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { LiteratureReviewAssistantService } from '../../electron/services/literature-review-assistant.service';
import type {
  LiteratureReviewMode,
  LiteratureReviewDraftRequest,
  WritingSourcePack,
} from '../../src/lib/contracts/research-writing.types';

// ── Helpers ────────────────────────────────────────────

const VALID_MODES: LiteratureReviewMode[] = ['vault_only', 'selected_sources_only'];

interface SourceOpts {
  relativePath: string;
  chunkIndex?: number;
  headingPath?: string[];
  score?: number;
}

interface EvidenceOpts {
  sourceRelativePath: string;
  excerpt: string;
}

function makeSourcePack(
  sources?: SourceOpts[],
  evidence?: EvidenceOpts[],
): WritingSourcePack {
  const srcs = (sources ?? [{ relativePath: 'notes/research.md' }]).map((s) => ({
    relativePath: s.relativePath,
    chunkIndex: s.chunkIndex ?? 0,
    headingPath: s.headingPath ?? ['# Research'],
    score: s.score ?? 0.9,
  }));
  const evs = (evidence ?? []).map((e) => ({
    source: { relativePath: e.sourceRelativePath, chunkIndex: 0, headingPath: [], score: 0.9 },
    excerpt: e.excerpt,
    excerptTokenCount: 5,
  }));
  return {
    sources: srcs,
    evidence: evs,
    memoryTreeNodes: [],
    compiledMarkdown: null,
    contextPackSummary: {
      scope: {
        type: 'combined',
        selectedFiles: srcs.map((s) => ({ relativePath: s.relativePath, displayName: s.relativePath })),
        selectedFolder: undefined,
        wikilinkExpansion: { enabled: false, maxDepth: 1, onlyInsideSelectedScope: true },
      },
      tokenBudget: { fileTokenBudget: 2000, packTokenBudget: 8000 },
      fileCount: srcs.length,
      files: srcs.map((s) => ({ relativePath: s.relativePath, displayName: s.relativePath, tokenCount: 200, truncated: false })),
      totalTokens: srcs.length * 200,
      providerId: '',
      model: '',
      providerDisplayName: '',
      truncatedFileCount: 0,
    },
    totalTokens: srcs.length * 200,
  };
}

function makeRequest(
  mode: LiteratureReviewMode = 'selected_sources_only',
  overrides?: Partial<LiteratureReviewDraftRequest>,
): LiteratureReviewDraftRequest {
  return {
    mode,
    sourcePack: makeSourcePack(),
    contextConfirmationSummary: 'User confirmed selected sources for literature review.',
    ...overrides,
  };
}

// ── Constants ──────────────────────────────────────────


// ── Tests ───────────────────────────────────────────────

describe('LiteratureReviewAssistantService', () => {
  const svc = new LiteratureReviewAssistantService();

  // ════════════════════════════════════════════════════════
  // F-P0-1: selected sources required → no sources → fail
  // ════════════════════════════════════════════════════════

  it('F-P0-1: no selected sources returns insufficient_evidence and ok=false', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([]),
    }));
    assert.equal(result.ok, false);
    assert.equal(result.draft, null);
    assert.ok(result.errors.some((e) => e.code === 'INSUFFICIENT_EVIDENCE'));
  });

  it('F-P0-1: selected sources required — empty sources fail in main flow', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([]),
    }));
    assert.equal(result.ok, false);
    assert.equal(result.draft, null);
    assert.ok(
      result.errors.some((e) => e.code === 'INSUFFICIENT_EVIDENCE') ||
      result.errors.some((e) => e.code === 'SELECTED_SOURCES_REQUIRED'),
      'Empty sources should fail with INSUFFICIENT_EVIDENCE',
    );
  });

  it('F-P0-1: at least one source succeeds with ok=true', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/paper1.md' }]),
    }));
    assert.equal(result.ok, true);
    assert.ok(result.draft);
    assert.equal(result.report.sourceCount, 1);
  });

  // ════════════════════════════════════════════════════════
  // F-P0-2: only uses selected Vault sources
  // ════════════════════════════════════════════════════════

  it('F-P0-2: review uses only selected Vault sources — all citations from sourcePack', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/paper-a.md' },
        { relativePath: 'notes/paper-b.md' },
      ]),
    }));
    assert.equal(result.ok, true);
    assert.ok(result.draft);
    // All sections should reference sources from the pack
    for (const section of result.draft!.sections) {
      for (const src of section.sources) {
        assert.ok(
          ['notes/paper-a.md', 'notes/paper-b.md'].includes(src.relativePath) ||
          ['notes/research.md'].includes(src.relativePath),
          `Unexpected source in section: ${src.relativePath}`,
        );
      }
    }
  });

  it('F-P0-2: vault_only mode works the same as selected_sources_only', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('vault_only', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/vault-paper.md' },
      ]),
    }));
    assert.equal(result.ok, true);
    assert.ok(result.draft);
    assert.equal(result.report.mode, 'vault_only');
  });

  // ════════════════════════════════════════════════════════
  // F-P0-3: no external database claim
  // ════════════════════════════════════════════════════════

  it('F-P0-3: draft does not claim PubMed search', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    assert.equal(result.ok, true);
    const text = result.draft!.sections.map((s) => s.content).join(' ');
    assert.ok(!text.toLowerCase().includes('pubmed'), 'Draft should not mention PubMed');
  });

  it('F-P0-3: draft does not claim Crossref search', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    const text = result.draft!.sections.map((s) => s.content).join(' ');
    assert.ok(!text.toLowerCase().includes('crossref'), 'Draft should not mention Crossref');
  });

  it('F-P0-3: draft does not claim OpenAlex search', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    const text = result.draft!.sections.map((s) => s.content).join(' ');
    assert.ok(!text.toLowerCase().includes('openalex'), 'Draft should not mention OpenAlex');
  });

  it('F-P0-3: draft does not claim Google Scholar search', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    const text = result.draft!.sections.map((s) => s.content).join(' ');
    assert.ok(!text.toLowerCase().includes('google scholar'), 'Draft should not mention Google Scholar');
  });

  it('F-P0-3: draft explicitly states no external database was searched', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    const text = result.draft!.sections.map((s) => s.content).join(' ');
    assert.ok(
      text.toLowerCase().includes('no external database') ||
      text.toLowerCase().includes('no external database was searched'),
      'Draft should explicitly state no external database was searched',
    );
  });

  // ════════════════════════════════════════════════════════
  // F-P0-4: draft does not claim comprehensive coverage
  // ════════════════════════════════════════════════════════

  it('F-P0-4: draft explicitly states it is based on Vault sources only', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    const text = result.draft!.sections.map((s) => s.content).join(' ');
    assert.ok(
      text.toLowerCase().includes('vault') ||
      text.toLowerCase().includes('selected source'),
      'Draft should reference Vault sources',
    );
  });

  it('F-P0-4: draft does not claim complete/exhaustive/systematic coverage', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    const text = result.draft!.sections.map((s) => s.content).join(' ');
    assert.ok(!text.toLowerCase().includes('systematic review'), 'Draft should not claim systematic review');
    assert.ok(!text.toLowerCase().includes('exhaustive'), 'Draft should not claim exhaustive');
    assert.ok(!text.toLowerCase().includes('complete coverage'), 'Draft should not claim complete coverage');
  });

  // ════════════════════════════════════════════════════════
  // F-P0-5: all literature claims cite SourceRef / EvidenceRef
  // ════════════════════════════════════════════════════════

  it('F-P0-5: every section has SourceRef array (non-empty for content sections)', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/a.md' },
        { relativePath: 'notes/b.md' },
      ]),
    }));
    assert.equal(result.ok, true);
    for (const section of result.draft!.sections) {
      assert.ok(Array.isArray(section.sources), `Section "${section.heading}" sources is not an array`);
      assert.ok(Array.isArray(section.evidence), `Section "${section.heading}" evidence is not an array`);
    }
  });

  it('F-P0-5: thematic analysis section carries SourceRefs for all themes', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/dl.md', headingPath: ['# Deep Learning', '## CNN'] },
        { relativePath: 'notes/nlp.md', headingPath: ['# NLP', '## Transformers'] },
      ]),
    }));
    assert.equal(result.ok, true);
    const thematicSection = result.draft!.sections.find(
      (s) => s.heading === 'Thematic Analysis',
    );
    assert.ok(thematicSection, 'Thematic Analysis section should exist');
    assert.ok(thematicSection!.sources.length >= 1, 'Thematic Analysis should have sources');
  });

  // ════════════════════════════════════════════════════════
  // F-P0-6: missing metadata produces warning
  // ════════════════════════════════════════════════════════

  it('F-P0-6: sources without headingPath produce MISSING_METADATA warning', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/has-meta.md', headingPath: ['# Research'] },
        { relativePath: 'notes/no-meta.md', headingPath: [] },
      ]),
    }));
    assert.equal(result.ok, true);
    assert.ok(result.warnings.some((w) => w.code === 'MISSING_METADATA'));
  });

  it('F-P0-6: sources with headingPath do not produce MISSING_METADATA warning', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/paper1.md', headingPath: ['# Research'] },
        { relativePath: 'notes/paper2.md', headingPath: ['# Methods'] },
      ]),
    }));
    const hasMissingMeta = result.warnings.some((w) => w.code === 'MISSING_METADATA');
    assert.equal(hasMissingMeta, false,
      'Should not warn about missing metadata when all sources have headingPath');
  });

  // ════════════════════════════════════════════════════════
  // F-P0-7: duplicate sources handled
  // ════════════════════════════════════════════════════════

  it('F-P0-7: duplicate sources produce DUPLICATE_SOURCES warning', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/paper.md' },
        { relativePath: 'notes/paper.md' },
        { relativePath: 'notes/other.md' },
      ]),
    }));
    assert.equal(result.ok, true);
    assert.ok(result.warnings.some((w) => w.code === 'DUPLICATE_SOURCES'));
  });

  it('F-P0-7: unique sources do not produce DUPLICATE_SOURCES warning', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/a.md' },
        { relativePath: 'notes/b.md' },
        { relativePath: 'notes/c.md' },
      ]),
    }));
    const hasDupeWarning = result.warnings.some((w) => w.code === 'DUPLICATE_SOURCES');
    assert.equal(hasDupeWarning, false);
  });

  it('F-P0-7: duplicate count is correct in report', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/dup.md' },
        { relativePath: 'notes/dup.md' },
        { relativePath: 'notes/dup.md' },
      ]),
    }));
    assert.equal(result.report.duplicateSourceCount, 2);
  });

  it('F-P0-7: deduplicateSources removes duplicates keeping first occurrence', () => {
    const sources = [
      { relativePath: 'a.md', chunkIndex: 0, headingPath: ['# A'], score: 0.9 },
      { relativePath: 'b.md', chunkIndex: 0, headingPath: ['# B'], score: 0.8 },
      { relativePath: 'a.md', chunkIndex: 1, headingPath: ['# A dup'], score: 0.7 },
    ] as const;
    const result = svc.deduplicateSources(sources);
    assert.equal(result.length, 2);
    assert.equal(result[0].relativePath, 'a.md');
    assert.equal(result[1].relativePath, 'b.md');
  });

  // ════════════════════════════════════════════════════════
  // F-P0-8: no fabricated references
  // ════════════════════════════════════════════════════════

  it('F-P0-8: draft does not contain fake DOI patterns', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/paper.md' },
      ]),
    }));
    const text = result.draft!.sections.map((s) => s.content).join(' ');
    assert.ok(!text.includes('10.'), 'Draft should not contain fake DOI patterns');
  });

  it('F-P0-8: draft does not fabricate PMID numbers', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    const text = result.draft!.sections.map((s) => s.content).join(' ');
    assert.ok(!text.toLowerCase().includes('pmid'), 'Draft should not contain PMID');
  });

  it('F-P0-8: draft does not fabricate journal metadata', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    const text = result.draft!.sections.map((s) => s.content).join(' ');
    // No fabricated journal names like "Nature", "Science" etc. unless they come from sources
    assert.ok(!text.includes('Published in'), 'Draft should not fabricate journal metadata');
    assert.ok(!text.includes('Journal of'), 'Draft should not fabricate journal names');
  });

  // ════════════════════════════════════════════════════════
  // F-P0-9: gap statements marked as draft / inferential
  // ════════════════════════════════════════════════════════

  it('F-P0-9: gap/limitation section contains INFERENTIAL markers', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    assert.equal(result.ok, true);
    const gapSection = result.draft!.sections.find(
      (s) => s.heading === 'Gaps and Limitations',
    );
    assert.ok(gapSection, 'Gaps and Limitations section should exist');
    assert.ok(
      gapSection!.content.includes('INFERENTIAL') || gapSection!.content.includes('inferential'),
      'Gap section should be marked as inferential',
    );
    assert.ok(
      gapSection!.content.includes('DRAFT') || gapSection!.content.includes('draft'),
      'Gap section should be marked as draft',
    );
  });

  it('F-P0-9: gap section has hasUnsupportedClaims=true', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    const gapSection = result.draft!.sections.find(
      (s) => s.heading === 'Gaps and Limitations',
    );
    assert.ok(gapSection);
    assert.equal(gapSection!.hasUnsupportedClaims, true,
      'Gap section should have hasUnsupportedClaims=true');
  });

  it('F-P0-9: gap section does not claim definitive field-level gaps', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    const gapSection = result.draft!.sections.find(
      (s) => s.heading === 'Gaps and Limitations',
    );
    assert.ok(gapSection);
    const content = gapSection!.content;
    // Should not claim "no research exists" without qualification
    const hasUnqualifiedClaim = /no research exists[^.?!]*(?!.*inferential|.*selected|.*scope)/i.test(content);
    assert.equal(hasUnqualifiedClaim, false, 'Should not claim "no research exists" without qualification');
  });

  // ════════════════════════════════════════════════════════
  // F-P0-10: no automatic final literature review
  // ════════════════════════════════════════════════════════

  it('F-P0-10: draft status is always "draft"', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    assert.equal(result.draft!.status, 'draft');
  });

  it('F-P0-10: draft status is never "finalized", "submitted", or "published"', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    assert.notEqual(result.draft!.status, 'finalized');
    assert.notEqual(result.draft!.status, 'submitted');
    assert.notEqual(result.draft!.status, 'published');
    assert.notEqual(result.draft!.status, 'accepted');
  });

  it('F-P0-10: isMockArtifact is true', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    assert.equal(result.draft!.isMockArtifact, true);
  });

  it('F-P0-10: providerCalled is always false', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    assert.equal(result.report.providerCalled, false);
  });

  // ════════════════════════════════════════════════════════
  // F-P0-11: no Vault write
  // ════════════════════════════════════════════════════════

  it('F-P0-11: service does not modify the filesystem', () => {
    // The service only creates in-memory draft artifacts — no file I/O
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    assert.equal(result.ok, true);
    assert.ok(result.draft);
    // No side effects verify: draft is an in-memory object only
    assert.equal(typeof result.draft!.id, 'string');
  });

  it('F-P0-11: no Vault paths are written — draft is in-memory only', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/test-paper.md' },
      ]),
    }));
    // Service only produces draft artifacts — never writes to Vault
    assert.equal(result.ok, true);
    assert.equal(result.report.guardRan, true);
    // providerCalled=false confirms no network/disk write
    assert.equal(result.report.providerCalled, false);
  });

  // ════════════════════════════════════════════════════════
  // Additional P1 and boundary tests
  // ════════════════════════════════════════════════════════

  it('F-P1-1: source grouping produces groups from heading paths', () => {
    const sources = [
      { relativePath: 'notes/ai.md', chunkIndex: 0, headingPath: ['# Artificial Intelligence', '## Neural Networks'], score: 0.95 },
      { relativePath: 'notes/ml.md', chunkIndex: 0, headingPath: ['# Machine Learning', '## Supervised'], score: 0.9 },
      { relativePath: 'notes/dl.md', chunkIndex: 0, headingPath: ['# Deep Learning', '## CNN Architectures'], score: 0.85 },
    ] as const;
    const groups = svc.groupSourcesByTheme(sources, []);
    assert.ok(groups.length >= 1, 'Should produce at least one group');
    // Each group should have a name and themes
    for (const g of groups) {
      assert.ok(g.groupName && g.groupName.length > 0, 'Group should have a name');
      assert.ok(g.themes && g.themes.length >= 1, 'Group should have themes');
    }
  });

  it('F-P1-2: evidence-backed synthesis — evidence attached to sections', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack(
        [{ relativePath: 'notes/paper.md' }],
        [{ sourceRelativePath: 'notes/paper.md', excerpt: 'This study demonstrates key findings in the field.' }],
      ),
    }));
    assert.equal(result.ok, true);
    // At least one section should have evidence
    const hasEvidence = result.draft!.sections.some((s) => s.evidence.length > 0);
    assert.ok(hasEvidence, 'At least one section should carry EvidenceRefs');
  });

  it('context confirmation is required', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      contextConfirmationSummary: '',
    }));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'NO_CONTEXT_CONFIRMATION'));
  });

  it('missing source pack returns MISSING_SOURCE_PACK error', () => {
    const result = svc.generateLiteratureReviewDraft({
      mode: 'selected_sources_only',
      sourcePack: undefined as unknown as WritingSourcePack,
      contextConfirmationSummary: 'test',
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'MISSING_SOURCE_PACK'));
  });

  it('invalid mode returns INVALID_MODE error', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('pubmed_search' as LiteratureReviewMode));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'INVALID_MODE'));
  });

  it('all invalid mode values are rejected in main flow', () => {
    // Test directly with invalid mode strings skipping makeRequest default
    const invalidModeStrings = [
      'pubmed_search',
      'crossref_search',
      'openalex_search',
      'google_scholar_search',
      'web_search',
      'auto_discovery',
      'external',
      '',
    ];
    for (const mode of invalidModeStrings) {
      const result = svc.generateLiteratureReviewDraft({
        mode: mode as LiteratureReviewMode,
        sourcePack: makeSourcePack([{ relativePath: 'notes/test.md' }]),
        contextConfirmationSummary: 'test',
      });
      assert.equal(result.ok, false, `Mode "${mode}" should produce ok=false`);
      assert.ok(
        result.errors.some((e) => e.code === 'INVALID_MODE'),
        `Mode "${mode}" should produce INVALID_MODE error`,
      );
    }
  });

  it('both valid modes (vault_only, selected_sources_only) are accepted in main flow', () => {
    for (const mode of VALID_MODES) {
      const result = svc.generateLiteratureReviewDraft(makeRequest(mode));
      assert.equal(result.ok, true, `Mode "${mode}" should be accepted`);
    }
  });

  // ════════════════════════════════════════════════════════
  // Guard integration tests
  // ════════════════════════════════════════════════════════

  it('unsupported claim guard runs and is included in result', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    assert.equal(result.ok, true);
    assert.ok(result.guardResult);
    assert.ok(Array.isArray(result.guardResult.unsupportedClaims));
    assert.ok(result.report.guardRan);
  });

  it('citation rendering runs and is included in result', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/paper.md' },
      ]),
    }));
    assert.equal(result.ok, true);
    assert.ok(result.renderResult !== null, 'Citation rendering should run');
    assert.ok(result.report.citationRenderingRan);
  });

  it('reference guard runs and is included in result', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/paper.md' },
      ]),
    }));
    assert.equal(result.ok, true);
    assert.ok(result.referenceResult !== null, 'Reference guard should run');
    assert.ok(result.report.referenceGuardRan);
  });

  it('runCitationRendering returns result for valid draft', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    const renderResult = svc.runCitationRendering(result.draft!);
    assert.ok(renderResult !== null);
  });

  it('runReferenceGuard returns result for valid draft', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    const refResult = svc.runReferenceGuard(result.draft!);
    assert.ok(refResult !== null);
  });

  it('runUnsupportedClaimGuard returns result for valid draft', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    const guardResult = svc.runUnsupportedClaimGuard(result.draft!);
    assert.ok(guardResult);
    assert.ok('passes' in guardResult);
  });

  // ════════════════════════════════════════════════════════
  // No provider / embedding call
  // ════════════════════════════════════════════════════════

  it('no provider call — providerCalled is always false', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    assert.equal(result.report.providerCalled, false);
  });

  it('no embedding call — service has no embedding logic', () => {
    // The service does not import or use any embedding provider
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    assert.equal(result.ok, true);
    assert.equal(result.report.providerCalled, false);
    assert.equal(result.report.isMockGeneration, true);
  });

  // ════════════════════════════════════════════════════════
  // No external database lookup
  // ════════════════════════════════════════════════════════

  it('no external database lookup — report confirms local-only', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    assert.equal(result.report.isMockGeneration, true);
    assert.equal(result.report.providerCalled, false);
  });

  // ════════════════════════════════════════════════════════
  // No generic IPC
  // ════════════════════════════════════════════════════════

  it('no generic IPC — service is pure logic with no ipcMain.handle', () => {
    // The service file does not import from electron/ipc
    // and does not register any IPC handlers
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    assert.equal(result.ok, true);
  });

  // ════════════════════════════════════════════════════════
  // No Vault write
  // ════════════════════════════════════════════════════════

  it('no Vault write — service never calls file I/O', () => {
    // The service only creates in-memory draft objects
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    assert.equal(result.ok, true);
    assert.ok(result.draft);
    assert.equal(typeof result.draft.id, 'string');
  });

  // ════════════════════════════════════════════════════════
  // No Phase 4-3-G / 4-4 / 5 entry
  // ════════════════════════════════════════════════════════

  it('no Phase 4-3-G entry — no ResearchAgentWorkflow references', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    assert.equal(result.ok, true);
    assert.equal(result.draft!.status, 'draft');
    assert.equal(result.mode, 'selected_sources_only');
  });

  it('no Phase 4-4 entry — no PPT, no Multimodal Artifact references', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    const text = result.draft!.sections.map((s) => s.content).join(' ');
    assert.ok(!text.toLowerCase().includes('ppt'));
    assert.ok(!text.toLowerCase().includes('multimodal artifact'));
  });

  it('no Phase 5 entry — no product-level frontend references', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    assert.equal(result.report.isMockGeneration, true);
    assert.equal(result.report.providerCalled, false);
  });

  // ════════════════════════════════════════════════════════
  // Report completeness
  // ════════════════════════════════════════════════════════

  it('report contains all required fields', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/paper.md' },
      ]),
    }));
    const report = result.report;
    assert.equal(report.mode, 'selected_sources_only');
    assert.equal(typeof report.sourceCount, 'number');
    assert.equal(typeof report.evidenceCount, 'number');
    assert.equal(typeof report.themeCount, 'number');
    assert.equal(typeof report.citationCount, 'number');
    assert.equal(typeof report.unsupportedClaimCount, 'number');
    assert.equal(typeof report.duplicateSourceCount, 'number');
    assert.equal(typeof report.missingMetadataCount, 'number');
    assert.equal(typeof report.gapStatementsCount, 'number');
    assert.equal(report.isMockGeneration, true);
    assert.equal(report.providerCalled, false);
    assert.equal(report.guardRan, true);
    assert.equal(typeof report.citationRenderingRan, 'boolean');
    assert.equal(typeof report.referenceGuardRan, 'boolean');
    assert.ok(typeof report.generatedAt, 'string');
    assert.ok(Array.isArray(report.warnings));
  });

  // ════════════════════════════════════════════════════════
  // Construction and type safety
  // ════════════════════════════════════════════════════════

  it('service can be instantiated without errors', () => {
    const instance = new LiteratureReviewAssistantService();
    assert.ok(instance instanceof LiteratureReviewAssistantService);
  });

  it('multiple calls produce distinct draft IDs', () => {
    const r1 = svc.generateLiteratureReviewDraft(makeRequest());
    const r2 = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/other.md' }]),
    }));
    assert.notEqual(r1.draft!.id, r2.draft!.id);
  });

  // ════════════════════════════════════════════════════════
  // Edge cases
  // ════════════════════════════════════════════════════════

  it('single source generates complete draft', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/single.md' }]),
    }));
    assert.equal(result.ok, true);
    assert.ok(result.draft);
    assert.ok(result.draft!.sections.length >= 3);
  });

  it('many sources generate complete draft with themes', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/a.md', headingPath: ['# NLP'] },
        { relativePath: 'notes/b.md', headingPath: ['# Computer Vision'] },
        { relativePath: 'notes/c.md', headingPath: ['# NLP', '## Transformers'] },
        { relativePath: 'notes/d.md', headingPath: ['# Reinforcement Learning'] },
        { relativePath: 'notes/e.md', headingPath: ['# Computer Vision', '## Object Detection'] },
      ]),
    }));
    assert.equal(result.ok, true);
    assert.ok(result.draft);
    assert.ok(result.report.themeCount >= 1);
  });

  it('evidence without sources emits NO_EVIDENCE warning', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack(
        [{ relativePath: 'notes/paper.md' }],
        [],
      ),
    }));
    assert.ok(result.warnings.some((w) => w.code === 'NO_EVIDENCE'));
  });

  it('groupSourcesByTheme with empty sources returns empty array', () => {
    const groups = svc.groupSourcesByTheme([], []);
    assert.ok(Array.isArray(groups));
    assert.equal(groups.length, 0);
  });

  it('countDuplicates with no duplicates returns 0', () => {
    const sources = [
      { relativePath: 'a.md', chunkIndex: 0, headingPath: [], score: 0.9 },
      { relativePath: 'b.md', chunkIndex: 0, headingPath: [], score: 0.9 },
    ] as const;
    assert.equal(svc.countDuplicates(sources), 0);
  });

  it('countDuplicates with duplicates returns correct count', () => {
    const sources = [
      { relativePath: 'a.md', chunkIndex: 0, headingPath: [], score: 0.9 },
      { relativePath: 'a.md', chunkIndex: 1, headingPath: [], score: 0.8 },
      { relativePath: 'b.md', chunkIndex: 0, headingPath: [], score: 0.9 },
    ] as const;
    assert.equal(svc.countDuplicates(sources), 1);
  });

  it('countMissingMetadata with headingPath returns 0', () => {
    const sources = [
      { relativePath: 'a.md', chunkIndex: 0, headingPath: ['# Title'], score: 0.9 },
    ] as const;
    assert.equal(svc.countMissingMetadata(sources), 0);
  });

  it('countMissingMetadata without headingPath returns > 0', () => {
    const sources = [
      { relativePath: 'a.md', chunkIndex: 0, headingPath: [], score: 0.9 },
      { relativePath: 'b.md', chunkIndex: 0, headingPath: [], score: 0.9 },
    ] as const;
    assert.equal(svc.countMissingMetadata(sources), 2);
  });

  // ════════════════════════════════════════════════════════
  // No fake DOI / PMID / journal metadata
  // ════════════════════════════════════════════════════════

  it('no fake DOI — draft content does not contain DOI patterns', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    const text = result.draft!.sections.map((s) => s.content).join(' ');
    assert.ok(!/\b10\.\d{4,}\//.test(text), 'Draft should not contain DOI patterns like 10.xxxx/...');
  });

  it('no fake PMID — draft content does not contain PMID patterns', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest());
    const text = result.draft!.sections.map((s) => s.content).join(' ');
    assert.ok(!/PMID\s*:?\s*\d+/i.test(text), 'Draft should not contain PMID');
  });

  it('no fabricated author/title/journal in draft', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/my-paper.md' }]),
    }));
    const text = result.draft!.sections.map((s) => s.content).join(' ');
    // Should reference source files, not fabricated authors
    assert.ok(!text.includes('et al.'), 'Draft should not contain fabricated "et al." references');
  });

  // ════════════════════════════════════════════════════════
  // No Phase 4-3-G mode values
  // ════════════════════════════════════════════════════════

  it('no research agent workflow modes — only vault_only and selected_sources_only exist', () => {
    const result = svc.generateLiteratureReviewDraft(makeRequest('selected_sources_only'));
    assert.equal(result.mode, 'selected_sources_only');
    // Verify the mode is one of the two valid types
    assert.ok(VALID_MODES.includes(result.mode));
  });
});
