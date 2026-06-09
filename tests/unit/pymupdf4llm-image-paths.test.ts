/**
 * @legacy CODE-QUALITY-IMP-4: PyMuPDF4LLM deprecated.
 *
 * Phase 3-4-I-ENG-2: PyMuPDF4LLM image paths test.
 *
 * Tests image naming, path rewrite, and forbidden pattern rejection.
 */
import assert from 'node:assert/strict';
import path from 'node:path';

// ── Simulated image path logic ────────────────────

function renameImage(seq: number, ext: string): string {
  return `img_${String(seq).padStart(3, '0')}${ext.toLowerCase()}`;
}

function rewriteImageLink(markdown: string, oldName: string, newName: string, jobId: string): string {
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const replacement = `./assets/${jobId}/${newName}`;
  return markdown.replace(new RegExp(escaped, 'g'), replacement);
}

function isSafeImageRef(ref: string, jobId: string): boolean {
  // Must be ./assets/{jobId}/img_NNN.png
  return new RegExp(`^\\.\\/assets\\/${jobId}\\/img_\\d{3}\\.png$`).test(ref);
}

function hasForbiddenRefs(markdown: string): boolean {
  const forbidden = [
    /\.\.\/assets\//,
    /https?:\/\//,
    /C:\\/,
    /\/home\//,
    /\/Users\//,
    /attachments\//,
    /_exports\//,
    /\.schola\//,
  ];
  return forbidden.some(re => re.test(markdown));
}

// ── Run ────────────────────────────────────────────

function run(): void {
  // Image naming
  assert.equal(renameImage(1, '.png'), 'img_001.png');
  assert.equal(renameImage(5, '.PNG'), 'img_005.png');
  assert.equal(renameImage(10, '.jpg'), 'img_010.jpg');
  assert.equal(renameImage(100, '.png'), 'img_100.png');

  // Image link rewrite
  const jobId = 'import_test123';
  let md = '![Figure 1](old_image_1.png)\n![Figure 2](old_image_2.png)';
  md = rewriteImageLink(md, 'old_image_1.png', 'img_001.png', jobId);
  md = rewriteImageLink(md, 'old_image_2.png', 'img_002.png', jobId);

  assert.ok(md.includes(`./assets/${jobId}/img_001.png`));
  assert.ok(md.includes(`./assets/${jobId}/img_002.png`));
  assert.ok(!md.includes('old_image_1.png'));
  assert.ok(!md.includes('old_image_2.png'));

  // Safe ref check
  assert.equal(isSafeImageRef(`./assets/${jobId}/img_001.png`, jobId), true);
  assert.equal(isSafeImageRef(`./assets/${jobId}/img_099.png`, jobId), true);
  assert.equal(isSafeImageRef(`../assets/${jobId}/img_001.png`, jobId), false);
  assert.equal(isSafeImageRef(`./assets/other_job/img_001.png`, jobId), false);
  assert.equal(isSafeImageRef(`C:\\Users\\img_001.png`, jobId), false);

  // Forbidden refs
  const cleanMd = `![Fig](./assets/${jobId}/img_001.png)`;
  assert.equal(hasForbiddenRefs(cleanMd), false);

  const badMd1 = `![Fig](../assets/${jobId}/img_001.png)`;
  assert.equal(hasForbiddenRefs(badMd1), true);

  const badMd2 = `![Fig](https://oss.example.com/img.png)`;
  assert.equal(hasForbiddenRefs(badMd2), true);

  const badMd3 = `![Fig](C:\\Users\\test\\img.png)`;
  assert.equal(hasForbiddenRefs(badMd3), true);

  const badMd4 = `![Fig](attachments/imports/test.pdf)`;
  assert.equal(hasForbiddenRefs(badMd4), true);

  console.log('[PASS] pymupdf4llm-image-paths');
}

// LEGACY: CODE-QUALITY-IMP-4 — PyMuPDF4LLM deactivated. Test skipped.
console.log('[SKIP] pymupdf4llm-image-paths — PyMuPDF4LLM deactivated (Phase 4-0-CODE-QUALITY-IMP-4)');
