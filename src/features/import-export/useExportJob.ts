/**
 * Export job state hook — Phase 3-3 + CODE-QUALITY-IMP-3.
 */
import { useState, useCallback } from 'react';
import type { ExportJobStatus } from '../../lib/contracts/export-job.types';
import type { ExportFormat } from '../../lib/contracts/export.types';
import { createExportJob, getExportJobStatus } from '../../lib/platform/schola-api';
import { useJobPollRef } from './useJobPolling';

export type ExportUIState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'pending'; readonly jobId: string; readonly targetFormat: ExportFormat }
  | { readonly phase: 'running'; readonly job: ExportJobStatus }
  | { readonly phase: 'completed'; readonly job: ExportJobStatus }
  | { readonly phase: 'failed'; readonly job: ExportJobStatus };

export interface UseExportJobResult {
  readonly state: ExportUIState;
  readonly startExport: (vaultId: string, sourceMarkdownRelativePath: string, targetFormat: ExportFormat) => Promise<void>;
  readonly dismiss: () => void;
}

export function useExportJob(): UseExportJobResult {
  const [state, setState] = useState<ExportUIState>({ phase: 'idle' });
  const polling = useJobPollRef();

  const dismiss = useCallback(() => { polling.stopPolling(); setState({ phase: 'idle' }); }, [polling]);

  const startExport = useCallback(async (vaultId: string, sourceMarkdownRelativePath: string, targetFormat: ExportFormat) => {
    polling.stopPolling();
    const result = await createExportJob({ vaultId, sourceMarkdownRelativePath, targetFormat });
    if (!result.ok) { setState({ phase: 'failed', job: { jobId: '', vaultId, phase: 'failed' as const, engine: 'pandoc' as const, targetFormat, sourceMarkdownRelativePath, outputRelativePath: null, metadataRelativePath: null, progress: 0, warnings: [], error: { code: result.code, message: result.message, recoverable: false }, createdAt: new Date().toISOString(), completedAt: null } }); return; }
    setState({ phase: 'pending', jobId: result.jobId, targetFormat });
    polling.startPolling(result.jobId, (jobId) => getExportJobStatus(vaultId, jobId), setState as any, () => ({ phase: 'failed' as const, job: { jobId: result.jobId, vaultId, phase: 'failed' as const, engine: 'pandoc' as const, targetFormat, sourceMarkdownRelativePath, outputRelativePath: null, metadataRelativePath: null, progress: 0, warnings: [], error: { code: 'INTERNAL_ERROR' as const, message: 'Timed out', recoverable: false }, createdAt: new Date().toISOString(), completedAt: null } }));
  }, [polling]);
  return { state, startExport, dismiss };
}
