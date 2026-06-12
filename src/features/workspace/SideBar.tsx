import { type CSSProperties, type ReactElement } from 'react';
import { GraphSidebarSummary } from '../graph/components/GraphSidebarSummary';
import type { GraphScope } from '../graph/lib/graphTypes';
import type { SearchMatch } from '../search/lib/searchIndex';
import { VaultPanel } from '../vault/components/VaultPanel';
import type { VaultPanelProps } from '../vault/components/VaultPanel';
import type { ActivityId } from './ActivityBar';

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 480;

interface SearchSidebarProps {
  readonly query: string;
  readonly matches: readonly SearchMatch[];
  readonly source?: 'sqlite' | 'memory';
  readonly fallbackReason?: string;
  readonly indexReady?: boolean;
  readonly onQueryChange: (query: string) => void;
  readonly onOpenFile: (relativePath: string) => void;
  readonly onClose: () => void;
}

interface GraphSidebarProps {
  readonly vaultId: string | null;
  readonly isOpen: boolean;
  readonly selectedFile: string | null;
  readonly selectedFiles: readonly string[];
  readonly scope: GraphScope;
  readonly onOpenMainView: () => void;
}

export interface SideBarProps extends VaultPanelProps {
  readonly activeActivity: ActivityId;
  readonly width: number;
  readonly search?: SearchSidebarProps;
  readonly graph: GraphSidebarProps;
  readonly onOpenAIResearchWorkbench: () => void;
  readonly onOpenSettings: () => void;
}

function SideBarHeader({ title, subtitle }: { readonly title: string; readonly subtitle: string }): ReactElement {
  return (
    <header className="workspace-sidebar-header">
      <p className="workspace-sidebar-kicker">Workbench</p>
      <h2 className="workspace-sidebar-title">{title}</h2>
      <p className="workspace-sidebar-copy">{subtitle}</p>
    </header>
  );
}

export function SideBar({
  activeActivity,
  width,
  graph,
  onOpenAIResearchWorkbench: _onOpenAIResearchWorkbench,
  onOpenSettings,
  ...vaultPanelProps
}: SideBarProps): ReactElement {
  const sidebarStyle: CSSProperties = {
    width,
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth: SIDEBAR_MAX_WIDTH,
    flexBasis: width,
  };

  let content: ReactElement;

  switch (activeActivity) {
    case 'files':
      content = (
        <div className="workspace-sidebar-fill" data-testid="vault-panel">
          <VaultPanel {...vaultPanelProps} />
        </div>
      );
      break;
    case 'graph':
      content = (
        <div className="workspace-sidebar-fill workspace-sidebar-graph" data-testid="workspace-sidebar-graph">
          <GraphSidebarSummary
            vaultId={graph.vaultId}
            isOpen={graph.isOpen}
            selectedFile={graph.selectedFile}
            selectedFiles={graph.selectedFiles}
            scope={graph.scope}
            onOpenMainView={graph.onOpenMainView}
          />
        </div>
      );
      break;
    case 'ai':
      content = (
        <div className="workspace-sidebar-fill workspace-sidebar-workbench" data-testid="workspace-sidebar-ai-disabled">
          <SideBarHeader title="AI Research" subtitle="AI Research 使用编辑区主视图，不再渲染外侧摘要栏。" />
        </div>
      );
      break;
    case 'artifacts':
      content = (
        <div className="workspace-sidebar-fill workspace-sidebar-artifacts" data-testid="workspace-sidebar-artifacts">
          <SideBarHeader title="Artifacts" subtitle="Artifact drafts will appear here." />
        </div>
      );
      break;
    case 'plugins':
      content = (
        <div className="workspace-sidebar-fill workspace-sidebar-plugins">
          <SideBarHeader title="Plugin Ecosystem" subtitle="Read-only preview. Plugin Manager is Phase 5-P." />
        </div>
      );
      break;
    case 'settings':
      content = (
        <div className="workspace-sidebar-fill" data-testid="workspace-sidebar-settings">
          <div className="workspace-sidebar-section">
            <h3 className="workspace-sidebar-section-title">设置</h3>
            <p className="workspace-sidebar-section-desc">Schola 设置已移入独立面板。</p>
            <button
              type="button"
              className="workspace-ai-research-primary-button"
              data-testid="sidebar-open-settings"
              onClick={() => onOpenSettings()}
            >
              打开设置
            </button>
          </div>
        </div>
      );
      break;
  }

  return (
    <aside
      className={`workspace-sidebar schola-sidebar workspace-sidebar-activity-${activeActivity}`}
      data-testid="workspace-sidebar"
      data-active-activity={activeActivity}
      style={sidebarStyle}
    >
      {content}
    </aside>
  );
}
