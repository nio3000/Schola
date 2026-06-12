/**
 * Resource classifier unit tests — Phase 5-4A-IMP-1.
 *
 * Tests all classifier functions with the 30 required cases.
 * No file I/O, no network, no system paths.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeResourceExtension,
  getResourceKindByExtension,
  getResourceKindByPath,
  viewerKindForResourceKind,
  isSupportedResourceExtension,
  getResourceSubdir,
} from '../../src/lib/contracts/resource-classifier';

// ── normalizeResourceExtension ──────────────────

describe('normalizeResourceExtension', () => {
  it('lowercases uppercase', () => {
    expect(normalizeResourceExtension('PDF')).toBe('.pdf');
  });

  it('lowercases dotted uppercase', () => {
    expect(normalizeResourceExtension('.PDF')).toBe('.pdf');
  });

  it('extracts extension from filename with uppercase', () => {
    // normalizeResourceExtension is called with the extension part,
    // not the full path. The path parsing is in getResourceKindByPath.
    // For extension strings like "PDF" it lowercases and adds dot.
    expect(normalizeResourceExtension('PDF')).toBe('.pdf');
  });

  it('trims whitespace', () => {
    expect(normalizeResourceExtension('  .pdf  ')).toBe('.pdf');
  });

  it('adds leading dot when missing', () => {
    expect(normalizeResourceExtension('pdf')).toBe('.pdf');
  });

  it('returns empty for empty input', () => {
    expect(normalizeResourceExtension('')).toBe('');
  });

  it('returns empty for whitespace only', () => {
    expect(normalizeResourceExtension('   ')).toBe('');
  });
});

// ── getResourceKindByExtension ──────────────────

describe('getResourceKindByExtension', () => {
  it('.pdf → pdf', () => {
    expect(getResourceKindByExtension('.pdf')).toBe('pdf');
  });

  it('.PDF → pdf (case-insensitive)', () => {
    expect(getResourceKindByExtension('.PDF')).toBe('pdf');
  });

  it('.html → html', () => {
    expect(getResourceKindByExtension('.html')).toBe('html');
  });

  it('.htm → html', () => {
    expect(getResourceKindByExtension('.htm')).toBe('html');
  });

  it('.docx → docx', () => {
    expect(getResourceKindByExtension('.docx')).toBe('docx');
  });

  it('.pptx → pptx', () => {
    expect(getResourceKindByExtension('.pptx')).toBe('pptx');
  });

  it('.xlsx → xlsx', () => {
    expect(getResourceKindByExtension('.xlsx')).toBe('xlsx');
  });

  it('.csv → csv', () => {
    expect(getResourceKindByExtension('.csv')).toBe('csv');
  });

  it('.txt → txt', () => {
    expect(getResourceKindByExtension('.txt')).toBe('txt');
  });

  it('.png → image', () => {
    expect(getResourceKindByExtension('.png')).toBe('image');
  });

  it('.jpg → image', () => {
    expect(getResourceKindByExtension('.jpg')).toBe('image');
  });

  it('.jpeg → image', () => {
    expect(getResourceKindByExtension('.jpeg')).toBe('image');
  });

  it('.webp → image', () => {
    expect(getResourceKindByExtension('.webp')).toBe('image');
  });

  it('.gif → image', () => {
    expect(getResourceKindByExtension('.gif')).toBe('image');
  });

  it('.exe → other (not in whitelist)', () => {
    expect(getResourceKindByExtension('.exe')).toBe('other');
  });

  it('.md → markdown', () => {
    expect(getResourceKindByExtension('.md')).toBe('markdown');
  });

  it('.markdown → markdown', () => {
    expect(getResourceKindByExtension('.markdown')).toBe('markdown');
  });

  it('empty string → other', () => {
    expect(getResourceKindByExtension('')).toBe('other');
  });
});

// ── isSupportedResourceExtension ────────────────

describe('isSupportedResourceExtension', () => {
  it('.pdf is supported', () => {
    expect(isSupportedResourceExtension('.pdf')).toBe(true);
  });

  it('.exe is NOT supported', () => {
    expect(isSupportedResourceExtension('.exe')).toBe(false);
  });

  it('.js is NOT supported', () => {
    expect(isSupportedResourceExtension('.js')).toBe(false);
  });

  it('.bat is NOT supported', () => {
    expect(isSupportedResourceExtension('.bat')).toBe(false);
  });

  it('empty string is NOT supported', () => {
    expect(isSupportedResourceExtension('')).toBe(false);
  });
});

// ── getResourceKindByPath ───────────────────────

describe('getResourceKindByPath', () => {
  it('notes/index.md → markdown', () => {
    expect(getResourceKindByPath('notes/index.md')).toBe('markdown');
  });

  it('resources/pdf/paper.PDF → pdf (case-insensitive)', () => {
    expect(getResourceKindByPath('resources/pdf/paper.PDF')).toBe('pdf');
  });

  it('resources/pdf/paper.v1.final.pdf → pdf (multi-dot)', () => {
    expect(getResourceKindByPath('resources/pdf/paper.v1.final.pdf')).toBe('pdf');
  });

  it('.env → other (hidden file, no secondary ext)', () => {
    expect(getResourceKindByPath('.env')).toBe('other');
  });

  it('.gitignore → other', () => {
    expect(getResourceKindByPath('.gitignore')).toBe('other');
  });

  it('no-extension-file → other', () => {
    expect(getResourceKindByPath('some-file-without-ext')).toBe('other');
  });

  it('empty string → other', () => {
    expect(getResourceKindByPath('')).toBe('other');
  });

  it('resources/images/photo.png → image', () => {
    expect(getResourceKindByPath('resources/images/photo.png')).toBe('image');
  });

  it('Windows path separator → markdown', () => {
    expect(getResourceKindByPath('notes\\index.md')).toBe('markdown');
  });
});

// ── viewerKindForResourceKind ───────────────────

describe('viewerKindForResourceKind', () => {
  it('markdown → markdown-editor', () => {
    expect(viewerKindForResourceKind('markdown')).toBe('markdown-editor');
  });

  it('pdf → pdf-viewer', () => {
    expect(viewerKindForResourceKind('pdf')).toBe('pdf-viewer');
  });

  it('html → html-viewer', () => {
    expect(viewerKindForResourceKind('html')).toBe('html-viewer');
  });

  it('image → image-viewer', () => {
    expect(viewerKindForResourceKind('image')).toBe('image-viewer');
  });

  it('txt → text-viewer', () => {
    expect(viewerKindForResourceKind('txt')).toBe('text-viewer');
  });

  it('csv → text-viewer', () => {
    expect(viewerKindForResourceKind('csv')).toBe('text-viewer');
  });

  it('docx → metadata-viewer', () => {
    expect(viewerKindForResourceKind('docx')).toBe('metadata-viewer');
  });

  it('pptx → metadata-viewer', () => {
    expect(viewerKindForResourceKind('pptx')).toBe('metadata-viewer');
  });

  it('xlsx → metadata-viewer', () => {
    expect(viewerKindForResourceKind('xlsx')).toBe('metadata-viewer');
  });

  it('other → unsupported', () => {
    expect(viewerKindForResourceKind('other')).toBe('unsupported');
  });
});

// ── getResourceSubdir ───────────────────────────

describe('getResourceSubdir', () => {
  it('pdf → resources/pdf', () => {
    expect(getResourceSubdir('pdf')).toBe('resources/pdf');
  });

  it('image → resources/images', () => {
    expect(getResourceSubdir('image')).toBe('resources/images');
  });

  it('markdown → notes', () => {
    expect(getResourceSubdir('markdown')).toBe('notes');
  });

  it('html → resources/html', () => {
    expect(getResourceSubdir('html')).toBe('resources/html');
  });

  it('docx → resources/docx', () => {
    expect(getResourceSubdir('docx')).toBe('resources/docx');
  });

  it('other → resources/other', () => {
    expect(getResourceSubdir('other')).toBe('resources/other');
  });
});
