import { useState, type ReactElement } from 'react';
import { DEFAULT_SCOPE } from '../lib/graphScope';
import type { GraphScope, GraphViewMode } from '../lib/graphTypes';
import { GraphMainView } from './GraphMainView';
import { GraphSidebarSummary } from './GraphSidebarSummary';

export interface GraphPanelProps {
  readonly vaultId: string | null;
  readonly isOpen: boolean;
  readonly selectedFile: string | null;
  readonly selectedFiles?: readonly string[];
  readonly customFiles?: readonly string[];
  readonly scope?: GraphScope;
  readonly viewMode?: GraphViewMode;
  readonly onOpenFile: (path: string) => void;
  readonly onScopeChange?: (scope: GraphScope) => void;
  readonly onOpenMainView?: () => void;
  readonly onClose?: () => void;
}

export function GraphPanel({
  vaultId,
  isOpen,
  selectedFile,
  selectedFiles = [],
  customFiles = [],
  scope,
  viewMode = 'main',
  onOpenFile,
  onScopeChange,
  onOpenMainView,
  onClose,
}: GraphPanelProps): ReactElement | null {
  const [localScope, setLocalScope] = useState<GraphScope>(scope ?? DEFAULT_SCOPE);

  if (!isOpen) return null;

  const activeScope = scope ?? localScope;
  const handleScopeChange = (nextScope: GraphScope): void => {
    setLocalScope(nextScope);
    onScopeChange?.(nextScope);
  };

  if (viewMode === 'sidebar') {
    return (
      <GraphSidebarSummary
        vaultId={vaultId}
        isOpen={isOpen}
        selectedFile={selectedFile}
        selectedFiles={selectedFiles}
        customFiles={customFiles}
        scope={activeScope}
        onOpenMainView={onOpenMainView ?? (() => undefined)}
      />
    );
  }

  return (
    <GraphMainView
      vaultId={vaultId}
      isOpen={isOpen}
      selectedFile={selectedFile}
      selectedFiles={selectedFiles}
      customFiles={customFiles}
      scope={activeScope}
      onScopeChange={handleScopeChange}
      onOpenFile={onOpenFile}
      onClose={onClose ?? (() => undefined)}
    />
  );
}
