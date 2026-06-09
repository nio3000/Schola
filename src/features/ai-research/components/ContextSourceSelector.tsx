import type { ReactElement } from 'react';
import type { ContextSourceRef } from '../../../lib/contracts/ai-research.types';

export interface ContextSourceSelectorProps {
  readonly sources: readonly ContextSourceRef[];
  readonly selectedSources: readonly ContextSourceRef[];
  readonly vaultReady: boolean;
  readonly loading: boolean;
  readonly onToggleSource: (source: ContextSourceRef) => void;
  readonly onBuildPack: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '未知大小';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileTypeLabel(sourceType: string, name: string): string {
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
  const map: Record<string, string> = {
    '.md': 'MD', '.markdown': 'MD', '.mdx': 'MDX',
    '.pdf': 'PDF',
    '.docx': 'DOCX', '.doc': 'DOC',
    '.pptx': 'PPTX', '.ppt': 'PPT',
    '.tex': 'TeX', '.ltx': 'TeX',
    '.bib': 'BIB', '.bibtex': 'BIB', '.ris': 'RIS',
    '.csv': 'CSV', '.xlsx': 'XLSX', '.xls': 'XLS', '.tsv': 'TSV',
    '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML',
    '.txt': 'TXT', '.rtf': 'RTF',
    '.png': 'IMG', '.jpg': 'IMG', '.jpeg': 'IMG', '.gif': 'IMG', '.svg': 'IMG', '.webp': 'IMG',
  };
  return map[ext] ?? sourceType.toUpperCase();
}

export function ContextSourceSelector({
  sources,
  selectedSources,
  vaultReady,
  loading,
  onToggleSource,
  onBuildPack,
}: ContextSourceSelectorProps): ReactElement {
  const selectedPaths = new Set(selectedSources.map((source) => source.relativePath));
  const disabled = !vaultReady || selectedSources.length === 0 || loading;

  return (
    <section className="workspace-ai-research-card" data-testid="ai-research-context-source-selector">
      <div className="workspace-ai-research-card-header">
        <div>
          <p className="workspace-ai-research-kicker">知识库源文件</p>
          <h3 className="workspace-ai-research-card-title">Project Sources</h3>
        </div>
        <span className="workspace-ai-research-count-pill">{selectedSources.length} 个</span>
      </div>

      <div className="workspace-ai-research-source-list">
        {!vaultReady ? (
          <p className="workspace-ai-research-empty">请先打开 Vault。</p>
        ) : sources.length === 0 ? (
          <p className="workspace-ai-research-empty">当前 Vault 中暂无可选文件。支持 Markdown、PDF、DOCX、PPTX、TeX、BibTeX、CSV 及图片格式。</p>
        ) : (
          sources.slice(0, 24).map((source) => {
            const selected = selectedPaths.has(source.relativePath);
            return (
              <label key={source.relativePath} className="workspace-ai-research-source-row">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleSource(source)}
                />
                <span className="workspace-ai-research-source-main">
                  <span className="workspace-ai-research-source-name">{source.displayName}</span>
                  <span className="workspace-ai-research-source-path">{source.relativePath}</span>
                </span>
                <span className="workspace-ai-research-source-type">
                  {getFileTypeLabel(source.sourceType, source.displayName)}
                </span>
                <span className="workspace-ai-research-source-size">{formatFileSize(source.fileSize)}</span>
              </label>
            );
          })
        )}
      </div>

      <button type="button" className="workspace-ai-research-primary-button" onClick={onBuildPack} disabled={disabled}>
        构建上下文包草稿
      </button>
    </section>
  );
}
