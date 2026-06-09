import type { ReactElement } from 'react';
import { AI_RESEARCH_TASK_LABELS, type AIResearchTaskType } from '../../../lib/contracts/ai-research.types';

export interface TaskTypeSelectorProps {
  readonly value: AIResearchTaskType;
  readonly onChange: (value: AIResearchTaskType) => void;
}

const TASK_TYPES = Object.keys(AI_RESEARCH_TASK_LABELS) as AIResearchTaskType[];

export function TaskTypeSelector({ value, onChange }: TaskTypeSelectorProps): ReactElement {
  return (
    <section className="workspace-ai-research-card" data-testid="ai-research-task-type-selector">
      <p className="workspace-ai-research-kicker">任务类型</p>
      <div className="workspace-ai-research-task-grid">
        {TASK_TYPES.map((taskType) => (
          <button
            key={taskType}
            type="button"
            className={`workspace-ai-research-task-option${value === taskType ? ' workspace-ai-research-task-option-active' : ''}`}
            onClick={() => onChange(taskType)}
          >
            {AI_RESEARCH_TASK_LABELS[taskType]}
          </button>
        ))}
      </div>
    </section>
  );
}
