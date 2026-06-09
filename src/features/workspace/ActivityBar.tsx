/**
 * ActivityBar — Phase 5-0.
 *
 * Productization-grade activity bar with 7 main function entries.
 * Pure UI switching — no runtime actions, no provider/plugin/export invocation.
 *
 * Key invariants:
 * - Read-only entry switching: each button only changes activeActivity
 * - No runtime: does not trigger provider, plugin loader, context send, export
 * - Placeholder-aware: entries for unimplemented features are explicitly labeled
 * - Accessible: proper aria-labels, aria-pressed, data-testid on all entries
 */
import type { ReactElement } from 'react';
import { ScholaIcon } from '../icons/ScholaIcon';

export type ActivityId = 'files' | 'graph' | 'ai' | 'artifacts' | 'plugins' | 'settings';

export interface ActivityBarProps {
  readonly activeActivity: ActivityId;
  readonly onActivityChange: (activity: ActivityId) => void;
}

export interface ActivityEntry {
  readonly id: ActivityId;
  readonly icon: ReactElement;
  readonly label: string;
  readonly testid: string;
}

export const ACTIVITY_BAR_ITEMS: readonly ActivityEntry[] = [
  { id: 'files', icon: <ScholaIcon iconId="files" />, label: '文件', testid: 'activity-files' },
  { id: 'graph', icon: <ScholaIcon iconId="graph" />, label: '图谱', testid: 'activity-graph' },
  {
    id: 'ai',
    icon: <ScholaIcon iconId="ai-research" />,
    label: 'AI 工作台',
    testid: 'activity-ai',
  },
  {
    id: 'artifacts',
    icon: <ScholaIcon iconId="artifacts" />,
    label: '产物',
    testid: 'activity-artifacts',
  },
  {
    id: 'plugins',
    icon: <ScholaIcon iconId="plugins" />,
    label: '插件生态',
    testid: 'activity-plugins',
  },
  {
    id: 'settings',
    icon: <ScholaIcon iconId="settings" />,
    label: '设置',
    testid: 'activity-settings',
  },
];

export function ActivityBar({ activeActivity, onActivityChange }: ActivityBarProps): ReactElement {
  return (
    <nav className="schola-activitybar" aria-label="Activity bar">
      {ACTIVITY_BAR_ITEMS.map((entry) => {
        const isActive = activeActivity === entry.id;
        return (
          <button
            key={entry.id}
            type="button"
            className={`activitybar-btn${isActive ? ' activitybar-btn-active' : ''}`}
            data-testid={entry.testid}
            data-active={isActive ? 'true' : 'false'}
            title={entry.label}
            aria-label={entry.label}
            aria-pressed={isActive}
            onClick={() => onActivityChange(entry.id)}
          >
            <ScholaIcon iconId={entry.id} active={isActive} />
          </button>
        );
      })}
    </nav>
  );
}
