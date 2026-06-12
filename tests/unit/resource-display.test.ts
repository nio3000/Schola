/**
 * Resource display unit tests — Phase 5-4A-TD.
 *
 * Tests resourceDisplay.ts: labels, icons, CSS classes,
 * path-based helpers, and isNonMarkdownResource.
 */
import { describe, it, expect } from 'vitest';
import {
  getResourceKindLabel,
  getResourceIconChar,
  getResourceKindCss,
  getResourceKindLabelForPath,
  getResourceIconForPath,
  getResourceCssForPath,
  isNonMarkdownResource,
  RESOURCE_KIND_LABEL,
} from '../../src/features/resources/resourceDisplay';

// ── Labels ────────────────────────────────────────

describe('getResourceKindLabel', () => {
  it('pdf → PDF', () => expect(getResourceKindLabel('pdf')).toBe('PDF'));
  it('html → HTML', () => expect(getResourceKindLabel('html')).toBe('HTML'));
  it('docx → Word', () => expect(getResourceKindLabel('docx')).toBe('Word'));
  it('pptx → PPT', () => expect(getResourceKindLabel('pptx')).toBe('PPT'));
  it('xlsx → Excel', () => expect(getResourceKindLabel('xlsx')).toBe('Excel'));
  it('csv → CSV', () => expect(getResourceKindLabel('csv')).toBe('CSV'));
  it('txt → TXT', () => expect(getResourceKindLabel('txt')).toBe('TXT'));
  it('image → Image', () => expect(getResourceKindLabel('image')).toBe('Image'));
  it('markdown → Markdown', () => expect(getResourceKindLabel('markdown')).toBe('Markdown'));
  it('other → File', () => expect(getResourceKindLabel('other')).toBe('File'));
});

// ── Icons ─────────────────────────────────────────

describe('getResourceIconChar', () => {
  it('pdf → PDF', () => expect(getResourceIconChar('pdf')).toBe('PDF'));
  it('html → HTM', () => expect(getResourceIconChar('html')).toBe('HTM'));
  it('docx → DOC', () => expect(getResourceIconChar('docx')).toBe('DOC'));
  it('pptx → PPT', () => expect(getResourceIconChar('pptx')).toBe('PPT'));
  it('xlsx → XLS', () => expect(getResourceIconChar('xlsx')).toBe('XLS'));
  it('csv → CSV', () => expect(getResourceIconChar('csv')).toBe('CSV'));
  it('txt → TXT', () => expect(getResourceIconChar('txt')).toBe('TXT'));
  it('image → IMG', () => expect(getResourceIconChar('image')).toBe('IMG'));
  it('other → ???', () => expect(getResourceIconChar('other')).toBe('???'));
  it('markdown is empty string', () => expect(getResourceIconChar('markdown')).toBe(''));
});

// ── CSS Classes ───────────────────────────────────

describe('getResourceKindCss', () => {
  it('pdf → resource-kind-pdf', () => expect(getResourceKindCss('pdf')).toBe('resource-kind-pdf'));
  it('html → resource-kind-html', () => expect(getResourceKindCss('html')).toBe('resource-kind-html'));
  it('docx → resource-kind-docx', () => expect(getResourceKindCss('docx')).toBe('resource-kind-docx'));
  it('image → resource-kind-image', () => expect(getResourceKindCss('image')).toBe('resource-kind-image'));
  it('other → resource-kind-other', () => expect(getResourceKindCss('other')).toBe('resource-kind-other'));
});

// ── Path-based helpers ────────────────────────────

describe('getResourceKindLabelForPath', () => {
  it('notes/paper.pdf → PDF', () => expect(getResourceKindLabelForPath('notes/paper.pdf')).toBe('PDF'));
  it('docs/index.html → HTML', () => expect(getResourceKindLabelForPath('docs/index.html')).toBe('HTML'));
  it('data/report.csv → CSV', () => expect(getResourceKindLabelForPath('data/report.csv')).toBe('CSV'));
  it('unknown/file.bin → File', () => expect(getResourceKindLabelForPath('unknown/file.bin')).toBe('File'));
  it('notes/readme.md → Markdown', () => expect(getResourceKindLabelForPath('notes/readme.md')).toBe('Markdown'));
});

describe('getResourceIconForPath', () => {
  it('paper.pdf → PDF icon', () => expect(getResourceIconForPath('paper.pdf')).toBe('PDF'));
  it('image.png → IMG icon', () => expect(getResourceIconForPath('image.png')).toBe('IMG'));
  it('note.md → empty (markdown)', () => expect(getResourceIconForPath('note.md')).toBe(''));
});

describe('getResourceCssForPath', () => {
  it('doc.pdf → resource-kind-pdf', () => expect(getResourceCssForPath('doc.pdf')).toBe('resource-kind-pdf'));
  it('data.xlsx → resource-kind-xlsx', () => expect(getResourceCssForPath('data.xlsx')).toBe('resource-kind-xlsx'));
});

// ── isNonMarkdownResource ─────────────────────────

describe('isNonMarkdownResource', () => {
  it('paper.pdf → true', () => expect(isNonMarkdownResource('paper.pdf')).toBe(true));
  it('page.html → true', () => expect(isNonMarkdownResource('page.html')).toBe(true));
  it('image.png → true', () => expect(isNonMarkdownResource('image.png')).toBe(true));
  it('data.csv → true', () => expect(isNonMarkdownResource('data.csv')).toBe(true));
  it('notes/readme.md → false (markdown)', () => expect(isNonMarkdownResource('notes/readme.md')).toBe(false));
  it('doc.markdown → false (markdown)', () => expect(isNonMarkdownResource('doc.markdown')).toBe(false));
  it('unknown.xyz → true', () => expect(isNonMarkdownResource('unknown.xyz')).toBe(true));
});

// ── All labels covered ────────────────────────────

describe('RESOURCE_KIND_LABEL completeness', () => {
  it('has all 10 kinds', () => {
    const keys = Object.keys(RESOURCE_KIND_LABEL);
    expect(keys).toHaveLength(12);
    expect(keys).toContain('markdown');
    expect(keys).toContain('pdf');
    expect(keys).toContain('html');
    expect(keys).toContain('docx');
    expect(keys).toContain('pptx');
    expect(keys).toContain('xlsx');
    expect(keys).toContain('csv');
    expect(keys).toContain('txt');
    expect(keys).toContain('image');
    expect(keys).toContain('other');
  });
});
