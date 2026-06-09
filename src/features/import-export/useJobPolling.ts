/**
 * Generic job polling hook — CODE-QUALITY-IMP-3.
 *
 * Extracted from useImportJob / useExportJob (audit DUP-05).
 */
import { useRef, useCallback, useEffect } from 'react';

export const JOB_POLL_INTERVAL_MS = 1000;
export const JOB_MAX_POLLS = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyState = any;

interface JobPollRef {
  stopPolling: () => void;
  startPolling: (
    jobId: string,
    getStatus: (jobId: string) => Promise<AnyState>,
    setState: (updater: (prev: AnyState) => AnyState) => void,
    buildTimeoutFailure: () => AnyState,
  ) => void;
}

export function useJobPollRef(): JobPollRef {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback((
    _jobId: string,
    getStatus: (jobId: string) => Promise<AnyState>,
    setState: (updater: (prev: AnyState) => AnyState) => void,
    buildTimeoutFailure: () => AnyState,
  ) => {
    let polls = 0;
    pollRef.current = setInterval(async () => {
      polls += 1;
      const statusResult = await getStatus(_jobId);

      if (!statusResult.ok || polls >= JOB_MAX_POLLS) {
        stopPolling();
        setState((prev: AnyState) =>
          prev.phase === 'pending' || prev.phase === 'running'
            ? buildTimeoutFailure()
            : prev,
        );
        return;
      }

      const job = statusResult.status;
      if (job.phase === 'completed') {
        stopPolling();
        setState(() => ({ phase: 'completed' as const, job }));
      } else if (job.phase === 'failed' || job.phase === 'cancelled') {
        stopPolling();
        setState(() => ({ phase: 'failed' as const, job }));
      } else {
        setState(() => ({ phase: 'running' as const, job }));
      }
    }, JOB_POLL_INTERVAL_MS);
  }, [stopPolling]);

  return { stopPolling, startPolling };
}
