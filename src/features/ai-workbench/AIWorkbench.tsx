/**
 * AI Workbench — Phase 4-1-IMP-7: AI Skill Preset Registry + Research Task Recipe.
 *
 * Three-column layout:
 * - Left: Skill preset selection + model info
 * - Center: Context confirmation + skill details + chat placeholder
 * - Right: Artifact preview placeholder
 *
 * No real API calls. No API key display. No Vault writes. No generic IPC.
 * Skills are static prompt templates — NOT automatic agents.
 * Context confirmation is a mandatory preflight guard before any cloud call.
 */
import { useState, useCallback, useMemo } from 'react';
import type { FC, ReactElement } from 'react';
import type {
  ContextSummary,
  ContextFileRefSummary,
} from '../../lib/contracts/context-pack.types';
import type {
  ContextPackV2Summary,
  ContextScope,
} from '../../lib/contracts/context-pack-v2.types';
import { createDefaultWikilinkExpansion } from '../../lib/contracts/context-pack-v2.types';
import type { AISkillPreset, AISkillSummary } from '../../lib/contracts/ai-skill-preset.types';
import { toAISkillSummary } from '../../lib/contracts/ai-skill-preset.types';
import { getAllSkills } from '../../lib/ai-skill-preset-registry';

// ── Mock data for demonstration ──────────────────────

/** Mock context v2 summary for UI demonstration. No real file access. */
const MOCK_CONTEXT_V2: ContextPackV2Summary = {
  scope: {
    type: 'combined',
    selectedFiles: [
      { relativePath: 'notes/research/methodology.md', displayName: 'methodology.md' },
      { relativePath: 'notes/research/literature-review.md', displayName: 'literature-review.md' },
      { relativePath: 'notes/research/experiment-results.md', displayName: 'experiment-results.md' },
    ],
    selectedFolder: {
      relativePath: 'notes/research/',
      displayName: 'research',
    },
    wikilinkExpansion: createDefaultWikilinkExpansion(),
  },
  tokenBudget: { fileTokenBudget: 4000, packTokenBudget: 16000 },
  fileCount: 3,
  files: [
    { relativePath: 'notes/research/methodology.md', displayName: 'methodology.md', tokenCount: 450, truncated: false },
    { relativePath: 'notes/research/literature-review.md', displayName: 'literature-review.md', tokenCount: 1200, truncated: false },
    { relativePath: 'notes/research/experiment-results.md', displayName: 'experiment-results.md', tokenCount: 2100, truncated: true },
  ],
  totalTokens: 3950,
  providerId: 'openai',
  model: 'gpt-4o',
  providerDisplayName: 'OpenAI',
  truncatedFileCount: 1,
};

/** v1-compatible context summary for backward compat. */
const MOCK_CONTEXT_SUMMARY: ContextSummary = {
  fileCount: MOCK_CONTEXT_V2.fileCount,
  files: MOCK_CONTEXT_V2.files,
  totalTokens: MOCK_CONTEXT_V2.totalTokens,
  providerId: MOCK_CONTEXT_V2.providerId,
  model: MOCK_CONTEXT_V2.model,
  providerDisplayName: MOCK_CONTEXT_V2.providerDisplayName,
  truncatedFileCount: MOCK_CONTEXT_V2.truncatedFileCount,
};

// ── Skill list for the left panel ───────────────────

const SKILL_LIST = getAllSkills().map(toAISkillSummary);

// ── Category display names ──────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  reading: '文献阅读',
  analysis: '数据分析',
  writing: '写作辅助',
  review: '审稿评审',
  teaching: '教学辅助',
  methodology: '研究方法',
};

const PRIVACY_LABELS: Record<string, string> = {
  standard: '标准',
  sensitive: '敏感（额外隐私提示）',
  restricted: '受限（每次需单独授权）',
};

const SCOPE_LABELS: Record<string, string> = {
  files: '选择文件',
  folder: '选择文件夹',
  current_note: '当前笔记',
  imported_literature: '导入文献',
  combined: '组合选择',
};

// ── Context Confirmation Panel ───────────────────────

interface ContextConfirmationPanelProps {
  summary: ContextSummary;
  /** Optional v2 scope info for expanded display. */
  scope?: ContextScope;
  confirmed: boolean;
  onToggleConfirm: (confirmed: boolean) => void;
}

const ContextConfirmationPanel: FC<ContextConfirmationPanelProps> = ({
  summary,
  scope,
  confirmed,
  onToggleConfirm,
}) => {
  const handleCheck = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onToggleConfirm(e.target.checked);
    },
    [onToggleConfirm],
  );

  return (
    <div className="aw-context-confirmation" data-testid="aw-context-confirmation">
      <h3 className="aw-cc-title">上下文确认</h3>

      {/* v2: Scope display */}
      {scope && (
        <div className="aw-cc-section" data-testid="aw-cc-scope">
          <div className="aw-cc-label">上下文范围</div>
          <div className="aw-cc-value">{SCOPE_LABELS[scope.type] ?? scope.type}</div>
          {scope.selectedFolder && (
            <div className="aw-cc-sub">
              文件夹：{scope.selectedFolder.displayName}（仅直接内容，不递归遍历子文件夹）
            </div>
          )}
          {scope.currentNote && (
            <div className="aw-cc-sub">当前笔记：{scope.currentNote.displayName}</div>
          )}
          {scope.importedLiterature && (
            <div className="aw-cc-sub">
              导入文献范围（{scope.importedLiterature.fileCount} 个文件）
            </div>
          )}
          {/* Wikilink expansion status */}
          {scope.wikilinkExpansion.enabled ? (
            <div className="aw-cc-sub aw-cc-wikilink-on" data-testid="aw-cc-wikilink-on">
              wikilink 拓链：已启用（深度 {scope.wikilinkExpansion.maxDepth}，仅限选择范围内）
            </div>
          ) : (
            <div className="aw-cc-sub aw-cc-wikilink-off" data-testid="aw-cc-wikilink-off">
              wikilink 拓链：关闭（默认不自动包含链接文件）
            </div>
          )}
        </div>
      )}

      {/* Provider / Model summary */}
      <div className="aw-cc-section" data-testid="aw-cc-provider">
        <div className="aw-cc-label">Provider</div>
        <div className="aw-cc-value">{summary.providerDisplayName || summary.providerId}</div>
        <div className="aw-cc-label">模型</div>
        <div className="aw-cc-value">{summary.model}</div>
      </div>

      {/* Selected file list */}
      <div className="aw-cc-section" data-testid="aw-cc-files">
        <div className="aw-cc-label">
          选中文件 ({summary.fileCount})
        </div>
        <ul className="aw-cc-file-list">
          {summary.files.map((file) => (
            <FileRow key={file.relativePath} file={file} />
          ))}
        </ul>
      </div>

      {/* Token summary */}
      <div className="aw-cc-section" data-testid="aw-cc-tokens">
        <div className="aw-cc-token-summary">
          <span className="aw-cc-label">预估 Token 总数</span>
          <span className="aw-cc-token-count">{summary.totalTokens.toLocaleString()}</span>
        </div>
        {summary.truncatedFileCount > 0 && (
          <div className="aw-cc-truncation-note">
            {summary.truncatedFileCount} 个文件内容已截断（超出单文件 Token 预算）
          </div>
        )}
      </div>

      {/* Privacy warning */}
      <div className="aw-cc-section aw-cc-warning" data-testid="aw-cc-warning">
        <strong>隐私提示：</strong>
        以上文件内容将发送至 {summary.providerDisplayName || summary.providerId}（{summary.model}）。
        Schola 不会保存您的文件内容到云端，仅本地加密存储您的 API Key。
        如包含未发表论文或课题申报内容，请确认您了解数据发送范围。
      </div>

      {/* Confirmation control */}
      <div className="aw-cc-section aw-cc-confirm" data-testid="aw-cc-confirm">
        <label className="aw-cc-checkbox-label">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={handleCheck}
            data-testid="aw-cc-checkbox"
          />
          <span>我已确认上下文范围，同意将上述文件内容发送至 AI 模型</span>
        </label>
      </div>
    </div>
  );
};

// ── File Row ──────────────────────────────────────────

const FileRow: FC<{ file: ContextFileRefSummary }> = ({ file }) => (
  <li className="aw-cc-file-row" data-testid={`aw-cc-file-${file.displayName}`}>
    <span className="aw-cc-file-name" title={file.relativePath}>
      {file.displayName}
    </span>
    <span className="aw-cc-file-tokens">
      ~{file.tokenCount.toLocaleString()} tokens
    </span>
    {file.truncated && (
      <span className="aw-cc-file-truncated" title="内容已截断">
        [已截断]
      </span>
    )}
  </li>
);

// ── Skill Card (left panel) ──────────────────────────

const SkillCard: FC<{
  skill: AISkillSummary;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ skill, isSelected, onSelect }) => (
  <div
    className={`aw-skill-card ${isSelected ? 'aw-skill-card--selected' : ''}`}
    data-testid={`aw-skill-${skill.skillId}`}
    onClick={onSelect}
  >
    <div className="aw-skill-card-header">
      <span className="aw-skill-category-tag" data-testid={`aw-skill-category-${skill.skillId}`}>
        {CATEGORY_LABELS[skill.category] ?? skill.category}
      </span>
    </div>
    <div className="aw-skill-card-title">{skill.title}</div>
    <div className="aw-skill-card-desc">{skill.description}</div>
    <div className="aw-skill-card-meta">
      <span className="aw-skill-privacy" title="隐私级别" data-testid={`aw-skill-privacy-${skill.skillId}`}>
        {PRIVACY_LABELS[skill.privacyLevel] ?? skill.privacyLevel}
      </span>
    </div>
  </div>
);

// ── Left Panel ────────────────────────────────────────

interface LeftPanelProps {
  selectedSkillId: string | null;
  onSelectSkill: (skillId: string) => void;
}

const LeftPanel: FC<LeftPanelProps> = ({ selectedSkillId, onSelectSkill }) => (
  <div className="aw-left" data-testid="aw-left-panel">
    <h3>AI 技能</h3>
    <div className="aw-skill-note" data-testid="aw-skill-note">
      官方内置技能模板 — 选择后生成任务说明和提示词预览，不自动执行。
    </div>
    <div className="aw-skill-list" data-testid="aw-skill-list">
      {SKILL_LIST.map((skill) => (
        <SkillCard
          key={skill.skillId}
          skill={skill}
          isSelected={skill.skillId === selectedSkillId}
          onSelect={() => onSelectSkill(skill.skillId)}
        />
      ))}
    </div>

    <h3>模型</h3>
    <div className="aw-placeholder">OpenAI — GPT-4o</div>
    <div className="aw-placeholder">需要配置 API Key (BYOK)</div>
  </div>
);

// ── Skill Detail Panel (center panel top) ────────────

const SkillDetailPanel: FC<{ preset: AISkillPreset }> = ({ preset }) => (
  <div className="aw-skill-detail" data-testid="aw-skill-detail">
    <h3 className="aw-skill-detail-title" data-testid="aw-skill-detail-title">
      {preset.title}
    </h3>

    <div className="aw-cc-section" data-testid="aw-skill-detail-category">
      <div className="aw-cc-label">分类</div>
      <div className="aw-cc-value">{CATEGORY_LABELS[preset.category] ?? preset.category}</div>
    </div>

    <div className="aw-cc-section" data-testid="aw-skill-detail-context">
      <div className="aw-cc-label">所需上下文</div>
      <div className="aw-cc-value">{preset.requiredContext.hint}</div>
      <div className="aw-cc-sub">最少 {preset.requiredContext.minFiles} 个文件</div>
    </div>

    <div className="aw-cc-section" data-testid="aw-skill-detail-output">
      <div className="aw-cc-label">输出方式</div>
      <div className="aw-cc-value">{preset.outputMode.description}</div>
    </div>

    <div className="aw-cc-section" data-testid="aw-skill-detail-privacy">
      <div className="aw-cc-label">隐私级别</div>
      <div className="aw-cc-value">{PRIVACY_LABELS[preset.privacyLevel] ?? preset.privacyLevel}</div>
    </div>

    <div className="aw-cc-section" data-testid="aw-skill-detail-prompt">
      <div className="aw-cc-label">提示词模板</div>
      <pre className="aw-prompt-preview">{preset.promptTemplate}</pre>
    </div>

    <div className="aw-cc-section aw-cc-warning" data-testid="aw-skill-detail-boundary">
      <strong>阶段边界：</strong>
      {preset.phaseBoundaryNote}
    </div>

    <div className="aw-cc-section" data-testid="aw-skill-detail-forbidden">
      <strong>禁止声明：</strong>
      <ul className="aw-forbidden-list">
        {preset.forbiddenClaims.map((claim, i) => (
          <li key={i}>{claim}</li>
        ))}
      </ul>
    </div>

    <div className="aw-cc-section aw-cc-warning" data-testid="aw-skill-detail-artifact-note">
      <strong>Artifact / Draft-first：</strong>
      AI 输出绝不直接覆盖 Vault 文件。生成内容将先显示在右侧 Artifact 预览区，您审查后再手动保存。
    </div>

    <div className="aw-cc-section" data-testid="aw-skill-detail-confirmation-required">
      <strong>前置条件：</strong>
      使用此技能前必须先完成上下文确认（下方 Context Confirmation 面板）。
    </div>
  </div>
);

// ── Center Panel ──────────────────────────────────────

interface CenterPanelProps {
  summary: ContextPackage;
  /** V2 scope for expanded context display. */
  contextScope?: ContextScope;
  confirmed: boolean;
  selectedSkill: AISkillPreset | null;
  onToggleConfirm: (confirmed: boolean) => void;
}

interface ContextPackage {
  fileCount: number;
  files: readonly ContextFileRefSummary[];
  totalTokens: number;
  providerId: string;
  model: string;
  providerDisplayName: string;
  truncatedFileCount: number;
}

const CenterPanel: FC<CenterPanelProps> = ({ summary, contextScope, confirmed, selectedSkill, onToggleConfirm }) => (
  <div className="aw-center" data-testid="aw-center-panel">
    {/* Skill detail when selected */}
    {selectedSkill && <SkillDetailPanel preset={selectedSkill} />}

    {/* Context Confirmation */}
    <ContextConfirmationPanel
      summary={summary}
      scope={contextScope}
      confirmed={confirmed}
      onToggleConfirm={onToggleConfirm}
    />

    {/* Chat area */}
    <h3>AI 对话</h3>
    <div className="aw-placeholder aw-chat-area">
      <p>AI Workbench — ContextPack v2 + Skill Preset (4-2-B).</p>
      {!selectedSkill && <p>请从左侧选择一个 AI 技能开始。</p>}
      {selectedSkill && !confirmed && <p>请先确认上下文范围。</p>}
      {selectedSkill && confirmed && <p>已选择「{selectedSkill.title}」，上下文已确认，可发送消息（Skeleton — 无真实 API 调用）。</p>}
    </div>
    <div className="aw-input-area">
      <textarea
        disabled={!confirmed}
        placeholder={confirmed ? '输入消息... (Skeleton)' : '请先确认上下文'}
        data-testid="aw-chat-input"
      />
      <button disabled={!confirmed} data-testid="aw-send-btn">发送</button>
    </div>
  </div>
);

// ── Right Panel ───────────────────────────────────────

const RightPanel: FC = () => (
  <div className="aw-right" data-testid="aw-right-panel">
    <h3>Artifact 预览</h3>
    <div className="aw-placeholder">
      <p>AI 生成的内容将在此显示。</p>
      <p>您可以审查后再决定是否保存到 Vault。</p>
    </div>
    <div className="aw-placeholder">
      <p>Artifact-first: AI 输出绝不直接覆盖 Vault 文件。</p>
    </div>
  </div>
);

// ── Main Workbench ────────────────────────────────────

const AIWorkbench: FC = (): ReactElement => {
  const [visible, setVisible] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const summary = useMemo(() => MOCK_CONTEXT_SUMMARY, []);
  const contextScope = useMemo(() => MOCK_CONTEXT_V2.scope, []);

  const handleToggleConfirm = useCallback((value: boolean) => {
    setConfirmed(value);
  }, []);

  const handleSelectSkill = useCallback((skillId: string) => {
    setSelectedSkillId(skillId);
    // Selecting a new skill resets confirmation
    setConfirmed(false);
  }, []);

  const selectedSkillPreset = useMemo(() => {
    if (!selectedSkillId) return null;
    return getAllSkills().find((s) => s.skillId === selectedSkillId) ?? null;
  }, [selectedSkillId]);

  if (!visible) {
    return (
      <div className="aw-entry" data-testid="aw-entry">
        <button onClick={() => setVisible(true)}>打开 AI 工作台</button>
        <p className="aw-note">AI Workbench — ContextPack v2 + Skill Preset Registry. BYOK only.</p>
      </div>
    );
  }

  return (
    <div className="aw-workbench" data-testid="aw-workbench">
      <div className="aw-header">
        <h2>AI 工作台</h2>
        <button onClick={() => setVisible(false)}>收起</button>
      </div>
      <div className="aw-three-columns">
        <LeftPanel
          selectedSkillId={selectedSkillId}
          onSelectSkill={handleSelectSkill}
        />
        <CenterPanel
          summary={summary}
          contextScope={contextScope}
          confirmed={confirmed}
          selectedSkill={selectedSkillPreset}
          onToggleConfirm={handleToggleConfirm}
        />
        <RightPanel />
      </div>
      <div className="aw-footer">
        <p className="aw-byok-note">Schola 不提供 API Key 或模型额度。请使用您自己的 API Key (BYOK)。</p>
      </div>
    </div>
  );
};

export default AIWorkbench;
