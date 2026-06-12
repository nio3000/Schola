/**
 * Resource viewer routing unit tests — Phase 5-4A-TD.
 *
 * Tests shouldUseResourceViewer() and verifies routing logic
 * that maps ResourceKind → ResourceViewerKind → viewer component.
 */
import { describe, it, expect } from 'vitest';
import {
  viewerKindForResourceKind,
  getResourceKindByPath,
} from '../../src/lib/contracts/resource-classifier';
import { shouldUseResourceViewer } from '../../src/features/resources/ResourceViewerShell';

// ── shouldUseResourceViewer ───────────────────────

describe('shouldUseResourceViewer', () => {
  it('pdf → true', () => expect(shouldUseResourceViewer('paper.pdf')).toBe(true));
  it('html → true', () => expect(shouldUseResourceViewer('page.html')).toBe(true));
  it('htm → true', () => expect(shouldUseResourceViewer('page.htm')).toBe(true));
  it('txt → true', () => expect(shouldUseResourceViewer('readme.txt')).toBe(true));
  it('csv → true', () => expect(shouldUseResourceViewer('data.csv')).toBe(true));
  it('image → true (png)', () => expect(shouldUseResourceViewer('photo.png')).toBe(true));
  it('image → true (jpg)', () => expect(shouldUseResourceViewer('photo.jpg')).toBe(true));
  it('docx → true', () => expect(shouldUseResourceViewer('report.docx')).toBe(true));
  it('pptx → true', () => expect(shouldUseResourceViewer('slides.pptx')).toBe(true));
  it('xlsx → true', () => expect(shouldUseResourceViewer('sheet.xlsx')).toBe(true));
  it('unknown → true (routes to unsupported)', () => expect(shouldUseResourceViewer('file.xyz')).toBe(true));

  it('markdown .md → false', () => expect(shouldUseResourceViewer('notes/note.md')).toBe(false));
  it('markdown .markdown → false', () => expect(shouldUseResourceViewer('notes/note.markdown')).toBe(false));

  it('nested path works', () => expect(shouldUseResourceViewer('resources/pdf/paper.pdf')).toBe(true));
  it('vault-relative markdown stays editor', () =>
    expect(shouldUseResourceViewer('notes/deep/nested/readme.md')).toBe(false));
});

// ── viewerKindForResourceKind mapping ─────────────

describe('viewerKindForResourceKind', () => {
  it('pdf → pdf-viewer', () => expect(viewerKindForResourceKind('pdf')).toBe('pdf-viewer'));
  it('html → html-viewer', () => expect(viewerKindForResourceKind('html')).toBe('html-viewer'));
  it('txt → text-viewer', () => expect(viewerKindForResourceKind('txt')).toBe('text-viewer'));
  it('csv → text-viewer', () => expect(viewerKindForResourceKind('csv')).toBe('text-viewer'));
  it('image → image-viewer', () => expect(viewerKindForResourceKind('image')).toBe('image-viewer'));
  it('docx → metadata-viewer', () => expect(viewerKindForResourceKind('docx')).toBe('metadata-viewer'));
  it('pptx → metadata-viewer', () => expect(viewerKindForResourceKind('pptx')).toBe('metadata-viewer'));
  it('xlsx → metadata-viewer', () => expect(viewerKindForResourceKind('xlsx')).toBe('metadata-viewer'));
  it('other → unsupported', () => expect(viewerKindForResourceKind('other')).toBe('unsupported'));
  it('markdown → markdown-editor', () => expect(viewerKindForResourceKind('markdown')).toBe('markdown-editor'));
});

// ── kind → viewer routing consistency ─────────────

describe('routing consistency', () => {
  it('txt goes to text-viewer', () => {
    expect(viewerKindForResourceKind('txt')).toBe('text-viewer');
  });
  it('csv goes to text-viewer', () => {
    expect(viewerKindForResourceKind('csv')).toBe('text-viewer');
  });
  it('all office formats go to metadata-viewer', () => {
    expect(viewerKindForResourceKind('docx')).toBe('metadata-viewer');
    expect(viewerKindForResourceKind('pptx')).toBe('metadata-viewer');
    expect(viewerKindForResourceKind('xlsx')).toBe('metadata-viewer');
  });
  it('pdf and html have dedicated viewers', () => {
    expect(viewerKindForResourceKind('pdf')).toBe('pdf-viewer');
    expect(viewerKindForResourceKind('html')).toBe('html-viewer');
  });

  it('shouldUseResourceViewer true for all non-markdown', () => {
    const nonMdPaths = [
      'a.pdf', 'b.html', 'c.txt', 'd.csv', 'e.png',
      'f.docx', 'g.pptx', 'h.xlsx', 'i.unknown',
    ];
    for (const p of nonMdPaths) {
      expect(shouldUseResourceViewer(p)).toBe(true);
    }
  });

  it('shouldUseResourceViewer false only for markdown', () => {
    expect(shouldUseResourceViewer('a.md')).toBe(false);
    expect(shouldUseResourceViewer('b.markdown')).toBe(false);
  });
});

// ── getResourceKindByPath integration ─────────────

describe('getResourceKindByPath → viewer routing', () => {
  it('resources/pdf/paper.pdf → pdf → pdf-viewer', () => {
    const kind = getResourceKindByPath('resources/pdf/paper.pdf');
    expect(kind).toBe('pdf');
    expect(viewerKindForResourceKind(kind)).toBe('pdf-viewer');
  });

  it('resources/html/page.html → html → html-viewer', () => {
    const kind = getResourceKindByPath('resources/html/page.html');
    expect(kind).toBe('html');
    expect(viewerKindForResourceKind(kind)).toBe('html-viewer');
  });

  it('resources/docx/report.docx → docx → metadata-viewer', () => {
    const kind = getResourceKindByPath('resources/docx/report.docx');
    expect(kind).toBe('docx');
    expect(viewerKindForResourceKind(kind)).toBe('metadata-viewer');
  });

  it('resources/csv/data.csv → csv → text-viewer', () => {
    const kind = getResourceKindByPath('resources/csv/data.csv');
    expect(kind).toBe('csv');
    expect(viewerKindForResourceKind(kind)).toBe('text-viewer');
  });

  it('resources/images/photo.png → image → image-viewer', () => {
    const kind = getResourceKindByPath('resources/images/photo.png');
    expect(kind).toBe('image');
    expect(viewerKindForResourceKind(kind)).toBe('image-viewer');
  });

  it('notes/readme.md → markdown → markdown-editor', () => {
    const kind = getResourceKindByPath('notes/readme.md');
    expect(kind).toBe('markdown');
    expect(viewerKindForResourceKind(kind)).toBe('markdown-editor');
  });

  it('unknown/file.bin → other → unsupported', () => {
    const kind = getResourceKindByPath('unknown/file.bin');
    expect(kind).toBe('other');
    expect(viewerKindForResourceKind(kind)).toBe('unsupported');
  });
});
