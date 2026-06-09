/**
 * QueryWorkflow Service — Phase 4-2-E.
 *
 * Wraps LocalKnowledgeQAService in a workflow with:
 * - Context Confirmation gate
 * - Mock-only answer (no real LLM)
 * - SourceRef / EvidenceRef
 * - insufficient_evidence handling
 */
import type {
  QueryWorkflowRequest,
  QueryWorkflowResult,
  WorkflowError,
} from '../../src/lib/contracts/workflow.types';
import { LocalKnowledgeQAService } from './local-knowledge-qa.service';

export class QueryWorkflow {
  private qaService: LocalKnowledgeQAService;

  constructor(qaService?: LocalKnowledgeQAService) {
    this.qaService = qaService ?? new LocalKnowledgeQAService();
  }

  async execute(
    request: QueryWorkflowRequest,
    fileContents?: Map<string, string>,
  ): Promise<QueryWorkflowResult> {
    const startTime = Date.now();
    const errors: WorkflowError[] = [];

    // P0: Context Confirmation required
    if (!request.confirmContext) {
      return {
        status: 'failed',
        hasSufficientEvidence: false,
        answer: '',
        sources: [],
        retrievedCount: 0,
        relevantCount: 0,
        errors: [{ code: 'CONTEXT_NOT_CONFIRMED', message: 'Context confirmation is required before query' }],
        warnings: [],
        elapsedMs: Date.now() - startTime,
        isMockAnswer: true,
      };
    }

    // Index content if provided
    if (fileContents && fileContents.size > 0) {
      try {
        const pack = createMinimalPack();
        await this.qaService.indexFromContextPack(pack, fileContents);
      } catch (err) {
        errors.push({
          code: 'INDEX_ERROR',
          message: `Failed to index content: ${String(err)}`,
        });
      }
    }

    // Execute query via LocalKnowledgeQAService
    const result = await this.qaService.query({ query: request.query });

    return {
      status: 'completed',
      hasSufficientEvidence: result.answer.hasSufficientEvidence,
      answer: result.answer.answer,
      sources: result.answer.sources.map((s) => ({
        relativePath: s.relativePath,
        chunkIndex: s.chunkIndex,
        headingPath: s.headingPath,
        score: s.score,
      })),
      retrievedCount: result.answer.retrievedCount,
      relevantCount: result.answer.relevantCount,
      errors,
      warnings: [],
      elapsedMs: Date.now() - startTime,
      isMockAnswer: true,
    };
  }
}

function createMinimalPack() {
  const { createDefaultWikilinkExpansion, resolveTokenBudget } =
    require('../../src/lib/contracts/context-pack-v2.types');
  return {
    scope: {
      type: 'files' as const,
      selectedFiles: [{ relativePath: 'notes/a.md', displayName: 'a.md' }],
      wikilinkExpansion: createDefaultWikilinkExpansion(),
    },
    tokenBudget: resolveTokenBudget('gpt-4o'),
    files: [],
    providerId: 'openai',
    model: 'gpt-4o',
    providerDisplayName: 'OpenAI',
    totalTokens: 0,
    truncatedFileCount: 0,
  };
}
