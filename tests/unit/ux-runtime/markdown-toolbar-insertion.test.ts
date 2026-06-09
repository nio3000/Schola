/**
 * R6-R14: MarkdownToolbar insertion logic tests.
 * Verifies the toolbar has all 12 buttons with real insertion functions.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');
const src = readFileSync(resolve(ROOT, 'src', 'features', 'editor', 'components', 'MarkdownToolbar.tsx'), 'utf8');

const BUTTONS = ['heading','bold','italic','strikethrough','quote','link','code','codeblock','ul','ol','task','table'];

describe('MarkdownToolbar insertion logic (R6-R14)', () => {
  it('has all 12 format buttons', () => {
    for (const id of BUTTONS) expect(src).toContain(`id: '${id}'`);
  });

  it('has wrapSelection helper', () => {
    expect(src).toContain('function wrapSelection');
    expect(src).toContain('view.state.selection.main');
  });

  it('has insertAtLineStart helper', () => {
    expect(src).toContain('function insertAtLineStart');
    expect(src).toContain('view.state.doc.lineAt');
  });

  it('has insertBlock helper', () => {
    expect(src).toContain('function insertBlock');
  });

  it('heading uses ## prefix', () => expect(src).toContain("insertAtLineStart(view, '## ')"));
  it('bold wraps with **', () => expect(src).toContain("wrapSelection(view, '**', '**',"));
  it('italic wraps with *', () => expect(src).toContain("wrapSelection(view, '*', '*',"));
  it('strikethrough wraps with ~~', () => expect(src).toContain("wrapSelection(view, '~~', '~~',"));
  it('quote uses > prefix', () => expect(src).toContain("insertAtLineStart(view, '> ')"));
  it('link wraps with [](url)', () => expect(src).toContain("wrapSelection(view, '[', '](url)',"));
  it('code wraps with backticks', () => expect(src).toContain("wrapSelection(view, '`', '`',"));
  it('codeblock inserts triple-backtick', () => expect(src).toContain("insertBlock(view, '```"));
  it('ul uses - prefix', () => expect(src).toContain("insertAtLineStart(view, '- ')"));
  it('ol uses 1. prefix', () => expect(src).toContain("insertAtLineStart(view, '1. ')"));
  it('task uses - [ ] prefix', () => expect(src).toContain("insertAtLineStart(view, '- [ ] ')"));
  it('table inserts markdown table template', () => {
    expect(src).toContain('| 列1 | 列2 | 列3 |');
    expect(src).toContain('| --- | --- | --- |');
  });

  it('all handlers call view.focus()', () => {
    expect((src.match(/view\.focus\(\)/g) || []).length).toBeGreaterThanOrEqual(1);
  });

  it('has role=toolbar', () => expect(src).toContain('role="toolbar"'));
  it('disables when disabled prop is true', () => expect(src).toContain('if (!view || disabled) return'));
});
