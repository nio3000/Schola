/**
 * Manuscript Section Assistant Service Tests — Phase 4-3-D.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import { ManuscriptSectionAssistantService } from '../../electron/services/manuscript-section-assistant.service';
import type {
  ManuscriptSectionType,
  ManuscriptSectionDraftRequest,
  WritingSourcePack,
} from '../../src/lib/contracts/research-writing.types';

// ── Helpers ────────────────────────────────────────────

function makeSourcePack(
  sources?: { relativePath: string; chunkIndex?: number; headingPath?: string[]; score?: number }[],
  evidence?: { sourceRelativePath: string; excerpt: string }[],
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
  sectionType: ManuscriptSectionType = 'introduction',
  overrides?: Partial<ManuscriptSectionDraftRequest>,
): ManuscriptSectionDraftRequest {
  return {
    sectionType,
    sourcePack: makeSourcePack(),
    contextConfirmationSummary: 'User confirmed sources for this section.',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────

describe('ManuscriptSectionAssistantService', () => {
  const svc = new ManuscriptSectionAssistantService();

  // ── D-P0-1: Abstract draft remains draft ──────────────

  it('D-P0-1: abstract draft remains draft, no final status', () => {
    const result = svc.generateSectionDraft(makeRequest('abstract'));
    assert.ok(result.ok);
    assert.ok(result.draft);
    assert.equal(result.draft!.status, 'draft');
    assert.notEqual(result.draft!.status, 'final');
    assert.notEqual(result.draft!.status, 'submitted');
    assert.notEqual(result.draft!.status, 'published');
    assert.equal(result.draft!.isMockArtifact, true);
  });

  it('abstract with no sources gets warning', () => {
    const result = svc.generateSectionDraft(makeRequest('abstract', {
      sourcePack: makeSourcePack([], []),
    }));
    assert.ok(result.ok);
    assert.ok(result.warnings.some((w) => w.code === 'ABSTRACT_NO_SOURCES'));
  });

  // ── D-P0-2: Introduction cites sources ────────────────

  it('D-P0-2: introduction requires sources for factual background', () => {
    const result = svc.generateSectionDraft(makeRequest('introduction', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/intro-bg.md' },
        { relativePath: 'notes/intro-lit.md' },
      ]),
    }));
    assert.ok(result.ok);
    assert.ok(result.draft);
    assert.ok(result.report.sourceCount >= 1);
  });

  it('introduction with no sources gets warning', () => {
    const result = svc.generateSectionDraft(makeRequest('introduction', {
      sourcePack: makeSourcePack([], []),
    }));
    assert.ok(result.warnings.some((w) => w.code === 'INTRODUCTION_NO_SOURCES'));
  });

  // ── D-P0-3: Methods must not invent ───────────────────

  it('D-P0-3: methods section must not invent methods', () => {
    const result = svc.generateSectionDraft(makeRequest('methods', {
      sourcePack: makeSourcePack(
        [{ relativePath: 'notes/methods.md' }, { relativePath: 'notes/protocol.md' }],
        [{ sourceRelativePath: 'notes/methods.md', excerpt: 'Protocol step 1' }],
      ),
    }));
    assert.ok(result.ok);
    assert.ok(result.warnings.some((w) => w.code === 'METHODS_NO_EVIDENCE') === false);
  });

  it('methods with no sources gets heavy warning', () => {
    const result = svc.generateSectionDraft(makeRequest('methods', {
      sourcePack: makeSourcePack([], []),
    }));
    assert.ok(result.warnings.some((w) => w.code === 'METHODS_NO_SOURCES'));
    assert.ok(result.warnings.some((w) => w.code === 'METHODS_NO_EVIDENCE'));
  });

  it('methods with limited sources warns about invention risk', () => {
    const result = svc.generateSectionDraft(makeRequest('methods', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/single-method.md' }], []),
    }));
    assert.ok(result.warnings.some((w) => w.code === 'METHODS_LOW_SOURCES'));
  });

  // ── D-P0-4: Results must not invent ───────────────────

  it('D-P0-4: results section must not invent results', () => {
    const result = svc.generateSectionDraft(makeRequest('results', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/results.md' }], []),
    }));
    assert.ok(result.ok);
    assert.ok(result.warnings.some((w) => w.code === 'RESULTS_NO_EVIDENCE'));
  });

  it('results with sources and evidence gets minimal warnings', () => {
    const result = svc.generateSectionDraft(makeRequest('results', {
      sourcePack: makeSourcePack(
        [{ relativePath: 'notes/results.md' }],
        [{ sourceRelativePath: 'notes/results.md', excerpt: 'Data point' }],
      ),
    }));
    assert.ok(result.ok);
    assert.ok(!result.warnings.some((w) => w.code === 'RESULTS_NO_SOURCES'));
  });

  // ── D-P0-5: Discussion marks speculative ──────────────

  it('D-P0-5: discussion warns about speculative claims', () => {
    const result = svc.generateSectionDraft(makeRequest('discussion', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/discussion.md' }]),
    }));
    assert.ok(result.ok);
    assert.ok(result.warnings.some((w) => w.code === 'DISCUSSION_SPECULATIVE'));
  });

  // ── D-P0-6: Conclusion cannot exceed evidence ─────────

  it('D-P0-6: conclusion warns when evidence is limited', () => {
    const result = svc.generateSectionDraft(makeRequest('conclusion', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/conclusion.md' }], []),
    }));
    assert.ok(result.ok);
    assert.ok(result.warnings.some((w) => w.code === 'CONCLUSION_LOW_EVIDENCE'));
  });

  it('conclusion with no sources gets warning', () => {
    const result = svc.generateSectionDraft(makeRequest('conclusion', {
      sourcePack: makeSourcePack([], []),
    }));
    assert.ok(result.warnings.some((w) => w.code === 'CONCLUSION_NO_SOURCES'));
  });

  // ── D-P0-7: No source → insufficient_evidence ─────────

  it('D-P0-7: no source → insufficient_evidence warning', () => {
    const result = svc.generateSectionDraft(makeRequest('introduction', {
      sourcePack: makeSourcePack([], []),
    }));
    assert.ok(result.warnings.some((w) => w.code === 'INSUFFICIENT_EVIDENCE'));
  });

  // ── D-P0-8: SourceRef / EvidenceRef preserved ─────────

  it('D-P0-8: generated draft preserves SourceRef and EvidenceRef', () => {
    const result = svc.generateSectionDraft(makeRequest('results', {
      sourcePack: makeSourcePack(
        [{ relativePath: 'notes/r1.md' }, { relativePath: 'notes/r2.md' }],
        [{ sourceRelativePath: 'notes/r1.md', excerpt: 'Finding A' }],
      ),
    }));
    assert.ok(result.draft);
    const totalSources = result.draft!.sections.reduce((s, sec) => s + sec.sources.length, 0);
    const totalEvidence = result.draft!.sections.reduce((s, sec) => s + sec.evidence.length, 0);
    assert.ok(totalSources > 0);
    assert.ok(totalEvidence > 0);
  });

  // ── Integration tests ─────────────────────────────────

  it('guard runs and returns UnsupportedClaimGuardResult', () => {
    const result = svc.generateSectionDraft(makeRequest('introduction'));
    assert.ok(result.guardResult);
    assert.ok(typeof result.guardResult.passes === 'boolean');
  });

  it('citation rendering runs', () => {
    const result = svc.generateSectionDraft(makeRequest('introduction', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/a.md' }]),
    }));
    assert.ok(result.report.citationRenderingRan);
  });

  it('reference guard runs', () => {
    const result = svc.generateSectionDraft(makeRequest('introduction'));
    assert.ok(result.report.referenceGuardRan);
  });

  // ── Error paths ───────────────────────────────────────

  it('missing source pack returns fail', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = svc.generateSectionDraft({ sectionType: 'introduction', sourcePack: undefined as any, contextConfirmationSummary: 'ok' });
    assert.equal(result.ok, false);
    assert.equal(result.draft, null);
    assert.ok(result.errors.some((e) => e.code === 'MISSING_SOURCE_PACK'));
  });

  it('empty context confirmation returns fail', () => {
    const result = svc.generateSectionDraft(makeRequest('introduction', {
      contextConfirmationSummary: '',
    }));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'NO_CONTEXT_CONFIRMATION'));
  });

  // ── All 6 section types ───────────────────────────────

  const allSections: ManuscriptSectionType[] = [
    'abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion',
  ];

  for (const sec of allSections) {
    it(`${sec} section generates valid draft`, () => {
      const result = svc.generateSectionDraft(makeRequest(sec));
      assert.ok(result.ok);
      assert.ok(result.draft);
      assert.equal(result.draft!.isMockArtifact, true);
      assert.equal(result.draft!.status, 'draft');
      assert.equal(result.report.sectionType, sec);
      assert.equal(result.report.providerCalled, false);
    });
  }

  // ── No final manuscript ────────────────────────────────

  it('no final manuscript flag — all outputs are draft', () => {
    for (const sec of allSections) {
      const result = svc.generateSectionDraft(makeRequest(sec));
      assert.equal(result.draft!.status, 'draft');
      assert.notEqual(result.draft!.status, 'final');
      assert.notEqual(result.draft!.status, 'submitted');
      assert.notEqual(result.draft!.status, 'published');
    }
  });
});

// ── Safety tests ─────────────────────────────────────────

describe('manuscript section assistant safety', () => {
  const svcPath = path.resolve(
    __dirname,
    '../../electron/services/manuscript-section-assistant.service.ts',
  );

  it('no provider call: no fetch/axios/openai/anthropic', () => {
    const content = fs.readFileSync(svcPath, 'utf8');
    assert.ok(!content.includes('fetch('));
    assert.ok(!content.includes('axios'));
    assert.ok(!content.includes('openai'));
    assert.ok(!content.includes('anthropic'));
    assert.ok(!content.includes('ollama'));
  });

  it('no Vault write: no writeFile/saveToVault', () => {
    const content = fs.readFileSync(svcPath, 'utf8');
    assert.ok(!content.includes('writeFile'));
    assert.ok(!content.includes('saveToVault'));
  });

  it('no generic IPC', () => {
    const content = fs.readFileSync(svcPath, 'utf8');
    assert.ok(!content.includes('ipcMain'));
    assert.ok(!content.includes('ipcRenderer'));
  });

  it('no Phase 4-4/5 entry', () => {
    const content = fs.readFileSync(svcPath, 'utf8');
    const codeOnly = content
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      })
      .join('\n');
    assert.ok(!codeOnly.includes('Phase 4-4'));
    assert.ok(!codeOnly.includes('Phase 5'));
  });

  it('no API Key / secret', () => {
    const content = fs.readFileSync(svcPath, 'utf8');
    const fieldPatterns = [/\bapiKey\b/i, /\bAPI_KEY\b/, /\bsecret\b(?!\w*Path)/i, /\bpassword\b/i];
    for (const pattern of fieldPatterns) {
      const lines = content.split('\n');
      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
        if (pattern.test(t)) assert.fail(`Forbidden pattern: ${t}`);
      }
    }
  });

  it('no fake reference generation', () => {
    const content = fs.readFileSync(svcPath, 'utf8');
    assert.ok(!content.includes('generateDoi'));
    assert.ok(!content.includes('generatePmid'));
    assert.ok(!content.includes('fabricated'));
  });

  it('no external database lookup', () => {
    const content = fs.readFileSync(svcPath, 'utf8');
    const codeOnly = content
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      })
      .join('\n');
    assert.ok(!codeOnly.includes('PubMed'));
    assert.ok(!codeOnly.includes('Crossref'));
    assert.ok(!codeOnly.includes('OpenAlex'));
  });
});
