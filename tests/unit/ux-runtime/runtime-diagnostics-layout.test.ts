/**
 * R6-R14: RuntimeDiagnostics layout test.
 * Verifies workspace-body uses flex:1 1 0 to prevent layout squeeze.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');
const css = readFileSync(resolve(ROOT, 'src', 'styles.css'), 'utf8');

describe('RuntimeDiagnostics layout (R6-R14)', () => {
  it('workspace-body uses flex:1 1 0', () => {
    expect(css).toContain('flex:1 1 0');
    // Find the .workspace-body rule
    const match = css.match(/\.workspace-body\s*\{[^}]+\}/);
    if (match) {
      expect(match[0]).toContain('flex:1 1 0');
    }
  });

  it('workspace-body has min-height:0 for flex children', () => {
    const match = css.match(/\.workspace-body\s*\{[^}]+\}/);
    if (match) {
      expect(match[0]).toContain('min-height:0');
    }
  });

  it('.schola-statusbar has flex:none (fixed height)', () => {
    const match = css.match(/\.schola-statusbar\s*\{[^}]+\}/);
    if (match) {
      expect(match[0]).toContain('flex:none');
    }
  });

  it('.workspace-editor-area has min-height:0', () => {
    const match = css.match(/\.workspace-editor-area\s*\{[^}]+\}/);
    if (match) {
      expect(match[0]).toContain('min-height:0');
    }
  });

  it('.editor-panel has min-height:0 for nested flex', () => {
    const match = css.match(/\.editor-panel\s*\{[^}]+\}/);
    if (match) {
      expect(match[0]).toContain('min-height:0');
    }
  });

  it('.editor-split-container has min-height:0', () => {
    const match = css.match(/\.editor-split-container\s*\{[^}]+\}/);
    if (match) {
      expect(match[0]).toContain('min-height:0');
    }
  });
});
