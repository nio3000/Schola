import type { ReactElement } from 'react';

export interface InstructionEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function InstructionEditor({ value, onChange }: InstructionEditorProps): ReactElement {
  return (
    <section className="workspace-ai-research-card workspace-ai-research-instruction-card" data-testid="ai-research-instruction-editor">
      <div className="workspace-ai-research-card-header">
        <div>
          <p className="workspace-ai-research-kicker">用户指令</p>
          <h3 className="workspace-ai-research-card-title">草稿生成说明</h3>
        </div>
        <span className="workspace-ai-research-count-pill">{value.trim().length} 字</span>
      </div>
      <textarea
        className="workspace-ai-research-textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="请输入希望 AI 辅助整理的研究问题、比较维度或阅读笔记要求。输出始终为草稿，必须人工审查。"
      />
    </section>
  );
}
