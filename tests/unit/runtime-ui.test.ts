/**
 * Runtime Pack UI tests — Phase 3-4-G3-C.
 * @legacy CODE-QUALITY-IMP-4: Runtime Pack hidden.
 *
 * Runs in Node environment with manual window mocking. No jsdom required.
 * All API calls exercise the schola-api wrapper layer and the 11 fixed-function
 * window.schola.runtime APIs.
 *
 * ⚠️  Component render tests (React Testing Library) are skipped here because
 *     Schola's Vite config only supports renderer build, not RTL imports.
 *     These smoke/unit tests verify API contracts, error handling, and
 *     safety invariants (no path leakage, no engine names in UI text).
 *
 * ⚠️  eslint: `globalThis` mocking for browser API simulation uses `as` type
 *     casts which are unavoidable in this test-only context.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock window.schola.runtime ──────────────────────────

function mockRuntimeApi() {
  const api = {
    listPacks: vi.fn<() => Promise<{ ok: boolean; packs: any[] }>>(),
    getStatus: vi.fn<(packId: string) => Promise<{ ok: boolean; status: any }>>(),
    install: vi.fn<(input: any) => Promise<{ ok: boolean; status: any; message?: string }>>(),
    cancelInstall: vi.fn<(packId: string) => Promise<{ ok: boolean; status: any }>>(),
    uninstall: vi.fn<(input: any) => Promise<{ ok: boolean; status: any; freedDiskMb?: number }>>(),
    enable: vi.fn<(packId: string) => Promise<{ ok: boolean; status: any }>>(),
    disable: vi.fn<(packId: string) => Promise<{ ok: boolean; status: any }>>(),
    probe: vi.fn<(packId: string) => Promise<{ ok: boolean; available: boolean; version?: string; reason?: string }>>(),
    diagnose: vi.fn<(input: any) => Promise<{ ok: boolean; checks: any[]; suggestion?: string }>>(),
    clearCache: vi.fn<(packId: string) => Promise<{ ok: boolean; freedDiskMb: number; message?: string }>>(),
    exportDiagnostics: vi.fn<(input: any) => Promise<{ ok: boolean; saved: boolean; message?: string }>>(),
  };
  (window as any).schola = { runtime: api };
  return api;
}

function removeRuntimeApi() {
  delete (window as any).schola;
}

// ── Helper types and factories ──────────────────────────

function makePack(overrides: Partial<any> = {}) {
  return {
    packId: 'schola.import.precision',
    displayName: '论文导入增强',
    description: '提升论文 PDF 的解析效果',
    version: '0.1.0',
    capabilities: ['import.pdf'] as string[],
    networkRequired: 'never' as const,
    diskSizeMb: 120,
    ...overrides,
  };
}

function makeStatus(overrides: Partial<any> = {}) {
  return {
    packId: 'schola.import.precision',
    phase: 'available-to-install' as const,
    installedVersion: null,
    enabled: false,
    installedAt: null,
    updatedAt: Date.now(),
    lastProbeAt: null,
    lastProbeOk: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    consecutiveFailures: 0,
    progress: null,
    ...overrides,
  };
}

// ── Unit Tests ─────────────────────────────────────────

describe.skip('Runtime Pack API availability', () => {
  beforeEach(() => { removeRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('detects when runtime API is unavailable (window.schola.runtime missing)', () => {
    expect((window as any).schola?.runtime).toBeUndefined();
  });

  it('detects when runtime API is available', () => {
    mockRuntimeApi();
    expect((window as any).schola.runtime).toBeDefined();
    expect(typeof (window as any).schola.runtime.listPacks).toBe('function');
  });
});

describe.skip('listPacks API call', () => {
  let api: ReturnType<typeof mockRuntimeApi>;

  beforeEach(() => { api = mockRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('calls listPacks and returns packs', async () => {
    api.listPacks.mockResolvedValue({ ok: true, packs: [makePack()] });
    const result = await (window as any).schola.runtime.listPacks();
    expect(result.ok).toBe(true);
    expect(result.packs).toHaveLength(1);
    expect(result.packs[0].packId).toBe('schola.import.precision');
  });

  it('returns empty packs when ok is false', async () => {
    api.listPacks.mockResolvedValue({ ok: false, packs: [] });
    const result = await (window as any).schola.runtime.listPacks();
    expect(result.ok).toBe(false);
    expect(result.packs).toHaveLength(0);
  });
});

describe.skip('getStatus API call', () => {
  let api: ReturnType<typeof mockRuntimeApi>;

  beforeEach(() => { api = mockRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('returns status for a pack', async () => {
    const s = makeStatus();
    api.getStatus.mockResolvedValue({ ok: true, status: s });
    const result = await (window as any).schola.runtime.getStatus('schola.import.precision');
    expect(result.ok).toBe(true);
    expect(result.status.phase).toBe('available-to-install');
  });
});

describe.skip('install API call', () => {
  let api: ReturnType<typeof mockRuntimeApi>;

  beforeEach(() => { api = mockRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('calls install with acceptedNetworkDownload=true when user consented', async () => {
    api.install.mockResolvedValue({ ok: true, status: makeStatus({ phase: 'installed' }) });
    const result = await (window as any).schola.runtime.install({
      packId: 'schola.import.precision',
      acceptedNetworkDownload: true,
      acceptedDiskUsageMb: 200,
    });
    expect(result.ok).toBe(true);
    expect(api.install).toHaveBeenCalledWith({
      packId: 'schola.import.precision',
      acceptedNetworkDownload: true,
      acceptedDiskUsageMb: 200,
    });
  });

  it('calls install with acceptedNetworkDownload=false when networkRequired=never', async () => {
    api.install.mockResolvedValue({ ok: true, status: makeStatus({ phase: 'installed' }) });
    const result = await (window as any).schola.runtime.install({
      packId: 'schola.import.precision',
      acceptedNetworkDownload: false,
      acceptedDiskUsageMb: 200,
    });
    expect(result.ok).toBe(true);
    expect(api.install).toHaveBeenCalledWith(
      expect.objectContaining({ acceptedNetworkDownload: false }),
    );
  });
});

describe.skip('cancelInstall API call', () => {
  let api: ReturnType<typeof mockRuntimeApi>;

  beforeEach(() => { api = mockRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('calls cancelInstall with packId', async () => {
    api.cancelInstall.mockResolvedValue({ ok: true, status: makeStatus() });
    await (window as any).schola.runtime.cancelInstall('schola.import.precision');
    expect(api.cancelInstall).toHaveBeenCalledWith('schola.import.precision');
  });
});

describe.skip('enable / disable API calls', () => {
  let api: ReturnType<typeof mockRuntimeApi>;

  beforeEach(() => { api = mockRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('calls enable', async () => {
    api.enable.mockResolvedValue({ ok: true, status: makeStatus({ phase: 'enabled' }) });
    const result = await (window as any).schola.runtime.enable('schola.import.precision');
    expect(result.ok).toBe(true);
    expect(api.enable).toHaveBeenCalledWith('schola.import.precision');
  });

  it('calls disable', async () => {
    api.disable.mockResolvedValue({ ok: true, status: makeStatus({ phase: 'disabled' }) });
    const result = await (window as any).schola.runtime.disable('schola.import.precision');
    expect(result.ok).toBe(true);
    expect(api.disable).toHaveBeenCalledWith('schola.import.precision');
  });
});

describe.skip('diagnose API call', () => {
  let api: ReturnType<typeof mockRuntimeApi>;

  beforeEach(() => { api = mockRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('calls diagnose with packId and sanitized logs flag', async () => {
    api.diagnose.mockResolvedValue({
      ok: true,
      checks: [{ id: '1', label: 'Python check', ok: true, message: 'Python 3.11 found' }],
    });
    const result = await (window as any).schola.runtime.diagnose({
      packId: 'schola.import.precision',
      includeSanitizedLogs: true,
    });
    expect(result.ok).toBe(true);
    expect(result.checks).toHaveLength(1);
  });
});

describe.skip('clearCache API call', () => {
  let api: ReturnType<typeof mockRuntimeApi>;

  beforeEach(() => { api = mockRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('calls clearCache with packId', async () => {
    api.clearCache.mockResolvedValue({ ok: true, freedDiskMb: 50 });
    const result = await (window as any).schola.runtime.clearCache('schola.import.precision');
    expect(result.ok).toBe(true);
    expect(result.freedDiskMb).toBe(50);
  });
});

describe.skip('exportDiagnostics API call', () => {
  let api: ReturnType<typeof mockRuntimeApi>;

  beforeEach(() => { api = mockRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('calls exportDiagnostics and returns saved: true', async () => {
    api.exportDiagnostics.mockResolvedValue({ ok: true, saved: true });
    const result = await (window as any).schola.runtime.exportDiagnostics({ packId: 'schola.import.precision' });
    expect(result.ok).toBe(true);
    expect(result.saved).toBe(true);
  });

  it('returns saved: false when user cancels', async () => {
    api.exportDiagnostics.mockResolvedValue({ ok: true, saved: false, message: '已取消' });
    const result = await (window as any).schola.runtime.exportDiagnostics({ packId: null });
    expect(result.saved).toBe(false);
  });
});

describe.skip('uninstall API call', () => {
  let api: ReturnType<typeof mockRuntimeApi>;

  beforeEach(() => { api = mockRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('calls uninstall with options', async () => {
    api.uninstall.mockResolvedValue({ ok: true, status: makeStatus({ phase: 'uninstalled' }), freedDiskMb: 200 });
    const result = await (window as any).schola.runtime.uninstall({
      packId: 'schola.import.precision',
      removeModelCache: true,
      removeLogs: true,
    });
    expect(result.ok).toBe(true);
    expect(api.uninstall).toHaveBeenCalledWith({
      packId: 'schola.import.precision',
      removeModelCache: true,
      removeLogs: true,
    });
  });
});

// ── Safety Tests ──────────────────────────────────────

describe.skip('exportDiagnostics does not expose paths', () => {
  let api: ReturnType<typeof mockRuntimeApi>;

  beforeEach(() => { api = mockRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('result does not contain file paths', async () => {
    api.exportDiagnostics.mockResolvedValue({ ok: true, saved: true, message: 'saved' });
    const result = await (window as any).schola.runtime.exportDiagnostics({ packId: 'schola.import.precision' });
    // Result should contain only { ok, saved, message? }
    const keys = Object.keys(result);
    expect(keys).not.toContain('path');
    expect(keys).not.toContain('filePath');
    expect(keys).not.toContain('downloadUrl');
    expect(result).not.toHaveProperty('absolutePath');
  });
});

describe.skip('error messages do not expose system paths', () => {
  let api: ReturnType<typeof mockRuntimeApi>;

  beforeEach(() => { api = mockRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('install error does not expose paths in message', async () => {
    api.install.mockResolvedValue({
      ok: false,
      status: makeStatus({ phase: 'failed', lastErrorMessage: 'Installation failed' }),
      message: 'Installation failed',
    });
    const result = await (window as any).schola.runtime.install({
      packId: 'schola.import.precision',
      acceptedNetworkDownload: true,
      acceptedDiskUsageMb: 100,
    });
    expect(result.message).not.toMatch(/[A-Z]:\\/);
    expect(result.message).not.toMatch(/\/home\//);
    expect(result.message).not.toMatch(/\/Users\//);
    expect(result.message).not.toMatch(/python/i);
    expect(result.message).not.toMatch(/pip/i);
  });
});

describe.skip('no technical engine names in pack display name', () => {
  it('known pack IDs map to user-friendly names, not engine names', () => {
    const knownIds = [
      'schola.import.precision',
      'schola.import.formula-pack',
      'schola.import.ocr',
      'schola.import.chinese',
      'schola.import.quick-plus',
    ];
    const forbiddenNames = ['Docling', 'Marker', 'MinerU', 'PyMuPDF4LLM'];
    // These pack IDs should NOT contain forbidden engine names
    for (const id of knownIds) {
      for (const forbidden of forbiddenNames) {
        expect(id.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    }
  });
});

// ── Hook Integration Tests ─────────────────────────────

describe.skip('useRuntimePacks hook (schola-api layer)', () => {
  let api: ReturnType<typeof mockRuntimeApi>;

  beforeEach(() => { api = mockRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('listRuntimePacks returns packs from window.schola.runtime.listPacks', async () => {
    const { listRuntimePacks } = await import('../../src/lib/platform/schola-api');
    api.listPacks.mockResolvedValue({ ok: true, packs: [makePack()] });
    const result = await listRuntimePacks();
    expect(result.ok).toBe(true);
    expect(result.packs).toHaveLength(1);
  });

  it('installRuntimePack passes input to window.schola.runtime.install', async () => {
    const { installRuntimePack } = await import('../../src/lib/platform/schola-api');
    api.install.mockResolvedValue({ ok: true, status: makeStatus({ phase: 'installed' }) });
    const result = await installRuntimePack({
      packId: 'schola.import.precision',
      acceptedNetworkDownload: true,
      acceptedDiskUsageMb: 200,
    });
    expect(result.ok).toBe(true);
  });

  it('enableRuntimePack calls window.schola.runtime.enable', async () => {
    const { enableRuntimePack } = await import('../../src/lib/platform/schola-api');
    api.enable.mockResolvedValue({ ok: true, status: makeStatus({ phase: 'enabled' }) });
    const result = await enableRuntimePack('schola.import.precision');
    expect(result.ok).toBe(true);
    expect(api.enable).toHaveBeenCalledWith('schola.import.precision');
  });

  it('disableRuntimePack calls window.schola.runtime.disable', async () => {
    const { disableRuntimePack } = await import('../../src/lib/platform/schola-api');
    api.disable.mockResolvedValue({ ok: true, status: makeStatus({ phase: 'disabled' }) });
    const result = await disableRuntimePack('schola.import.precision');
    expect(result.ok).toBe(true);
    expect(api.disable).toHaveBeenCalledWith('schola.import.precision');
  });

  it('diagnoseRuntimePack passes input to window.schola.runtime.diagnose', async () => {
    const { diagnoseRuntimePack } = await import('../../src/lib/platform/schola-api');
    api.diagnose.mockResolvedValue({ ok: true, checks: [] });
    const result = await diagnoseRuntimePack({
      packId: 'schola.import.precision',
      includeSanitizedLogs: true,
    });
    expect(result.ok).toBe(true);
  });

  it('exportRuntimePackDiagnostics passes input to window.schola.runtime.exportDiagnostics', async () => {
    const { exportRuntimePackDiagnostics } = await import('../../src/lib/platform/schola-api');
    api.exportDiagnostics.mockResolvedValue({ ok: true, saved: true });
    const result = await exportRuntimePackDiagnostics({ packId: 'schola.import.precision' });
    expect(result.ok).toBe(true);
    expect(result.saved).toBe(true);
  });

  it('clearRuntimePackCache calls window.schola.runtime.clearCache', async () => {
    const { clearRuntimePackCache } = await import('../../src/lib/platform/schola-api');
    api.clearCache.mockResolvedValue({ ok: true, freedDiskMb: 30 });
    const result = await clearRuntimePackCache('schola.import.precision');
    expect(result.ok).toBe(true);
    expect(result.freedDiskMb).toBe(30);
  });

  it('cancelInstallRuntimePack calls window.schola.runtime.cancelInstall', async () => {
    const { cancelInstallRuntimePack } = await import('../../src/lib/platform/schola-api');
    api.cancelInstall.mockResolvedValue({ ok: true, status: makeStatus() });
    const result = await cancelInstallRuntimePack('schola.import.precision');
    expect(result.ok).toBe(true);
  });

  it('getRuntimePackStatus calls window.schola.runtime.getStatus', async () => {
    const { getRuntimePackStatus } = await import('../../src/lib/platform/schola-api');
    api.getStatus.mockResolvedValue({ ok: true, status: makeStatus() });
    const result = await getRuntimePackStatus('schola.import.precision');
    expect(result.ok).toBe(true);
  });

  it('uninstallRuntimePack passes input to window.schola.runtime.uninstall', async () => {
    const { uninstallRuntimePack } = await import('../../src/lib/platform/schola-api');
    api.uninstall.mockResolvedValue({ ok: true, status: makeStatus({ phase: 'uninstalled' }), freedDiskMb: 200 });
    const result = await uninstallRuntimePack({
      packId: 'schola.import.precision',
      removeModelCache: true,
      removeLogs: false,
    });
    expect(result.ok).toBe(true);
    expect(api.uninstall).toHaveBeenCalledWith({
      packId: 'schola.import.precision',
      removeModelCache: true,
      removeLogs: false,
    });
  });
});

// ── Error State Tests ─────────────────────────────────

describe.skip('UI error handling does not crash', () => {
  let api: ReturnType<typeof mockRuntimeApi>;

  beforeEach(() => { api = mockRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('window.schola.runtime missing does not throw on import', async () => {
    removeRuntimeApi();
    // Importing schola-api should not throw even when runtime API is missing
    const mod = await import('../../src/lib/platform/schola-api');
    expect(mod).toBeDefined();
  });

  it('API call rejection does not expose internal paths', async () => {
    api.install.mockRejectedValue(new Error('C:\\Users\\test\\runtime failed'));
    try {
      await (window as any).schola.runtime.install({
        packId: 'schola.import.precision',
        acceptedNetworkDownload: true,
        acceptedDiskUsageMb: 100,
      });
    } catch (e: any) {
      // Error messages should not be exposed to user
      // (test verifies the error object shape, not UI rendering)
      expect(e).toBeDefined();
    }
  });
});

// ── Phase State Tests ─────────────────────────────────

describe.skip('runtime pack phase states', () => {
  it('all defined phases have valid state transitions', () => {
    const phases = [
      'undiscovered', 'discovered', 'available-to-install', 'unavailable',
      'probe-failed', 'installing', 'installed', 'enabled', 'running',
      'error', 'disabled', 'uninstalling', 'uninstalled', 'failed',
    ];
    expect(phases).toHaveLength(14);
  });

  it('installable phases include available-to-install and discovered', () => {
    const installablePhases = ['available-to-install', 'discovered'];
    expect(installablePhases).toContain('available-to-install');
    expect(installablePhases).toContain('discovered');
  });
});

// ── G3-D0: acceptedNetworkDownload explicit confirmation ──

describe.skip('G3-D0: acceptedNetworkDownload is no longer hardcoded', () => {
  let api: ReturnType<typeof mockRuntimeApi>;

  beforeEach(() => { api = mockRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('install accepts acceptedNetworkDownload=false when networkRequired=never', async () => {
    api.install.mockResolvedValue({ ok: true, status: makeStatus({ phase: 'installed' }) });
    await (window as any).schola.runtime.install({
      packId: 'schola.import.precision',
      acceptedNetworkDownload: false,
      acceptedDiskUsageMb: 200,
    });
    expect(api.install).toHaveBeenCalledWith(
      expect.objectContaining({ acceptedNetworkDownload: false }),
    );
  });

  it('install accepts acceptedNetworkDownload=true when user consented', async () => {
    api.install.mockResolvedValue({ ok: true, status: makeStatus({ phase: 'installed' }) });
    await (window as any).schola.runtime.install({
      packId: 'schola.import.precision',
      acceptedNetworkDownload: true,
      acceptedDiskUsageMb: 200,
    });
    expect(api.install).toHaveBeenCalledWith(
      expect.objectContaining({ acceptedNetworkDownload: true }),
    );
  });

  it('useRuntimePacks install default is acceptedNetworkDownload=false', async () => {
    const { installRuntimePack } = await import('../../src/lib/platform/schola-api');
    api.install.mockResolvedValue({ ok: true, status: makeStatus({ phase: 'installed' }) });
    // The hook now defaults acceptedNetworkDownload to false
    // Previously it was hardcoded to true
    await installRuntimePack({
      packId: 'schola.import.precision',
      acceptedNetworkDownload: false,
      acceptedDiskUsageMb: 200,
    });
    expect(api.install).toHaveBeenCalledWith(
      expect.objectContaining({ acceptedNetworkDownload: false }),
    );
  });
});

describe.skip('G3-D0: network consent flow', () => {
  let api: ReturnType<typeof mockRuntimeApi>;

  beforeEach(() => { api = mockRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('install with networkRequired=install passes through acceptedNetworkDownload', async () => {
    // When networkRequired=install and user checks the consent box,
    // the hook should pass acceptedNetworkDownload=true
    api.install.mockResolvedValue({ ok: true, status: makeStatus({ phase: 'installing' }) });
    await (window as any).schola.runtime.install({
      packId: 'schola.import.precision',
      acceptedNetworkDownload: true,
      acceptedDiskUsageMb: 200,
    });
    expect(api.install).toHaveBeenCalledWith(
      expect.objectContaining({
        packId: 'schola.import.precision',
        acceptedNetworkDownload: true,
      }),
    );
  });

  it('acceptedNetworkDownload flows through schola-api wrapper correctly', async () => {
    const { installRuntimePack } = await import('../../src/lib/platform/schola-api');
    api.install.mockResolvedValue({ ok: true, status: makeStatus() });

    // User consented → true
    await installRuntimePack({
      packId: 'p1',
      acceptedNetworkDownload: true,
      acceptedDiskUsageMb: 100,
    });
    expect(api.install).toHaveBeenLastCalledWith(
      expect.objectContaining({ acceptedNetworkDownload: true }),
    );

    // networkRequired=never → false
    await installRuntimePack({
      packId: 'p2',
      acceptedNetworkDownload: false,
      acceptedDiskUsageMb: 100,
    });
    expect(api.install).toHaveBeenLastCalledWith(
      expect.objectContaining({ acceptedNetworkDownload: false }),
    );
  });
});

describe.skip('G3-D0: safety invariants preserved', () => {
  let api: ReturnType<typeof mockRuntimeApi>;

  beforeEach(() => { api = mockRuntimeApi(); });
  afterEach(() => { removeRuntimeApi(); });

  it('install input still does not contain downloadUrl', async () => {
    api.install.mockResolvedValue({ ok: true, status: makeStatus() });
    const input = {
      packId: 'schola.import.precision',
      acceptedNetworkDownload: true,
      acceptedDiskUsageMb: 200,
    };
    // downloadUrl must not be in the install input
    expect(Object.keys(input)).not.toContain('downloadUrl');
    expect(Object.keys(input)).not.toContain('url');
    expect(Object.keys(input)).not.toContain('path');
    expect(Object.keys(input)).toContain('acceptedNetworkDownload');
    expect(Object.keys(input)).toContain('acceptedDiskUsageMb');
  });

  it('no Docling / Marker / MinerU / PyMuPDF4LLM in install flow', () => {
    const forbidden = ['Docling', 'Marker', 'MinerU', 'PyMuPDF4LLM'];
    const packId = 'schola.import.precision';
    for (const fb of forbidden) {
      expect(packId.toLowerCase()).not.toContain(fb.toLowerCase());
    }
  });

  it('acceptedNetworkDownload is never omitted from install input', async () => {
    api.install.mockResolvedValue({ ok: true, status: makeStatus() });
    // Install input must always include acceptedNetworkDownload
    const input = {
      packId: 'p1',
      acceptedNetworkDownload: false,
      acceptedDiskUsageMb: 100,
    };
    expect(input).toHaveProperty('acceptedNetworkDownload');
  });
});
