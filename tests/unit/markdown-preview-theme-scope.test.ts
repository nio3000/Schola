export {};
/**
 * Phase 4-0-P0-UI-EXPORT: Markdown preview theme scope test.
 * Uses simple string grep instead of CSS parser for reliability.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function run(): void {
  const cssPath = path.resolve(__dirname, '..', '..', 'src', 'styles.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  // TC-01: Newsprint theme exists with table vars
  assert.ok(css.includes('data-preview-theme="newsprint"'), 'Newsprint theme block');
  assert.ok(css.includes('--preview-th-bg'), 'th-bg var');
  assert.ok(css.includes('--preview-th-text'), 'th-text var');
  assert.ok(css.includes('--preview-td-border'), 'td-border var');

  // TC-02: Base table styles
  assert.ok(css.includes('overflow-x'), 'overflow-x');
  assert.ok(css.includes('.schola-markdown-preview table'), 'table selector');
  assert.ok(css.includes('.schola-markdown-preview th'), 'th selector');
  assert.ok(css.includes('border-collapse'), 'border-collapse');

  // TC-03: Zebra striping
  assert.ok(css.includes('nth-child(even)'), 'zebra striping');

  // TC-04: Newsprint has th-text for contrast
  const nsIdx = css.indexOf('data-preview-theme="newsprint"');
  const nsSection = css.slice(nsIdx, nsIdx + 800);
  assert.ok(nsSection.includes('--preview-th-text'), 'Newsprint th-text');

  // TC-05: Context menu CSS
  assert.ok(css.includes('preview-context-menu'), 'context menu CSS');
  assert.ok(css.includes('preview-context-item'), 'context menu item CSS');

  console.log('[PASS] markdown-preview-theme-scope');
}

run();
