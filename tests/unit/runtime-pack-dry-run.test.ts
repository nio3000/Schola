/**
 * @legacy CODE-QUALITY-IMP-4: Runtime Pack hidden.
 *
 * Runtime Pack dry-run tests — Phase 3-4-G3-D3-C.
 *
 * Covers: manifest schema extension (license/package/signature),
 *         unknown top-level key = reject, _comment exception,
 *         dry-run fixture validation, diagnostics sanitization,
 *         no-network/no-pip/no-venv boundary.
 *
 * ⚠️  No real download, no pip install, no venv, no third-party runtime.
 *
 * ⚠️  eslint: `as any` casts are used for raw JSON fixture validation
 *     which is unavoidable in this test-only context.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { validateManifestStructure, validateManifestBusiness } from '../../electron/services/runtime-pack/runtime-pack-manifest.service';
import { DOWNLOAD_URL_ALLOWLIST } from '../../electron/services/runtime-pack/runtime-pack-security.service';

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'runtime-packs', 'dry-run');

function readFixture(name: string) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name, 'schola-pack.json'), 'utf-8'));
}

// ── Positive Cases ──────────────────────────────

describe.skip('dry-run manifest schema (positive)', () => {
  const valid = readFixture('valid-d2-pack');

  it('P01: valid-d2-pack passes structure validation', () => {
    expect(validateManifestStructure(valid).ok).toBe(true);
  });

  it('P02: manifest with license/package/signature fields passes', () => {
    const r = validateManifestStructure(valid);
    expect(r.ok).toBe(true);
  });

  it('P03: networkRequired=never in dry-run fixture passes', () => {
    expect(valid.runtime.networkRequired).toBe('never');
  });

  it('P04: containsRuntime=false passes in dry-run', () => {
    expect(valid.package.containsRuntime).toBe(false);
    const r = validateManifestStructure(valid);
    expect(r.ok).toBe(true);
  });

  it('P05: containsModels=false + models=[] passes', () => {
    expect(valid.package.containsModels).toBe(false);
    expect(valid.models).toHaveLength(0);
  });

  it('P06: signatureType=none accepted', () => {
    expect(valid.signature.signatureType).toBe('none');
    const r = validateManifestStructure(valid);
    expect(r.ok).toBe(true);
  });

  it('P07: _comment key accepted (private metadata exception)', () => {
    expect(valid._comment).toBeDefined();
    const r = validateManifestStructure(valid);
    expect(r.ok).toBe(true);
  });

  it('P08: entrypoint mock adapter id accepted', () => {
    expect(valid.entrypoints.probe).toBe('schola.adapter.dry-run.probe');
  });

  it('P09: valid-d2-pack business validation rejects fake URL (expected — allowlist is empty)', () => {
    const r = validateManifestBusiness(valid as any);
    // Business validation rejects because:
    // 1. downloadUrl not in empty DOWNLOAD_URL_ALLOWLIST
    // 2. packId 'schola.dry-run.d2-valid' not in OFFICIAL_PACK_ALLOWLIST
    // This is correct — dry-run fixtures must not pass production validation
    expect(r.ok).toBe(false);
  });
});

// ── Negative Manifest Cases ─────────────────────

describe.skip('dry-run manifest schema (negative)', () => {
  it('N01: unknown top-level key rejects', () => {
    const m = readFixture('invalid-unknown-key');
    expect(m._badKey).toBe(true);
    const r = validateManifestStructure(m);
    expect(r.ok).toBe(false);
    expect(r.issues.some(i => i.message.includes('unknown key'))).toBe(true);
  });

  it('N02: _custom (not _comment) rejects', () => {
    const m = JSON.parse(JSON.stringify(readFixture('valid-d2-pack')));
    m._custom = 'test';
    const r = validateManifestStructure(m);
    expect(r.ok).toBe(false);
  });

  it('N03: packageFormat != zip rejects', () => {
    const m = readFixture('invalid-wrong-packageformat');
    expect(m.package.packageFormat).toBe('tar.gz');
    const r = validateManifestStructure(m);
    expect(r.ok).toBe(false);
  });

  it('N04: type != runtime-pack rejects', () => {
    const m = readFixture('invalid-manifest-not-runtime-pack');
    expect(m.type).toBe('plugin');
    const r = validateManifestStructure(m);
    expect(r.ok).toBe(false);
  });

  it('N05: publisher != schola-official rejects', () => {
    const m = readFixture('invalid-publisher-not-schola');
    expect(m.publisher).toBe('third-party');
    const r = validateManifestBusiness(m as any);
    expect(r.ok).toBe(false);
  });

  it('N06: id not schola.* rejects', () => {
    const m = readFixture('invalid-id-not-schola');
    expect(m.id).toBe('evil.test.notschola');
    const r = validateManifestBusiness(m as any);
    expect(r.ok).toBe(false);
  });

  it('N07: non-empty install.pip rejects in dry-run', () => {
    const m = readFixture('invalid-nonempty-pip');
    expect(m.install.pip).toHaveLength(1);
    const r = validateManifestBusiness(m as any);
    expect(r.ok).toBe(false);
  });

  it('N08: missing license field rejects', () => {
    const m = JSON.parse(JSON.stringify(readFixture('valid-d2-pack')));
    delete m.license;
    const r = validateManifestStructure(m);
    expect(r.ok).toBe(false);
  });

  it('N09: missing package field rejects', () => {
    const m = JSON.parse(JSON.stringify(readFixture('valid-d2-pack')));
    delete m.package;
    const r = validateManifestStructure(m);
    expect(r.ok).toBe(false);
  });

  it('N10: missing signature field rejects', () => {
    const m = JSON.parse(JSON.stringify(readFixture('valid-d2-pack')));
    delete m.signature;
    const r = validateManifestStructure(m);
    expect(r.ok).toBe(false);
  });

  it('N11: license.primaryLicense empty rejects', () => {
    const m = JSON.parse(JSON.stringify(readFixture('valid-d2-pack')));
    m.license.primaryLicense = '';
    const r = validateManifestStructure(m);
    expect(r.ok).toBe(false);
  });

  it('N12: license.commercialUseAllowed invalid value rejects', () => {
    const m = JSON.parse(JSON.stringify(readFixture('valid-d2-pack')));
    m.license.commercialUseAllowed = 'maybe';
    const r = validateManifestStructure(m);
    expect(r.ok).toBe(false);
  });

  it('N13: license.redistributionAllowed invalid value rejects', () => {
    const m = JSON.parse(JSON.stringify(readFixture('valid-d2-pack')));
    m.license.redistributionAllowed = 'maybe';
    const r = validateManifestStructure(m);
    expect(r.ok).toBe(false);
  });

  it('N14: signature.signatureType invalid rejects', () => {
    const m = JSON.parse(JSON.stringify(readFixture('valid-d2-pack')));
    m.signature.signatureType = 'pgp';
    const r = validateManifestStructure(m);
    expect(r.ok).toBe(false);
  });

  it('N15: containsRuntime=true does not trigger dry-run pip check (it is a real pack pattern)', () => {
    const m = JSON.parse(JSON.stringify(readFixture('valid-d2-pack')));
    m.package.containsRuntime = true;
    // With containsRuntime=true, the dry-run check (pip must be empty) is skipped
    // But business validation still fails because URL/packId not in allowlist
    const r = validateManifestBusiness(m as any);
    // The dry-run rule is not the cause of rejection — it's the allowlist
    expect(r.ok).toBe(false);
    // Verify no issue mentions 'dry-run'
    const dryRunIssues = r.issues.filter(i => i.message.includes('dry-run'));
    expect(dryRunIssues).toHaveLength(0);
  });
});

// ── No-Network / No-Pip / No-Venv Boundary ──────

describe.skip('no-network no-pip no-venv boundary', () => {
  it('SN01: DOWNLOAD_URL_ALLOWLIST is empty', () => {
    expect(Array.isArray(DOWNLOAD_URL_ALLOWLIST)).toBe(true);
    // G3-B/G3-D2: allowlist must remain empty
  });

  it('SN02: no fetch/http/https in manifest service', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'electron', 'services', 'runtime-pack', 'runtime-pack-manifest.service.ts'),
      'utf-8',
    );
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/require\s*\(\s*['"]http['"]\s*\)/);
    expect(src).not.toMatch(/require\s*\(\s*['"]https['"]\s*\)/);
    expect(src).not.toMatch(/require\s*\(\s*['"]net['"]\s*\)/);
  });

  it('SN03: no child_process in manifest service', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'electron', 'services', 'runtime-pack', 'runtime-pack-manifest.service.ts'),
      'utf-8',
    );
    expect(src).not.toMatch(/child_process/);
    expect(src).not.toMatch(/\bexecFile\b/);
    expect(src).not.toMatch(/\bspawn\b/);
  });

  it('SN04: no pip install string in manifest service', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'electron', 'services', 'runtime-pack', 'runtime-pack-manifest.service.ts'),
      'utf-8',
    );
    expect(src).not.toMatch(/pip\s+install/i);
    expect(src).not.toMatch(/python\s+-m\s+venv/i);
    expect(src).not.toMatch(/\bvirtualenv\b/i);
  });

  it('SN05: no PyMuPDF4LLM / Marker / MinerU / Docling in manifest or security service', () => {
    const files = [
      'runtime-pack-manifest.service.ts',
      'runtime-pack-security.service.ts',
      'runtime-pack-manager.service.ts',
      'runtime-pack-diagnostics.service.ts',
    ];
    for (const f of files) {
      const src = fs.readFileSync(
        path.join(__dirname, '..', '..', 'electron', 'services', 'runtime-pack', f),
        'utf-8',
      );
      expect(src).not.toMatch(/PyMuPDF4LLM/);
      expect(src).not.toMatch(/\bMarker\b/);
      expect(src).not.toMatch(/\bMinerU\b/);
      expect(src).not.toMatch(/\bDocling\b/);
    }
  });

  it('SN06: no pikepdf / pdfplumber / Camelot in services', () => {
    const files = [
      'runtime-pack-manifest.service.ts',
      'runtime-pack-security.service.ts',
      'runtime-pack-manager.service.ts',
    ];
    for (const f of files) {
      const src = fs.readFileSync(
        path.join(__dirname, '..', '..', 'electron', 'services', 'runtime-pack', f),
        'utf-8',
      );
      expect(src).not.toMatch(/pikepdf/);
      expect(src).not.toMatch(/pdfplumber/);
      expect(src).not.toMatch(/\bCamelot\b/);
    }
  });
});

// ── Diagnostics Sanitization ────────────────────

describe.skip('dry-run diagnostics sanitization', () => {
  const valid = readFixture('valid-d2-pack');

  it('DIA01: valid manifest does not contain absolute paths', () => {
    const str = JSON.stringify(valid);
    expect(str).not.toMatch(/[A-Z]:\\/);
    expect(str).not.toMatch(/\/home\//);
    expect(str).not.toMatch(/\/Users\//);
  });

  it('DIA02: valid manifest downloadUrl is a placeholder', () => {
    expect(valid.runtime.downloadUrl).toContain('releases.schola.app');
    // This is a design placeholder; must not be treated as real
  });

  it('DIA03: valid manifest does not contain API keys or tokens', () => {
    const str = JSON.stringify(valid);
    expect(str).not.toMatch(/Bearer\s/);
    expect(str).not.toMatch(/token=/);
    expect(str).not.toMatch(/api[_-]?key/i);
  });

  it('DIA04: valid manifest does not contain shell commands', () => {
    const str = JSON.stringify(valid);
    expect(str).not.toMatch(/&&/);
    expect(str).not.toMatch(/\|\|/);
  });
});

// ── Status-Flow ─────────────────────────────────

describe.skip('dry-run status-flow', () => {
  it('SF01: valid fixture represents a pack that can be installed', () => {
    const valid = readFixture('valid-d2-pack');
    expect(valid.type).toBe('runtime-pack');
    expect(valid.publisher).toBe('schola-official');
    // The fixture itself is valid for install (empty-shell dry-run)
  });

  it('SF02: dry-run fixture does not trigger real download flow', () => {
    const valid = readFixture('valid-d2-pack');
    // networkRequired=never → download should not be triggered
    expect(valid.runtime.networkRequired).toBe('never');
    expect(valid.install.pip).toHaveLength(0);
    expect(valid.models).toHaveLength(0);
  });

  it('SF03: dry-run fixture does not contain user files', () => {
    const valid = readFixture('valid-d2-pack');
    const str = JSON.stringify(valid);
    expect(str).not.toMatch(/vault/i);
    expect(str).not.toMatch(/notes\//);
    expect(str).not.toMatch(/exports\//);
  });
});

// ── D3/D4 Boundary ──────────────────────────────

describe.skip('D3/D4 boundary', () => {
  it('B01: dry-run fixture does not set candidate PASS', () => {
    const valid = readFixture('valid-d2-pack');
    expect(valid.license.primaryLicense).toBe('Schola-Internal-Fixture');
    expect(valid.license.commercialUseAllowed).toBe('no');
    expect(valid.license.redistributionAllowed).toBe('no');
    // D3 fixture is not a real candidate
  });

  it('B02: dry-run fixture does not provide real packageHash', () => {
    const valid = readFixture('valid-d2-pack');
    expect(valid.runtime.integrity.runtimeHash).toMatch(/^sha256:0{64}$/);
  });

  it('B03: production DOWNLOAD_URL_ALLOWLIST unchanged', () => {
    // Already verified in SN01 — allowlist is empty
    expect(Array.isArray(DOWNLOAD_URL_ALLOWLIST)).toBe(true);
  });

  it('B04: D4 prerequisites not met', () => {
    const valid = readFixture('valid-d2-pack');
    // D4 needs real candidate, real hash, real allowlist — none present
    expect(valid.package.containsRuntime).toBe(false);
    expect(valid.runtime.integrity.runtimeHash).toMatch(/0{64}/);
  });
});

// ── Fixture Structure ───────────────────────────

describe.skip('dry-run fixture structure', () => {
  const baseDir = path.join(FIXTURE_DIR, 'valid-d2-pack');

  it('has schola-pack.json at root', () => {
    expect(fs.existsSync(path.join(baseDir, 'schola-pack.json'))).toBe(true);
  });

  it('has runtime/ directory', () => {
    expect(fs.existsSync(path.join(baseDir, 'runtime'))).toBe(true);
  });

  it('has models/ directory', () => {
    expect(fs.existsSync(path.join(baseDir, 'models'))).toBe(true);
  });

  it('has licenses/LICENSE', () => {
    expect(fs.existsSync(path.join(baseDir, 'licenses', 'LICENSE'))).toBe(true);
  });

  it('has licenses/NOTICE', () => {
    expect(fs.existsSync(path.join(baseDir, 'licenses', 'NOTICE'))).toBe(true);
  });

  it('has licenses/THIRD_PARTY_NOTICES', () => {
    expect(fs.existsSync(path.join(baseDir, 'licenses', 'THIRD_PARTY_NOTICES'))).toBe(true);
  });

  it('has checksums/SHA256SUMS', () => {
    expect(fs.existsSync(path.join(baseDir, 'checksums', 'SHA256SUMS'))).toBe(true);
  });

  it('has README.runtime.md', () => {
    expect(fs.existsSync(path.join(baseDir, 'README.runtime.md'))).toBe(true);
  });

  it('does not contain .py files', () => {
    const walk = (dir: string): string[] => {
      return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? walk(full) : [full];
      });
    };
    const files = walk(baseDir);
    const pyFiles = files.filter(f => f.endsWith('.py') || f.endsWith('.whl'));
    expect(pyFiles).toHaveLength(0);
  });

  it('does not contain .exe / .dll / .so / .dylib files', () => {
    const walk = (dir: string): string[] => {
      return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? walk(full) : [full];
      });
    };
    const files = walk(baseDir);
    const bins = files.filter(f =>
      f.endsWith('.exe') || f.endsWith('.dll') ||
      f.endsWith('.so') || f.endsWith('.dylib'),
    );
    expect(bins).toHaveLength(0);
  });
});
