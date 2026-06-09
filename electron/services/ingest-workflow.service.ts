/**
 * IngestWorkflow Service — Phase 4-2-E.
 *
 * Controlled ingest pipeline:
 * 1. Validate explicit user selection (no whole Vault)
 * 2. Require Context Confirmation
 * 3. Chunk → MockEmbedding → InMemoryVectorIndex
 * 4. Produce IngestResult with IndexManifest
 *
 * All invariants: no whole Vault, no real provider, relativePath-only.
 */
import type {
  IngestRequest,
  IngestResult,
  IndexManifest,
  IndexedFileRecord,
  WorkflowError,
  WorkflowWarning,
} from '../../src/lib/contracts/workflow.types';
import type { ChunkSource } from '../../src/lib/contracts/chunk.types';
import { chunkMarkdownFile } from './chunking-strategy.service';
import { MockEmbeddingProvider } from './embedding-provider.mock';
import { InMemoryVectorIndex } from './vector-index.mock';
import type { VectorIndexEntry } from '../../src/lib/contracts/vector-index.types';

export class IngestWorkflow {
  private embeddingProvider: MockEmbeddingProvider;
  private vectorIndex: InMemoryVectorIndex;
  private currentManifest: IndexManifest | null = null;

  constructor(embeddingProvider?: MockEmbeddingProvider, vectorIndex?: InMemoryVectorIndex) {
    this.embeddingProvider = embeddingProvider ?? new MockEmbeddingProvider();
    this.vectorIndex = vectorIndex ?? new InMemoryVectorIndex();
  }

  async execute(
    request: IngestRequest,
    fileContents: Map<string, string>,
  ): Promise<IngestResult> {
    const startTime = Date.now();
    const errors: WorkflowError[] = [];
    const warnings: WorkflowWarning[] = [];

    // P0: Explicit user selection required
    if (!request.scope.selectedFiles || request.scope.selectedFiles.length === 0) {
      return {
        status: 'failed',
        indexedFiles: 0,
        totalChunks: 0,
        totalTokens: 0,
        errors: [{ code: 'NO_FILES_SELECTED', message: 'Explicit file selection is required for ingest' }],
        warnings: [],
        manifest: null,
        elapsedMs: Date.now() - startTime,
      };
    }

    // P0: Context Confirmation required
    if (!request.confirmContext) {
      return {
        status: 'failed',
        indexedFiles: 0,
        totalChunks: 0,
        totalTokens: 0,
        errors: [{ code: 'CONTEXT_NOT_CONFIRMED', message: 'Context confirmation is required before ingest' }],
        warnings: [],
        manifest: null,
        elapsedMs: Date.now() - startTime,
      };
    }

    // Clear index for fresh ingest
    await this.vectorIndex.clear();

    const fileRecords: IndexedFileRecord[] = [];
    let totalChunks = 0;
    let totalTokens = 0;
    let indexedFiles = 0;

    for (const [relativePath, content] of fileContents) {
      try {
        const source: ChunkSource = {
          relativePath,
          displayName: relativePath.split('/').pop() ?? relativePath,
        };

        const chunkResult = chunkMarkdownFile(source, content, { strategy: 'heading' });

        if (chunkResult.chunks.length === 0) {
          warnings.push({
            code: 'EMPTY_FILE',
            message: `File produced no chunks: ${relativePath}`,
            filePath: relativePath,
          });
          continue;
        }

        // Embed chunks
        const texts = chunkResult.chunks.map((c) => c.content);
        const embedResult = await this.embeddingProvider.embed({
          texts,
          chunks: chunkResult.chunks,
        });

        // Build entries
        const entries: VectorIndexEntry[] = chunkResult.chunks.map((chunk, i) => ({
          chunkId: chunk.chunkId,
          relativePath: chunk.source.relativePath,
          headingPath: chunk.headingPath,
          tokenCount: chunk.tokenCount,
          vector: embedResult.vectors[i].values,
          dimensions: embedResult.vectors[i].dimensions,
          strategy: chunk.strategy,
        }));

        await this.vectorIndex.add(entries);

        // Record in manifest
        fileRecords.push({
          relativePath,
          indexedAt: new Date().toISOString(),
          chunkCount: entries.length,
          totalTokens: chunkResult.totalTokens,
          chunks: entries.map((e) => ({
            chunkId: e.chunkId,
            chunkIndex: parseInt(e.chunkId.split('#chunk-')[1] ?? '0', 10),
            headingPath: e.headingPath,
            tokenCount: e.tokenCount,
          })),
        });

        totalChunks += entries.length;
        totalTokens += chunkResult.totalTokens;
        indexedFiles++;
      } catch (err) {
        // Partial failure — continue with remaining files
        errors.push({
          code: 'CHUNK_ERROR',
          message: `Failed to process file: ${relativePath} — ${String(err)}`,
          filePath: relativePath,
        });
      }
    }

    this.currentManifest = {
      vaultId: 'local',
      updatedAt: new Date().toISOString(),
      totalFiles: indexedFiles,
      totalChunks,
      totalTokens,
      files: fileRecords,
    };

    return {
      status: errors.length > 0 && indexedFiles === 0 ? 'failed' : 'completed',
      indexedFiles,
      totalChunks,
      totalTokens,
      errors,
      warnings,
      manifest: this.currentManifest,
      elapsedMs: Date.now() - startTime,
    };
  }

  getManifest(): IndexManifest | null {
    return this.currentManifest;
  }

  async clearIndex(): Promise<void> {
    await this.vectorIndex.clear();
    this.currentManifest = null;
  }
}
