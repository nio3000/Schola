/**
 * Reference Guard Service Tests — Phase 4-3-C.
 *
 * Validates ReferenceGuardService against Phase 4-3-TB C-slice P0 requirements.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import { ReferenceGuardService } from '../../electron/services/reference-guard.service';
import type {
  WritingDraftArtifact,
  WritingDraftSection,
  CitationMarker,
  ReferenceViolation,
} from '../../src/lib/contracts/research-writing.types';
import { createMockWritingDraft } from '../../src/lib/contracts/research-writing.types';
import type { SourceRef } from '../../src/lib/contracts/local-qa.types';

// ── Helpers ────────────────────────────────────────────

function makeSourceRef(relativePath = 'notes/research.md'): SourceRef {
  return { relativePath, chunkIndex: 0, headingPath: ['# Research'], score: 0.9 };
}

function makeCitationMarker(source?: SourceRef, label?: string): CitationMarker {
  return {
    sourceRef: source ?? makeSourceRef(),
    label: label ?? '[Source: notes/research.md]',
    position: 0,
    isVerified: false,
  };
}

function makeSection(heading: string, content: string, citations: CitationMarker[]): WritingDraftSection {
  return {
    heading,
    content,
    sources: citations.map((c) => ({ ...c.sourceRef })),
    evidence: [],
    citations,
    confidence: 0.8,
    hasUnsupportedClaims: false,
    unsupportedClaims: [],
  };
}

function makeDraft(sections: WritingDraftSection[]): WritingDraftArtifact {
  const allCitations = sections.flatMap((s) => s.citations);
  return {
    ...createMockWritingDraft(),
    sections,
    allCitations,
  };
}

// ── C-P0-5: Fake DOI is blocked ────────────────────────

describe('ReferenceGuardService', () => {
  const svc = new ReferenceGuardService();

  it('C-P0-5: fake DOI in label is blocked', () => {
    const marker = makeCitationMarker(
      makeSourceRef('notes/a.md'),
      '[1] 10.1234/abcd.efgh',
    );
    const violations = svc.guardCitationMarker(marker);
    assert.ok(violations.some((v) => v.reason === 'fabricated_doi'));
  });

  it('C-P0-5b: fake DOI in content is blocked', () => {
    const marker = makeCitationMarker(makeSourceRef('notes/a.md'), '[1]');
    const section = makeSection(
      'Results',
      'As shown in DOI: 10.1234/test.5678, the results...',
      [marker],
    );
    const result = svc.guardReferences(makeDraft([section]));
    assert.ok(result.violations.some((v) => v.reason === 'fabricated_doi'));
    assert.equal(result.passes, false);
  });

  it('C-P0-5c: doi.org URL is blocked', () => {
    const section = makeSection(
      'References',
      'See https://doi.org/10.1234/test',
      [makeCitationMarker()],
    );
    const result = svc.guardReferences(makeDraft([section]));
    assert.ok(result.violations.some((v) => v.reason === 'fabricated_doi'));
  });

  // ── C-P0-6: Fake PMID is blocked ──────────────────────

  it('C-P0-6: fake PMID in label is blocked', () => {
    const marker = makeCitationMarker(
      makeSourceRef('notes/a.md'),
      'PMID: 12345678',
    );
    const violations = svc.guardCitationMarker(marker);
    assert.ok(violations.some((v) => v.reason === 'fabricated_pmid'));
  });

  it('C-P0-6b: fake PMID in content is blocked', () => {
    const section = makeSection(
      'Methods',
      'Reference PMID: 98765432 describes the protocol.',
      [makeCitationMarker()],
    );
    const result = svc.guardReferences(makeDraft([section]));
    assert.ok(result.violations.some((v) => v.reason === 'fabricated_pmid'));
  });

  // ── C-P0-7: Fake journal metadata is blocked ──────────

  it('C-P0-7: fake journal metadata in content is blocked', () => {
    const section = makeSection(
      'Discussion',
      'This was published in the Journal of Experimental Medicine, Vol. 42, pp. 100-120 (2023).',
      [makeCitationMarker()],
    );
    const result = svc.guardReferences(makeDraft([section]));
    assert.ok(result.violations.some((v) => v.reason === 'fabricated_journal'));
  });

  // ── C-P0-8: External database citation is blocked ─────

  it('C-P0-8: external database claim (PubMed) is blocked', () => {
    const section = makeSection(
      'Literature Review',
      'A PubMed search reveals several related studies.',
      [makeCitationMarker()],
    );
    const result = svc.guardReferences(makeDraft([section]));
    assert.ok(
      result.violations.some((v) => v.reason === 'external_database_claim'),
    );
  });

  it('C-P0-8b: Crossref claim is blocked', () => {
    const section = makeSection(
      'References',
      'Data from Crossref confirms these findings.',
      [makeCitationMarker()],
    );
    const result = svc.guardReferences(makeDraft([section]));
    assert.ok(
      result.violations.some((v) => v.reason === 'external_database_claim'),
    );
  });

  // ── C-P0-9: No fabricated reference list item ────────

  it('C-P0-9: clean content passes guard with no violations', () => {
    const section = makeSection(
      'Introduction',
      'This research builds on prior work in the field.',
      [makeCitationMarker(makeSourceRef('notes/valid.md'))],
    );
    const result = svc.guardReferences(makeDraft([section]));
    assert.ok(result.passes);
    assert.equal(result.violations.length, 0);
  });

  it('C-P0-9b: guardReferences returns verified count', () => {
    const section = makeSection(
      'Results',
      'The experiment confirmed the hypothesis.',
      [makeCitationMarker()],
    );
    const result = svc.guardReferences(makeDraft([section]));
    assert.ok(result.totalCitations > 0);
    assert.ok(result.verifiedCitations >= 0);
  });

  // ── C-P0-10: relativePath-only ────────────────────────

  it('C-P0-10: absolute path in source ref is flagged', () => {
    const marker = makeCitationMarker(
      { relativePath: 'C:\\Users\\file.md', chunkIndex: 0, headingPath: [], score: 0 },
    );
    const violations = svc.guardCitationMarker(marker);
    assert.ok(violations.some((v) => v.reason === 'source_not_in_vault'));
  });

  // ── Missing source ────────────────────────────────────

  it('empty relativePath creates source_not_in_vault violation', () => {
    const marker = makeCitationMarker(
      { relativePath: '', chunkIndex: 0, headingPath: [], score: 0 },
    );
    const violations = svc.guardCitationMarker(marker);
    assert.ok(violations.some((v) => v.reason === 'source_not_in_vault'));
  });

  // ── validateKnownSource ───────────────────────────────

  it('validates known source with valid relativePath', () => {
    assert.equal(svc.validateKnownSource(makeSourceRef('notes/valid.md')), true);
  });

  it('rejects source with empty relativePath', () => {
    assert.equal(
      svc.validateKnownSource({ relativePath: '', chunkIndex: 0, headingPath: [], score: 0 }),
      false,
    );
  });

  it('rejects source with absolute path', () => {
    assert.equal(
      svc.validateKnownSource({ relativePath: 'C:\\file.md', chunkIndex: 0, headingPath: [], score: 0 }),
      false,
    );
  });

  // ── Detect methods ────────────────────────────────────

  it('detectFabricatedDOI returns true for DOI text', () => {
    assert.equal(svc.detectFabricatedDOI('10.1234/test'), true);
    assert.equal(svc.detectFabricatedDOI('normal text'), false);
  });

  it('detectFabricatedPMID returns true for PMID text', () => {
    assert.equal(svc.detectFabricatedPMID('PMID: 12345'), true);
    assert.equal(svc.detectFabricatedPMID('normal text'), false);
  });

  it('detectFabricatedJournal returns true for journal text', () => {
    assert.equal(svc.detectFabricatedJournal('Journal of Physics, Vol. 10'), true);
    assert.equal(svc.detectFabricatedJournal('normal text'), false);
  });

  it('detectExternalDatabaseClaim returns true for PubMed text', () => {
    assert.equal(svc.detectExternalDatabaseClaim('PubMed search'), true);
    assert.equal(svc.detectExternalDatabaseClaim('normal text'), false);
  });

  it('detectAbsolutePathLeak returns true for absolute path', () => {
    assert.equal(svc.detectAbsolutePathLeak('C:\\Users\\file.md'), true);
    assert.equal(svc.detectAbsolutePathLeak('notes/file.md'), false);
  });

  // ── Multiple violations in single content ─────────────

  it('detects multiple violation types in single content', () => {
    const section = makeSection(
      'Discussion',
      'DOI: 10.1234/test. PMID: 12345678. PubMed search confirms.',
      [makeCitationMarker()],
    );
    const result = svc.guardReferences(makeDraft([section]));
    const reasons = result.violations.map((v) => v.reason);
    assert.ok(reasons.includes('fabricated_doi'));
    assert.ok(reasons.includes('fabricated_pmid'));
    assert.ok(reasons.includes('external_database_claim'));
  });

  // ── No source → no citation ───────────────────────────

  it('C-P0-12: draft with no citations returns passes true with zero counts', () => {
    const draft = { ...createMockWritingDraft(), sections: [], allCitations: [] };
    const result = svc.guardReferences(draft);
    assert.ok(result.passes);
    assert.equal(result.totalCitations, 0);
    assert.equal(result.verifiedCitations, 0);
  });
});

// ── Safety tests ─────────────────────────────────────────

describe('reference guard safety', () => {
  const svcPath = path.resolve(
    __dirname,
    '../../electron/services/reference-guard.service.ts',
  );

  it('no provider call: no fetch/axios/openai/anthropic', () => {
    const content = fs.readFileSync(svcPath, 'utf8');
    assert.ok(!content.includes('fetch('));
    assert.ok(!content.includes('axios'));
    assert.ok(!content.includes('openai'));
    assert.ok(!content.includes('anthropic'));
  });

  it('no external database lookup code', () => {
    const content = fs.readFileSync(svcPath, 'utf8');
    // Only the patterns (strings) in guard logic, no actual HTTP/API calls
    assert.ok(!content.includes('fetch('));
    assert.ok(!content.includes('http://'));
    assert.ok(!content.includes('https://'));
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
    const fieldPatterns = [
      /\bapiKey\b/i,
      /\bAPI_KEY\b/,
      /\bsecret\b(?!\w*Path)/i,
      /\bpassword\b/i,
    ];
    for (const pattern of fieldPatterns) {
      const lines = content.split('\n');
      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
        if (pattern.test(t)) {
          assert.fail(`Contains forbidden pattern "${pattern}" in: ${t}`);
        }
      }
    }
  });

  it('no fabricated reference generation in guard service', () => {
    const content = fs.readFileSync(svcPath, 'utf8');
    const codeOnly = content
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      })
      .join('\n');
    // The guard DETECTS these patterns but never GENERATES them
    assert.ok(!codeOnly.includes('fake'));
    assert.ok(!codeOnly.includes('generateDoi'));
    assert.ok(!codeOnly.includes('generatePmid'));
  });
});
