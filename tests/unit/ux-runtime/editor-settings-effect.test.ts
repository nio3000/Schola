/**
 * R6-R14: Editor settings effect tests.
 * Verifies fontSize/lineHeight/fontFamily settings affect CodeMirror via CSS variables.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

function readSrc(p: string): string { return readFileSync(resolve(ROOT, p), 'utf8'); }

describe('Editor settings effect (R6-R14)', () => {
  const gpSrc = readSrc('src/features/settings/components/GeneralPage.tsx');
  const btSrc = readSrc('src/features/theme/AppThemeBootstrap.tsx');
  const css = readSrc('src/styles.css');

  it('GeneralPage has editor font-size control', () => {
    expect(gpSrc).toContain('editor-font-size');
    expect(gpSrc).toContain('--editor-font-size');
    expect(gpSrc).toContain('localStorage.setItem');
  });

  it('GeneralPage has editor line-height control', () => {
    expect(gpSrc).toContain('editor-line-height');
    expect(gpSrc).toContain('--editor-line-height');
  });

  it('GeneralPage has editor font-family control', () => {
    expect(gpSrc).toContain('editor-font-family');
    expect(gpSrc).toContain('--editor-font-family');
  });

  it('GeneralPage reads initial values from localStorage', () => {
    expect(gpSrc).toContain('localStorage.getItem');
    expect(gpSrc).toContain('schola.editorFontSize');
    expect(gpSrc).toContain('schola.editorLineHeight');
  });

  it('AppThemeBootstrap initializes editor CSS vars on startup', () => {
    expect(btSrc).toContain('initEditorCssVars');
    expect(btSrc).toContain('--editor-font-size');
    expect(btSrc).toContain('--editor-line-height');
  });

  it('CodeMirror CSS uses --editor-font-size variable', () => {
    expect(css).toContain('var(--editor-font-size');
  });

  it('CodeMirror CSS uses --editor-line-height variable', () => {
    expect(css).toContain('var(--editor-line-height');
  });

  it('CodeMirror CSS uses --editor-font-family variable', () => {
    expect(css).toContain('var(--editor-font-family');
  });
});
