import { useEffect } from 'react';
import type { VaultFileEvent } from '../../../lib/contracts/vault.types';
import { onVaultFileEvent } from '../../../lib/platform/schola-api';

/**
 * Subscribe to vault file events from the backend watcher.
 *
 * The callback receives a deduplicated, debounced batch of events
 * whenever the file system changes within the open vault.
 *
 * Unsubscribes automatically on unmount.
 */
export function useVaultEvents(
  onEvents: (events: readonly VaultFileEvent[]) => void,
): void {
  useEffect(() => {
    const unsubscribe = onVaultFileEvent(onEvents);
    return unsubscribe;
  }, [onEvents]);
}
