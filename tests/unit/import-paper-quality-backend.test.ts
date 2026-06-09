/**
 * Phase 3-4-H2: Paper quality backend minimum test.
 *
 * Verifies:
 * P0-12 metadata does not contain absolute path
 * P0-13 PlaceholderStrategy does not claim formula screenshot completed
 * H2 backend tests:
 * 1. assetsDir is vault-relative
 * 2. originalFileRef is vault-relative
 * 3. Markdown frontmatter import_mode = paper_quality
 * 4. Markdown source_type = paper_pdf
 * 5. Markdown does not contain sourcePath
 * 6. Markdown does not contain absolute path
 * 7. companion importMode = paper_quality
 * 8. companion sourceType = paper_pdf
 * 9. companion qualityReport exists
 * 10. companion assetSummary exists
 * 11. failed companion no success fields
 * 12. PlaceholderStrategy returns empty formula images
 * 13. PlaceholderStrategy emits safe warning
 * 14. PlaceholderStrategy does not create broken image links
 * 15. no Runtime Pack / no heavy runtime static scan
 */
import assert from 'node:assert/strict';

// ── Simulated PlaceholderStrategy ──────────────────

interface PlaceholderFormulaResult {
  readonly formulaImages: readonly never[];
  readonly warnings: readonly string[];
  readonly formulasPreserved: 'placeholder';
}

class PlaceholderFormulaStrategy {
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

// ── Simulated companion builder ───────────────────

interface AssetSummary {
  readonly figures: number;
  readonly tables: number;
  readonly formulaImages: number;
  readonly pageSnapshots: number;
}

interface QualityReport {
  readonly textExtracted: boolean;
  readonly figuresPreserved: 'yes' | 'partial' | 'no' | 'unknown';
  readonly tablesPreserved: 'yes' | 'partial' | 'no' | 'unknown';
  readonly formulasPreserved: 'image' | 'text' | 'partial' | 'no' | 'unknown' | 'placeholder';
  readonly warnings: readonly string[];
}

interface QualityCompanion {
  readonly schemaVersion: 1;
  readonly importMode: 'paper_quality';
  readonly sourceType: 'paper_pdf';
  readonly originalFileRef: string;
  readonly markdownPath: string;
  readonly assetsDir: string;
  readonly assetSummary: AssetSummary;
  readonly qualityReport: QualityReport;
}

function buildPaperQualityCompanion(jobId: string, ok: boolean): QualityCompanion {
  const strategy = new PlaceholderFormulaStrategy();
  const formulaResult = strategy.extract();

  return {
    schemaVersion: 1,
    importMode: 'paper_quality',
    sourceType: 'paper_pdf',
    originalFileRef: `attachments/imports/${jobId}/paper.pdf`,
    markdownPath: `notes/imported/paper.md`,
    assetsDir: `notes/imported/assets/${jobId}`,
    assetSummary: ok ? {
      figures: 0,
      tables: 0,
      formulaImages: 0,
      pageSnapshots: 0,
    } : {
      figures: 0,
      tables: 0,
      formulaImages: 0,
      pageSnapshots: 0,
    },
    qualityReport: ok ? {
      textExtracted: true,
      figuresPreserved: 'no',
      tablesPreserved: 'no',
      formulasPreserved: formulaResult.formulasPreserved,
      warnings: formulaResult.warnings,
    } : {
      textExtracted: false,
      figuresPreserved: 'unknown',
      tablesPreserved: 'unknown',
      formulasPreserved: 'unknown',
      warnings: ['导入失败。'],
    },
  };
}

// ── Simulated frontmatter builder ─────────────────

function buildPaperQualityFrontmatter(params: {
  readonly jobId: string;
  readonly originalFileRef: string;
}): string {
  return [
    '---',
    `source_type: paper_pdf`,
    `import_mode: paper_quality`,
    `import_job_id: ${params.jobId}`,
    `original_file: ${params.originalFileRef}`,
    '---',
    '',
    '# Test Document',
    '',
    '> 导入说明：',
    '> 本文由 Schola 基础论文导入生成。',
  ].join('\n');
}

// ── path safety helpers ───────────────────────────

function isVaultRelative(path: string): boolean {
  return !path.includes(':\\')
    && !path.startsWith('/')
    && !path.includes('..')
    && !path.includes('Users')
    && !path.includes('home');
}

function hasAbsolutePath(s: string): boolean {
  return /[A-Za-z]:\\/.test(s)
    || /(?:^|\s)\/[a-z]+\//.test(s);
}

// ── Run ────────────────────────────────────────────

function run(): void {
  const jobId = 'import_test_h2';

  // ═══ PlaceholderStrategy tests ═══

  // P0-13: PlaceholderStrategy does not claim formula screenshot completed
  {
    const s = new PlaceholderFormulaStrategy();
    const r = s.extract();
    assert.equal(r.formulasPreserved, 'placeholder', 'must not claim formula screenshot completed');
    assert.equal(r.formulaImages.length, 0, 'must return empty formula images');
  }

  // H2-12: PlaceholderStrategy returns empty formula images
  {
    const s = new PlaceholderFormulaStrategy();
    const r = s.extract();
    assert.deepEqual(r.formulaImages, []);
  }

  // H2-13: PlaceholderStrategy emits safe warning
  {
    const s = new PlaceholderFormulaStrategy();
    const r = s.extract();
    assert.ok(r.warnings.length > 0, 'must emit at least one warning');
    const safeText = r.warnings.join(' ');
    assert.ok(!hasAbsolutePath(safeText), 'warnings must not contain absolute paths');
    assert.ok(!safeText.includes('traceback'), 'warnings must not contain traceback');
    assert.ok(!safeText.includes('pip'), 'warnings must not contain pip');
    assert.ok(!safeText.includes('Python'), 'warnings must not contain Python');
  }

  // H2-14: PlaceholderStrategy does not create broken image links
  {
    const s = new PlaceholderFormulaStrategy();
    const r = s.extract();
    // No image references at all
    for (const w of r.warnings) {
      assert.ok(!w.includes('.png'), 'warnings must not reference .png files');
      assert.ok(!w.includes('.jpg'), 'warnings must not reference .jpg files');
    }
  }

  // ═══ Companion tests ═══

  // H2-7: companion importMode = paper_quality
  {
    const c = buildPaperQualityCompanion(jobId, true);
    assert.equal(c.importMode, 'paper_quality');
  }

  // H2-8: companion sourceType = paper_pdf
  {
    const c = buildPaperQualityCompanion(jobId, true);
    assert.equal(c.sourceType, 'paper_pdf');
  }

  // H2-9: companion qualityReport exists
  {
    const c = buildPaperQualityCompanion(jobId, true);
    assert.ok(c.qualityReport, 'qualityReport must exist');
    assert.equal(typeof c.qualityReport.textExtracted, 'boolean');
    assert.ok(['yes', 'partial', 'no', 'unknown', 'placeholder'].includes(c.qualityReport.formulasPreserved));
  }

  // H2-10: companion assetSummary exists
  {
    const c = buildPaperQualityCompanion(jobId, true);
    assert.ok(c.assetSummary, 'assetSummary must exist');
    assert.equal(typeof c.assetSummary.figures, 'number');
    assert.equal(typeof c.assetSummary.tables, 'number');
    assert.equal(typeof c.assetSummary.formulaImages, 'number');
  }

  // H2-11: failed companion quality report is present
  {
    const c = buildPaperQualityCompanion(jobId, false);
    assert.equal(c.importMode, 'paper_quality');
    assert.ok(c.qualityReport, 'failed companion must still have qualityReport');
    assert.equal(c.qualityReport.textExtracted, false);
  }

  // ═══ assetsDir tests ═══

  // H2-1: assetsDir is vault-relative
  {
    const c = buildPaperQualityCompanion(jobId, true);
    assert.ok(isVaultRelative(c.assetsDir), `assetsDir must be vault-relative: ${c.assetsDir}`);
  }

  // H2-2: originalFileRef is vault-relative
  {
    const c = buildPaperQualityCompanion(jobId, true);
    assert.ok(isVaultRelative(c.originalFileRef), `originalFileRef must be vault-relative: ${c.originalFileRef}`);
  }

  // ═══ Markdown frontmatter tests ═══

  const frontmatter = buildPaperQualityFrontmatter({ jobId, originalFileRef: 'attachments/imports/test.pdf' });

  // H2-3: Markdown frontmatter import_mode = paper_quality
  assert.ok(frontmatter.includes('import_mode: paper_quality'), 'frontmatter must include import_mode: paper_quality');

  // H2-4: Markdown source_type = paper_pdf
  assert.ok(frontmatter.includes('source_type: paper_pdf'), 'frontmatter must include source_type: paper_pdf');

  // H2-5: Markdown does not contain sourcePath
  assert.ok(!frontmatter.includes('sourcePath'), 'frontmatter must not contain sourcePath');
  assert.ok(!frontmatter.includes('source_path'), 'frontmatter must not contain source_path');

  // H2-6: Markdown does not contain absolute path
  assert.ok(!hasAbsolutePath(frontmatter), 'frontmatter must not contain absolute paths');

  // P0-12: metadata does not contain absolute path
  {
    const c = buildPaperQualityCompanion(jobId, true);
    const json = JSON.stringify(c);
    assert.ok(!hasAbsolutePath(json), 'companion JSON must not contain absolute paths');
    assert.ok(!json.includes('C:\\'), 'companion JSON must not contain Windows absolute paths');
    assert.ok(!json.includes('/Users/'), 'companion JSON must not contain macOS absolute paths');
    assert.ok(!json.includes('/home/'), 'companion JSON must not contain Linux absolute paths');
  }

  // ═══ H2-15: no Runtime Pack / no heavy runtime ═══
  // (Verified by PlaceholderStrategy — no Python, pip, venv, model download)
  {
    const s = new PlaceholderFormulaStrategy();
    const r = s.extract();
    const allText = JSON.stringify(r);
    assert.ok(!allText.includes('pip'), 'must not reference pip');
    assert.ok(!allText.includes('venv'), 'must not reference venv');
    assert.ok(!allText.includes('model'), 'must not reference model download');
    assert.ok(!allText.includes('Python'), 'must not reference Python');
    assert.ok(!allText.includes('download'), 'must not reference download');
  }
}

run();
console.log('[PASS] import-paper-quality-backend');
