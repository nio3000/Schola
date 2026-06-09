/**
 * Phase 3-4-I: PyMuPDF4LLM companion summary test.
 * @legacy CODE-QUALITY-IMP-4: PyMuPDF4LLM deprecated.
 */
import assert from 'node:assert/strict';

// ── Types ─────────────────────────────────────────

interface ImportCompanionSummary {
  readonly sourceType: 'paper_pdf';
  readonly assetSummary: { readonly figures: number; readonly tables: number; readonly formulaImages: number; readonly pageSnapshots: number };
  readonly qualityReport: { readonly textExtracted: boolean; readonly figuresPreserved: string; readonly tablesPreserved: string; readonly formulasPreserved: string; readonly warnings: readonly string[] };
  readonly preview: { readonly available: boolean };
}

function buildPaperQualitySummary(ok: boolean): ImportCompanionSummary {
  if (!ok) {
    return {
      sourceType: 'paper_pdf',
      assetSummary: { figures: 0, tables: 0, formulaImages: 0, pageSnapshots: 0 },
      qualityReport: { textExtracted: false, figuresPreserved: 'unknown', tablesPreserved: 'unknown', formulasPreserved: 'unknown', warnings: ['导入失败。'] },
      preview: { available: false },
    };
  }
  return {
    sourceType: 'paper_pdf',
    assetSummary: { figures: 0, tables: 0, formulaImages: 0, pageSnapshots: 0 },
    qualityReport: {
      textExtracted: true,
      figuresPreserved: 'partial',
      tablesPreserved: 'partial',
      formulasPreserved: 'partial',
      warnings: ['公式内容以图片或文本保留，未做 LaTeX 识别。请结合原 PDF 核对。', '复杂表格可能需要手动核对格式。'],
    },
    preview: { available: false },
  };
}

// ── Run ────────────────────────────────────────────

function run(): void {
  // COMPANION SUMMARY SHAPE
  const s = buildPaperQualitySummary(true);
  assert.equal(s.sourceType, 'paper_pdf');
  assert.equal(s.qualityReport.textExtracted, true);
  assert.equal(s.qualityReport.figuresPreserved, 'partial');
  assert.equal(s.qualityReport.tablesPreserved, 'partial');
  assert.equal(s.qualityReport.formulasPreserved, 'partial');
  assert.equal(s.assetSummary.figures, 0);
  assert.equal(s.assetSummary.formulaImages, 0);

  // PYMUPDF4LLM ENGINE SUMMARY IS HONEST
  // formulasPreserved must NOT be 'yes'
  assert.notEqual(s.qualityReport.formulasPreserved, 'yes');
  // Must contain honest warning about LaTeX
  const allWarnings = s.qualityReport.warnings.join(' ');
  assert.ok(allWarnings.includes('LaTeX'), 'must mention LaTeX limitation');

  // NO PATH / ENGINE / RAw COMPANION IN SUMMARY
  const json = JSON.stringify(s);
  assert.ok(!json.includes('C:\\'));
  assert.ok(!json.includes('/home/'));
  assert.ok(!json.includes('sourcePath'));
  assert.ok(!json.includes('engine'));
  assert.ok(!json.includes('pymupdf4llm'));
  assert.ok(!json.includes('markitdown'));
  assert.ok(!json.includes('traceback'));
  assert.ok(!json.includes('Python'));
  assert.ok(!json.includes('site-packages'));

  // FAILED SUMMARY
  const f = buildPaperQualitySummary(false);
  assert.equal(f.qualityReport.textExtracted, false);
  assert.ok(f.qualityReport.warnings.length > 0);

  console.log('[PASS] pymupdf4llm-companion-summary');
}

// LEGACY: CODE-QUALITY-IMP-4 — PyMuPDF4LLM deactivated. Test skipped.
console.log('[SKIP] pymupdf4llm-companion-summary — PyMuPDF4LLM deactivated (Phase 4-0-CODE-QUALITY-IMP-4)');
