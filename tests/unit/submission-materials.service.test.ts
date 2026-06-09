/**
 * Submission Materials Service Tests — Phase 4-3-E.
 *
 * Covers all E-P0 and E-P1 test boundaries from Phase 4-3-TB.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import { SubmissionMaterialsService } from '../../electron/services/submission-materials.service';
import type {
  SubmissionMaterialType,
  SubmissionMaterialRequest,
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
  materialType: SubmissionMaterialType = 'cover_letter',
  overrides?: Partial<SubmissionMaterialRequest>,
): SubmissionMaterialRequest {
  return {
    materialType,
    sourcePack: makeSourcePack(),
    contextConfirmationSummary: 'User confirmed sources for this material.',
    ...overrides,
  };
}

// ── Constants ──────────────────────────────────────────

const allMaterialTypes: SubmissionMaterialType[] = [
  'cover_letter',
  'response_to_reviewers',
  'highlights',
  'title_suggestion',
  'author_contribution',
  'conflict_of_interest',
  'funding_statement',
  'ethics_statement',
];

// ── Tests ───────────────────────────────────────────────

describe('SubmissionMaterialsService', () => {
  const svc = new SubmissionMaterialsService();

  // ════════════════════════════════════════════════════════
  // E-P0-1: cover letter draft only
  // ════════════════════════════════════════════════════════

  it('E-P0-1: cover letter draft only, status is draft', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('cover_letter'));
    assert.ok(result.ok);
    assert.ok(result.draft);
    assert.equal(result.draft!.status, 'draft');
    assert.notEqual(result.draft!.status, 'submitted');
    assert.notEqual(result.draft!.status, 'accepted');
    assert.notEqual(result.draft!.status, 'published');
    assert.notEqual(result.draft!.status, 'final');
    assert.equal(result.draft!.isMockArtifact, true);
  });

  it('cover letter contains manuscript summary based on sources', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('cover_letter', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/manuscript.md' },
        { relativePath: 'notes/figures.md' },
      ]),
    }));
    assert.ok(result.ok);
    assert.ok(result.draft);
    assert.ok(result.draft!.sections.length >= 2);
    assert.ok(result.report.sourceCount >= 1);
  });

  it('cover letter with sources and evidence maintains draft status', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('cover_letter', {
      sourcePack: makeSourcePack(
        [{ relativePath: 'notes/a.md' }],
        [{ sourceRelativePath: 'notes/a.md', excerpt: 'Key finding' }],
      ),
    }));
    assert.equal(result.draft!.status, 'draft');
    assert.equal(result.report.providerCalled, false);
  });

  // ════════════════════════════════════════════════════════
  // E-P0-2: response to reviewers requires user-provided comments
  // ════════════════════════════════════════════════════════

  it('E-P0-2: response to reviewers requires user-provided reviewer comments', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('response_to_reviewers', {
      reviewerComments: [],
    }));
    assert.equal(result.ok, false);
    assert.equal(result.draft, null);
    assert.ok(result.errors.some((e) => e.code === 'REVIEWER_COMMENTS_REQUIRED'));
  });

  it('response to reviewers with comments succeeds', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('response_to_reviewers', {
      reviewerComments: ['The abstract should be more concise.', 'Methods section lacks detail.'],
    }));
    assert.ok(result.ok);
    assert.ok(result.draft);
    assert.equal(result.draft!.status, 'draft');
    assert.equal(result.report.reviewerCommentsProvided, true);
  });

  it('response to reviewers with missing reviewerComments field fails', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('response_to_reviewers', {
      reviewerComments: undefined,
    }));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'REVIEWER_COMMENTS_REQUIRED'));
  });

  // ════════════════════════════════════════════════════════
  // E-P0-3: no reviewer comments → cannot fabricate response target
  // ════════════════════════════════════════════════════════

  it('E-P0-3: no reviewer comment → cannot fabricate response target', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('response_to_reviewers', {
      reviewerComments: [],
    }));
    assert.equal(result.ok, false);
    assert.equal(result.draft, null);
    assert.ok(result.errors.some((e) => e.code === 'REVIEWER_COMMENTS_REQUIRED'));
  });

  it('no reviewer comments — draft is null', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('response_to_reviewers'));
    assert.equal(result.draft, null);
  });

  // ════════════════════════════════════════════════════════
  // E-P0-4: journal policy claim requires source
  // ════════════════════════════════════════════════════════

  it('E-P0-4: journal policy claim requires source', () => {
    const guardErrors = svc.guardJournalPolicyClaim({
      ...makeRequest('cover_letter'),
      journalPolicyClaim: { claim: 'This journal requires X.', source: '' },
    });
    assert.ok(guardErrors.some((e) => e.code === 'JOURNAL_POLICY_CLAIM_NO_SOURCE'));
  });

  it('journal policy claim with source passes guard', () => {
    const guardErrors = svc.guardJournalPolicyClaim({
      ...makeRequest('cover_letter'),
      journalPolicyClaim: { claim: 'This journal requires structured abstracts.', source: 'journal-guidelines.md' },
    });
    assert.equal(guardErrors.length, 0);
  });

  // ════════════════════════════════════════════════════════
  // E-P0-5: journal policy claim blocked
  // ════════════════════════════════════════════════════════

  it('E-P0-5: journal policy claim with empty source is blocked', () => {
    const guardErrors = svc.guardJournalPolicyClaim({
      ...makeRequest('cover_letter'),
      journalPolicyClaim: { claim: 'Policy text', source: '   ' },
    });
    assert.ok(guardErrors.some((e) => e.code === 'JOURNAL_POLICY_CLAIM_NO_SOURCE'));
  });

  it('journal policy claim with empty claim text is flagged', () => {
    const guardErrors = svc.guardJournalPolicyClaim({
      ...makeRequest('cover_letter'),
      journalPolicyClaim: { claim: '', source: 'source.md' },
    });
    assert.ok(guardErrors.some((e) => e.code === 'JOURNAL_POLICY_CLAIM_EMPTY'));
  });

  it('journal policy claim with fake journal metadata is rejected', () => {
    const guardErrors = svc.guardJournalPolicyClaim({
      ...makeRequest('cover_letter'),
      journalPolicyClaim: { claim: 'Journal of Science requires X.', source: 'source.md' },
    });
    assert.ok(guardErrors.some((e) => e.code === 'FAKE_JOURNAL_METADATA'));
  });

  // ════════════════════════════════════════════════════════
  // E-P0-6: no automatic submission
  // ════════════════════════════════════════════════════════

  it('E-P0-6: no automatic submission — no submit/send API', () => {
    const svcKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(svc));
    const submitMethods = svcKeys.filter((k) =>
      k.toLowerCase().includes('submit') || k.toLowerCase().includes('send'),
    );
    assert.equal(submitMethods.length, 0, 'Found submit/send methods');
  });

  it('all results have draft status, never submitted', () => {
    for (const mt of allMaterialTypes) {
      const overrides = mt === 'response_to_reviewers'
        ? { reviewerComments: ['Comment 1.'] }
        : {};
      const result = svc.generateSubmissionMaterial(makeRequest(mt, overrides));
      if (result.ok && result.draft) {
        assert.notEqual(result.draft.status, 'submitted', `${mt} must not be submitted`);
        assert.notEqual(result.draft.status, 'accepted', `${mt} must not be accepted`);
        assert.notEqual(result.draft.status, 'published', `${mt} must not be published`);
      }
    }
  });

  // ════════════════════════════════════════════════════════
  // E-P0-7: no fake journal metadata
  // ════════════════════════════════════════════════════════

  it('E-P0-7: no fake journal metadata in cover letter content', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('cover_letter'));
    assert.ok(result.ok);
    assert.ok(result.draft);
    const allText = result.draft!.sections.map((s) => s.content).join(' ');
    assert.ok(!allText.includes('ISSN'), 'Must not contain ISSN');
    assert.ok(!allText.includes('Impact Factor'), 'Must not contain Impact Factor');
    assert.ok(!allText.includes('Publisher:'), 'Must not contain Publisher metadata');
  });

  it('no fake journal metadata in any material type', () => {
    for (const mt of allMaterialTypes) {
      const overrides = mt === 'response_to_reviewers'
        ? { reviewerComments: ['Test.'] }
        : {};
      const result = svc.generateSubmissionMaterial(makeRequest(mt, overrides));
      if (result.ok && result.draft) {
        const allText = result.draft!.sections.map((s) => s.content).join(' ');
        assert.ok(!allText.includes('DOI:'), `${mt} must not contain fake DOI`);
        assert.ok(!allText.includes('PMID:'), `${mt} must not contain fake PMID`);
      }
    }
  });

  // ════════════════════════════════════════════════════════
  // E-P0-8: ethics / funding / COI placeholders
  // ════════════════════════════════════════════════════════

  it('E-P0-8: COI statement is placeholder when no facts provided', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('conflict_of_interest'));
    assert.ok(result.ok);
    assert.ok(result.draft);
    assert.equal(result.draft!.status, 'draft');
    assert.equal(result.draft!.isMockArtifact, true);
    const content = result.draft!.sections[0].content;
    assert.ok(content.includes('placeholder') || content.includes('Placeholder'),
      'COI must show placeholder, not default declaration');
  });

  it('COI with user facts generates non-placeholder', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('conflict_of_interest', {
      conflictOfInterestFacts: ['Author A is a consultant for Company X.'],
    }));
    assert.ok(result.ok);
    assert.ok(result.draft);
    assert.equal(result.draft!.status, 'draft');
  });

  it('funding statement is placeholder when no facts provided', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('funding_statement'));
    assert.ok(result.ok);
    assert.ok(result.draft);
    assert.equal(result.draft!.status, 'draft');
    assert.equal(result.draft!.isMockArtifact, true);
  });

  it('ethics statement is placeholder when no facts provided', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('ethics_statement'));
    assert.ok(result.ok);
    assert.ok(result.draft);
    assert.equal(result.draft!.status, 'draft');
    assert.equal(result.draft!.isMockArtifact, true);
  });

  it('ethics statement with user facts generates non-placeholder', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('ethics_statement', {
      ethicsFacts: ['Approval obtained from Institutional Review Board.'],
    }));
    assert.ok(result.ok);
    assert.ok(result.draft);
    assert.equal(result.draft!.status, 'draft');
    const totalUnsupported = result.draft!.sections.reduce(
      (sum, s) => sum + s.unsupportedClaims.length, 0,
    );
    assert.equal(totalUnsupported, 0);
  });

  it('funding placeholder warns about unsupported claims', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('funding_statement'));
    assert.ok(result.ok);
    const totalUnsupported = result.draft!.sections.reduce(
      (sum, s) => sum + s.unsupportedClaims.length, 0,
    );
    assert.ok(totalUnsupported > 0, 'Funding placeholder must flag unsupported claims');
  });

  it('COI placeholder warns about unsupported claims', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('conflict_of_interest'));
    assert.ok(result.ok);
    const totalUnsupported = result.draft!.sections.reduce(
      (sum, s) => sum + s.unsupportedClaims.length, 0,
    );
    assert.ok(totalUnsupported > 0, 'COI placeholder must flag unsupported claims');
  });

  // ════════════════════════════════════════════════════════
  // E-P0-9: source-backed manuscript summary
  // ════════════════════════════════════════════════════════

  it('E-P0-9: source-backed manuscript summary reports source count', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('cover_letter', {
      sourcePack: makeSourcePack([
        { relativePath: 'notes/chapter1.md' },
        { relativePath: 'notes/chapter2.md' },
        { relativePath: 'notes/chapter3.md' },
      ]),
    }));
    assert.ok(result.ok);
    assert.equal(result.report.sourceCount, 3);
  });

  it('manuscript summary without sources gets insufficient evidence warning', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('cover_letter', {
      sourcePack: makeSourcePack([], []),
    }));
    assert.ok(result.warnings.some((w) => w.code === 'INSUFFICIENT_EVIDENCE'));
  });

  it('cover letter with evidence reports evidence count', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('cover_letter', {
      sourcePack: makeSourcePack(
        [{ relativePath: 'notes/study.md' }],
        [{ sourceRelativePath: 'notes/study.md', excerpt: 'Study finding 1' }],
      ),
    }));
    assert.ok(result.ok);
    assert.equal(result.report.evidenceCount, 1);
  });

  // ════════════════════════════════════════════════════════
  // E-P0-10: no Vault overwrite
  // ════════════════════════════════════════════════════════

  it('E-P0-10: no Vault write — generateSubmissionMaterial returns in-memory artifact', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('cover_letter'));
    assert.ok(result.draft);
    assert.equal(result.draft!.isMockArtifact, true);
  });

  // ════════════════════════════════════════════════════════
  // Additional safety: no fabricated facts
  // ════════════════════════════════════════════════════════

  it('no fabricated funding facts — placeholder only when no facts', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('funding_statement'));
    const content = result.draft!.sections[0].content;
    assert.ok(!content.includes('NSF-'), 'Must not fabricate NSF grant number');
    assert.ok(!content.includes('NIH R'), 'Must not fabricate NIH grant number');
    // Template placeholder text "Grant No." is instruction, not fabrication
    assert.ok(!/Grant\s+No\.\s+\d/.test(content), 'Must not fabricate specific grant number');
  });

  it('no fabricated ethics approval — placeholder only', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('ethics_statement'));
    const content = result.draft!.sections[0].content;
    assert.ok(!content.includes('IRB-20'), 'Must not fabricate IRB number');
    assert.ok(!content.includes('Approval No.'), 'Must not fabricate approval number');
  });

  it('no fabricated author contribution — placeholder when no facts', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('author_contribution'));
    const content = result.draft!.sections[0].content;
    assert.ok(content.includes('placeholder') || content.includes('Placeholder'),
      'Author contribution must show placeholder');
  });

  it('no fabricated reviewer comments — blocked without input', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('response_to_reviewers'));
    assert.equal(result.ok, false);
    assert.equal(result.draft, null);
  });

  it('highlights remain editable draft', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('highlights', {
      sourcePack: makeSourcePack(
        [{ relativePath: 'notes/study.md' }],
        [{ sourceRelativePath: 'notes/study.md', excerpt: 'Finding A' }],
      ),
    }));
    assert.ok(result.ok);
    assert.equal(result.draft!.status, 'draft');
    assert.equal(result.draft!.isMockArtifact, true);
  });

  it('title suggestion generates candidate titles only', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('title_suggestion'));
    assert.ok(result.ok);
    assert.equal(result.draft!.status, 'draft');
    assert.equal(result.report.providerCalled, false);
    // Must not claim journal preference
    const content = result.draft!.sections[0].content;
    assert.ok(!content.includes('preferred by'), 'Must not claim journal preference');
    assert.ok(!content.includes('recommended for'), 'Must not recommend journal');
  });

  it('author contribution with facts generates populated draft', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('author_contribution', {
      authorContributionFacts: [
        'A. Smith: Conceptualization, Writing - Original Draft',
        'B. Jones: Methodology, Data Curation',
      ],
    }));
    assert.ok(result.ok);
    const content = result.draft!.sections[0].content;
    assert.ok(content.includes('A. Smith'));
    assert.ok(content.includes('B. Jones'));
  });

  // ════════════════════════════════════════════════════════
  // Integration tests: guards run
  // ════════════════════════════════════════════════════════

  it('guard runs and returns UnsupportedClaimGuardResult', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('cover_letter'));
    assert.ok(result.guardResult);
    assert.ok(typeof result.guardResult.passes === 'boolean');
  });

  it('citation rendering runs', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('cover_letter', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/a.md' }]),
    }));
    assert.ok(result.report.citationRenderingRan);
  });

  it('reference guard runs', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('cover_letter'));
    assert.ok(result.report.referenceGuardRan);
  });

  // ════════════════════════════════════════════════════════
  // Error paths
  // ════════════════════════════════════════════════════════

  it('missing source pack returns fail', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = svc.generateSubmissionMaterial({
      materialType: 'cover_letter',
      sourcePack: undefined as any,
      contextConfirmationSummary: 'ok',
    });
    assert.equal(result.ok, false);
    assert.equal(result.draft, null);
    assert.ok(result.errors.some((e) => e.code === 'MISSING_SOURCE_PACK'));
  });

  it('empty context confirmation returns fail', () => {
    const result = svc.generateSubmissionMaterial(makeRequest('cover_letter', {
      contextConfirmationSummary: '',
    }));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'NO_CONTEXT_CONFIRMATION'));
  });

  // ════════════════════════════════════════════════════════
  // All 8 material types generate valid drafts
  // ════════════════════════════════════════════════════════

  for (const mt of allMaterialTypes) {
    it(`${mt} generates valid draft`, () => {
      const overrides = mt === 'response_to_reviewers'
        ? { reviewerComments: ['Reviewer comment 1.', 'Reviewer comment 2.'] }
        : {};
      const result = svc.generateSubmissionMaterial(makeRequest(mt, overrides));
      assert.ok(result.ok, `${mt} generation must succeed`);
      assert.ok(result.draft, `${mt} must produce draft`);
      assert.equal(result.draft!.isMockArtifact, true, `${mt} must be mock artifact`);
      assert.equal(result.draft!.status, 'draft', `${mt} must be draft status`);
      assert.equal(result.report.materialType, mt);
      assert.equal(result.report.providerCalled, false);
    });
  }

  // ════════════════════════════════════════════════════════
  // No final submission status across all types
  // ════════════════════════════════════════════════════════

  it('no final submission status — all outputs are draft only', () => {
    for (const mt of allMaterialTypes) {
      const overrides = mt === 'response_to_reviewers'
        ? { reviewerComments: ['Comment.'] }
        : {};
      const result = svc.generateSubmissionMaterial(makeRequest(mt, overrides));
      assert.equal(result.draft!.status, 'draft');
      assert.notEqual(result.draft!.status, 'final');
      assert.notEqual(result.draft!.status, 'submitted');
      assert.notEqual(result.draft!.status, 'accepted');
      assert.notEqual(result.draft!.status, 'published');
    }
  });
});

// ════════════════════════════════════════════════════════
// Safety tests
// ════════════════════════════════════════════════════════

describe('submission materials assistant safety', () => {
  const svcPath = path.resolve(
    __dirname,
    '../../electron/services/submission-materials.service.ts',
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
    assert.ok(!content.includes('fs.write'));
    assert.ok(!content.includes('writeFileSync'));
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
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) continue;
        if (pattern.test(trimmedLine)) {
          assert.fail(`Found potential secret pattern: ${trimmedLine}`);
        }
      }
    }
  });

  it('no external database lookup', () => {
    const content = fs.readFileSync(svcPath, 'utf8');
    const dbPatterns = [/pubmed/i, /crossref/i, /openalex/i, /semantic\s*scholar/i, /google\s*scholar/i];
    const codeOnly = content
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      })
      .join('\n');
    for (const pattern of dbPatterns) {
      if (pattern.test(codeOnly)) {
        assert.fail(`Found external database reference: ${pattern.source}`);
      }
    }
  });
});
