/**
 * LocalKnowledgeQAService — Phase 4-2-D.
 *
 * Ties together ContextPack v2 + Chunking + MockEmbeddingProvider +
 * InMemoryVectorIndex into a minimal local knowledge QA closed loop.
 *
 * Pipeline:
 * 1. ContextPack v2 scope → selected files
 * 2. Chunk each file
 * 3. Embed chunks with MockEmbeddingProvider
 * 4. Index embeddings in InMemoryVectorIndex
 * 5. Accept query → embed → search topK → assemble evidence draft
 *
 * Key invariants:
 * - LOCAL-ONLY / MOCK-ONLY — no real LLM, no real embedding
 * - SourceRef relativePath-only
 * - EvidenceRef excerpt ≤ MAX_EXCERPT_LENGTH
 * - No source → insufficient_evidence
 * - No fake references
 * - No external database claims
 * - No Vault writes
 * - No logs of chunks/vectors/queries
 *
 * Skeleton — answer is a structured draft, not real LLM output.
 * Real LLM integration deferred to Phase 4-2-E+ with Context Confirmation.
 */
import type { ContextPackV2 } from '../../src/lib/contracts/context-pack-v2.types';
import type {
  ChunkSource,
  ChunkingOptions,
} from '../../src/lib/contracts/chunk.types';
import { chunkMarkdownFile } from './chunking-strategy.service';
import { MockEmbeddingProvider } from './embedding-provider.mock';
import { InMemoryVectorIndex } from './vector-index.mock';
import type { VectorIndexEntry } from '../../src/lib/contracts/vector-index.types';
import type {
  QueryRequest,
  QueryResult,
  QueryAnswerDraft,
  SourceRef,
  EvidenceRef,
} from '../../src/lib/contracts/local-qa.types';
import {
  truncateExcerpt,
  createInsufficientEvidenceAnswer,
  validateSourceRef,
  DEFAULT_QUERY_SCOPE,
  MAX_EXCERPT_LENGTH,
} from '../../src/lib/contracts/local-qa.types';

// ── Service ────────────────────────────────────────────

/**
 * Local-only knowledge QA service.
 *
 * Uses MockEmbeddingProvider for deterministic embeddings and
 * InMemoryVectorIndex for brute-force similarity search.
 * Answers are structured drafts — no real LLM generation.
 */
export class LocalKnowledgeQAService {
  private readonly embeddingProvider: MockEmbeddingProvider;
  private readonly vectorIndex: InMemoryVectorIndex;
  private readonly chunkOptions: Partial<ChunkingOptions>;

  constructor(
    embeddingProvider?: MockEmbeddingProvider,
    vectorIndex?: InMemoryVectorIndex,
    chunkOptions?: Partial<ChunkingOptions>,
  ) {
    this.embeddingProvider = embeddingProvider ?? new MockEmbeddingProvider();
    this.vectorIndex = vectorIndex ?? new InMemoryVectorIndex();
    this.chunkOptions = chunkOptions ?? { strategy: 'heading' };
  }

  /**
   * Index a set of files using a ContextPack v2 scope.
   *
   * Pipeline: chunk → embed → index.
   * Clears the existing index before building.
   *
   * @param pack - ContextPack v2 defining the selected files (content not provided — mock only).
   * @param fileContents - Map of relativePath → file content (for actual chunking).
   */
  async indexFromContextPack(
    _pack: ContextPackV2,
    fileContents: Map<string, string>,
  ): Promise<{ indexedFiles: number; indexedChunks: number; totalTokens: number }> {
    await this.vectorIndex.clear();

    let totalChunks = 0;
    let totalTokens = 0;
    let indexedFiles = 0;

    for (const [relativePath, content] of fileContents) {
      const source: ChunkSource = {
        relativePath,
        displayName: relativePath.split('/').pop() ?? relativePath,
      };

      const chunkResult = chunkMarkdownFile(source, content, this.chunkOptions);

      if (chunkResult.chunks.length === 0) continue;

      // Embed chunks
      const texts = chunkResult.chunks.map((c) => c.content);
      const embedResult = await this.embeddingProvider.embed({ texts, chunks: chunkResult.chunks });

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
      totalChunks += entries.length;
      totalTokens += chunkResult.totalTokens;
      indexedFiles++;
    }

    return { indexedFiles, indexedChunks: totalChunks, totalTokens };
  }

  /**
   * Execute a knowledge QA query.
   *
   * Pipeline: embed query → search topK → assemble evidence draft.
   * Returns a skeleton answer with source references.
   * Does NOT call any real LLM — answer is a structured draft.
   *
   * @param request - Query with optional scope.
   */
  async query(request: QueryRequest): Promise<QueryResult> {
    const startTime = Date.now();
    const scope = request.scope ?? DEFAULT_QUERY_SCOPE;

    // Step 1: Embed query
    const queryVector = await this.embeddingProvider.embedQuery(request.query);

    // Step 2: Search
    let searchResults = await this.vectorIndex.search(queryVector.values, scope.topK);

    // Step 3: Filter by scope (relativePath filter)
    if (scope.relativePath) {
      searchResults = searchResults.filter((r) =>
        r.entry.relativePath.startsWith(scope.relativePath!),
      );
    }

    // Step 4: Filter by relevance threshold
    const relevantResults = searchResults.filter((r) => r.score >= scope.relevanceThreshold);

    // Step 5: Build sources and evidence
    const sources: SourceRef[] = [];
    const evidence: EvidenceRef[] = [];

    for (const result of relevantResults) {
      const source: SourceRef = {
        relativePath: result.entry.relativePath,
        chunkIndex: parseInt(result.entry.chunkId.split('#chunk-')[1] ?? '0', 10),
        headingPath: result.entry.headingPath,
        score: result.score,
      };
      sources.push(source);

      // Build evidence ref
      const sourceId = `${source.relativePath}#chunk-${source.chunkIndex}`;
      const chunkEntry = searchResults.find((r) => r.entry.chunkId === sourceId);
      if (chunkEntry) {
        evidence.push({
          source,
          excerpt: 'Chunk content available in local index (mock)',
          excerptTokenCount: 10,
        });
      }
    }

    // Step 6: Build answer draft
    let answer: QueryAnswerDraft;
    if (sources.length === 0) {
      answer = createInsufficientEvidenceAnswer(request.query);
    } else {
      answer = {
        query: request.query,
        hasSufficientEvidence: true,
        answer: buildMockAnswer(request.query, sources),
        sources,
        evidence,
        retrievedCount: searchResults.length,
        relevantCount: sources.length,
        contextTokens: sources.reduce((sum, s) => sum + 100, 0), // Approximate
        isMockAnswer: true,
      };
    }

    const elapsedMs = Date.now() - startTime;
    return { answer, searchResults, elapsedMs };
  }

  /**
   * Check if an answer has sufficient evidence.
   * Convenience method.
   */
  hasSufficientEvidence(result: QueryResult): boolean {
    return result.answer.hasSufficientEvidence;
  }

  /**
   * Get index statistics.
   */
  getIndexStats() {
    return this.vectorIndex.stats();
  }

  /**
   * Clear the index.
   */
  async clearIndex(): Promise<void> {
    await this.vectorIndex.clear();
  }
}

// ── Mock Answer Builder ────────────────────────────────

/**
 * Build a mock answer skeleton from sources.
 * This is NOT real LLM generation — it's a structured placeholder
 * that demonstrates the answer format expected in Phase 4-2-E+.
 */
function buildMockAnswer(query: string, sources: readonly SourceRef[]): string {
  const sourceList = sources
    .map((s, i) => {
      const headingInfo =
        s.headingPath.length > 0 ? ` (${s.headingPath.join(' > ')})` : '';
      return `  [${i + 1}] ${s.relativePath}#chunk-${s.chunkIndex}${headingInfo} — relevance: ${s.score.toFixed(2)}`;
    })
    .join('\n');

  return `[Local QA Mock Answer — Phase 4-2-D Skeleton]

Query: "${query}"

Based on ${sources.length} relevant source(s) in your Vault, here is an evidence-grounded answer draft:

Sources:
${sourceList}

Note: This is a mock answer skeleton. Real answer synthesis will be added in Phase 4-2-E
when real LLM provider integration is implemented with Context Confirmation.`;
}
