/**
 * ImportExportPanel — Phase 3-3 + Phase 3-4-D + Phase 3-4-H3 + Phase 4-0-B.
 *
 * Renders import/export job status cards with open/reveal buttons.
 * Phase 4-0-B-IMP-1: import mode selector converged to two options:
 *   - 快速导入 (quick)
 *   - 增强导入 (enhanced, currently disabled)
 */
import { useState, useCallback, type ReactElement } from 'react';
import type { ExportFormat } from '../../lib/contracts/export.types';
import type { ImportMode, ProductImportMode } from '../../lib/contracts/import.types';
import type {
  AvailableImportModes,
  ImportCompanionSummary,
  ImportAssetSummary,
  ImportQualityReportSummary,
} from '../../lib/contracts/import-job.types';
import {
  openGeneratedMarkdown,
  revealGeneratedMarkdown,
  openExportArtifact,
  revealExportArtifact,
  getAvailableImportModes,
  openOriginalImportFile,
  revealOriginalImportFile,
} from '../../lib/platform/schola-api';
import { importResource } from '../../lib/platform/schola-api';
import { useImportJob, type ImportUIState } from './useImportJob';
import { useExportJob, type ExportUIState } from './useExportJob';

export interface ImportExportPanelProps {
  readonly vaultId: string | null;
  readonly selectedFile: string | null;
  readonly importState?: { state: ImportUIState; startImport: (vaultId: string, productMode?: ProductImportMode) => Promise<void>; dismiss: () => void };
  readonly exportState?: { state: ExportUIState; startExport: (vaultId: string, sourceMarkdownRelativePath: string, targetFormat: ExportFormat) => Promise<void>; dismiss: () => void };
  readonly onImport?: (vaultId: string, mode: ImportMode) => void;
  readonly onExportFormat?: (format: ExportFormat) => void;
}

const EXPORT_FORMATS: { format: ExportFormat; label: string }[] = [
  { format: 'docx', label: 'DOCX' },
  { format: 'html', label: 'HTML' },
  { format: 'latex', label: 'LaTeX' },
  { format: 'pdf', label: 'PDF' },
];

export function ImportExportPanel({ vaultId, selectedFile, importState: extImport, exportState: extExport, onImport, onExportFormat }: ImportExportPanelProps): ReactElement {
  const internalImport = useImportJob();
  const internalExport = useExportJob();
  const [showExportPicker, setShowExportPicker] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [availableModes, setAvailableModes] = useState<AvailableImportModes | null>(null);

  const imp = extImport ?? internalImport;
  const exp = extExport ?? internalExport;

  const canImport = vaultId !== null;
  const canExport = vaultId !== null && selectedFile !== null && selectedFile.endsWith('.md');

  const handleImportClick = useCallback(async () => {
    if (!canImport) return;
    if (!showModeMenu) {
      // Fetch available modes on menu open
      try {
        const result = await getAvailableImportModes();
        setAvailableModes(result.ok ? result.modes : null);
      } catch {
        setAvailableModes(null);
      }
    }
    setShowModeMenu(prev => !prev);
  }, [canImport, showModeMenu]);

  const handleModeSelect = useCallback((productMode: ProductImportMode) => {
    setShowModeMenu(false);
    if (!canImport) return;
    if (onImport) { onImport(vaultId!, productMode as ImportMode); return; }
    void imp.startImport(vaultId!, productMode);
  }, [canImport, vaultId, onImport, imp]);

  const handleExportFormat = (format: ExportFormat) => {
    setShowExportPicker(false);
    if (!canExport) return;
    if (onExportFormat) { onExportFormat(format); return; }
    void exp.startExport(vaultId!, selectedFile!, format);
  };

  const handleOpenGenerated = (relativePath: string) => {
    if (!vaultId) return;
    void openGeneratedMarkdown(vaultId, relativePath);
  };

  const handleRevealGenerated = (relativePath: string) => {
    if (!vaultId) return;
    void revealGeneratedMarkdown(vaultId, relativePath);
  };

  const handleOpenExport = (relativePath: string) => {
    if (!vaultId) return;
    void openExportArtifact(vaultId, relativePath);
  };

  const handleRevealExport = (relativePath: string) => {
    if (!vaultId) return;
    void revealExportArtifact(vaultId, relativePath);
  };

  const handleImportResource = useCallback(async () => {
    if (!vaultId) return;
    try {
      const result = await importResource({ vaultId });
      if (result.ok) {
        window.alert(`资源已导入：${result.resourceRelativePath}`);
      } else {
        window.alert(`导入失败：${result.error}`);
      }
    } catch {
      window.alert('导入资源失败，请重试。');
    }
  }, [vaultId]);

  const handleOpenOriginalPdf = (originalFileRef: string) => {
    if (!vaultId) return;
    void openOriginalImportFile(vaultId, originalFileRef);
  };

  const handleRevealOriginalPdf = (originalFileRef: string) => {
    if (!vaultId) return;
    void revealOriginalImportFile(vaultId, originalFileRef);
  };

  return (
    <div className="import-export-panel" data-testid="import-export-panel">
      {/* Import button + mode menu */}
      <div className="ie-actions">
        <div className="ie-import-wrapper">
          <button
            type="button"
            className="ie-btn ie-btn-import"
            disabled={!canImport}
            onClick={handleImportClick}
            data-testid="btn-import"
            title="导入文件"
          >
            📥 导入 ▾
          </button>
          {showModeMenu && (
            <div className="ie-mode-menu" data-testid="import-mode-menu">
              <button
                type="button"
                className="ie-mode-item"
                onClick={() => handleModeSelect('quick')}
                data-testid="import-mode-quick"
              >
                <span className="ie-mode-label">快速导入</span>
                <span className="ie-mode-desc">适合一般 PDF、DOCX、PPTX、网页等</span>
              </button>
              <button
                type="button"
                className="ie-mode-item ie-mode-item--disabled"
                disabled={true}
                onClick={() => handleModeSelect('enhanced')}
                data-testid="import-mode-enhanced"
                title="增强导入尚未就绪，后续版本开放"
              >
                <span className="ie-mode-label">增强导入（暂不可用）</span>
                <span className="ie-mode-desc">面向高质量论文 PDF，后续开放</span>
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="ie-btn ie-btn-export"
          disabled={!canExport}
          onClick={() => setShowExportPicker(true)}
          data-testid="btn-export"
          title="导出当前 Markdown"
        >
          📤 导出
        </button>
        <button
          type="button"
          className="ie-btn ie-btn-import-resource"
          disabled={!canImport}
          onClick={() => handleImportResource()}
          data-testid="btn-import-resource"
          title="导入资源文件（PDF/HTML/DOCX/图片等）"
        >
          📁 导入资源
        </button>
      </div>

      {/* Export format picker */}
      {showExportPicker && (
        <div className="ie-format-picker" data-testid="export-format-picker">
          {EXPORT_FORMATS.map(({ format, label }) => (
            <button
              key={format}
              type="button"
              className="ie-format-btn"
              onClick={() => handleExportFormat(format)}
              data-testid={'export-fmt-' + format}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Import job card */}
      {imp.state.phase !== 'idle' && imp.state.phase !== 'selecting' && (
        <JobCard
          kind="import"
          state={imp.state}
          onOpenGenerated={handleOpenGenerated}
          onRevealGenerated={handleRevealGenerated}
          onOpenOriginalPdf={handleOpenOriginalPdf}
          onRevealOriginalPdf={handleRevealOriginalPdf}
          onDismiss={imp.dismiss}
        />
      )}

      {/* Export job card */}
      {exp.state.phase !== 'idle' && (
        <JobCard
          kind="export"
          state={exp.state}
          onOpenGenerated={handleOpenGenerated}
          onRevealGenerated={handleRevealGenerated}
          onOpenExport={handleOpenExport}
          onRevealExport={handleRevealExport}
          onDismiss={exp.dismiss}
        />
      )}
    </div>
  );
}

// ── JobCard (internal) ──────────────────────────

interface JobCardProps {
  readonly kind: 'import' | 'export';
  readonly state: ImportUIState | ExportUIState;
  readonly onOpenGenerated: (relativePath: string) => void;
  readonly onRevealGenerated: (relativePath: string) => void;
  readonly onOpenExport?: (relativePath: string) => void;
  readonly onRevealExport?: (relativePath: string) => void;
  readonly onOpenOriginalPdf?: (originalFileRef: string) => void;
  readonly onRevealOriginalPdf?: (originalFileRef: string) => void;
  readonly onDismiss: () => void;
}

function modeLabel(mode?: string): string | null {
  if (mode === 'quick') return '快速导入';
  if (mode === 'paper_enhanced' || mode === 'enhanced') return '增强导入';
  if (mode === 'paper_quality') return '快速导入（论文PDF）';  // Phase 4-0-B: legacy display
  // precision and ocr — no longer displayed
  return null;
}

// ── Helpers for companionSummary rendering ─────

function preserveLabel(status: string): string {
  const map: Record<string, string> = {
    yes: '已保留', partial: '部分保留', no: '暂未提取', unknown: '未知',
    image: '以图片保留', text: '以文本保留', placeholder: '占位待增强',
  };
  return map[status] ?? status;
}

function qualityIcon(status: string): string {
  if (status === 'yes' || status === 'image' || status === 'text') return '✅';
  if (status === 'partial') return '⚠️';
  if (status === 'placeholder') return '⏳';
  if (status === 'no') return '⚠️';
  return '❓';
}

function QualitySummary({ summary }: { summary: ImportQualityReportSummary }): ReactElement {
  return (
    <div className="ie-quality-summary" data-testid="quality-summary">
      <div className="ie-quality-title">导入质量摘要</div>
      <div className="ie-quality-grid">
        <span>{qualityIcon(summary.textExtracted ? 'yes' : 'no')} 文本：{summary.textExtracted ? '已提取' : '未提取'}</span>
        <span>{qualityIcon(summary.figuresPreserved)} 图片：{preserveLabel(summary.figuresPreserved)}</span>
        <span>{qualityIcon(summary.tablesPreserved)} 表格：{preserveLabel(summary.tablesPreserved)}</span>
        <span>{qualityIcon(summary.formulasPreserved)} 公式：{preserveLabel(summary.formulasPreserved)}</span>
      </div>
    </div>
  );
}

function AssetSummary({ summary }: { summary: ImportAssetSummary }): ReactElement {
  if (summary.figures === 0 && summary.tables === 0 && summary.formulaImages === 0 && summary.pageSnapshots === 0) {
    return (
      <div className="ie-asset-summary" data-testid="asset-summary">
        <span className="ie-asset-placeholder">当前版本暂未生成公式截图和图片提取。原 PDF 已保留，可对照核对。</span>
      </div>
    );
  }
  return (
    <div className="ie-asset-summary" data-testid="asset-summary">
      <span>图片：{summary.figures}</span>
      <span>表格：{summary.tables}</span>
      <span>公式截图：{summary.formulaImages}</span>
      <span>页面快照：{summary.pageSnapshots}</span>
    </div>
  );
}

function WarningsList({ warnings, max = 3 }: { warnings: readonly string[]; max?: number }): ReactElement | null {
  if (!warnings || warnings.length === 0) return null;
  const visible = warnings.slice(0, max);
  const extra = warnings.length - max;
  return (
    <div className="ie-warnings" data-testid="warnings-list">
      <ul>
        {visible.map((w, i) => <li key={i}>{w}</li>)}
        {extra > 0 && <li className="ie-warnings-more">另有 {extra} 条提示</li>}
      </ul>
    </div>
  );
}

function PaperQualitySection({ summary }: { summary: ImportCompanionSummary }): ReactElement {
  return (
    <div className="ie-paper-quality" data-testid="paper-quality-section">
      <QualitySummary summary={summary.qualityReport} />
      <AssetSummary summary={summary.assetSummary} />
      <WarningsList warnings={summary.qualityReport.warnings} />
    </div>
  );
}

function JobCard({ kind, state, onOpenGenerated, onRevealGenerated, onOpenExport, onRevealExport, onOpenOriginalPdf, onRevealOriginalPdf, onDismiss }: JobCardProps): ReactElement {
  const isImport = kind === 'import';
  const stateAny = state as { job?: { importMode?: string; sourceFileName?: string; outputMarkdownRelativePath?: string | null; attachmentRelativePath?: string; phase: string; progress: number; error?: { message: string } | null; companionSummary?: ImportCompanionSummary } };
  const job = state.phase !== 'idle' && state.phase !== 'selecting' ? stateAny.job : null;

  if (!job) return <></>;

  const mode = isImport ? modeLabel((state as { job?: { importMode?: string } }).job?.importMode) : null;
  const isPaperQuality = isImport && (state as { job?: { importMode?: string } }).job?.importMode === 'paper_quality';
  const hasCompanionSummary = isPaperQuality && job.companionSummary != null;

  return (
    <div className="ie-job-card" data-testid={'job-card-' + kind}>
      <div className="ie-job-header">
        {mode && <span className="ie-job-mode" data-testid="job-card-mode">{mode}</span>}
        <span className="ie-job-name">{job.sourceFileName ?? ''}</span>
      </div>
      <div className="ie-job-progress">
        <div className="ie-job-bar" style={{ width: `${(job.progress ?? 0) * 100}%` }} />
      </div>
      <div className="ie-job-status">
        {job.phase === 'completed' && !isPaperQuality && '完成'}
        {job.phase === 'completed' && isPaperQuality && '论文导入完成。已生成可编辑 Markdown，原始 PDF 已保留。'}
        {job.phase === 'failed' && (job.error?.message ?? '导入失败')}
        {job.phase !== 'completed' && job.phase !== 'failed' && '处理中...'}
      </div>
      {/* Paper quality: companion summary */}
      {isPaperQuality && job.phase === 'completed' && hasCompanionSummary && (
        <PaperQualitySection summary={job.companionSummary!} />
      )}
      {isPaperQuality && job.phase === 'completed' && !hasCompanionSummary && (
        <div className="ie-quality-unavailable" data-testid="quality-unavailable">导入质量摘要暂不可用。</div>
      )}
      {/* Open/reveal generated Markdown */}
      {job.phase === 'completed' && job.outputMarkdownRelativePath && (
        <div className="ie-job-actions">
          <button type="button" onClick={() => onOpenGenerated(job.outputMarkdownRelativePath!)} data-testid={'btn-open-' + kind}>
            打开 Markdown
          </button>
          <button type="button" onClick={() => onRevealGenerated(job.outputMarkdownRelativePath!)} data-testid={'btn-reveal-' + kind}>
            定位文件
          </button>
        </div>
      )}
      {/* Paper quality: open/reveal original PDF */}
      {isPaperQuality && job.phase === 'completed' && job.attachmentRelativePath && onOpenOriginalPdf && onRevealOriginalPdf && (
        <div className="ie-job-actions">
          <button type="button" onClick={() => onOpenOriginalPdf(job.attachmentRelativePath!)} data-testid="btn-open-original-pdf">
            打开原 PDF
          </button>
          <button type="button" onClick={() => onRevealOriginalPdf(job.attachmentRelativePath!)} data-testid="btn-reveal-original-pdf">
            定位原 PDF
          </button>
        </div>
      )}
      {/* Export artifact section unchanged */}
      {isImport && onOpenExport && job.phase === 'completed' && (state as { job?: { outputMarkdownRelativePath?: string | null } }).job?.outputMarkdownRelativePath && (
        <div className="ie-job-actions">
          <button type="button" onClick={() => onOpenExport!((state as { job: { outputMarkdownRelativePath: string } }).job.outputMarkdownRelativePath)} data-testid="btn-open-export-artifact">
            打开导出文件
          </button>
          <button type="button" onClick={() => onRevealExport!((state as { job: { outputMarkdownRelativePath: string } }).job.outputMarkdownRelativePath)} data-testid="btn-reveal-export-artifact">
            在文件夹中显示
          </button>
        </div>
      )}
      <button type="button" onClick={onDismiss} className="ie-job-dismiss" data-testid="btn-dismiss">关闭</button>
    </div>
  );
}
