/**
 * no-phase-labels-in-workspace-r6-public — Phase 5-PUBLIC-LABEL-POLISH.
 *
 * Verifies workspace views and toolbars do NOT contain internal phase labels.
 * Source-code analysis (no React deps).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function readSrc(relativePath: string): string {
  return readFileSync(resolve(__dirname, '..', '..', '..', relativePath), 'utf-8');
}

describe('no-phase-labels-in-workspace-r6-public', () => {
  describe('ProductizedEmptyViews — Artifact', () => {
    const source = readSrc('src/features/workspace/views/ProductizedEmptyViews.tsx');

    it('does NOT contain Phase 5-4', () => {
      expect(source).not.toMatch(/Phase\s*5-4/);
    });

    it('contains 后续完成', () => {
      expect(source).toContain('导出与保存功能将在后续完成');
    });
  });

  describe('ProductizedEmptyViews — Plugin', () => {
    const source = readSrc('src/features/workspace/views/ProductizedEmptyViews.tsx');

    it('does NOT contain Phase 5-P', () => {
      expect(source).not.toMatch(/Phase\s*5-P/);
    });

    it('contains follow-up text', () => {
      expect(source).toContain('Schola 插件系统将在后续完成');
      expect(source).toContain('插件生态尚未开放');
    });
  });

  describe('EditorToolbar', () => {
    const source = readSrc('src/features/workspace/components/EditorToolbar.tsx');

    it('does NOT contain Phase 5-4', () => {
      expect(source).not.toMatch(/Phase\s*5-4/);
    });

    it('uses 后续完成', () => {
      expect(source).toContain('后续完成');
    });
  });

  describe('SettingsPlaceholder', () => {
    const source = readSrc('src/features/workspace/SettingsPlaceholder.tsx');

    it('does NOT contain Phase 5-1', () => {
      expect(source).not.toMatch(/Phase\s*5-1/);
    });

    it('does NOT contain 即将推出', () => {
      expect(source).not.toContain('即将推出');
    });

    it('contains 后续完成', () => {
      expect(source).toContain('后续完成');
    });
  });

  describe('AIWorkbench', () => {
    const source = readSrc('src/features/ai-workbench/AIWorkbench.tsx');

    it('does NOT contain Phase 4-2-B', () => {
      expect(source).not.toMatch(/Phase\s*4-2-B/);
    });
  });

  describe('app.ipc.ts', () => {
    const source = readSrc('electron/ipc/app.ipc.ts');

    it('does NOT use phase-1-c', () => {
      expect(source).not.toMatch(/phase-1-c/);
    });

    it('uses Bate', () => {
      expect(source).toMatch(/Bate/u);
    });
  });

  describe('AppInfo type', () => {
    const source = readSrc('src/lib/contracts/app.types.ts');

    it('phase field is string type', () => {
      expect(source).toMatch(/phase:\s*string/);
    });
  });
});
