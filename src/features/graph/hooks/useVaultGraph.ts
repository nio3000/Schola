/**
 * Hook for fetching vault graph data via IPC.
 *
 * Only fetches when the panel is open (isOpen=true).
 * Phase 2-D-2
 */

import { useCallback, useEffect, useState } from 'react';
import { getVaultGraph } from '../../../lib/platform/schola-api';
import type { GetVaultGraphResult, GraphNode, GraphEdge } from '../../../lib/contracts/graph-query.types';

export type GraphStatus = 'loading' | 'ready' | 'empty' | 'error' | 'limited';

interface UseVaultGraphInput {
  readonly vaultId: string | null;
  readonly isOpen: boolean;
}

interface UseVaultGraphResult {
  readonly status: GraphStatus;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly truncated: boolean;
  readonly nodeLimit: number;
  readonly totalNodes: number;
  readonly errorMessage: string | null;
  readonly refresh: () => void;
}

export function useVaultGraph({ vaultId, isOpen }: UseVaultGraphInput): UseVaultGraphResult {
  const [status, setStatus] = useState<GraphStatus>('loading');
  const [nodes, setNodes] = useState<readonly GraphNode[]>([]);
  const [edges, setEdges] = useState<readonly GraphEdge[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [nodeLimit, setNodeLimit] = useState(0);
  const [totalNodes, setTotalNodes] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!vaultId) {
      setStatus('error');
      setErrorMessage('Vault is not available.');
      return;
    }
    setStatus('loading');
    try {
      const result: GetVaultGraphResult = await getVaultGraph({ vaultId });

      if (result.ok) {
        setNodes(result.nodes);
        setEdges(result.edges);
        setTruncated(result.truncated);
        setNodeLimit(result.nodeLimit);
        setTotalNodes(result.totalNodes);
        if (result.edges.length === 0) {
          setStatus('empty');
        } else if (result.truncated) {
          setStatus('limited');
        } else {
          setStatus('ready');
        }
      } else {
        setStatus('error');
        setErrorMessage(result.message);
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [vaultId]);

  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('loading');
      setNodes([]);
      setEdges([]);
      return;
    }
    void fetch();
  }, [isOpen, fetch]);

  const refresh = useCallback(() => { void fetch(); }, [fetch]);

  return { status, nodes, edges, truncated, nodeLimit, totalNodes, errorMessage, refresh };
}
