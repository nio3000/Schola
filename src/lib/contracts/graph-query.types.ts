/**
 * Graph query IPC contract types (Phase 2-D-1).
 *
 * All queries are fixed-function — renderer cannot pass raw SQL,
 * table names, or file paths.  Graph View is a read-only consumer
 * of the SQLite links index.
 */

// ── Channel ────────────────────────────────────

export const GRAPH_GET_VAULT_GRAPH_CHANNEL = 'graph:get-vault-graph';

/** Backend hard cap on graph nodes returned. */
export const GRAPH_MAX_NODES = 200;

// ── Node / Edge ────────────────────────────────

export type GraphNodeKind = 'file' | 'unresolved';

export interface GraphNode {
  readonly id: string;
  readonly kind: GraphNodeKind;
  readonly label: string;
  readonly relativePath: string | null;
  readonly title: string | null;
  readonly linkCount: number;
  readonly backlinkCount: number;
  readonly isOrphan: boolean;
}

export type GraphEdgeKind = 'wikilink' | 'unresolved';

export interface GraphEdge {
  readonly source: string;
  readonly target: string;
  readonly kind: GraphEdgeKind;
  readonly label: string | null;
}

// ── Input / Output ─────────────────────────────

export interface GetVaultGraphInput {
  readonly vaultId: string;
  readonly options?: {
    readonly maxNodes?: number;
  };
}

export type GraphErrorCode = 'NO_VAULT' | 'DB_MISSING' | 'DB_ERROR' | 'DB_CORRUPTED';

export interface GetVaultGraphSuccess {
  readonly ok: true;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly truncated: boolean;
  readonly nodeLimit: number;
  readonly totalNodes: number;
}

export interface GetVaultGraphFailure {
  readonly ok: false;
  readonly code: GraphErrorCode;
  readonly message: string;
}

export type GetVaultGraphResult = GetVaultGraphSuccess | GetVaultGraphFailure;

// ── Renderer API ───────────────────────────────

export interface ScholaGraphApi {
  readonly getVaultGraph: (input: GetVaultGraphInput) => Promise<GetVaultGraphResult>;
}
