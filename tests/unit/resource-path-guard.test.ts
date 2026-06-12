/**
 * Path guard unit tests — Phase 5-4A-TD.
 *
 * Tests resolveVaultPath, isExcludedSystemPath, and path sanitization
 * from electron/security/path-guard.ts.
 *
 * Environment: Node (vitest). Uses os.tmpdir() for safe temp paths.
 */
import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  resolveVaultPath,
  toVaultRelativePath,
  isExcludedSystemPath,
  SKIP_SCAN_DIRECTORIES,
  normalizeVaultRoot,
  assertPathInsideRoot,
} from '../../electron/security/path-guard';

// Create a safe temp vault root for testing
function tempRoot(label: string): string {
  const dir = path.join(os.tmpdir(), `schola-path-guard-test-${label}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── resolveVaultPath — path traversal ────────────

describe('resolveVaultPath', () => {
  it('resolves simple relative path', () => {
    const root = tempRoot('simple');
    const result = resolveVaultPath(root, 'notes/test.md');
    expect(result).toBe(path.resolve(root, 'notes/test.md'));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('rejects ../ traversal', () => {
    const root = tempRoot('traversal');
    expect(() => resolveVaultPath(root, '../outside.txt')).toThrow();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('rejects multiple ../ traversal', () => {
    const root = tempRoot('multi-traversal');
    expect(() => resolveVaultPath(root, '../../etc/passwd')).toThrow();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('rejects absolute path as relative input', () => {
    const root = tempRoot('absolute-input');
    expect(() => resolveVaultPath(root, '/etc/passwd')).toThrow();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('rejects Windows absolute path as relative input', () => {
    const root = tempRoot('win-absolute');
    expect(() => resolveVaultPath(root, 'C:\\Windows\\System32\\evil.exe')).toThrow();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('allows nested safe paths', () => {
    const root = tempRoot('nested');
    const result = resolveVaultPath(root, 'resources/pdf/sub/deep/paper.pdf');
    expect(result).toBe(path.resolve(root, 'resources/pdf/sub/deep/paper.pdf'));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('rejects writing outside vault via ../', () => {
    const root = tempRoot('outside');
    // Try to escape to a sibling directory
    expect(() => resolveVaultPath(root, '../sibling/file.txt')).toThrow();
    fs.rmSync(root, { recursive: true, force: true });
  });
});

// ── toVaultRelativePath ───────────────────────────

describe('toVaultRelativePath', () => {
  it('converts absolute path to vault-relative', () => {
    const root = tempRoot('to-rel');
    const abs = path.join(root, 'notes', 'test.md');
    const rel = toVaultRelativePath(root, abs);
    expect(rel).toBe('notes/test.md');
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('rejects path outside vault', () => {
    const root = tempRoot('to-rel-outside');
    expect(() => toVaultRelativePath(root, '/etc/passwd')).toThrow();
    fs.rmSync(root, { recursive: true, force: true });
  });
});

// ── isExcludedSystemPath ─────────────────────────

describe('isExcludedSystemPath', () => {
  it('_exports is excluded', () => {
    expect(isExcludedSystemPath('_exports/report.html')).toBe(true);
  });

  it('_exports at root is excluded', () => {
    expect(isExcludedSystemPath('_exports')).toBe(true);
  });

  it('_trash is excluded', () => {
    expect(isExcludedSystemPath('_trash/old-note.md')).toBe(true);
  });

  it('_trash at any depth is excluded', () => {
    expect(isExcludedSystemPath('some/deep/path/_trash/file.txt')).toBe(true);
  });

  it('notes/my-exports-note.md is NOT excluded (false positive guard)', () => {
    expect(isExcludedSystemPath('notes/my-exports-note.md')).toBe(false);
  });

  it('normal path is not excluded', () => {
    expect(isExcludedSystemPath('notes/readme.md')).toBe(false);
  });

  it('resources path is not excluded', () => {
    expect(isExcludedSystemPath('resources/pdf/paper.pdf')).toBe(false);
  });
});

// ── SKIP_SCAN_DIRECTORIES ─────────────────────────

describe('SKIP_SCAN_DIRECTORIES', () => {
  it('contains _exports', () => {
    expect(SKIP_SCAN_DIRECTORIES.has('_exports')).toBe(true);
  });

  it('contains _trash', () => {
    expect(SKIP_SCAN_DIRECTORIES.has('_trash')).toBe(true);
  });
});

// ── normalizeVaultRoot ────────────────────────────

describe('normalizeVaultRoot', () => {
  it('resolves the given path', () => {
    const root = tempRoot('normalize');
    const result = normalizeVaultRoot(root);
    expect(result).toBe(path.resolve(root));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('empty path resolves to cwd (path.resolve behavior)', () => {
    // path.resolve('') returns process.cwd(), so normalizeVaultRoot does not throw
    const result = normalizeVaultRoot('');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('whitespace-only path resolves to cwd', () => {
    const result = normalizeVaultRoot('   ');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── assertPathInsideRoot ──────────────────────────

describe('assertPathInsideRoot', () => {
  it('does not throw for path inside root', () => {
    const root = tempRoot('assert-ok');
    const inside = path.join(root, 'notes', 'test.md');
    expect(() => assertPathInsideRoot(root, inside)).not.toThrow();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('throws for path outside root', () => {
    const root = tempRoot('assert-fail');
    expect(() => assertPathInsideRoot(root, '/etc/passwd')).toThrow('Path escapes the vault root.');
    fs.rmSync(root, { recursive: true, force: true });
  });
});

// ── Error message sanitization ────────────────────

describe('PathGuard — error message safety', () => {
  it('resolveVaultPath error does not contain system path', () => {
    const root = tempRoot('err-msg');
    try {
      resolveVaultPath(root, '../outside');
    } catch (e) {
      const msg = (e as Error).message;
      // The error message should not reveal the vault root
      expect(msg).not.toContain(':\\');
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('toVaultRelativePath error does not reveal root path', () => {
    const root = tempRoot('err-rel');
    try {
      toVaultRelativePath(root, '/etc/passwd');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toBe('Path escapes the vault root.');
      expect(msg).not.toContain('/etc');
    }
    fs.rmSync(root, { recursive: true, force: true });
  });
});

// ── .schola path handling (design verification) ───

describe('PathGuard — .schola path handling', () => {
  it('resolveVaultPath allows .schola/metadata/resources/', () => {
    const root = tempRoot('schola-meta');
    const result = resolveVaultPath(root, '.schola/metadata/resources/res_abc.json');
    expect(result).toBe(path.resolve(root, '.schola/metadata/resources/res_abc.json'));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('resolveVaultPath allows .schola subdirectory writes', () => {
    const root = tempRoot('schola-sub');
    const result = resolveVaultPath(root, '.schola/config/test.json');
    expect(result).toBe(path.resolve(root, '.schola/config/test.json'));
    fs.rmSync(root, { recursive: true, force: true });
  });
});

// ── Destination relative path safety ──────────────

describe('PathGuard — destination path safety', () => {
  it('toVaultRelativePath returns POSIX-style separators', () => {
    const root = tempRoot('posix-sep');
    const abs = path.join(root, 'resources', 'pdf', 'paper.pdf');
    const rel = toVaultRelativePath(root, abs);
    expect(rel).not.toContain('\\');
    expect(rel).toBe('resources/pdf/paper.pdf');
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('destination relative path has no absolute prefix', () => {
    const root = tempRoot('no-abs');
    const abs = path.join(root, 'notes', 'test.md');
    const rel = toVaultRelativePath(root, abs);
    expect(rel).not.toContain(':\\');
    expect(rel).not.toContain('/home/');
    expect(rel).not.toContain('/Users/');
    expect(rel).not.toContain('C:');
    fs.rmSync(root, { recursive: true, force: true });
  });
});
