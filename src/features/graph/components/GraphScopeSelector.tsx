import type { ReactElement } from 'react';
import { SCOPE_LABELS, type GraphScope } from '../lib/graphScope';

interface GraphScopeSelectorProps {
  readonly scope: GraphScope;
  readonly onScopeChange: (scope: GraphScope) => void;
}

const GRAPH_SCOPE_OPTIONS: readonly GraphScope[] = [
  'current-file',
  'selected-files',
  'folder-project',
  'custom',
  'whole-vault',
];

export function GraphScopeSelector({ scope, onScopeChange }: GraphScopeSelectorProps): ReactElement {
  return (
    <div className="graph-scope-selector" data-testid="graph-scope-selector" role="radiogroup" aria-label="图谱范围">
      {GRAPH_SCOPE_OPTIONS.map((option) => {
        const isActive = scope === option;
        return (
          <button
            key={option}
            type="button"
            className={`graph-scope-option${isActive ? ' graph-scope-option-active' : ''}`}
            data-testid={`graph-scope-${option}`}
            data-graph-scope={option}
            aria-checked={isActive}
            role="radio"
            onClick={() => onScopeChange(option)}
          >
            {SCOPE_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
