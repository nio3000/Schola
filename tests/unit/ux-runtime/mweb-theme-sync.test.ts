/**
 * R6-R14: Editor/Preview theme sync verification.
 * Verifies EditorPanel receives previewTheme and sets data-editor-theme.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

function readSrc(p: string): string { return readFileSync(resolve(ROOT, p), 'utf8'); }

describe('Editor/Preview theme sync (R6-R14)', () => {
  const wsSrc = readSrc('src/features/workspace/WorkspaceShell.tsx');
  const epSrc = readSrc('src/features/editor/EditorPanel.tsx');
  const ppSrc = readSrc('src/features/preview/PreviewPanel.tsx');
  const ptSrc = readSrc('src/features/preview/previewThemes.ts');

  it('WorkspaceShell reads previewTheme from localStorage', () => {
    expect(wsSrc).toContain('readStoredTheme');
    expect(wsSrc).toContain('previewTheme');
  });

  it('WorkspaceShell passes previewTheme to EditorPanel', () => {
    expect(wsSrc).toContain('previewTheme={previewTheme}');
    expect(wsSrc).toContain('EditorPanel');
  });

  it('EditorPanel accepts previewTheme prop', () => {
    expect(epSrc).toContain('previewTheme?:');
  });

  it('EditorPanel sets data-editor-theme attribute', () => {
    expect(epSrc).toContain('data-editor-theme=');
    expect(epSrc).toContain('previewTheme');
  });

  it('PreviewPanel calls onThemeChange when theme changes', () => {
    expect(ppSrc).toContain('onThemeChange?.(theme)');
  });

  it('WorkspaceShell passes onThemeChange to PreviewPanel', () => {
    expect(wsSrc).toContain('onThemeChange=');
    expect(wsSrc).toContain('PreviewPanel');
  });

  it('previewThemes.ts imports from theme registry', () => {
    expect(ptSrc).toContain("from './themes/registry'");
  });

  it('PreviewPanel uses data-preview-theme attribute', () => {
    expect(ppSrc).toContain('data-preview-theme');
  });

  it('MarkdownToolbar renders in WorkspaceShell', () => {
    expect(wsSrc).toContain('MarkdownToolbar');
    expect(wsSrc).toContain('editorViewRef');
  });
});
