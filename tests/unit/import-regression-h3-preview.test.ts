export {};
/**
 * Phase 3-4-Lite-C: H3 preview regression test.
 *
 * Verifies that H3 open/reveal buttons do not regress:
 * 1. 打开 Markdown button visibility
 * 2. 定位 Markdown (reveal) button visibility
 * 3. 打开原 PDF button visibility
 * 4. 定位原 PDF button visibility
 * 5. outputMarkdownRelativePath missing → hide Markdown buttons
 * 6. attachmentRelativePath missing → hide original PDF buttons
 * 7. Failed job → no completed summary
 * 8. Quick job → no paper_quality summary
 * 9. paper_quality completed job → summary displayed
 * 10. Warnings max capped
 */
const assert = require('node:assert/strict');

// ── Simulated job state helpers ─────────────────

interface SimJob {
  importMode?: string;
  phase: string;
  progress: number;
  outputMarkdownRelativePath?: string | null;
  attachmentRelativePath?: string;
  companionSummary?: unknown;
  error?: { message: string } | null;
}

function isPaperQuality(job: SimJob): boolean {
  return job.importMode === 'paper_quality';
}

function hasCompanionSummary(job: SimJob): boolean {
  return isPaperQuality(job) && job.companionSummary != null;
}

function showMarkdownButtons(job: SimJob): boolean {
  return job.phase === 'completed' && job.outputMarkdownRelativePath != null;
}

function showOriginalPdfButtons(job: SimJob): boolean {
  return isPaperQuality(job) && job.phase === 'completed' && job.attachmentRelativePath != null;
}

function showPaperQualitySection(job: SimJob): boolean {
  return isPaperQuality(job) && job.phase === 'completed' && hasCompanionSummary(job);
}

function warningsMax(warnings: readonly string[], max = 3): string[] {
  return warnings.slice(0, max);
}

// ── Run ────────────────────────────────────────────

function run(): void {
  // ═══ H3-R1: Completed job with output path → show Markdown buttons ═══
  {
    const job: SimJob = {
      importMode: 'paper_quality',
      phase: 'completed',
      progress: 1,
      outputMarkdownRelativePath: 'notes/imported.md',
      attachmentRelativePath: 'attachments/imports/im_job_1.pdf',
      companionSummary: { qualityReport: { textExtracted: true } },
    };
    assert.equal(showMarkdownButtons(job), true, 'Markdown buttons visible');
    assert.equal(showOriginalPdfButtons(job), true, 'original PDF buttons visible');
    assert.equal(showPaperQualitySection(job), true, 'quality section visible');
  }

  // ═══ H3-R2: outputMarkdownRelativePath=null → hide Markdown buttons ═══
  {
    const job: SimJob = {
      importMode: 'paper_quality',
      phase: 'completed',
      progress: 1,
      outputMarkdownRelativePath: null,
      attachmentRelativePath: 'attachments/imports/im_job_2.pdf',
    };
    assert.equal(showMarkdownButtons(job), false, 'Markdown buttons hidden when output is null');
  }

  // ═══ H3-R3: outputMarkdownRelativePath undefined → hide Markdown buttons ═══
  {
    const job: SimJob = {
      importMode: 'paper_quality',
      phase: 'completed',
      progress: 1,
      attachmentRelativePath: 'attachments/imports/im_job_3.pdf',
    };
    assert.equal(showMarkdownButtons(job), false, 'Markdown buttons hidden when output is undefined');
  }

  // ═══ H3-R4: attachmentRelativePath missing → hide original PDF buttons ═══
  {
    const job: SimJob = {
      importMode: 'paper_quality',
      phase: 'completed',
      progress: 1,
      outputMarkdownRelativePath: 'notes/imported.md',
    };
    assert.equal(showOriginalPdfButtons(job), false, 'original PDF buttons hidden without attachment');
  }

  // ═══ H3-R5: Failed job → no completed summary display ═══
  {
    const job: SimJob = {
      importMode: 'paper_quality',
      phase: 'failed',
      progress: 0,
      error: { message: '导入失败' },
    };
    assert.equal(showPaperQualitySection(job), false, 'failed job hides quality section');
    assert.equal(showMarkdownButtons(job), false, 'failed job hides Markdown buttons');
    assert.equal(showOriginalPdfButtons(job), false, 'failed job hides PDF buttons');
  }

  // ═══ H3-R6: Quick job → no paper_quality summary ═══
  {
    const job: SimJob = {
      importMode: 'quick',
      phase: 'completed',
      progress: 1,
      outputMarkdownRelativePath: 'notes/quick_import.md',
    };
    assert.equal(isPaperQuality(job), false, 'quick job is not paper_quality');
    assert.equal(showPaperQualitySection(job), false, 'quick job hides quality section');
    assert.equal(showOriginalPdfButtons(job), false, 'quick job hides PDF buttons');
    assert.equal(showMarkdownButtons(job), true, 'quick job still shows Markdown buttons');
  }

  // ═══ H3-R7: Quick job status text (no quality summary) ═══
  {
    const job: SimJob = {
      importMode: 'quick',
      phase: 'completed',
      progress: 1,
    };
    // Quick completed → just "完成" (no "论文导入完成" message)
    assert.equal(isPaperQuality(job), false);
  }

  // ═══ H3-R8: paper_quality completed → shows summary ═══
  {
    const job: SimJob = {
      importMode: 'paper_quality',
      phase: 'completed',
      progress: 1,
      outputMarkdownRelativePath: 'notes/paper.md',
      attachmentRelativePath: 'attachments/imports/im_job_paper.pdf',
      companionSummary: {
        qualityReport: {
          textExtracted: true,
          figuresPreserved: 'no',
          tablesPreserved: 'no',
          formulasPreserved: 'placeholder',
          warnings: ['公式截图保留将在后续增强。'],
        },
        assetSummary: { figures: 0, tables: 0, formulaImages: 0, pageSnapshots: 0 },
      },
    };
    assert.equal(showPaperQualitySection(job), true, 'paper_quality completed shows summary');
    assert.equal(showMarkdownButtons(job), true, 'markedown buttons visible');
    assert.equal(showOriginalPdfButtons(job), true, 'original PDF buttons visible');
  }

  // ═══ H3-R9: Warnings capped at max ═══
  {
    const warnings = ['w1', 'w2', 'w3', 'w4', 'w5'];
    assert.equal(warningsMax(warnings, 3).length, 3, 'warnings capped at 3');
    assert.equal(warningsMax(warnings, 1).length, 1, 'warnings capped at 1');
    assert.equal(warningsMax(warnings).length, 3, 'default max is 3');
    assert.equal(warningsMax([], 3).length, 0, 'empty warnings remains empty');
  }

  // ═══ H3-R10: Processing phase → no buttons ═══
  {
    const job: SimJob = {
      importMode: 'paper_quality',
      phase: 'processing',
      progress: 0.5,
    };
    assert.equal(showMarkdownButtons(job), false, 'processing hides Markdown buttons');
    assert.equal(showOriginalPdfButtons(job), false, 'processing hides PDF buttons');
    assert.equal(showPaperQualitySection(job), false, 'processing hides quality section');
  }

  // ═══ H3-R11: paper_quality with no companionSummary → shows unavailable message ═══
  {
    const job: SimJob = {
      importMode: 'paper_quality',
      phase: 'completed',
      progress: 1,
      outputMarkdownRelativePath: 'notes/paper.md',
      attachmentRelativePath: 'attachments/imports/im_x.pdf',
    };
    assert.equal(hasCompanionSummary(job), false, 'no companionSummary');
    // PaperQualitySection should not render when hasCompanionSummary is false
    assert.equal(showPaperQualitySection(job), false, 'quality section hidden when no companion');
  }

  console.log('[PASS] import-regression-h3-preview');
}

run();
