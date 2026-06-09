import assert from 'node:assert/strict';
import fs from 'node:fs';

import { describe, it, beforeEach, afterEach, vi } from 'vitest';

import {
  createConfiguredStatus,
  createNotConfiguredStatus,
  maskApiKey,
} from '../../src/lib/contracts/settings.types';

const mockState = vi.hoisted(() => ({
  files: new Map<string, Buffer>(),
  directories: new Set<string>(),
  packageJsonText: '{"name":"schola","dependencies":{"electron":"^42.1.0"}}',
  userDataDir: 'L:\\Schola\\mock-user-data',
}));

const mockSafeStorage = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => false),
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
  readFileSync: vi.fn((targetPath: string, encoding?: BufferEncoding) => {
    if (targetPath.replace(/\\/g, '/').endsWith('/package.json') || targetPath === 'package.json') {
      return encoding ? mockState.packageJsonText : Buffer.from(mockState.packageJsonText, 'utf8');
    }

    const buffer = mockState.files.get(targetPath);
    if (!buffer) {
      throw new Error('ENOENT: mocked file not found');
    }
    return encoding ? buffer.toString(encoding) : Buffer.from(buffer);
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

const providers = ['openai', 'anthropic', 'gemini', 'transient'];

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

describe('provider-key-store memory-only fallback behavior', () => {
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

  it('setProviderKey succeeds when safeStorage is unavailable', () => {
    const rawKey = 'fallback-secret-123456';

    const status = setProviderKey('openai', rawKey);

    assert.deepEqual(status, createConfiguredStatus('openai', maskApiKey(rawKey), 'memory'));
    assert.equal(getProviderKey('openai'), rawKey);
  });

  it('getProviderKeyStatus returns memory storageType when safeStorage is unavailable', () => {
    const rawKey = 'fallback-secret-654321';

    setProviderKey('openai', rawKey);
    const [status] = getProviderKeyStatus('openai');

    assert.equal(status.status, 'configured');
    if (status.status === 'configured') {
      assert.equal(status.storageType, 'memory');
      assert.equal(status.maskedSuffix, maskApiKey(rawKey));
    }
  });

  it('does not write an encrypted file to disk when safeStorage is unavailable', () => {
    setProviderKey('openai', 'fallback-no-disk-123456');

    assert.equal(mockFs.writeFileSync.mock.calls.length, 0);
    assert.equal(Array.from(mockState.files.keys()).some((filePath) => filePath.endsWith('.enc')), false);
  });

  it('deleteProviderKey removes a memory-only key', () => {
    setProviderKey('openai', 'fallback-delete-123456');

    const status = deleteProviderKey('openai');

    assert.deepEqual(status, createNotConfiguredStatus('openai'));
    assert.equal(hasProviderKey('openai'), false);
  });

  it('multiple memory-only keys do not interfere with each other', () => {
    setProviderKey('openai', 'openai-memory-secret-123456');
    setProviderKey('anthropic', 'anthropic-memory-secret-123456');

    assert.equal(getProviderKey('openai'), 'openai-memory-secret-123456');
    assert.equal(getProviderKey('anthropic'), 'anthropic-memory-secret-123456');

    deleteProviderKey('openai');

    assert.equal(hasProviderKey('openai'), false);
    assert.equal(getProviderKey('anthropic'), 'anthropic-memory-secret-123456');
  });

  it('memory-only key does not persist after module cache is cleared', async () => {
    setProviderKey('transient', 'transient-memory-secret-123456');
    assert.equal(hasProviderKey('transient'), true);

    vi.resetModules();
    const reloadedStore = await import('../../electron/services/provider-key-store.service');

    assert.equal(reloadedStore.hasProviderKey('transient'), false);
  });

  it('keytar is not present in package.json', () => {
    const packageJsonText = fs.readFileSync('package.json', 'utf8');

    assert.equal(packageJsonText.includes('keytar'), false);
  });
});
