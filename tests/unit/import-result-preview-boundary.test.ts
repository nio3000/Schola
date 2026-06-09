/**
 * Phase 3-4-H3-UI: Import result preview boundary test.
 *
 * Verifies UI safety boundaries for paper_quality result preview.
 */
import assert from 'node:assert/strict';

// ── Simulated companionSummary render helpers ─────

function modeLabel(mode?: string): string | null {
  if (mode === 'paper_quality') return '论文导入';
  if (mode === 'precision') return '论文导入（高精度）';
  if (mode === 'quick') return '快速导入';
  return null;
}

function preserveLabel(status: string): string {
  const map: Record<string, string> = {
    yes: '已保留', partial: '部分保留', no: '暂未提取', unknown: '未知',
    image: '以图片保留', text: '以文本保留', placeholder: '占位待增强',
  };
  return map[status] ?? status;
}

interface ImportCompanionSummary {
  sourceType: 'paper_pdf';
  assetSummary: { figures: number; tables: number; formulaImages: number; pageSnapshots: number };
  qualityReport: { textExtracted: boolean; figuresPreserved: string; tablesPreserved: string; formulasPreserved: string; warnings: readonly string[] };
  preview: { available: boolean };
}

function buildSummaryJson(summary: ImportCompanionSummary): string {
  return JSON.stringify(summary);
}

// ── Run ────────────────────────────────────────────

function run(): void {
  // MODE LABELS
  assert.equal(modeLabel('paper_quality'), '论文导入');
  assert.equal(modeLabel('precision'), '论文导入（高精度）');
  assert.equal(modeLabel('quick'), '快速导入');
  assert.equal(modeLabel(undefined), null);

  // PRESERVE LABELS
  assert.equal(preserveLabel('placeholder'), '占位待增强');
  assert.equal(preserveLabel('no'), '暂未提取');
  assert.equal(preserveLabel('image'), '以图片保留');
  assert.equal(preserveLabel('yes'), '已保留');

  // COMPANION SUMMARY SHAPE
  const summary: ImportCompanionSummary = {
    sourceType: 'paper_pdf',
    assetSummary: { figures: 0, tables: 0, formulaImages: 0, pageSnapshots: 0 },
    qualityReport: {
      textExtracted: true,
      figuresPreserved: 'no',
      tablesPreserved: 'no',
      formulasPreserved: 'placeholder',
      warnings: ['公式截图保留将在后续增强。', '图片暂未提取，请对照原 PDF 核对。'],
    },
    preview: { available: false },
  };
  assert.equal(summary.qualityReport.formulasPreserved, 'placeholder');
  assert.equal(summary.assetSummary.formulaImages, 0);

  // NO ABSOLUTE PATHS IN SUMMARY
  const json = buildSummaryJson(summary);
  assert.ok(!json.includes('C:\\'));
  assert.ok(!json.includes('/home/'));
  assert.ok(!json.includes('/Users/'));
  assert.ok(!json.includes('sourcePath'));

  // NO ENGINE NAMES IN SUMMARY
  assert.ok(!json.includes('markitdown'));
  assert.ok(!json.includes('Docling'));
  assert.ok(!json.includes('Marker'));
  assert.ok(!json.includes('MinerU'));
  assert.ok(!json.includes('PyMuPDF'));
  assert.ok(!json.includes('Python'));

  // NO TRACEBACK IN SUMMARY
  assert.ok(!json.includes('traceback'));
  assert.ok(!json.includes('at '));

  // WARNINGS ARE SAFE
  for (const w of summary.qualityReport.warnings) {
    assert.ok(!w.includes('C:\\'), 'warning must not contain path');
    assert.ok(!w.includes('sourcePath'), 'warning must not contain sourcePath');
  }

  // FORMULA PLACEHOLDER IS HONEST
  assert.notEqual(preserveLabel('placeholder'), '已保留');
  assert.notEqual(preserveLabel('placeholder'), '识别成功');
  assert.notEqual(preserveLabel('placeholder'), '已完成');

  console.log('[PASS] import-result-preview-boundary');
}

run();
