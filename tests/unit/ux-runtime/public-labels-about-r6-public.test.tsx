/**
 * public-labels-about-r6-public — Phase 5-PUBLIC-LABEL-POLISH.
 *
 * Verifies About page displays V1.0, Bate版, and no internal phase labels.
 * Source-code analysis — no jsdom/React deps.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function src(rel: string): string {
  return readFileSync(resolve(__dirname, '..', '..', '..', rel), 'utf-8');
}

function extractJsxText(source: string): string[] {
  const texts: string[] = [];
  const re = />([^<>{}\n]{2,})</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const t = m[1].trim();
    if (t.length > 1) texts.push(t);
  }
  return texts;
}

describe('public-labels-about', () => {
  const about = src('src/features/settings/components/AboutPage.tsx');
  const jsx = extractJsxText(about);

  it('About page formats version as V{version}', () => {
    expect(about).toContain('V{appInfo.version}');
  });

  it('About page does NOT display phase-1-c', () => {
    expect(about).not.toMatch(/phase-1-c/);
  });

  it('About page does NOT display Phase 5 - Productization', () => {
    expect(about).not.toMatch(/Phase\s*5.*Productization/);
    expect(about).not.toContain('Productization');
  });

  it('About page displays Schola description', () => {
    expect(about).toContain('面向高校科研人员与教育工作者的本地优先知识工作台');
  });

  it('About page no internal Phase labels in visible text', () => {
    jsx.forEach((t) => {
      expect(t).not.toMatch(/Phase\s*[0-9]/);
    });
    expect(about).not.toMatch(/PRECHECK/);
  });

  it('About page has 版本 and 阶段 fields', () => {
    expect(about).toContain('版本');
    expect(about).toContain('阶段');
  });

  const ipc = src('electron/ipc/app.ipc.ts');
  it('IPC phase is Bate版 not phase-1-c', () => {
    expect(ipc).not.toMatch(/phase-1-c/);
    expect(ipc).toMatch(/Bate/u);
  });

  it('IPC name is Schola', () => {
    expect(ipc).toMatch(/name:\s*'Schola'/);
  });

  const ct = src('src/lib/contracts/app.types.ts');
  it('AppInfo.phase is string type', () => {
    expect(ct).toMatch(/phase:\s*string/);
  });

  const pkg = JSON.parse(
    readFileSync(resolve(__dirname, '..', '..', '..', 'package.json'), 'utf-8'),
  );
  it('package version is 1.0.0', () => {
    expect(pkg.version).toBe('1.0.0');
  });
});
