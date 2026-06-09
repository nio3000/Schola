/**
 * Paper quality post-processing service — Phase 3-4-H2.
 *
 * Provides PlaceholderStrategy and companion/metadata builders for
 * the paper_quality import mode.  All functions are pure and
 * synchronous — no external runtimes, no pip, no venv, no model download.
 *
 * ⚠️  Does NOT generate real formula screenshots, figures, or tables.
 *     All formula/table/figure claims are explicit placeholders.
 *     User is warned that manual verification is needed.
 */

import type {
  AssetSummary,
  QualityReport,
  PreviewMeta,
} from '../../../../src/lib/contracts/import-companion.types';

// ── Placeholder Strategy ─────────────────────────

export interface PlaceholderFormulaResult {
  readonly formulaImages: readonly never[]; // empty — no real images generated
  readonly warnings: readonly string[];
  readonly formulasPreserved: 'placeholder';
}

/**
 * Placeholder formula strategy.
 *
 * Returns safe placeholder data without generating real formula screenshots.
 * No external runtime, no Python, no model download.
 */
export class PlaceholderFormulaStrategy {
  extract(): PlaceholderFormulaResult {
    return {
      formulaImages: [],
      warnings: [
        '公式截图保留将在后续增强，当前导入结果需手动核对公式。',
      ],
      formulasPreserved: 'placeholder',
    };
  }
}

// ── Quality Assessment ───────────────────────────

/**
 * Assess import quality for paper_quality mode.
 *
 * Reports honest placeholder status for figures, tables, and formulas.
 * textExtracted is true because MarkItDown baseline handles text.
 */
export function assessPaperQuality(): QualityReport {
  const formula = new PlaceholderFormulaStrategy().extract();

  return {
    textExtracted: true,
    figuresPreserved: 'no',
    tablesPreserved: 'no',
    formulasPreserved: formula.formulasPreserved,
    warnings: [
      ...formula.warnings,
      '图片暂未提取，请对照原 PDF 核对。',
      '表格暂未结构化，请对照原 PDF 核对。',
    ],
  };
}

// ── Asset Summary ────────────────────────────────

/**
 * Build asset summary for paper_quality mode.
 *
 * All counts are zero — no real assets are extracted at this stage.
 */
export function buildAssetSummary(): AssetSummary {
  return {
    figures: 0,
    tables: 0,
    formulaImages: 0,
    pageSnapshots: 0,
  };
}

// ── Preview Meta ─────────────────────────────────

/**
 * Build preview availability metadata for paper_quality mode.
 *
 * H3 frontend preview is not yet available in H2.
 */
export function buildPreviewMeta(
  markdownPath?: string,
): PreviewMeta {
  return {
    available: typeof markdownPath === 'string',
    ...(typeof markdownPath === 'string' ? { markdownPreviewPath: markdownPath } : {}),
  };
}

// ── Markdown Frontmatter ─────────────────────────

/**
 * Build the paper_quality Markdown frontmatter.
 *
 * All paths are vault-relative.  No system absolute paths exposed.
 * Includes user-facing disclaimer about placeholder quality.
 */
export function buildPaperQualityFrontmatter(params: {
  readonly jobId: string;
  readonly originalFileRef: string;
  readonly createdAt: string;
  readonly title?: string;
  readonly sourceFileName: string;
}): string {
  const { jobId, originalFileRef, createdAt, title, sourceFileName } = params;
  const displayTitle = title ?? sourceFileName;

  return [
    '---',
    `source_type: paper_pdf`,
    `import_mode: paper_quality`,
    `import_job_id: ${jobId}`,
    `original_file: ${originalFileRef}`,
    `created_at: ${createdAt}`,
    '---',
    '',
    `# ${displayTitle}`,
    '',
    '> 导入说明：',
    '> 本文由 Schola 基础论文导入生成。部分公式、图片或表格可能以截图或占位说明形式保留。',
    '',
    '## 原文文件',
    '',
    `原始 PDF 已保留，可在导入记录中打开或定位。`,
    '',
    '## 正文',
    '',
    '## 图表与公式保留',
    '',
    '当前版本采用基础论文导入质量模式。部分公式、图片或表格可能需要手动核对。',
    '',
    '## 导入质量报告',
    '',
    '- 文本：已提取',
    '- 图片：暂未提取',
    '- 表格：暂未结构化',
    '- 公式：占位待增强',
    '',
  ].join('\n');
}

// ── Diagnostics ──────────────────────────────────

/**
 * User-facing error messages for paper_quality diagnostics.
 *
 * Rules:
 *  - No system paths
 *  - No sourcePath
 *  - No traceback
 *  - No engine technical names
 *  - No Python / pip / venv references
 *  - No exaggerated quality claims
 */
export const PAPER_QUALITY_DIAGNOSTICS = {
  PDF_UNREADABLE: '无法读取 PDF 文件，原始文件已保留。',
  CONVERSION_FAILED: '论文导入未能完成，原始文件已保留，可尝试快速导入。',
  ASSETS_WRITE_FAILED: '导入资源写入失败，部分功能可能不可用。',
  METADATA_WRITE_FAILED: '导入元数据保存失败。',
  PREVIEW_UNAVAILABLE: '预览功能暂未开放。',
  FORMULAS_UNAVAILABLE: '公式识别将在后续版本中提供。',
  TABLES_UNAVAILABLE: '表格结构化将在后续版本中提供。',
  IMAGES_UNAVAILABLE: '图片提取将在后续版本中提供。',
} as const;
