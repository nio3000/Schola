/**
 * @legacy CODE-QUALITY-IMP-4: Runtime Pack hidden.
 *
 * Runtime Pack unit tests — Phase 3-4-G3-B.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { packIdToDirName } from '../../electron/services/runtime-pack/runtime-pack-path.service';
import { validateDownloadUrl, validatePipEntries } from '../../electron/services/runtime-pack/runtime-pack-security.service';
import { validateManifestStructure, validateManifestBusiness } from '../../electron/services/runtime-pack/runtime-pack-manifest.service';
import { getStatus, setStatus, removeStatus, getAllStatuses, createStatus } from '../../electron/services/runtime-pack/runtime-pack-status-store.service';
import { diagnosePlatform } from '../../electron/services/runtime-pack/runtime-pack-diagnostics.service';
import * as RT from '../../src/lib/contracts/runtime-pack.types';

function readFixture(name: string) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'runtime-packs', name, 'schola-pack.json'), 'utf-8'));
}

describe.skip('runtime-pack-path', () => {
  it('converts valid packId', () => {
    expect(packIdToDirName('schola.import.quick-plus')).toBe('schola-import-quick-plus');
  });
  it('rejects ../', () => expect(() => packIdToDirName('../evil')).toThrow());
  it('rejects slash', () => expect(() => packIdToDirName('schola/evil')).toThrow());
  it('rejects backslash', () => expect(() => packIdToDirName('schola\\evil')).toThrow());
  it('rejects colon', () => expect(() => packIdToDirName('C:evil')).toThrow());
  it('rejects whitespace', () => expect(() => packIdToDirName('schola test')).toThrow());
  it('rejects empty', () => expect(() => packIdToDirName('')).toThrow());
  it('rejects non-schola prefix', () => expect(() => packIdToDirName('evil.test')).toThrow());
  it('rejects double dot', () => expect(() => packIdToDirName('schola..test')).toThrow());
});

describe.skip('runtime-pack-security', () => {
  describe.skip('validateDownloadUrl', () => {
    it('rejects on empty allowlist', () => expect(() => validateDownloadUrl('https://releases.schola.app/runtimes/x.tar.gz')).toThrow('DOWNLOAD_URL_NOT_ALLOWED'));
    it('rejects http', () => expect(() => validateDownloadUrl('http://evil.com/x.tar.gz')).toThrow());
    it('rejects file://', () => expect(() => validateDownloadUrl('file:///tmp/x.tar.gz')).toThrow());
    it('rejects localhost', () => expect(() => validateDownloadUrl('http://localhost/x.tar.gz')).toThrow());
    it('rejects 127.0.0.1', () => expect(() => validateDownloadUrl('http://127.0.0.1/x.tar.gz')).toThrow());
    it('rejects private IP', () => expect(() => validateDownloadUrl('http://192.168.1.1/x.tar.gz')).toThrow());
    it('rejects github.com', () => expect(() => validateDownloadUrl('https://github.com/x.tar.gz')).toThrow());
    it('rejects token query', () => expect(() => validateDownloadUrl('https://releases.schola.app/x.tar.gz?token=abc')).toThrow());
  });

  describe.skip('validatePipEntries', () => {
    it('allows empty', () => expect(() => validatePipEntries([])).not.toThrow());
    it('allows simple name', () => expect(() => validatePipEntries(['pkg'])).not.toThrow());
    it('allows name==version', () => expect(() => validatePipEntries(['pkg==1.0'])).not.toThrow());
    it('rejects --index-url', () => expect(() => validatePipEntries(['pkg --index-url x'])).toThrow());
    it('rejects -r', () => expect(() => validatePipEntries(['-r req.txt'])).toThrow());
    it('rejects file://', () => expect(() => validatePipEntries(['file:///tmp/x.whl'])).toThrow());
    it('rejects git+https', () => expect(() => validatePipEntries(['git+https://evil'])).toThrow());
    it('rejects &&', () => expect(() => validatePipEntries(['pkg && rm'])).toThrow());
    it('rejects |', () => expect(() => validatePipEntries(['pkg | cat'])).toThrow());
  });
});

describe.skip('runtime-pack-manifest', () => {
  const valid = readFixture('valid-empty-pack');
  const badPublisher = readFixture('invalid-publisher');
  const badUrl = readFixture('invalid-url');

  it('validates valid manifest', () => expect(validateManifestStructure(valid).ok).toBe(true));
  it('rejects missing manifestVersion', () => {
    const m = { ...valid }; delete (m as any).manifestVersion;
    expect(validateManifestStructure(m).ok).toBe(false);
  });
  it('rejects manifestVersion != 1', () => {
    expect(validateManifestStructure({ ...valid, manifestVersion: '2' }).ok).toBe(false);
  });
  it('rejects type != runtime-pack', () => {
    expect(validateManifestStructure({ ...valid, type: 'plugin' }).ok).toBe(false);
  });
  it('rejects runtime.kind != python-venv', () => {
    const m = JSON.parse(JSON.stringify(valid)); m.runtime.kind = 'node-bundle';
    expect(validateManifestStructure(m).ok).toBe(false);
  });
  it('rejects missing runtimeHash', () => {
    const m = JSON.parse(JSON.stringify(valid)); delete m.runtime.integrity.runtimeHash;
    expect(validateManifestStructure(m).ok).toBe(false);
  });
  it('rejects entrypoint file path', () => {
    const m = JSON.parse(JSON.stringify(valid)); m.entrypoints.probe = 'C:\\scripts\\probe.py';
    expect(validateManifestStructure(m).ok).toBe(false);
  });
  it('rejects entrypoint ../', () => {
    const m = JSON.parse(JSON.stringify(valid)); m.entrypoints.probe = '../evil';
    expect(validateManifestStructure(m).ok).toBe(false);
  });
  it('rejects non-official publisher', () => {
    const r = validateManifestBusiness(badPublisher as any);
    expect(r.ok).toBe(false);
  });
  it('rejects invalid downloadUrl', () => {
    const r = validateManifestBusiness(badUrl as any);
    expect(r.ok).toBe(false);
  });
});

describe.skip('runtime-pack-status-store', () => {
  it('creates default status', () => {
    const s = createStatus('schola.test');
    expect(s.phase).toBe('discovered');
    expect(s.enabled).toBe(false);
  });
  it('sets and gets', () => {
    const s = createStatus('x', { phase: 'enabled' } as any);
    setStatus('x', s);
    expect(getStatus('x')?.phase).toBe('enabled');
  });
  it('removes', () => {
    setStatus('y', createStatus('y'));
    removeStatus('y');
    expect(getStatus('y')).toBeNull();
  });
});

describe.skip('runtime-pack-diagnostics', () => {
  it('detects current platform ok', () => {
    const r = diagnosePlatform({ platformRequirements: { os: [process.platform as any], arch: [process.arch], memoryMbMin: 1024, diskFreeMbMin: 100, gpuRequired: false } } as any);
    expect(r.ok).toBe(true);
  });
  it('rejects os mismatch', () => {
    const r = diagnosePlatform({ platformRequirements: { os: [process.platform === 'win32' ? 'darwin' : 'win32'], arch: [process.arch], memoryMbMin: 1024, diskFreeMbMin: 100, gpuRequired: false } } as any);
    expect(r.ok).toBe(false);
  });
  it('rejects gpuRequired without GPU', () => {
    const r = diagnosePlatform({ platformRequirements: { os: [process.platform as any], arch: [process.arch], memoryMbMin: 1024, diskFreeMbMin: 100, gpuRequired: true } } as any);
    expect(r.ok).toBe(false);
  });
});

describe.skip('runtime-pack-ipc-boundary', () => {
  it('allowed channels exported', () => {
    expect(RT.RUNTIME_LIST_PACKS_CHANNEL).toBe('runtime:list-packs');
    expect(RT.RUNTIME_INSTALL_CHANNEL).toBe('runtime:install');
    expect(RT.RUNTIME_UNINSTALL_CHANNEL).toBe('runtime:uninstall');
    expect(RT.RUNTIME_ENABLE_CHANNEL).toBe('runtime:enable');
    expect(RT.RUNTIME_DISABLE_CHANNEL).toBe('runtime:disable');
    expect(RT.RUNTIME_DIAGNOSE_CHANNEL).toBe('runtime:diagnose');
    expect(RT.RUNTIME_CLEAR_CACHE_CHANNEL).toBe('runtime:clear-cache');
    expect(RT.RUNTIME_EXPORT_DIAGNOSTICS_CHANNEL).toBe('runtime:export-diagnostics');
  });
  it('ExportDiagnosticsResult has no path', () => {
    const r: RT.ExportDiagnosticsResult = { ok: true, saved: true };
    expect(r.saved).toBe(true);
  });
});
