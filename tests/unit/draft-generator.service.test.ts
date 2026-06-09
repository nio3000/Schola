/**
 * Draft Generator Service Tests — Phase 4-3-B.
 *
 * Validates the DraftGeneratorService against Phase 4-3-TB B-slice P0 requirements.
 * Covers: source pack required, evidence required, context confirmation gate,
 * mock mode, provider gate, SourceRef/EvidenceRef, unsupported claims,
 * no source → insufficient_evidence, safety checks.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type {
  WritingTaskType,
  WritingSourcePack,
  DraftGenerationMode,
  DraftGenerationRequest,
  DraftGenerationResult,
} from '../../src/lib/contracts/research-writing.types';
import type { SourceRef, EvidenceRef } from '../../src/lib/contracts/local-qa.types';
import { createMockWritingDraft } from '../../src/lib/contracts/research-writing.types';
import { DraftGeneratorService } from '../../electron/services/draft-generator.service';

// ── Helpers ────────────────────────────────────────────

function makeSourceRef(relativePath = 'research/intro.md'): SourceRef {
  return { relativePath, chunkIndex: 0, headingPath: ['# Research'], score: 0.9 };
}

function makeEvidenceRef(sourceRelativePath = 'research/intro.md'): EvidenceRef {
  return {
    source: makeSourceRef(sourceRelativePath),
    excerpt: 'Key finding: the experiment confirmed the hypothesis.',
    excerptTokenCount: 8,
  };
}

function makeSourcePack(overrides?: Partial<WritingSourcePack>): WritingSourcePack {
  const sources = overrides?.sources ?? [
    makeSourceRef('research/intro.md'),
    makeSourceRef('research/methods.md'),
    makeSourceRef('research/results.md'),
  ];
  const evidence = overrides?.evidence ?? [
    makeEvidenceRef('research/intro.md'),
    makeEvidenceRef('research/methods.md'),
  ];
  return {
    sources,
    evidence,
    memoryTreeNodes: [],
    compiledMarkdown: null,
    contextPackSummary: {
      scope: {
        type: 'combined',
        selectedFiles: sources.map((s) => ({ relativePath: s.relativePath, displayName: s.relativePath })),
        selectedFolder: undefined,
        wikilinkExpansion: { enabled: false, maxDepth: 1, onlyInsideSelectedScope: true },
      },
      tokenBudget: { fileTokenBudget: 2000, packTokenBudget: 8000 },
      fileCount: sources.length,
      files: sources.map((s) => ({ relativePath: s.relativePath, displayName: s.relativePath, tokenCount: 200, truncated: false })),
      totalTokens: sources.length * 200,
      providerId: '',
      model: '',
      providerDisplayName: '',
      truncatedFileCount: 0,
    },
    totalTokens: sources.length * 200,
    ...overrides,
  };
}

function makeRequest(overrides?: Partial<DraftGenerationRequest>): DraftGenerationRequest {
  return {
    taskType: 'introduction_draft',
    sourcePack: makeSourcePack(),
    contextConfirmationSummary: 'I have reviewed the selected sources and confirm the scope.',
    mode: 'mock',
    ...overrides,
  };
}

// ── B-P0-1: Missing source pack → fail ─────────────────

describe('source pack required', () => {
  it('B-P0-1: missing source pack returns fail with MISSING_SOURCE_PACK', () => {
    const svc = new DraftGeneratorService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentionally testing invalid input
    const result = svc.generateDraft({ sourcePack: undefined as any, taskType: 'introduction_draft', contextConfirmationSummary: '', mode: 'mock' });
    assert.equal(result.ok, false);
    assert.equal(result.draft, null);
    assert.ok(result.errors.some((e) => e.code === 'MISSING_SOURCE_PACK'));
    assert.equal(result.insufficientEvidence, true);
  });
});

// ── B-P0-2: Missing evidence → warning ─────────────────

describe('evidence required', () => {
  it('B-P0-2: no sources → insufficient_evidence and fail', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({
      sourcePack: makeSourcePack({ sources: [], evidence: [] }),
    }));
    assert.equal(result.ok, false);
    assert.equal(result.insufficientEvidence, true);
    assert.ok(result.errors.some((e) => e.code === 'INSUFFICIENT_EVIDENCE'));
  });

  it('B-P0-2b: sources present but no evidence → warning', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({
      sourcePack: makeSourcePack({ evidence: [] }),
    }));
    assert.equal(result.ok, true);
    assert.ok(result.warnings.some((w) => w.code === 'NO_EVIDENCE'));
    assert.ok(result.draft);
  });

  it('B-P0-2c: sources and evidence present → ok, no NO_EVIDENCE warning', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest());
    assert.equal(result.ok, true);
    assert.ok(!result.warnings.some((w) => w.code === 'NO_EVIDENCE'));
  });
});

// ── B-P0-3: Context Confirmation gate ──────────────────

describe('context confirmation required', () => {
  it('B-P0-3: mock mode + empty context confirmation → blocked with NO_CONTEXT_CONFIRMATION', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({
      contextConfirmationSummary: '',
      mode: 'mock',
    }));
    assert.equal(result.ok, false);
    assert.equal(result.draft, null);
    assert.ok(result.errors.some((e) => e.code === 'NO_CONTEXT_CONFIRMATION'));
    assert.equal(result.report.providerCalled, false);
  });

  it('B-P0-3b: provider_gated + empty context confirmation → blocked', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({
      contextConfirmationSummary: '',
      mode: 'provider_gated',
    }));
    assert.equal(result.ok, false);
    assert.equal(result.draft, null);
    assert.ok(result.errors.some((e) => e.code === 'NO_CONTEXT_CONFIRMATION'));
    assert.equal(result.providerGate.contextConfirmed, false);
    assert.equal(result.report.providerCalled, false);
  });

  it('B-P0-3c: mock mode + valid context confirmation → allowed', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({
      contextConfirmationSummary: 'Confirmed',
      mode: 'mock',
    }));
    assert.equal(result.ok, true);
    assert.ok(result.draft);
    assert.equal(result.providerGate.contextConfirmed, true);
  });

  it('B-P0-3d: provider_gated + valid context confirmation → gate passes but providerCalled false', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({
      contextConfirmationSummary: 'Confirmed',
      mode: 'provider_gated',
    }));
    assert.equal(result.providerGate.contextConfirmed, true);
    assert.equal(result.report.providerCalled, false);
  });

  it('B-P0-3e: whitespace-only confirmation is treated as empty', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({
      contextConfirmationSummary: '   ',
      mode: 'mock',
    }));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'NO_CONTEXT_CONFIRMATION'));
  });
});

// ── B-P0-4: Mock mode does not call provider ────────────

describe('mock mode no provider call', () => {
  it('B-P0-4: mock mode produces isMockArtifact: true', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({ mode: 'mock' }));
    assert.equal(result.ok, true);
    assert.ok(result.draft);
    assert.equal(result.draft!.isMockArtifact, true);
    assert.equal(result.draft!.providerId, '');
  });

  it('B-P0-4b: report shows providerCalled: false', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({ mode: 'mock' }));
    assert.equal(result.report.providerCalled, false);
    assert.equal(result.report.isMockGeneration, true);
  });

  it('B-P0-4c: mock mode always has provider gate status blocked', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({ mode: 'mock' }));
    assert.equal(result.providerGate.status, 'blocked');
  });
});

// ── B-P0-5: Provider gated requires BYOK + confirmation ─

describe('provider_gated mode', () => {
  it('B-P0-5: provider_gated with empty context confirmation → blocked with NO_CONTEXT_CONFIRMATION', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({
      mode: 'provider_gated',
      contextConfirmationSummary: '',
    }));
    assert.equal(result.ok, false);
    assert.equal(result.draft, null);
    assert.ok(result.errors.some((e) => e.code === 'NO_CONTEXT_CONFIRMATION'));
    assert.equal(result.providerGate.status, 'blocked');
    assert.equal(result.report.providerCalled, false);
  });

  it('B-P0-5b: provider_gated with context confirmed still has providerCalled: false', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({
      mode: 'provider_gated',
      contextConfirmationSummary: 'Confirmed',
    }));
    assert.equal(result.report.providerCalled, false);
    // BYOK is still false in Phase 4-3-B, so gate should be blocked
  });

  it('B-P0-5c: inspectGate returns correct gate status without generating draft', () => {
    const svc = new DraftGeneratorService();
    const gate = svc.inspectGate(makeRequest({
      mode: 'provider_gated',
      contextConfirmationSummary: 'Confirmed.',
    }));
    assert.equal(gate.contextConfirmed, true);
    assert.equal(gate.byokConfigured, false);
    assert.equal(gate.sourceBacked, true);
    assert.equal(gate.noWholeVault, true);
  });
});

// ── B-P0-6: Generated draft includes SourceRef ──────────

describe('generated draft includes SourceRef', () => {
  it('B-P0-6: every section with sources has SourceRef entries', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest());
    assert.ok(result.draft);
    for (const section of result.draft!.sections) {
      assert.ok(Array.isArray(section.sources));
    }
    const totalSources = result.draft!.sections.reduce((s, sec) => s + sec.sources.length, 0);
    assert.ok(totalSources > 0);
  });

  it('B-P0-6b: SourceRef uses relativePath-only (no absolute path)', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest());
    for (const section of result.draft!.sections) {
      for (const src of section.sources) {
        assert.ok(!src.relativePath.includes(':\\'));
        assert.ok(!src.relativePath.includes('\\\\'));
        assert.ok(!src.relativePath.startsWith('/'));
      }
    }
  });
});

// ── B-P0-7: Generated draft includes EvidenceRef ────────

describe('generated draft includes EvidenceRef', () => {
  it('B-P0-7: sections have evidence refs when evidence is provided', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest());
    assert.ok(result.draft);
    const totalEvidence = result.draft!.sections.reduce((s, sec) => s + sec.evidence.length, 0);
    assert.ok(totalEvidence > 0);
  });

  it('B-P0-7b: evidence refs reference valid source relative paths', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest());
    for (const section of result.draft!.sections) {
      for (const ev of section.evidence) {
        assert.ok(typeof ev.source.relativePath === 'string');
        assert.ok(ev.source.relativePath.length > 0);
      }
    }
  });
});

// ── B-P0-8: Unsupported claim warning ──────────────────

describe('unsupported claim warning', () => {
  it('B-P0-8: sections without sources have unsupported claims', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({
      sourcePack: makeSourcePack({
        sources: [{ relativePath: 'single.md', chunkIndex: 0, headingPath: [], score: 1 }],
        evidence: [],
      }),
      taskType: 'introduction_draft',
    }));
    assert.ok(result.draft);
    // Introduction draft has 2 sections, 1 source → at least 1 section will have no sources
    const sectionsWithUnsupported = result.draft!.sections.filter((s) => s.hasUnsupportedClaims);
    assert.ok(sectionsWithUnsupported.length > 0);
  });

  it('B-P0-8b: unsupported claims trigger UNSUPPORTED_CLAIMS warning', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({
      sourcePack: makeSourcePack({
        sources: [{ relativePath: 'single.md', chunkIndex: 0, headingPath: [], score: 1 }],
        evidence: [],
      }),
      taskType: 'discussion_draft',
    }));
    // Discussion draft has 3 sections with only 1 source → unsupported claims expected
    const hasUnsupportedWarning = result.warnings.some((w) => w.code === 'UNSUPPORTED_CLAIMS');
    if (result.draft!.sections.some((s) => s.hasUnsupportedClaims)) {
      assert.ok(hasUnsupportedWarning);
    }
  });

  it('B-P0-8c: buildUnsupportedClaimGuard returns valid result', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest());
    const guard = svc.buildUnsupportedClaimGuard(result.draft!);
    assert.ok(typeof guard.passes === 'boolean');
    assert.ok(typeof guard.totalClaims === 'number');
    assert.ok(typeof guard.supportedClaims === 'number');
    assert.ok(Array.isArray(guard.unsupportedClaims));
  });
});

// ── B-P0-9: No source → insufficient_evidence ───────────

describe('no source → insufficient_evidence', () => {
  it('B-P0-9: insufficientEvidence flag is true when sources are empty', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({
      sourcePack: makeSourcePack({ sources: [], evidence: [] }),
    }));
    assert.equal(result.insufficientEvidence, true);
  });

  it('B-P0-9b: insufficientEvidence flag is false when sources are present', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest());
    assert.equal(result.insufficientEvidence, false);
  });
});

// ── Draft output invariants ─────────────────────────────

describe('draft output invariants', () => {
  it('draft status is always "draft"', () => {
    const svc = new DraftGeneratorService();
    const allTaskTypes: WritingTaskType[] = [
      'abstract_draft',
      'introduction_draft',
      'methods_draft',
      'results_draft',
      'discussion_draft',
      'conclusion_draft',
      'literature_review_draft',
      'submission_material_draft',
      'general_research_note',
    ];
    for (const taskType of allTaskTypes) {
      const result = svc.generateDraft(makeRequest({ taskType }));
      if (result.draft) {
        assert.equal(result.draft.status, 'draft', `taskType ${taskType} should produce status 'draft'`);
      }
    }
  });

  it('draft id is unique across generations', () => {
    const svc = new DraftGeneratorService();
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const result = svc.generateDraft(makeRequest());
      if (result.draft) ids.add(result.draft.id);
    }
    assert.equal(ids.size, 10);
  });

  it('draft includes citation markers', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest());
    assert.ok(result.draft);
    const allCitations = result.draft!.sections.flatMap((s) => s.citations);
    assert.ok(allCitations.length > 0);
    for (const c of allCitations) {
      assert.ok(typeof c.label === 'string');
      assert.ok(typeof c.position === 'number');
      assert.equal(c.isVerified, false);
    }
  });

  it('createMockWritingDraft produces valid draft with isMockArtifact: true', () => {
    const draft = createMockWritingDraft();
    assert.equal(draft.isMockArtifact, true);
    assert.equal(draft.providerId, '');
    assert.equal(draft.status, 'draft');
  });

  it('generateDraft with title override uses it', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({ title: 'My Custom Title' }));
    assert.equal(result.draft!.title, 'My Custom Title');
  });

  it('generateDraft without title uses default per task type', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({ taskType: 'methods_draft' }));
    assert.ok(result.draft!.title.includes('Methods'));
  });
});

// ── Report invariants ───────────────────────────────────

describe('DraftGenerationReport invariants', () => {
  it('report is always present, even on failure', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({
      sourcePack: makeSourcePack({ sources: [], evidence: [] }),
    }));
    assert.ok(result.report);
    assert.equal(result.report.sourceCount, 0);
    assert.equal(result.report.providerCalled, false);
  });

  it('report.sectionCount matches draft section count', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({ taskType: 'methods_draft' }));
    assert.ok(result.draft);
    assert.equal(result.report.sectionCount, result.draft!.sections.length);
  });

  it('report.isMockGeneration is true for mock mode', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({ mode: 'mock' }));
    assert.equal(result.report.isMockGeneration, true);
  });

  it('report.providerCalled is always false', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({ mode: 'provider_gated' }));
    assert.equal(result.report.providerCalled, false);
  });

  it('report.generatedAt is valid ISO string', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest());
    const date = new Date(result.report.generatedAt);
    assert.ok(!isNaN(date.getTime()));
  });
});

// ── All task types produce valid output ─────────────────

describe('all task types', () => {
  const allTaskTypes: WritingTaskType[] = [
    'abstract_draft',
    'introduction_draft',
    'methods_draft',
    'results_draft',
    'discussion_draft',
    'conclusion_draft',
    'literature_review_draft',
    'submission_material_draft',
    'general_research_note',
  ];

  for (const taskType of allTaskTypes) {
    it(`taskType ${taskType} produces valid draft`, () => {
      const svc = new DraftGeneratorService();
      const result = svc.generateDraft(makeRequest({ taskType }));
      assert.ok(result.ok);
      assert.ok(result.draft);
      assert.equal(result.draft!.taskType, taskType);
      assert.ok(result.draft!.sections.length > 0);
      // content must exist for each section
      for (const section of result.draft!.sections) {
        assert.ok(section.heading.length > 0);
        // content can be empty for sections with no sources, but heading must exist
      }
    });
  }
});

// ── Safety: no Vault write ──────────────────────────────

describe('no Vault write', () => {
  it('B-P0-10: service code contains no file write operations', () => {
    const servicePath = path.resolve(__dirname, '../../electron/services/draft-generator.service.ts');
    const content = fs.readFileSync(servicePath, 'utf8');
    assert.ok(!content.includes('writeFile'));
    assert.ok(!content.includes('saveToVault'));
    assert.ok(!content.includes('fs.write'));
    assert.ok(!content.includes('appendFile'));
  });
});

// ── Safety: no prompt / response logs ──────────────────

describe('no prompt / response logs', () => {
  it('B-P0-11: service code contains no prompt or response logging', () => {
    const servicePath = path.resolve(__dirname, '../../electron/services/draft-generator.service.ts');
    const content = fs.readFileSync(servicePath, 'utf8');
    // Strip comments: both JSDoc (/** ... */) and inline (//)
    const codeOnly = content
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      })
      .join('\n');
    assert.ok(!content.includes('console.log'));
    assert.ok(!codeOnly.includes("'prompt'"));
    assert.ok(!codeOnly.includes('"prompt"'));
    assert.ok(!codeOnly.includes("'response'"));
    assert.ok(!codeOnly.includes('"response"'));
    assert.ok(!codeOnly.includes('messages'));
  });
});

// ── Safety: no fabricated references ────────────────────

describe('no fabricated references', () => {
  it('B-P0-12: service code contains no fake DOI/PMID/journal metadata', () => {
    const servicePath = path.resolve(__dirname, '../../electron/services/draft-generator.service.ts');
    const content = fs.readFileSync(servicePath, 'utf8');
    // Strip comments — JSDoc invariants mention "DOI/PMID/journal"
    const codeOnly = content
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      })
      .join('\n');
    assert.ok(!codeOnly.includes('10.'));
    assert.ok(!codeOnly.includes('PMID'));
    assert.ok(!codeOnly.includes('PubMed'));
    assert.ok(!codeOnly.includes('Crossref'));
    assert.ok(!codeOnly.includes('journal'));
    assert.ok(!codeOnly.includes('doi'));
  });
});

// ── Safety: no generic IPC ──────────────────────────────

describe('no generic IPC', () => {
  it('B-P0-13: service code contains no IPC references', () => {
    const servicePath = path.resolve(__dirname, '../../electron/services/draft-generator.service.ts');
    const content = fs.readFileSync(servicePath, 'utf8');
    assert.ok(!content.includes('ipcMain'));
    assert.ok(!content.includes('ipcRenderer'));
    assert.ok(!content.includes('contextBridge'));
    assert.ok(!content.includes('invoke('));
  });
});

// ── Safety: no real provider call ───────────────────────

describe('no real provider call', () => {
  it('B-P0-14: service code contains no network/SDK imports or calls', () => {
    const servicePath = path.resolve(__dirname, '../../electron/services/draft-generator.service.ts');
    const content = fs.readFileSync(servicePath, 'utf8');
    assert.ok(!content.includes('fetch('));
    assert.ok(!content.includes('axios'));
    assert.ok(!content.includes('openai'));
    assert.ok(!content.includes('anthropic'));
    assert.ok(!content.includes('ollama'));
    assert.ok(!content.includes('gemini'));
    assert.ok(!content.includes('OpenAIClient'));
    assert.ok(!content.includes('AnthropicClient'));
  });
});

// ── Safety: no Phase 4-4 / Phase 5 entry ────────────────

describe('no Phase 4-4 / Phase 5 entry', () => {
  it('B-P0-15: service code has no Phase 4-4 or Phase 5 references', () => {
    const servicePath = path.resolve(__dirname, '../../electron/services/draft-generator.service.ts');
    const content = fs.readFileSync(servicePath, 'utf8');
    // Strip comments for code-only check
    const codeLines = content
      .split('\n')
      .map((l) => {
        const trimmed = l.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) return '';
        return trimmed;
      })
      .filter((l) => l.length > 0)
      .join('\n');
    assert.ok(!codeLines.includes('Phase 4-4'));
    assert.ok(!codeLines.includes('Phase 5'));
    assert.ok(!codeLines.includes('PPT'));
    assert.ok(!codeLines.includes('Multimodal'));
  });
});

// ── Safety: no Phase 4-3-C / 4-3-D entry ────────────────

describe('no entry into downstream services', () => {
  it('B-P0-16: service code does not import CitationRendering or ReferenceGuard', () => {
    const servicePath = path.resolve(__dirname, '../../electron/services/draft-generator.service.ts');
    const content = fs.readFileSync(servicePath, 'utf8');
    assert.ok(!content.includes('CitationRendering'));
    assert.ok(!content.includes('ReferenceGuard'));
    assert.ok(!content.includes('ManuscriptSection'));
    assert.ok(!content.includes('LiteratureReview'));
    assert.ok(!content.includes('SubmissionMaterial'));
    assert.ok(!content.includes('ResearchAgentWorkflow'));
  });
});

// ── Safety: no API Key / secret ─────────────────────────

describe('no API Key / secret', () => {
  it('B-P0-17: service code contains no API key, secret, or password', () => {
    const servicePath = path.resolve(__dirname, '../../electron/services/draft-generator.service.ts');
    const content = fs.readFileSync(servicePath, 'utf8');
    const fieldPatterns = [
      /\bapiKey\b/i,
      /\bAPI_KEY\b/,
      /\bsecret\b(?!\w*Path)/i,
      /\bpassword\b/i,
    ];
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) continue;
      if (trimmed.length === 0) continue;
      for (const pattern of fieldPatterns) {
        if (pattern.test(trimmed)) {
          assert.fail(`Service code contains forbidden field pattern "${pattern}" in: ${line.trim()}`);
        }
      }
    }
  });
});

// ── Safety: no contract misuse ──────────────────────────

describe('contract safety', () => {
  const contractPath = path.resolve(__dirname, '../../src/lib/contracts/research-writing.types.ts');

  it('contract has no Phase 4-4 / Phase 5 in new code', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    const codeOnly = content
      .split('\n')
      .map((l) => {
        const t = l.trim();
        if (t.startsWith('*') || t.startsWith('/*') || t.startsWith('//')) return '';
        return t;
      })
      .filter((l) => l.length > 0)
      .join('\n');
    // Phase 4-4 and Phase 5 may appear only in JSDoc comments (Phase 4-3-B comment header is ok)
    // Actual code lines must not reference them
    assert.ok(!codeOnly.includes('Phase 4-4'));
    assert.ok(!codeOnly.includes('Phase 5'));
  });

  it('contract has no provider SDK references in new code', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    assert.ok(!content.includes('fetch('));
    assert.ok(!content.includes('axios'));
    assert.ok(!content.includes('openai'));
    assert.ok(!content.includes('anthropic'));
  });

  it('contract has no Vault write operations', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    assert.ok(!content.includes('writeFile'));
    assert.ok(!content.includes('saveToVault'));
  });

  it('contract has no generic IPC references', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    assert.ok(!content.includes('ipcMain'));
    assert.ok(!content.includes('ipcRenderer'));
  });

  it('all DraftGenerationResult responses have providerCalled: false in Phase 4-3-B', () => {
    const svc = new DraftGeneratorService();

    // Test mock mode
    const mockResult = svc.generateDraft(makeRequest({ mode: 'mock' }));
    assert.equal(mockResult.report.providerCalled, false);

    // Test provider_gated mode
    const gatedResult = svc.generateDraft(makeRequest({ mode: 'provider_gated', contextConfirmationSummary: 'ok' }));
    assert.equal(gatedResult.report.providerCalled, false);

    // Test failure case
    const failResult = svc.generateDraft(makeRequest({
      sourcePack: makeSourcePack({ sources: [], evidence: [] }),
    }));
    assert.equal(failResult.report.providerCalled, false);
  });
});

// ── Edge cases ──────────────────────────────────────────

describe('edge cases', () => {
  it('single source with evidence produces draft with exactly those refs', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest({
      sourcePack: makeSourcePack({
        sources: [{ relativePath: 'one.md', chunkIndex: 0, headingPath: [], score: 1 }],
        evidence: [{
          source: { relativePath: 'one.md', chunkIndex: 0, headingPath: [], score: 0.9 },
          excerpt: 'Evidence text.',
          excerptTokenCount: 4,
        }],
      }),
      taskType: 'general_research_note',
    }));
    assert.ok(result.ok);
    assert.ok(result.draft);
    const allSources = result.draft!.sections.flatMap((s) => s.sources);
    assert.equal(allSources.length, 1);
    assert.equal(allSources[0].relativePath, 'one.md');
    const allEvidence = result.draft!.sections.flatMap((s) => s.evidence);
    assert.equal(allEvidence.length, 1);
    assert.equal(allEvidence[0].source.relativePath, 'one.md');
  });

  it('usedSources and usedEvidence in result are accurate', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest());
    const totalSrc = result.draft!.sections.reduce((s, sec) => s + sec.sources.length, 0);
    const totalEv = result.draft!.sections.reduce((s, sec) => s + sec.evidence.length, 0);
    assert.equal(result.usedSources, totalSrc);
    assert.equal(result.usedEvidence, totalEv);
  });

  it('isMockArtifact is always true regardless of mode', () => {
    const svc = new DraftGeneratorService();
    const mockResult = svc.generateDraft(makeRequest({ mode: 'mock' }));
    assert.equal(mockResult.draft!.isMockArtifact, true);
    assert.equal(mockResult.draft!.providerId, '');

    // provider_gated that fails gate check still produces draft with isMockArtifact: true
    const gatedResult = svc.generateDraft(makeRequest({
      mode: 'provider_gated',
      contextConfirmationSummary: '',
    }));
    if (gatedResult.draft) {
      assert.equal(gatedResult.draft.isMockArtifact, true);
    }
  });

  it('no file paths are absolute anywhere in the output', () => {
    const svc = new DraftGeneratorService();
    const result = svc.generateDraft(makeRequest());
    const outputStr = JSON.stringify(result);
    assert.ok(!outputStr.includes('L:\\'));
    assert.ok(!outputStr.includes('C:\\'));
    assert.ok(!outputStr.includes('D:\\'));
  });
});
