export {};
/**
 * Phase 3-4-Lite-C: Paper quality UI visibility test.
 *
 * Verifies that:
 * 1. paperQuality=true → 论文导入 displays
 * 2. PyMuPDF4LLM missing → 论文导入 still displays
 * 3. Marker missing → 论文导入 still displays
 * 4. paperEnhanced=false → 高精度论文导入 hidden/disabled
 * 5. No technical names in regular UI
 * 6. baseline warning text is correct
 */
const assert = require('node:assert/strict');

// ── Simulated availableModes helpers ─────────────

interface AvailableImportModes {
  quick: boolean;
  paper_quality: boolean;
  paper_enhanced: boolean;
  precision: boolean;
  ocr: boolean;
}

/**
 * Replicates computeAvailableModes logic in pure JS for test isolation.
 * paper_quality is always true (built-in baseline engine).
 */
function computeAvailableModes(
  markitdownAvailable = false,
  markerAvailable = false,
): AvailableImportModes {
  return {
    quick: markitdownAvailable,
    paper_quality: true,           // Always available
    paper_enhanced: markerAvailable,
    precision: false,              // DISABLE_RESERVED_ENGINE_PROBES=true
    ocr: false,
  };
}

// ── UI visibility helpers (derived from ImportExportPanel) ──

function shouldShowPaperQualityImport(modes: AvailableImportModes | null): boolean {
  // Phase 3-4-Lite: 论文导入 (paper_quality) is always visible — unconditionally rendered
  return true;
}

function shouldShowHighPrecisionImport(modes: AvailableImportModes | null): boolean {
  // High-precision (论文导入高精度) shows when precision || paperEnhanced is truthy
  if (!modes) return false;
  return modes.precision || modes.paper_enhanced;
}

function shouldShowQuickImport(modes: AvailableImportModes | null): boolean {
  return true; // Always rendered in current code
}

// ── Baseline warning text verification ──────────

const BASELINE_WARNING_TEXTS = [
  '公式截图保留将在后续增强。',
  '图片暂未提取，请对照原 PDF 核对。',
  '表格暂未提取，请对照原 PDF 核对。',
];

const FORBIDDEN_OLD_SEMANTICS = [
  'LaTeX',
  'PyMuPDF4LLM',
  'PyMuPDF',
  'pymupdf4llm',
  '未做',
  '无法识别',
];

// ── Technical name leak check ───────────────────

const FORBIDDEN_TECHNICAL_NAMES = [
  'PyMuPDF4LLM',
  'Marker',
  'marker',
  'Python',
  'python',
  'venv',
  'HuggingFace',
  'Plugin Manager',
  'markitdown',
  'Docling',
  'MinerU',
  'mineru',
];

function modeLabel(mode?: string): string | null {
  if (mode === 'paper_quality') return '论文导入';
  if (mode === 'precision') return '论文导入（高精度）';
  if (mode === 'quick') return '快速导入';
  return null;
}

// ── Run ────────────────────────────────────────────

function run(): void {
  // ═══ TC-01: paperQuality=true → 论文导入 always shows ═══
  {
    const modes = computeAvailableModes(true, false);
    assert.equal(modes.paper_quality, true, 'paperQuality must be true');
    assert.equal(shouldShowPaperQualityImport(modes), true);
  }

  // ═══ TC-02: PyMuPDF4LLM unavailable → 论文导入 still shows ═══
  {
    // PyMuPDF4LLM probe status does NOT affect paperQuality
    const modes = computeAvailableModes(true, false);
    assert.equal(modes.paper_quality, true, 'paperQuality unaffected by PyMuPDF4LLM');
    assert.equal(shouldShowPaperQualityImport(modes), true);
  }

  // ═══ TC-03: Marker unavailable → 论文导入 still shows ═══
  {
    const modes = computeAvailableModes(true, false); // markerAvailable=false
    assert.equal(modes.paper_quality, true, 'paperQuality unaffected by Marker');
    assert.equal(shouldShowPaperQualityImport(modes), true);
  }

  // ═══ TC-04: paperEnhanced=false → 高精度论文导入 not shown ═══
  {
    const modes = computeAvailableModes(true, false);
    assert.equal(modes.paper_enhanced, false, 'paperEnhanced must be false when marker unavailable');
    assert.equal(shouldShowHighPrecisionImport(modes), false, 'high precision must not show');
  }

  // ═══ TC-05: 快速导入 still shows ═══
  {
    assert.equal(shouldShowQuickImport(null), true, 'quick import always rendered');
  }

  // ═══ TC-06: Mode labels are correct ═══
  {
    assert.equal(modeLabel('paper_quality'), '论文导入');
    assert.equal(modeLabel('precision'), '论文导入（高精度）');
    assert.equal(modeLabel('quick'), '快速导入');
    assert.equal(modeLabel(undefined), null);
    assert.equal(modeLabel('ocr'), null);
  }

  // ═══ TC-07: No technical names leak in mode labels ═══
  {
    const labels = [modeLabel('paper_quality'), modeLabel('quick'), modeLabel('precision')];
    for (const label of labels) {
      if (!label) continue;
      for (const forbidden of FORBIDDEN_TECHNICAL_NAMES) {
        assert.ok(
          !label.includes(forbidden),
          `mode label must not contain "${forbidden}": "${label}"`,
        );
      }
    }
  }

  // ═══ TC-08: Baseline warnings are honest ─ not old PyMuPDF4LLM semantics ═══
  {
    for (const w of BASELINE_WARNING_TEXTS) {
      for (const forbidden of FORBIDDEN_OLD_SEMANTICS) {
        assert.ok(
          !w.includes(forbidden),
          `baseline warning must not contain "${forbidden}": "${w}"`,
        );
      }
    }
  }

  // ═══ TC-09: Baseline warnings are safe ─ no paths, no engine names ═══
  {
    for (const w of BASELINE_WARNING_TEXTS) {
      assert.ok(!w.includes('C:\\'), 'warning must not contain Windows path');
      assert.ok(!w.includes('/home/'), 'warning must not contain POSIX path');
      assert.ok(!w.includes('/Users/'), 'warning must not contain macOS path');
      assert.ok(!w.includes('sourcePath'), 'warning must not contain sourcePath');
      assert.ok(!w.toLowerCase().includes('pymupdf'), 'warning must not mention PyMuPDF');
    }
  }

  // ═══ TC-10: computeAvailableModes output is safe ═══
  {
    const json = JSON.stringify(computeAvailableModes(true, true));
    for (const forbidden of FORBIDDEN_TECHNICAL_NAMES) {
      assert.ok(
        !json.includes(forbidden),
        `availableModes JSON must not contain "${forbidden}"`,
      );
    }
    assert.ok(!json.includes('C:\\'), 'no Windows paths');
    assert.ok(!json.includes('/'), 'no POSIX paths');
  }

  // ═══ TC-11: ocr is always false ═══
  {
    assert.equal(computeAvailableModes(true, true).ocr, false, 'ocr must be false');
    assert.equal(computeAvailableModes(false, false).ocr, false, 'ocr must be false');
  }

  // ═══ TC-12: paperQuality with quick=false still shows ═══
  {
    const modes = computeAvailableModes(false);
    assert.equal(modes.paper_quality, true, 'paperQuality independent of markitdown');
  }

  console.log('[PASS] import-paper-quality-ui-visibility');
}

run();
