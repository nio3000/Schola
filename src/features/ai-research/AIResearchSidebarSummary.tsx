import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type { ContextSourceRef, ProviderReadiness } from '../../lib/contracts/ai-research.types';
import type { FileEntry } from '../../lib/contracts/vault.types';
import { getProviderReadiness } from '../../lib/platform/ai-research-api';

export interface AIResearchSidebarSummaryProps {
  readonly fileTree: readonly FileEntry[];
  readonly selectedFile: string | null;
  readonly onOpenWorkbench: () => void;
}

function collectSources(entries: readonly FileEntry[]): ContextSourceRef[] {
  const supportedExtensions = [
    '.md', '.markdown', '.mdx',
    '.pdf',
    '.docx', '.doc',
    '.pptx', '.ppt',
    '.txt', '.rtf',
    '.tex', '.ltx',
    '.bib', '.bibtex', '.ris',
    '.csv', '.xlsx', '.xls', '.tsv',
    '.json', '.yaml', '.yml',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
  ];

  return entries.flatMap((entry) => {
    if (entry.type === 'directory') return collectSources(entry.children ?? []);
    const lowerPath = entry.relativePath.toLowerCase();
    const ext = lowerPath.slice(lowerPath.lastIndexOf('.'));
    if (!supportedExtensions.includes(ext)) return [];

    let sourceType: ContextSourceRef['sourceType'] = 'markdown';
    if (lowerPath.endsWith('.pdf')) sourceType = 'pdf';
    else if (lowerPath.endsWith('.docx') || lowerPath.endsWith('.doc')) sourceType = 'pdf'; // treated as document
    else if (lowerPath.endsWith('.pptx') || lowerPath.endsWith('.ppt')) sourceType = 'pdf';
    else if (lowerPath.endsWith('.tex') || lowerPath.endsWith('.ltx')) sourceType = 'markdown';
    else if (lowerPath.endsWith('.bib') || lowerPath.endsWith('.bibtex') || lowerPath.endsWith('.ris')) sourceType = 'markdown';
    else if (lowerPath.endsWith('.csv') || lowerPath.endsWith('.xlsx') || lowerPath.endsWith('.xls')) sourceType = 'markdown';
    else if (lowerPath.endsWith('.png') || lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg') || lowerPath.endsWith('.gif') || lowerPath.endsWith('.svg')) sourceType = 'pdf';

    return [{
      relativePath: entry.relativePath,
      displayName: entry.name,
      sourceType,
      fileSize: entry.size ?? 0,
    }];
  });
}

function estimateTokens(sources: readonly ContextSourceRef[]): number {
  return sources.reduce((sum, source) => sum + Math.max(120, Math.round(source.fileSize / 4)), 0);
}

export function AIResearchSidebarSummary({
  fileTree,
  selectedFile,
  onOpenWorkbench,
}: AIResearchSidebarSummaryProps): ReactElement {
  const [providers, setProviders] = useState<readonly ProviderReadiness[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getProviderReadiness().then((readiness) => {
      if (cancelled) return;
      setProviders(readiness);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const readyProvider = useMemo(() => providers.find((provider) => provider.ready) ?? providers[0] ?? null, [providers]);
  const ready = readyProvider?.ready ?? false;
  const summarySources = useMemo(() => {
    const sources = collectSources(fileTree);
    const selected = selectedFile ? sources.find((source) => source.relativePath === selectedFile) : undefined;
    const rest = sources.filter((source) => source.relativePath !== selectedFile).slice(0, selected ? 2 : 3);
    return selected ? [selected, ...rest] : rest;
  }, [fileTree, selectedFile]);
  const tokenEstimate = estimateTokens(summarySources);

  return (
    <section className="workspace-ai-research-sidebar-summary" data-testid="ai-research-sidebar-summary">
      <header className="workspace-sidebar-header">
        <p className="workspace-sidebar-kicker">AI 研究</p>
        <h2 className="workspace-sidebar-title">研究工作台</h2>
        <p className="workspace-sidebar-copy">轻量摘要。完整三栏工作台在编辑区打开。</p>
      </header>

      <div className="workspace-ai-research-summary-card">
        <span className={`workspace-ai-research-status ${ready ? 'workspace-ai-research-status-ready' : 'workspace-ai-research-status-blocked'}`}>
          {ready ? '✓ 提供者就绪' : '✗ 提供者未就绪'}
        </span>
        <p className="workspace-ai-research-summary-title">{readyProvider?.preset.displayName ?? (loading ? '正在读取提供者' : '未发现提供者')}</p>
        <p className="workspace-ai-research-summary-copy">模型：{readyProvider?.models[0]?.displayName ?? '未选择'}</p>
      </div>

      <div className="workspace-ai-research-summary-card">
        <p className="workspace-ai-research-kicker">上下文摘要</p>
        <p className="workspace-ai-research-summary-metric">
          {summarySources.length} 个文件，约 {tokenEstimate.toLocaleString('zh-CN')} Token
        </p>
        <p className="workspace-ai-research-summary-copy">主工作区可选择 Vault 文件并构建上下文包草稿。</p>
      </div>

      <div className="workspace-ai-research-summary-card">
        <p className="workspace-ai-research-kicker">任务状态</p>
        <p className="workspace-ai-research-summary-metric">空闲</p>
        <p className="workspace-ai-research-summary-copy">草稿产物需要人工审查，不会自动保存或导出。</p>
      </div>

      <div className="workspace-ai-research-summary-card">
        <p className="workspace-ai-research-kicker">最近草稿</p>
        <ul className="workspace-ai-research-draft-list" aria-label="最近草稿列表">
          <li>暂无草稿</li>
        </ul>
      </div>

      <button type="button" className="workspace-ai-research-open-button" onClick={onOpenWorkbench}>
        打开 AI Research Workbench
      </button>
    </section>
  );
}
