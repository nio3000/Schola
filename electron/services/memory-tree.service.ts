/**
 * MemoryTreeService — Phase 4-2-F.
 *
 * Builds Research / Teaching Memory Trees from:
 * - Selected Vault scope (files/folders)
 * - Ingest manifests (SourceRef / EvidenceRef)
 * - Query results
 *
 * Trees are DERIVED artifacts — never auto-written to Vault.
 * User review is required before any save operation.
 *
 * Key invariants: derived-only, source-preserving, relativePath-only,
 * no real provider/embedding, no fabricated sources.
 */
import type {
  MemoryTree,
  MemoryTreeNode,
  MemoryTreeBuildRequest,
  MemoryTreeBuildResult,
  MemoryTreeCategory,
} from '../../src/lib/contracts/memory-tree.types';
import {
  createEmptyTree,
  generateNodeId,
  generateTreeId,
} from '../../src/lib/contracts/memory-tree.types';
import type { SourceRef, EvidenceRef } from '../../src/lib/contracts/local-qa.types';

export class MemoryTreeService {
  private trees: Map<string, MemoryTree> = new Map();

  /**
   * Build a memory tree from selected scope and optional query results.
   */
  buildTree(request: MemoryTreeBuildRequest): MemoryTreeBuildResult {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    if (request.selectedFiles.length === 0) {
      return {
        tree: null,
        status: 'failed',
        errors: ['No files selected for tree building'],
        warnings: [],
        elapsedMs: Date.now() - startTime,
      };
    }

    const tree = createEmptyTree(request.category, request.title);
    const root = tree.root as { children: MemoryTreeNode[] };

    // Build child nodes from selected files
    for (const file of request.selectedFiles) {
      const now = new Date().toISOString();
      const child: MemoryTreeNode = {
        id: generateNodeId(),
        title: file.displayName.replace(/\.md$/, ''),
        type: this.inferNodeType(file.relativePath, request.category),
        summary: `Source: ${file.relativePath}`,
        children: [],
        sources: [{
          relativePath: file.relativePath,
          chunkIndex: 0,
          headingPath: [],
          score: 1,
        }],
        evidence: [],
        confidence: 0.8,
        completeness: 0.3,
        createdAt: now,
        updatedAt: now,
      };
      root.children.push(child);
    }

    // Add nodes from query result if provided
    if (request.queryResult?.sources) {
      for (const source of request.queryResult.sources) {
        const now = new Date().toISOString();
        const child: MemoryTreeNode = {
          id: generateNodeId(),
          title: this.extractTitle(source),
          type: 'reference',
          summary: source.headingPath.join(' > ') || `Chunk ${source.chunkIndex}`,
          children: [],
          sources: [source],
          evidence: request.queryResult.evidence.filter(
            (e) => e.source.relativePath === source.relativePath,
          ),
          confidence: source.score,
          completeness: 0.2,
          createdAt: now,
          updatedAt: now,
        };
        root.children.push(child);
      }
    }

    // Update tree totals
    const updatedTree: MemoryTree = {
      ...tree,
      root: root as MemoryTreeNode,
      totalNodes: 1 + root.children.length,
      sourceCount: root.children.reduce((sum, c) => sum + c.sources.length, 0),
      updatedAt: new Date().toISOString(),
      isMockTree: true,
    };

    this.trees.set(updatedTree.id, updatedTree);

    return {
      tree: updatedTree,
      status: warnings.length > 0 ? 'partial' : 'success',
      errors,
      warnings,
      elapsedMs: Date.now() - startTime,
    };
  }

  /**
   * Get a previously built tree.
   */
  getTree(treeId: string): MemoryTree | null {
    return this.trees.get(treeId) ?? null;
  }

  /**
   * Simulate user manual edit preservation.
   * In production, edits would merge into the tree.
   * This is a contract placeholder for Phase 4-2-G.
   */
  preserveManualEdits(
    _treeId: string,
    _edits: Array<{ nodeId: string; title?: string; summary?: string }>,
  ): { ok: boolean; reason?: string } {
    return { ok: true };
  }

  /**
   * Simulate corrupted tree recovery.
   * Always returns a fresh empty tree as recovery.
   */
  recoverCorruptedTree(category: MemoryTreeCategory): MemoryTree {
    return createEmptyTree(category, 'Recovered Tree');
  }

  /**
   * List all built trees.
   */
  listTrees(): readonly MemoryTree[] {
    return Array.from(this.trees.values());
  }

  /**
   * Clear all stored trees.
   */
  clear(): void {
    this.trees.clear();
  }

  // ── Helpers ─────────────────────────────────────

  private inferNodeType(relativePath: string, category: MemoryTreeCategory): MemoryTreeNode['type'] {
    if (relativePath.includes('research') || relativePath.includes('paper')) return 'reference';
    if (relativePath.includes('teaching') || relativePath.includes('lecture')) return 'page';
    if (category === 'teaching') return 'concept';
    return 'topic';
  }

  private extractTitle(source: SourceRef): string {
    if (source.headingPath.length > 0) {
      return source.headingPath[source.headingPath.length - 1].replace(/^#+\s*/, '');
    }
    return source.relativePath.split('/').pop()?.replace(/\.md$/, '') ?? 'Untitled';
  }
}
