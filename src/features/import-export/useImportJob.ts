/**
 * Import job state hook — Phase 3-3 + CODE-QUALITY-IMP-3.
 */
import { useState, useCallback } from 'react';
import type { ImportJobStatus, SelectImportSourceInput } from '../../lib/contracts/import-job.types';
import type { ImportMode, ProductImportMode } from '../../lib/contracts/import.types';
import { selectImportSource, createImportJob, getImportJobStatus } from '../../lib/platform/schola-api';
import { useJobPollRef } from './useJobPolling';

export type ImportUIState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'selecting' }
  | { readonly phase: 'pending'; readonly jobId: string; readonly sourceFileName: string }
  | { readonly phase: 'running'; readonly job: ImportJobStatus }
  | { readonly phase: 'completed'; readonly job: ImportJobStatus }
  | { readonly phase: 'failed'; readonly job: ImportJobStatus };

export interface UseImportJobResult {
  readonly state: ImportUIState;
  readonly startImport: (vaultId: string, productMode?: ProductImportMode) => Promise<void>;
  readonly dismiss: () => void;
}

export function useImportJob(): UseImportJobResult {
  const [state, setState] = useState<ImportUIState>({ phase: 'idle' });
  const polling = useJobPollRef();

  const dismiss = useCallback(() => { polling.stopPolling(); setState({ phase: 'idle' }); }, [polling]);

  const startImport = useCallback(async (vaultId: string, productMode: ProductImportMode = 'quick') => {
    polling.stopPolling();
    setState({ phase: 'selecting' });
    const internalMode: ImportMode = productMode === 'enhanced' ? 'paper_enhanced' : 'quick';
    const selectInput: SelectImportSourceInput | undefined = productMode === 'enhanced' ? { formatFilter: ['pdf'] } : undefined;
    const sourceResult = await selectImportSource(selectInput);
    if (!sourceResult.ok) { setState({ phase: 'idle' }); return; }
    const createResult = await createImportJob({ vaultId, sourceFormat: sourceResult.sourceFormat as 'pdf' | 'docx', selectedSourceToken: sourceResult.selectedSourceToken, mode: internalMode });
    if (!createResult.ok) { setState({ phase: 'failed', job: { jobId: '', vaultId, phase: 'failed' as const, engine: 'markitdown' as const, sourceFormat: (sourceResult.sourceFormat as 'pdf' | 'docx') ?? 'pdf', sourceFileName: sourceResult.sourceFileName, attachmentRelativePath: '', outputMarkdownRelativePath: null, companionRelativePath: null, progress: 0, warnings: [], error: { code: createResult.code, message: createResult.message, recoverable: false }, createdAt: new Date().toISOString(), completedAt: null, importMode: internalMode } }); return; }
    setState({ phase: 'pending', jobId: createResult.jobId, sourceFileName: sourceResult.sourceFileName });
    polling.startPolling(createResult.jobId, (jobId) => getImportJobStatus(vaultId, jobId), setState as any, () => ({ phase: 'failed' as const, job: { jobId: createResult.jobId, vaultId, phase: 'failed' as const, engine: 'markitdown' as const, sourceFormat: (sourceResult.sourceFormat as 'pdf' | 'docx') ?? 'pdf', sourceFileName: sourceResult.sourceFileName, attachmentRelativePath: '', outputMarkdownRelativePath: null, companionRelativePath: null, progress: 0, warnings: [], error: { code: 'INTERNAL_ERROR' as const, message: 'Timed out', recoverable: false }, createdAt: new Date().toISOString(), completedAt: null, importMode: internalMode } }));
  }, [polling]);
  return { state, startImport, dismiss };
}
