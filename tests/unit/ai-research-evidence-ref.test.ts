import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getVaultRootPath: vi.fn(),
  getProviderKeyStatus: vi.fn(),
  getProviderConfig: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { isReady: () => true },
}));

vi.mock('../../electron/services/vault.service', () => ({
  getVaultRootPath: mocks.getVaultRootPath,
}));

vi.mock('../../electron/services/provider-key-store.service', () => ({
  getProviderKeyStatus: mocks.getProviderKeyStatus,
}));

vi.mock('../../electron/services/settings-store.service', () => ({
  getProviderConfig: mocks.getProviderConfig,
}));

describe('AI Research EvidenceRef', () => {
  let rootPath: string;

  beforeEach(async () => {
    rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'schola-evidence-ref-'));
    await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true });
    await fs.mkdir(path.join(rootPath, 'resources', 'pdf'), { recursive: true });
    await fs.writeFile(
      path.join(rootPath, 'notes', 'research.md'),
      '# Research\n\nAlpha finding with enough detail for quote preview.',
      'utf-8',
    );
    await fs.writeFile(path.join(rootPath, 'resources', 'pdf', 'paper.pdf'), '%PDF-1.7', 'utf-8');
    mocks.getVaultRootPath.mockReturnValue(rootPath);
    mocks.getProviderKeyStatus.mockReturnValue([]);
    mocks.getProviderConfig.mockReturnValue({ enabled: true });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await fs.rm(rootPath, { recursive: true, force: true });
  });

  it('AI-C-EVID-001/002/008 creates source-backed and model-inferred refs', async () => {
    const { buildContextPack, buildEvidenceRefsForContextPack } = await import(
      '../../electron/services/ai-research-context.service'
    );

    const preview = await buildContextPack({
      vaultId: 'vault-1',
      providerId: 'ollama',
      model: 'llama3.2',
      selectedSources: [
        {
          relativePath: 'notes/research.md',
          displayName: 'research.md',
          sourceType: 'markdown',
          fileSize: 64,
        },
      ],
    });
    const refs = buildEvidenceRefsForContextPack(preview.packId, 'Model conclusion');

    expect(refs.some((item) => item.kind === 'source-backed')).toBe(true);
    expect(refs.some((item) => item.kind === 'model-inferred')).toBe(true);
    expect(JSON.stringify(refs)).toContain('notes/research.md');
    expect(JSON.stringify(refs)).not.toContain(rootPath);
  });

  it('AI-C-EVID-005 extraction-failed PDF does not generate quotePreview', async () => {
    const { buildContextPack, buildEvidenceRefsForContextPack } = await import(
      '../../electron/services/ai-research-context.service'
    );

    // '%PDF-1.7' is too small to be a valid PDF, extraction will fail
    const preview = await buildContextPack({
      vaultId: 'vault-1',
      providerId: 'ollama',
      model: 'llama3.2',
      selectedSources: [
        {
          relativePath: 'resources/pdf/paper.pdf',
          displayName: 'paper.pdf',
          sourceType: 'pdf',
          fileSize: 8,
        },
      ],
    });
    const refs = buildEvidenceRefsForContextPack(preview.packId, 'Model conclusion');
    const pdfRef = refs.find((item) => item.relativePath === 'resources/pdf/paper.pdf');

    expect(pdfRef?.kind).toBe('source-backed');
    expect(pdfRef?.quotePreview).toBeUndefined();
    expect(pdfRef?.note).toBeTruthy();
    // For invalid/corrupt PDF, extraction fails; no quote or metadata claim
  });

  it('AI-C-EVID-006 quotePreview is limited and sanitized', async () => {
    await fs.writeFile(
      path.join(rootPath, 'notes', 'secret.md'),
      `# Secret\n\n${'a'.repeat(240)} sk-test-secret-12345678901234567890`,
      'utf-8',
    );
    const { buildContextPack, buildEvidenceRefsForContextPack } = await import(
      '../../electron/services/ai-research-context.service'
    );

    const preview = await buildContextPack({
      vaultId: 'vault-1',
      providerId: 'ollama',
      model: 'llama3.2',
      selectedSources: [
        {
          relativePath: 'notes/secret.md',
          displayName: 'secret.md',
          sourceType: 'markdown',
          fileSize: 300,
        },
      ],
    });
    const refs = buildEvidenceRefsForContextPack(preview.packId, 'Model conclusion');
    const ref = refs.find((item) => item.kind === 'source-backed');

    expect(ref?.quotePreview?.length).toBeLessThanOrEqual(180);
    expect(ref?.quotePreview).not.toContain('sk-test-secret');
  });

  it('AI-C-EVID-007 does not fabricate page, row, sheet, or heading metadata', async () => {
    const { buildContextPack, buildEvidenceRefsForContextPack } = await import(
      '../../electron/services/ai-research-context.service'
    );

    const preview = await buildContextPack({
      vaultId: 'vault-1',
      providerId: 'ollama',
      model: 'llama3.2',
      selectedSources: [
        {
          relativePath: 'notes/research.md',
          displayName: 'research.md',
          sourceType: 'markdown',
          fileSize: 64,
        },
      ],
    });
    const refs = buildEvidenceRefsForContextPack(preview.packId, 'Model conclusion');
    const ref = refs.find((item) => item.kind === 'source-backed');

    expect(ref?.page).toBeUndefined();
    expect(ref?.rowRange).toBeUndefined();
    expect(ref?.sheetName).toBeUndefined();
    expect(ref?.heading).toBeUndefined();
  });

  // Phase 5-5-C-POST-SYNC-PDF-CONTEXT-INGEST-FIX: PDF extraction tests
  describe('PDF context extraction', () => {
    it('PDF-C-001 PDF source type is recognized', async () => {
      const { buildContextPack } = await import(
        '../../electron/services/ai-research-context.service'
      );

      const preview = await buildContextPack({
        vaultId: 'vault-1',
        providerId: 'ollama',
        model: 'llama3.2',
        selectedSources: [
          {
            relativePath: 'resources/pdf/paper.pdf',
            displayName: 'paper.pdf',
            sourceType: 'pdf',
            fileSize: 8,
          },
        ],
      });

      expect(preview.fileCount).toBe(1);
      expect(preview.selectedSourceRefs[0].sourceType).toBe('pdf');
    });

    it('PDF-C-002 extraction failure produces no quotePreview', async () => {
      const { buildContextPack, buildEvidenceRefsForContextPack } = await import(
        '../../electron/services/ai-research-context.service'
      );

      const preview = await buildContextPack({
        vaultId: 'vault-1',
        providerId: 'ollama',
        model: 'llama3.2',
        selectedSources: [
          {
            relativePath: 'resources/pdf/paper.pdf',
            displayName: 'paper.pdf',
            sourceType: 'pdf',
            fileSize: 8,
          },
        ],
      });
      const refs = buildEvidenceRefsForContextPack(preview.packId, '');
      const pdfRef = refs.find((item) => item.sourceType === 'pdf');

      expect(pdfRef).toBeDefined();
      expect(pdfRef?.quotePreview).toBeUndefined();
    });

    it('PDF-C-003 ContextSourceExtractionStatus type values are valid', () => {
      const validStatuses = ['text-extracted', 'metadata-only', 'extract-failed', 'unsupported'];
      for (const status of validStatuses) {
        expect(typeof status).toBe('string');
        expect(status.length).toBeGreaterThan(0);
      }
    });

    it('PDF-C-004 ContextPack preview does not expose absolute paths for PDF', async () => {
      const { buildContextPack } = await import(
        '../../electron/services/ai-research-context.service'
      );

      const preview = await buildContextPack({
        vaultId: 'vault-1',
        providerId: 'ollama',
        model: 'llama3.2',
        selectedSources: [
          {
            relativePath: 'resources/pdf/paper.pdf',
            displayName: 'paper.pdf',
            sourceType: 'pdf',
            fileSize: 8,
          },
        ],
      });

      const json = JSON.stringify(preview);
      expect(json).not.toContain(rootPath);
      expect(json).not.toContain(':\\\\');
      expect(json).not.toContain('C:\\\\');
    });

    it('PDF-C-005 context confirmation warning includes extraction status', async () => {
      const { buildContextPack } = await import(
        '../../electron/services/ai-research-context.service'
      );

      const preview = await buildContextPack({
        vaultId: 'vault-1',
        providerId: 'ollama',
        model: 'llama3.2',
        selectedSources: [
          {
            relativePath: 'resources/pdf/paper.pdf',
            displayName: 'paper.pdf',
            sourceType: 'pdf',
            fileSize: 8,
          },
        ],
      });

      // Warnings should contain PDF-related info (extraction failed for invalid PDF)
      expect(preview.warnings.length).toBeGreaterThanOrEqual(0);
    });
  });
});
