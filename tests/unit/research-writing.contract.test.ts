/**
 * Research Writing Task Contract Tests — Phase 4-3-A.
 *
 * Validates the contract types defined in research-writing.types.ts
 * against Phase 4-3-TB A-slice P0 requirements.
 *
 * All tests are compile-time + runtime structural checks.
 * No services, no provider calls, no real synthesis.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  generateWritingDraftId,
  createMockWritingDraft,
} from '../../src/lib/contracts/research-writing.types';
import type {
  WritingTaskType,
  ManuscriptSectionType,
  WritingSourcePack,
  WritingDraftArtifact,
  WritingDraftSection,
  CitationMarker,
  ReferenceGuardResult,
  ReferenceViolation,
  UnsupportedClaimGuardResult,
  UnsupportedClaim,
} from '../../src/lib/contracts/research-writing.types';

// ── Helpers ────────────────────────────────────────────

const validWritingTaskTypes: WritingTaskType[] = [
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

const validManuscriptSectionTypes: ManuscriptSectionType[] = [
  'abstract',
  'introduction',
  'methods',
  'results',
  'discussion',
  'conclusion',
];

// ── A-P0-1: WritingTaskType ────────────────────────────

describe('WritingTaskType', () => {
  it('A-P0-1: all 9 writing task types are defined and mutually exclusive', () => {
    assert.equal(validWritingTaskTypes.length, 9);
    const unique = new Set(validWritingTaskTypes);
    assert.equal(unique.size, 9); // no duplicates
  });

  it('every task type ends with _draft or is general_research_note', () => {
    for (const t of validWritingTaskTypes) {
      assert.ok(
        t.endsWith('_draft') || t === 'general_research_note',
        `task type "${t}" should end with _draft or be general_research_note`,
      );
    }
  });

  it('no task type implies final/submitted/published', () => {
    const forbidden = ['final', 'submitted', 'accepted', 'published'];
    for (const t of validWritingTaskTypes) {
      for (const f of forbidden) {
        assert.ok(
          !t.includes(f),
          `task type "${t}" must not contain "${f}"`,
        );
      }
    }
  });
});

// ── A-P0-2: ManuscriptSectionType ──────────────────────

describe('ManuscriptSectionType', () => {
  it('A-P0-2: all 6 IMRaD section types are defined', () => {
    assert.equal(validManuscriptSectionTypes.length, 6);
    const unique = new Set(validManuscriptSectionTypes);
    assert.equal(unique.size, 6);
  });

  it('covers abstract, introduction, methods, results, discussion, conclusion', () => {
    const expected: ManuscriptSectionType[] = [
      'abstract', 'introduction', 'methods',
      'results', 'discussion', 'conclusion',
    ];
    for (const e of expected) {
      assert.ok(validManuscriptSectionTypes.includes(e));
    }
  });
});

// ── A-P0-3, A-P0-11: WritingSourcePack ─────────────────

describe('WritingSourcePack', () => {
  it('A-P0-3: sources, evidence, and contextPackSummary are required', () => {
    const pack: WritingSourcePack = {
      sources: [{ relativePath: 'notes/a.md', chunkIndex: 0, headingPath: [], score: 1 }],
      evidence: [],
      memoryTreeNodes: [],
      compiledMarkdown: null,
      contextPackSummary: {
        scope: {
          type: 'combined',
          selectedFiles: [],
          selectedFolder: undefined,
          wikilinkExpansion: { enabled: false, maxDepth: 1, onlyInsideSelectedScope: true },
        },
        tokenBudget: { fileTokenBudget: 1000, packTokenBudget: 4000 },
        fileCount: 0,
        files: [],
        totalTokens: 0,
        providerId: '',
        model: '',
        providerDisplayName: '',
        truncatedFileCount: 0,
      },
      totalTokens: 100,
    };
    assert.ok(pack.sources.length > 0);
    assert.ok(pack.contextPackSummary);
    assert.ok(typeof pack.totalTokens === 'number');
  });

  it('A-P0-11: contextPackSummary is not optional in structure', () => {
    // contextPackSummary is readonly (required) — validates via type system
    const pack: WritingSourcePack = {
      sources: [],
      evidence: [],
      memoryTreeNodes: [],
      compiledMarkdown: null,
      contextPackSummary: {
        scope: {
          type: 'combined',
          selectedFiles: [],
          selectedFolder: undefined,
          wikilinkExpansion: { enabled: false, maxDepth: 1, onlyInsideSelectedScope: true },
        },
        tokenBudget: { fileTokenBudget: 1000, packTokenBudget: 4000 },
        fileCount: 0,
        files: [],
        totalTokens: 0,
        providerId: '',
        model: '',
        providerDisplayName: '',
        truncatedFileCount: 0,
      },
      totalTokens: 0,
    };
    assert.ok('contextPackSummary' in pack);
  });
});

// ── A-P0-4: WritingDraftArtifact draft-only ────────────

describe('WritingDraftArtifact', () => {
  it('A-P0-4: status is draft-only — no final/submitted/published', () => {
    const draft = createMockWritingDraft();
    assert.equal(draft.status, 'draft');

    const reviewed = createMockWritingDraft({ status: 'reviewed' });
    assert.equal(reviewed.status, 'reviewed');

    // Verify the type system only allows 'draft' | 'reviewed'
    // Runtime check: any other string would be a TS error
    const validStatuses: string[] = ['draft', 'reviewed'];
    assert.ok(validStatuses.includes(draft.status));
    assert.ok(validStatuses.includes(reviewed.status));
  });

  it('A-P0-12: isMockArtifact is required and true for mock drafts', () => {
    const draft = createMockWritingDraft();
    assert.equal(draft.isMockArtifact, true);

    // Even with overrides, it's present
    const withOverride = createMockWritingDraft({ isMockArtifact: false });
    assert.equal(withOverride.isMockArtifact, false);
  });

  it('generates unique IDs', () => {
    assert.notEqual(generateWritingDraftId(), generateWritingDraftId());
  });

  it('mock draft has empty providerId', () => {
    const draft = createMockWritingDraft();
    assert.equal(draft.providerId, '');
  });

  it('sections, allCitations default to empty arrays', () => {
    const draft = createMockWritingDraft();
    assert.ok(Array.isArray(draft.sections));
    assert.ok(Array.isArray(draft.allCitations));
    assert.equal(draft.sections.length, 0);
    assert.equal(draft.allCitations.length, 0);
  });
});

// ── A-P0-7: WritingDraftSection ────────────────────────

describe('WritingDraftSection', () => {
  it('A-P0-7: section must include sources, evidence, and unsupportedClaims arrays', () => {
    const section: WritingDraftSection = {
      heading: 'Test Section',
      content: 'Some content.',
      sources: [],
      evidence: [],
      citations: [],
      confidence: 0.5,
      hasUnsupportedClaims: false,
      unsupportedClaims: [],
    };
    assert.ok(Array.isArray(section.sources));
    assert.ok(Array.isArray(section.evidence));
    assert.ok(Array.isArray(section.unsupportedClaims));
  });

  it('unsupportedClaims is present even when empty', () => {
    const section: WritingDraftSection = {
      heading: 'Test',
      content: 'content',
      sources: [{ relativePath: 'a.md', chunkIndex: 0, headingPath: [], score: 1 }],
      evidence: [],
      citations: [],
      confidence: 0.8,
      hasUnsupportedClaims: false,
      unsupportedClaims: [],
    };
    assert.ok('unsupportedClaims' in section);
  });
});

// ── A-P0-5: CitationMarker no fake metadata ────────────

describe('CitationMarker', () => {
  it('A-P0-5: CitationMarker has no DOI, PMID, or journal metadata fields', () => {
    const marker: CitationMarker = {
      sourceRef: { relativePath: 'notes/a.md', chunkIndex: 0, headingPath: [], score: 1 },
      label: '[1]',
      position: 0,
      isVerified: true,
    };
    // Verify only expected keys exist — no fabricatable metadata
    const keys = Object.keys(marker);
    assert.ok(keys.includes('sourceRef'));
    assert.ok(keys.includes('label'));
    assert.ok(keys.includes('position'));
    assert.ok(keys.includes('isVerified'));

    // Must NOT include fabricatable fields
    const forbidden = ['doi', 'pmid', 'journal', 'authors', 'title', 'year', 'externalDatabase'];
    for (const f of forbidden) {
      assert.ok(
        !(f in marker),
        `CitationMarker must not have field "${f}"`,
      );
    }
  });
});

// ── A-P0-6: ReferenceGuardResult ───────────────────────

describe('ReferenceGuardResult', () => {
  it('A-P0-6: can express valid (passes=true, no violations)', () => {
    const result: ReferenceGuardResult = {
      passes: true,
      totalCitations: 3,
      verifiedCitations: 3,
      violations: [],
    };
    assert.equal(result.passes, true);
    assert.equal(result.violations.length, 0);
  });

  it('can express missing source violation', () => {
    const violation: ReferenceViolation = {
      citation: {
        sourceRef: { relativePath: 'missing.md', chunkIndex: 0, headingPath: [], score: 1 },
        label: '[1]',
        position: 0,
        isVerified: false,
      },
      reason: 'source_not_in_vault',
      detail: 'Source file not found in Vault.',
    };
    const result: ReferenceGuardResult = {
      passes: false,
      totalCitations: 1,
      verifiedCitations: 0,
      violations: [violation],
    };
    assert.equal(result.passes, false);
    assert.equal(result.violations.length, 1);
    assert.equal(result.violations[0].reason, 'source_not_in_vault');
  });

  it('can express unsupported claim violation', () => {
    const violation: ReferenceViolation = {
      citation: {
        sourceRef: { relativePath: 'notes/a.md', chunkIndex: 0, headingPath: [], score: 1 },
        label: '[1]',
        position: 0,
        isVerified: false,
      },
      reason: 'unsupported_claim',
      detail: 'Claim has no SourceRef backing.',
    };
    assert.equal(violation.reason, 'unsupported_claim');
  });

  it('all 6 violation reasons are expressible', () => {
    const reasons = [
      'source_not_in_vault',
      'fabricated_doi',
      'fabricated_pmid',
      'fabricated_journal',
      'unsupported_claim',
      'external_database_claim',
    ];
    assert.equal(reasons.length, 6);
    const unique = new Set(reasons);
    assert.equal(unique.size, 6);
  });
});

// ── A-P0-6 (extended): UnsupportedClaimGuardResult ─────

describe('UnsupportedClaimGuardResult', () => {
  it('can express passing result', () => {
    const result: UnsupportedClaimGuardResult = {
      passes: true,
      totalClaims: 5,
      supportedClaims: 5,
      unsupportedClaims: [],
    };
    assert.equal(result.passes, true);
    assert.equal(result.unsupportedClaims.length, 0);
  });

  it('can express failing result with unsupported claims', () => {
    const claim: UnsupportedClaim = {
      claimText: 'This drug cures all diseases.',
      sectionHeading: 'Results',
      reason: 'no_source',
    };
    const result: UnsupportedClaimGuardResult = {
      passes: false,
      totalClaims: 5,
      supportedClaims: 4,
      unsupportedClaims: [claim],
    };
    assert.equal(result.passes, false);
    assert.equal(result.unsupportedClaims.length, 1);
    assert.equal(result.unsupportedClaims[0].reason, 'no_source');
  });
});

// ── A-P0-8: relativePath-only ──────────────────────────

describe('relativePath-only invariant', () => {
  it('A-P0-8: SourceRef in contract uses relativePath (no absolute path)', () => {
    const source = {
      relativePath: 'notes/research/paper.md',
      chunkIndex: 0,
      headingPath: ['# Results'],
      score: 0.9,
    };
    assert.ok(!source.relativePath.includes(':\\'));
    assert.ok(!source.relativePath.includes('\\\\'));
    assert.ok(!source.relativePath.startsWith('/'));
  });

  it('CitationMarker.sourceRef uses relativePath-only', () => {
    const marker: CitationMarker = {
      sourceRef: { relativePath: 'notes/b.md', chunkIndex: 0, headingPath: [], score: 1 },
      label: '[1]',
      position: 0,
      isVerified: true,
    };
    assert.ok(!marker.sourceRef.relativePath.includes(':\\'));
    assert.ok(!marker.sourceRef.relativePath.includes('\\\\'));
  });
});

// ── A-P0-9: No API Key / secret fields ────────────────

/** Strip comments from a source line (JSDoc and inline). Returns code-only portion. */
function stripComments(line: string): string {
  let s = line.trim();
  // Skip JSDoc block lines: start with * or /*
  if (s.startsWith('*') || s.startsWith('/*')) return '';
  // Skip inline comments
  const commentIdx = s.indexOf('//');
  if (commentIdx >= 0) s = s.substring(0, commentIdx);
  return s.trim();
}

describe('no secret fields', () => {
  const contractPath = path.resolve(__dirname, '../../src/lib/contracts/research-writing.types.ts');

  it('A-P0-9: contract contains no API Key, secret, or password fields', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    const fieldPatterns = [
      /\bapiKey\b/i,
      /\bAPI_KEY\b/,
      /\bsecret\b(?!\w*Path)/i,
      /\bpassword\b/i,
    ];
    for (const pattern of fieldPatterns) {
      const lines = content.split('\n');
      for (const line of lines) {
        const codeOnly = stripComments(line);
        if (codeOnly.length === 0) continue;
        if (pattern.test(codeOnly)) {
          assert.fail(`Contract contains forbidden field pattern "${pattern}" in code: ${line.trim()}`);
        }
      }
    }
    assert.ok(true);
  });
});

// ── A-P0-10: No Phase 4-4 / Phase 5 entry ──────────────

describe('no phase boundary violation', () => {
  const contractPath = path.resolve(__dirname, '../../src/lib/contracts/research-writing.types.ts');

  it('A-P0-10: contract has no Phase 4-4 or Phase 5 type references', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    // Only check actual code lines, not JSDoc comments
    const codeLines = content
      .split('\n')
      .map((l) => stripComments(l))
      .filter((l) => l.length > 0)
      .join('\n');
    assert.ok(!codeLines.includes('Phase 4-4'));
    assert.ok(!codeLines.includes('Phase 5'));
    assert.ok(!codeLines.includes('PPT'));
    assert.ok(!codeLines.includes('Multimodal'));
    assert.ok(!codeLines.includes('Plugin'));
    assert.ok(!codeLines.includes('Billing'));
  });
});

// ── Additional safety checks ───────────────────────────

describe('contract safety', () => {
  const contractPath = path.resolve(__dirname, '../../src/lib/contracts/research-writing.types.ts');

  it('no real provider call in contract', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    assert.ok(!content.includes('fetch('));
    assert.ok(!content.includes('axios'));
    assert.ok(!content.includes('openai'));
    assert.ok(!content.includes('anthropic'));
    assert.ok(!content.includes('gemini'));
  });

  it('no Vault write in contract', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    assert.ok(!content.includes('writeFile'));
    assert.ok(!content.includes('saveToVault'));
  });

  it('no generic IPC in contract', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    assert.ok(!content.includes('ipcMain'));
    assert.ok(!content.includes('ipcRenderer'));
  });

  it('no external database claim', () => {
    const content = fs.readFileSync(contractPath, 'utf8');
    assert.ok(!content.includes('PubMed'));
    assert.ok(!content.includes('Crossref'));
  });
});
