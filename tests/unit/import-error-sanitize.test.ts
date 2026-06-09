/**
 * Phase 3-4-D-R5-P1: Import error sanitization test.
 *
 * Validates that error output NEVER contains forbidden terms:
 *   MarkItDown, Docling, Python, traceback, site-packages, stderr,
 *   C:\, /Users/, /home/, /usr/, pdfminer, pdfplumber, pypdfium.
 */
import assert from 'node:assert/strict';
import { sanitizeErrorMessage, FORBIDDEN_UI_TERMS } from '../../electron/services/engines/import/bridge-validation.ts';

function run(): void {
  // ═══ 1: sanitizeErrorMessage removes forbidden terms ═══
  const testCases: [string, string][] = [
    ['MarkItDown conversion failed: FileConversionException', 'quick error with engine name'],
    ['Docling traceback: error at site-packages/docling/...', 'precision error with traceback'],
    ['Python stderr: pip install markitdown[pdf]', 'install suggestion in stderr'],
    ['C:\\Users\\test\\file.pdf not found', 'Windows absolute path'],
    ['/Users/test/file.pdf not found', 'macOS absolute path'],
    ['/home/user/file.pdf not found', 'Linux absolute path'],
    ['/usr/local/bin/python error', 'system binary path'],
    ['pdfminer.six not found in site-packages', 'pdfminer dependency'],
    ['pdfplumber extraction failed', 'pdfplumber dependency'],
    ['pypdfium2 rendering error', 'pypdfium dependency'],
  ];

  for (const [input] of testCases) {
    const output = sanitizeErrorMessage(input);
    for (const term of FORBIDDEN_UI_TERMS) {
      assert.ok(
        !output.includes(term),
        `sanitizeErrorMessage must not contain "${term}". Input: "${input.slice(0, 80)}". Output: "${output.slice(0, 100)}"`,
      );
    }
  }

  // ═══ 2: sanitizeErrorMessage handles empty input ═══
  {
    const output = sanitizeErrorMessage('');
    assert.equal(typeof output, 'string');
    assert.equal(output.length, 0);
  }

  // ═══ 3: Truncation at 500 chars ═══
  {
    const longInput = 'x'.repeat(1000);
    const output = sanitizeErrorMessage(longInput);
    assert.ok(output.length <= 500, 'sanitizeErrorMessage must truncate at 500 chars');
  }

  // ═══ 4: FORBIDDEN_UI_TERMS covers all required terms ═══
  const requiredTerms = [
    'MarkItDown', 'markitdown', 'Docling', 'docling', 'Python',
    'traceback', 'Traceback', 'site-packages', 'stderr',
    'C:\\', '/Users/', '/home/', '/usr/',
    'pdfplumber', 'pdfminer', 'pypdfium',
  ];
  for (const term of requiredTerms) {
    assert.ok(
      FORBIDDEN_UI_TERMS.includes(term),
      `FORBIDDEN_UI_TERMS must include "${term}"`,
    );
  }

  // ═══ 5: Engine error codes are diagnostic-safe ═══
  const safeMessages = [
    '快速导入失败。请尝试论文导入，或检查文件格式后重试。',
    '论文导入失败。可稍后重试，或改用快速导入。',
    '论文导入所需模型尚未准备好，请联网后重试。',
    '导入失败。',
  ];
  for (const msg of safeMessages) {
    const output = sanitizeErrorMessage(msg);
    // Safe messages pass through unchanged
    for (const term of FORBIDDEN_UI_TERMS) {
      assert.ok(!output.includes(term), `Safe message must not contain "${term}"`);
    }
  }

  // ═══ 6: stderr diagnostics are sanitized ═══
  {
    const stderrInput = [
      'Traceback (most recent call last):',
      '  File "site-packages/markitdown/convert.py", line 42',
      'FileConversionException: PdfConverter failed',
    ].join('\n');
    const output = sanitizeErrorMessage(stderrInput);
    for (const term of FORBIDDEN_UI_TERMS) {
      assert.ok(
        !output.includes(term),
        `stderr sanitization must not contain "${term}". Output: "${output.slice(0, 100)}"`,
      );
    }
  }
}

run();
console.log('PASS: import-error-sanitize.test.ts');
