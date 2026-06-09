/**
 * MemoryTree Contract — Phase 4-2-F.
 *
 * Defines the Memory Tree structure for Research / Teaching knowledge.
 * Memory Trees are DERIVED artifacts built from selected Vault scope,
 * Ingest manifests, and Query results. They are never auto-written to Vault.
 *
 * Key invariants:
 * - Derived data / artifact draft only
 * - SourceRef / EvidenceRef preservation (relativePath-only)
 * - User review required before save
 * - No fabricated sources, no external database claims
 * - No real provider/embedding calls
 */

import type { SourceRef, EvidenceRef } from './local-qa.types';

// ── Node Types ─────────────────────────────────────────

export type MemoryTreeNodeType = 'topic' | 'page' | 'collection' | 'concept' | 'reference';

export interface MemoryTreeNode {
  readonly id: string;
  readonly title: string;
  readonly type: MemoryTreeNodeType;
  readonly summary: string;
  readonly children: MemoryTreeNode[];
  readonly sources: readonly SourceRef[];
  readonly evidence: readonly EvidenceRef[];
  readonly confidence: number;
  readonly completeness: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ── Tree Structure ─────────────────────────────────────

export type MemoryTreeRelationType = 'parent_of' | 'related_to' | 'derived_from' | 'references';

export interface MemoryTreeEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly relation: MemoryTreeRelationType;
  readonly label: string;
}

export type MemoryTreeCategory = 'research' | 'teaching';

export interface MemoryTree {
  readonly id: string;
  readonly title: string;
  readonly category: MemoryTreeCategory;
  readonly root: MemoryTreeNode;
  readonly edges: readonly MemoryTreeEdge[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly totalNodes: number;
  readonly sourceCount: number;
  readonly isMockTree: boolean;
}

// ── Build Types ───────────────────────────────────────

export interface MemoryTreeBuildRequest {
  readonly category: MemoryTreeCategory;
  readonly title: string;
  readonly selectedFiles: readonly { relativePath: string; displayName: string }[];
  readonly queryResult?: {
    readonly sources: readonly SourceRef[];
    readonly evidence: readonly EvidenceRef[];
  };
}

export interface MemoryTreeBuildResult {
  readonly tree: MemoryTree | null;
  readonly status: 'success' | 'partial' | 'failed';
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly elapsedMs: number;
}

// ── Validation ─────────────────────────────────────────

export function validateMemoryTreeNode(node: MemoryTreeNode): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!node.id) issues.push('Node id required');
  if (!node.title) issues.push('Node title required');
  if (node.confidence < 0 || node.confidence > 1) issues.push('Confidence must be 0-1');
  if (node.completeness < 0 || node.completeness > 1) issues.push('Completeness must be 0-1');
  for (const s of node.sources) {
    if (s.relativePath.includes(':\\')) issues.push(`Source absolute path: ${s.relativePath}`);
    if (s.relativePath.includes('\\\\')) issues.push(`Source UNC path: ${s.relativePath}`);
  }
  return { valid: issues.length === 0, issues };
}

// ── Helpers ────────────────────────────────────────────

let nodeIdCounter = 0;
export function generateNodeId(): string {
  return `mt-node-${Date.now()}-${++nodeIdCounter}`;
}

let treeIdCounter = 0;
export function generateTreeId(): string {
  return `mt-${Date.now()}-${++treeIdCounter}`;
}

export function createEmptyTree(category: MemoryTreeCategory, title: string): MemoryTree {
  const now = new Date().toISOString();
  return {
    id: generateTreeId(),
    title,
    category,
    root: {
      id: generateNodeId(),
      title,
      type: 'topic',
      summary: '',
      children: [],
      sources: [],
      evidence: [],
      confidence: 1,
      completeness: 0,
      createdAt: now,
      updatedAt: now,
    },
    edges: [],
    createdAt: now,
    updatedAt: now,
    totalNodes: 1,
    sourceCount: 0,
    isMockTree: true,
  };
}
