/**
 * useMenuCommands — Phase 5-3-IMP / QUALITY-DEBT.
 *
 * Listens for typed menu IPC messages via window.schola.menu.onNavigate
 * and dispatches to renderer-side handlers.
 *
 * Security: typed unions (ScholaMenuPayload) replace string payloads.
 * Runtime whitelists retained for defense-in-depth.
 */

import { useEffect, useCallback } from 'react';
import type { ActivityId } from '../ActivityBar';
import type { GraphScope, GraphLayoutAlgorithm } from '../../graph/lib/graphTypes';
import type {
  ScholaMenuPayload,
  ScholaMenuNavigatePayload,
  ScholaMenuActionPayload,
  ScholaMenuViewTogglePayload,
  ScholaMenuGraphScopePayload,
  ScholaMenuGraphLayoutPayload,
  ScholaMenuGraphActionPayload,
} from '../../../lib/contracts/app.types';

export type MenuNavigateActivityId = ActivityId | 'search' | 'help';

export interface MenuCommandCallbacks {
  readonly onNavigate: (activity: MenuNavigateActivityId, section?: string, action?: string) => void;
  readonly onAction: (action: string) => void;
  readonly onViewToggle: (panel: string) => void;
  readonly onGraphScope: (scope: GraphScope) => void;
  readonly onGraphLayout: (layout: GraphLayoutAlgorithm) => void;
  readonly onGraphAction: (action: string) => void;
}

// Runtime whitelists (defense-in-depth)
const VALID_ACTIONS = new Set<string>([
  'newMarkdown', 'newFolder', 'rename', 'delete', 'revealInExplorer', 'find', 'clearContext', 'importDocument',
]);

const VALID_GRAPH_ACTIONS = new Set<string>([
  'openStylePanel', 'toggleRelationLabel', 'resetView',
]);

const VALID_PANELS = new Set<string>(['activityBar', 'sideBar', 'bottomPanel']);

const VALID_SCOPES = new Set<string>([
  'current-file', 'selected-files', 'folder-project', 'custom', 'whole-vault',
]);

const VALID_LAYOUTS = new Set<string>(['force-directed', 'hierarchical', 'circular']);

function isNavigatePayload(p: ScholaMenuPayload): p is ScholaMenuNavigatePayload {
  return 'activity' in p;
}

function isActionPayload(p: ScholaMenuPayload): p is ScholaMenuActionPayload {
  return 'action' in p && !('activity' in p) && !('panel' in p) && !('scope' in p) && !('layout' in p);
}

function isViewTogglePayload(p: ScholaMenuPayload): p is ScholaMenuViewTogglePayload {
  return 'panel' in p;
}

function isGraphScopePayload(p: ScholaMenuPayload): p is ScholaMenuGraphScopePayload {
  return 'scope' in p;
}

function isGraphLayoutPayload(p: ScholaMenuPayload): p is ScholaMenuGraphLayoutPayload {
  return 'layout' in p && !('scope' in p);
}

function isGraphActionPayload(p: ScholaMenuPayload): p is ScholaMenuGraphActionPayload {
  return 'action' in p && !('activity' in p) && !('panel' in p) && !('scope' in p) && !('layout' in p);
}

export function useMenuCommands(callbacks: MenuCommandCallbacks): void {
  const handleMenuCommand = useCallback(
    (payload: ScholaMenuPayload) => {
      if (isNavigatePayload(payload)) {
        const valid = new Set(['files', 'search', 'graph', 'ai', 'artifacts', 'plugins', 'settings', 'help']);
        if (valid.has(payload.activity)) {
          callbacks.onNavigate(payload.activity as MenuNavigateActivityId, payload.section, payload.action);
        }
        return;
      }

      if (isActionPayload(payload)) {
        if (VALID_ACTIONS.has(payload.action)) {
          callbacks.onAction(payload.action);
        }
        return;
      }

      if (isViewTogglePayload(payload)) {
        if (VALID_PANELS.has(payload.panel)) {
          callbacks.onViewToggle(payload.panel);
        }
        return;
      }

      if (isGraphScopePayload(payload)) {
        if (VALID_SCOPES.has(payload.scope)) {
          callbacks.onGraphScope(payload.scope as GraphScope);
        }
        return;
      }

      if (isGraphLayoutPayload(payload)) {
        if (VALID_LAYOUTS.has(payload.layout)) {
          callbacks.onGraphLayout(payload.layout as GraphLayoutAlgorithm);
        }
        return;
      }

      if (isGraphActionPayload(payload)) {
        if (VALID_GRAPH_ACTIONS.has(payload.action)) {
          callbacks.onGraphAction(payload.action);
        }
        return;
      }
    },
    [callbacks],
  );

  useEffect(() => {
    const api = window.schola?.menu;
    if (!api) return;

    const unsubscribe = api.onNavigate(handleMenuCommand);
    return unsubscribe;
  }, [handleMenuCommand]);
}
