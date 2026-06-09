import type { ReactElement } from 'react';
import type { FileEntry } from '../../lib/contracts/vault.types';
import { AIResearchMainView } from './AIResearchMainView';

export interface AIResearchWorkbenchProps {
  readonly vaultId: string | null;
  readonly fileTree: readonly FileEntry[];
}

export function AIResearchWorkbench({ vaultId, fileTree }: AIResearchWorkbenchProps): ReactElement {
  return (
    <div className="workspace-ai-research-workbench" data-testid="ai-research-workbench">
      <AIResearchMainView vaultId={vaultId} fileTree={fileTree} />
    </div>
  );
}
