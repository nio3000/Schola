/**
 * Citation Rendering Service Tests — Phase 4-3-C.
 *
 * Validates CitationRenderingService against Phase 4-3-TB C-slice P0 requirements.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import { CitationRenderingService } from '../../electron/services/citation-rendering.service';
import type {
  WritingDraftArtifact,
  WritingDraftSection,
  CitationMarker,
} from '../../src/lib/contracts/research-writing.types';
import { createMockWritingDraft } from '../../src/lib/contracts/research-writing.types';
import type { SourceRef, EvidenceRef } from '../../src/lib/contracts/local-qa.types';

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

function makeSection(heading: string, citations: CitationMarker[]): WritingDraftSection {
  return {
    heading,
    content: `## ${heading}\n\nContent with citations.`,
    sources: citations.map((c) => ({ ...c.sourceRef })),
    evidence: [],
    citations,
    confidence: 0.8,
    hasUnsupportedClaims: false,
    unsupportedClaims: [],
  };
}

function makeDraft(citations?: CitationMarker[]): WritingDraftArtifact {
  const markers = citations ?? [
    makeCitationMarker(makeSourceRef('notes/a.md')),
    makeCitationMarker(makeSourceRef('notes/b.md')),
  ];
  return {
    ...createMockWritingDraft(),
    sections: [makeSection('Section 1', markers)],
    allCitations: markers,
  };
}

// ── C-P0-1: Citation marker renders from SourceRef ──────

describe('CitationRenderingService', () => {
  const svc = new CitationRenderingService();

  it('C-P0-1: renders citation markers from SourceRef', () => {
    const draft = makeDraft();
    const result = svc.renderCitations(draft);
    assert.ok(result.ok);
    assert.equal(result.totalRendered, 2);
    assert.ok(result.entries.length === 2);
    for (const entry of result.entries) {
      assert.ok(entry.inlineText.includes('[Source:'));
      assert.ok(entry.referenceText.includes('[Source:'));
    }
  });

  it('renders inline citation with safe format [Source: path]', () => {
    const text = svc.buildInlineText(makeSourceRef('notes/test.md'));
    assert.ok(text.includes('[Source: notes/test.md]'));
    assert.ok(!text.includes('DOI'));
    assert.ok(!text.includes('PMID'));
    assert.ok(!text.includes('Journal'));
  });

  it('renders reference list entry with safe format', () => {
    const text = svc.buildReferenceText(makeSourceRef('notes/test.md'), 1);
    assert.equal(text, '1. [Source: notes/test.md]');
    assert.ok(!text.includes('DOI'));
    assert.ok(!text.includes('PMID'));
  });

  it('renders with chunk index when present', () => {
    const src = makeSourceRef('notes/test.md');
    const chunked = { ...src, chunkIndex: 3 };
    const text = svc.buildInlineText(chunked);
    assert.ok(text.includes('#chunk-3'));
  });

  it('renders evidence citation safely', () => {
    const ev: EvidenceRef = {
      source: makeSourceRef('notes/evidence.md'),
      excerpt: 'test',
      excerptTokenCount: 1,
    };
    const text = svc.buildEvidenceCitation(ev);
    assert.ok(text.includes('[Evidence: notes/evidence.md]'));
  });

  // ── CitationRenderStyle behavior ──────────────────────

  it('style=inline renders only inline citations', () => {
    const draft = makeDraft();
    const result = svc.renderCitations(draft, 'inline');
    assert.ok(result.inlineCitations.length > 0);
    assert.equal(result.referenceList, '');
  });

  it('style=reference_list renders only reference list', () => {
    const draft = makeDraft();
    const result = svc.renderCitations(draft, 'reference_list');
    assert.equal(result.inlineCitations, '');
    assert.ok(result.referenceList.length > 0);
  });

  it('style=both renders both inline and reference', () => {
    const draft = makeDraft();
    const result = svc.renderCitations(draft, 'both');
    assert.ok(result.inlineCitations.length > 0);
    assert.ok(result.referenceList.length > 0);
  });

  // ── C-P0-2: Section with evidence gets citation marker ─

  it('C-P0-2: renders section citations from markers', () => {
    const markers = [makeCitationMarker(makeSourceRef('notes/a.md'))];
    const section = makeSection('Test', markers);
    const text = svc.renderSectionCitations(section);
    assert.ok(text.includes('[Source: notes/a.md]'));
  });

  // ── C-P0-3: Source without metadata still cites safely ─

  it('C-P0-3: source without metadata still cites local source safely', () => {
    const src: SourceRef = { relativePath: 'plain/file.txt', chunkIndex: 0, headingPath: [], score: 0.5 };
    const text = svc.buildInlineText(src);
    assert.ok(text.includes('[Source: plain/file.txt]'));
    assert.ok(!text.includes('DOI'));
    assert.ok(!text.includes('PMID'));
    assert.ok(!text.includes('author'));
    assert.ok(!text.includes('year'));
  });

  // ── C-P0-4: Missing source creates warning ─

  it('C-P0-4: missing source creates warning', () => {
    const marker = makeCitationMarker({ relativePath: '', chunkIndex: 0, headingPath: [], score: 0 });
    const draft = makeDraft([marker]);
    const result = svc.renderCitations(draft);
    assert.ok(result.warnings.some((w) => w.code === 'MISSING_SOURCE'));
    assert.equal(result.totalRendered, 0);
  });

  // ── Reference list from known sources ─

  it('builds reference list from source refs', () => {
    const sources = [makeSourceRef('notes/a.md'), makeSourceRef('notes/b.md')];
    const list = svc.buildReferenceList(sources);
    assert.ok(list.includes('1. [Source: notes/a.md]'));
    assert.ok(list.includes('2. [Source: notes/b.md]'));
  });

  it('empty reference list produces placeholder', () => {
    const list = svc.buildReferenceList([]);
    assert.equal(list, '(no references)');
  });

  it('empty draft with no citations produces NO_CITATIONS warning', () => {
    const draft = {
      ...createMockWritingDraft(),
      sections: [makeSection('Empty', [])],
      allCitations: [],
    };
    const result = svc.renderCitations(draft);
    assert.ok(result.warnings.some((w) => w.code === 'NO_CITATIONS'));
  });

  // ── Duplicate source handling ─

  it('handles duplicate sources with DUPLICATE_SOURCE warning', () => {
    const src = makeSourceRef('notes/same.md');
    const markers = [makeCitationMarker(src), makeCitationMarker(src)];
    const draft = makeDraft(markers);
    const result = svc.renderCitations(draft);
    assert.ok(result.warnings.some((w) => w.code === 'DUPLICATE_SOURCE'));
    assert.equal(result.totalRendered, 1);
  });

  // ── C-P0-10: relativePath-only ─

  it('C-P0-10: blocks absolute path with ABSOLUTE_PATH_LEAK', () => {
    const marker = makeCitationMarker(
      { relativePath: 'C:\\Users\\file.md', chunkIndex: 0, headingPath: [], score: 0 },
    );
    const draft = makeDraft([marker]);
    const result = svc.renderCitations(draft);
    assert.ok(result.warnings.some((w) => w.code === 'ABSOLUTE_PATH_LEAK'));
  });

  // ── Safety: no fabricated references in rendered output ─

  it('rendered output never contains DOI', () => {
    const result = svc.renderCitations(makeDraft());
    const allText = result.inlineCitations + result.referenceList;
    assert.ok(!allText.includes('DOI'));
    assert.ok(!allText.includes('doi:'));
    assert.ok(!allText.includes('10.'));
  });

  it('rendered output never contains PMID', () => {
    const result = svc.renderCitations(makeDraft());
    const allText = result.inlineCitations + result.referenceList;
    assert.ok(!allText.includes('PMID'));
    assert.ok(!allText.includes('pmid:'));
  });

  it('rendered output never contains journal metadata', () => {
    const result = svc.renderCitations(makeDraft());
    const allText = result.inlineCitations + result.referenceList;
    assert.ok(!allText.includes('Journal'));
    assert.ok(!allText.includes('Vol.'));
    assert.ok(!allText.includes('pp.'));
  });
});

// ── Safety tests ─────────────────────────────────────────

describe('citation rendering safety', () => {
  const svcPath = path.resolve(
    __dirname,
    '../../electron/services/citation-rendering.service.ts',
  );

  it('no provider call: no fetch/axios/openai/anthropic', () => {
    const content = fs.readFileSync(svcPath, 'utf8');
    assert.ok(!content.includes('fetch('));
    assert.ok(!content.includes('axios'));
    assert.ok(!content.includes('openai'));
    assert.ok(!content.includes('anthropic'));
  });

  it('no external database lookup: no PubMed/Crossref/OpenAlex', () => {
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
});
