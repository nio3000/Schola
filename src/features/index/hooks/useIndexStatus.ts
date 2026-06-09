/**
 * Hook for querying SQLite index status and triggering rebuilds.
 *
 * Phase: Retrofit-5-B
 */

import { useCallback, useEffect, useState } from 'react';
import { getIndexStatus, rebuildIndex } from '../../../lib/platform/schola-api';
import type { IndexStatus, IndexRebuildResult } from '../../../lib/contracts/index-status.types';

interface UseIndexStatusInput {
  readonly vaultId: string | null;
}

interface UseIndexStatusOutput {
  readonly status: IndexStatus | null;
  readonly isRebuilding: boolean;
  readonly rebuildError: string | null;
  readonly handleRebuild: () => Promise<IndexRebuildResult | null>;
  readonly refreshStatus: () => Promise<void>;
}

export function useIndexStatus({ vaultId }: UseIndexStatusInput): UseIndexStatusOutput {
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildError, setRebuildError] = useState<string | null>(null);

  const refreshStatus = useCallback(async (): Promise<void> => {
    if (!vaultId) {
      setStatus(null);
      return;
    }
    try {
      const result = await getIndexStatus(vaultId);
      setStatus(result);
    } catch {
      setStatus(null);
    }
  }, [vaultId]);

  // Fetch status on vault change (separate effect, only depends on vaultId)
  useEffect(() => {
    let cancelled = false;
    if (!vaultId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus(null);
      return;
    }
    getIndexStatus(vaultId).then((result) => {
      if (!cancelled) setStatus(result);
    }).catch(() => {
      if (!cancelled) setStatus(null);
    });
    return () => { cancelled = true; };
  }, [vaultId]);

  const handleRebuild = useCallback(async (): Promise<IndexRebuildResult | null> => {
    if (!vaultId) return null;
    setRebuildError(null);
    setIsRebuilding(true);
    try {
      const result = await rebuildIndex(vaultId);
      if (result.ok) {
        setStatus(result.status);
        return result;
      } else {
        setRebuildError(result.errorMessage ?? '重建失败');
        void refreshStatus();
        return result;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setRebuildError(message);
      void refreshStatus();
      return null;
    } finally {
      setIsRebuilding(false);
    }
  }, [vaultId, refreshStatus]);

  return { status, isRebuilding, rebuildError, handleRebuild, refreshStatus };
}
