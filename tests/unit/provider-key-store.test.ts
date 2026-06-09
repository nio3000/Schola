import assert from 'node:assert/strict';

import { describe, it, beforeEach, afterEach, vi } from 'vitest';

import {
  createConfiguredStatus,
  createNotConfiguredStatus,
  maskApiKey,
} from '../../src/lib/contracts/settings.types';

const mockState = vi.hoisted(() => ({
  files: new Map<string, Buffer>(),
  directories: new Set<string>(),
  userDataDir: 'L:\\Schola\\mock-user-data',
}));

const mockSafeStorage = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((key: string) => Buffer.from(`encrypted:${key}`, 'utf8')),
  decryptString: vi.fn((encrypted: Buffer) => encrypted.toString('utf8').replace(/^encrypted:/, '')),
}));

const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn((targetPath: string) => {
    return mockState.directories.has(targetPath) || mockState.files.has(targetPath);
  }),
  mkdirSync: vi.fn((targetPath: string) => {
    mockState.directories.add(targetPath);
    return undefined;
  }),
  writeFileSync: vi.fn((targetPath: string, data: string | NodeJS.ArrayBufferView) => {
    const buffer = Buffer.isBuffer(data) ? Buffer.from(data) : Buffer.from(String(data), 'utf8');
    mockState.files.set(targetPath, buffer);
  }),
  readFileSync: vi.fn((targetPath: string) => {
    const buffer = mockState.files.get(targetPath);
    if (!buffer) {
      throw new Error('ENOENT: mocked file not found');
    }
    return Buffer.from(buffer);
  }),
  readdirSync: vi.fn((targetPath: string) => {
    const normalizedDir = targetPath.replace(/\\/g, '/');
    const prefix = `${normalizedDir}/`;
    return Array.from(mockState.files.keys())
      .map((filePath) => filePath.replace(/\\/g, '/'))
      .filter((filePath) => filePath.startsWith(prefix))
      .map((filePath) => filePath.slice(prefix.length));
  }),
  unlinkSync: vi.fn((targetPath: string) => {
    mockState.files.delete(targetPath);
  }),
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mockState.userDataDir),
  },
  safeStorage: mockSafeStorage,
}));

vi.mock('node:fs', () => ({
  default: mockFs,
  ...mockFs,
}));

import {
  deleteProviderKey,
  getProviderKey,
  getProviderKeyStatus,
  hasProviderKey,
  setProviderKey,
} from '../../electron/services/provider-key-store.service';

const providers = ['openai', 'anthropic', 'unknown-provider'];

function resetMocks(): void {
  mockState.files.clear();
  mockState.directories.clear();
  mockSafeStorage.isEncryptionAvailable.mockClear();
  mockSafeStorage.encryptString.mockClear();
  mockSafeStorage.decryptString.mockClear();
  mockFs.existsSync.mockClear();
  mockFs.mkdirSync.mockClear();
  mockFs.writeFileSync.mockClear();
  mockFs.readFileSync.mockClear();
  mockFs.readdirSync.mockClear();
  mockFs.unlinkSync.mockClear();
}

describe('provider-key-store safeStorage behavior', () => {
  beforeEach(() => {
    resetMocks();
    for (const providerId of providers) {
      deleteProviderKey(providerId);
    }
    resetMocks();
  });

  afterEach(() => {
    for (const providerId of providers) {
      deleteProviderKey(providerId);
    }
    resetMocks();
  });

  it('setProviderKey stores key and returns MaskedSecretStatus with configured status', () => {
    const rawKey = 'sk-test-secret-123456';

    const status = setProviderKey('openai', rawKey);

    assert.deepEqual(
      status,
      createConfiguredStatus('openai', maskApiKey(rawKey), 'safeStorage'),
    );
    assert.equal(status.status, 'configured');
    assert.equal(mockSafeStorage.encryptString.mock.calls[0]?.[0], rawKey);
    assert.equal(mockFs.writeFileSync.mock.calls.length, 1);
  });

  it('getProviderKeyStatus returns masked status without the raw key', () => {
    const rawKey = 'anthropic-secret-987654';

    setProviderKey('anthropic', rawKey);
    const [status] = getProviderKeyStatus('anthropic');

    assert.equal(status.status, 'configured');
    if (status.status === 'configured') {
      assert.equal(status.maskedSuffix, maskApiKey(rawKey));
      assert.notEqual(status.maskedSuffix, rawKey);
      assert.equal(status.storageType, 'safeStorage');
    }
  });

  it('getProviderKeyStatus for unknown provider returns not-configured', () => {
    const [status] = getProviderKeyStatus('unknown-provider');

    assert.deepEqual(status, createNotConfiguredStatus('unknown-provider'));
  });

  it('deleteProviderKey removes key and returns not-configured', () => {
    setProviderKey('openai', 'sk-delete-secret-123456');

    const status = deleteProviderKey('openai');

    assert.deepEqual(status, createNotConfiguredStatus('openai'));
    assert.equal(hasProviderKey('openai'), false);
  });

  it('hasProviderKey returns true after set', () => {
    setProviderKey('openai', 'sk-present-secret-123456');

    assert.equal(hasProviderKey('openai'), true);
  });

  it('hasProviderKey returns false after delete', () => {
    setProviderKey('openai', 'sk-delete-secret-654321');
    deleteProviderKey('openai');

    assert.equal(hasProviderKey('openai'), false);
  });

  it('maskApiKey produces prefix and suffix format', () => {
    assert.equal(maskApiKey('abcdef123456'), 'abc...3456');
  });

  it('maskApiKey for short key returns stars only', () => {
    assert.equal(maskApiKey('short'), '***');
  });

  it('getProviderKey is exported as a function', () => {
    assert.equal(typeof getProviderKey, 'function');
  });

  it('setProviderKey with empty key throws', () => {
    assert.throws(() => setProviderKey('openai', '   '), /INVALID_INPUT/);
  });

  it('setProviderKey with short key throws', () => {
    assert.throws(() => setProviderKey('openai', '1234567'), /too short/);
  });
});
