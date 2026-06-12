/**
 * HTML sanitizer unit tests — Phase 5-4A-TD.
 *
 * Tests sanitizeHtml() strips scripts, event handlers, iframes,
 * remote assets, javascript: URLs, meta refresh, etc.
 * Also verifies benign content is preserved.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../src/features/resources/htmlSanitizer';

// ── Script removal ────────────────────────────────

describe('sanitizeHtml — script removal', () => {
  it('removes <script>...</script>', () => {
    const r = sanitizeHtml('<p>hello</p><script>alert("xss")</script>');
    expect(r).not.toContain('<script');
    expect(r).not.toContain('alert');
    expect(r).toContain('<p>hello</p>');
  });

  it('removes <script> with attributes', () => {
    const r = sanitizeHtml('<script type="text/javascript">evil</script>');
    expect(r).not.toContain('<script');
    expect(r).not.toContain('evil');
  });

  it('removes self-closing <script />', () => {
    const r = sanitizeHtml('<script src="evil.js"/><p>ok</p>');
    expect(r).not.toContain('<script');
    expect(r).toContain('<p>ok</p>');
  });
});

// ── iframe / object / embed removal ───────────────

describe('sanitizeHtml — embedded content removal', () => {
  it('removes <iframe>...</iframe>', () => {
    const r = sanitizeHtml('<iframe src="http://evil.com"></iframe>');
    expect(r).not.toContain('<iframe');
    expect(r).not.toContain('evil.com');
  });

  it('removes <object>...</object>', () => {
    const r = sanitizeHtml('<object data="evil.swf"></object>');
    expect(r).not.toContain('<object');
  });

  it('removes <embed>', () => {
    const r = sanitizeHtml('<embed src="evil.swf">');
    expect(r).not.toContain('<embed');
  });
});

// ── Event handler removal ─────────────────────────

describe('sanitizeHtml — event handler removal', () => {
  it('removes onerror', () => {
    const r = sanitizeHtml('<img src=x onerror="alert(1)">');
    expect(r).not.toContain('onerror');
    expect(r).not.toContain('alert(1)');
    expect(r).toContain('<img');
  });

  it('removes onload', () => {
    const r = sanitizeHtml('<body onload="doEvil()">');
    expect(r).not.toContain('onload');
  });

  it('removes onclick', () => {
    const r = sanitizeHtml('<div onclick="xss()">click</div>');
    expect(r).not.toContain('onclick');
    expect(r).toContain('click');
  });

  it('removes onmouseover', () => {
    const r = sanitizeHtml('<span onmouseover="bad()">text</span>');
    expect(r).not.toContain('onmouseover');
    expect(r).toContain('text');
  });
});

// ── javascript: URL blocking ──────────────────────

describe('sanitizeHtml — javascript: URL blocking', () => {
  it('blocks href="javascript:..."', () => {
    const r = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(r).not.toContain('javascript:');
    expect(r).toContain('href="#"');
  });

  it('blocks src="javascript:..."', () => {
    const r = sanitizeHtml('<img src="javascript:alert(1)">');
    expect(r).not.toContain('javascript:');
  });
});

// ── meta refresh removal ─────────────────────────

describe('sanitizeHtml — meta refresh removal', () => {
  it('removes <meta http-equiv="refresh">', () => {
    const r = sanitizeHtml('<meta http-equiv="refresh" content="0;url=http://evil.com">');
    expect(r).not.toContain('refresh');
    expect(r).not.toContain('evil.com');
  });
});

// ── Remote asset blocking ─────────────────────────

describe('sanitizeHtml — remote asset blocking', () => {
  it('removes remote CSS <link>', () => {
    const r = sanitizeHtml('<link rel="stylesheet" href="http://evil.com/style.css">');
    expect(r).not.toContain('http://evil.com');
  });

  it('removes remote CSS <link> (https)', () => {
    const r = sanitizeHtml('<link href="https://cdn.example/theme.css">');
    expect(r).not.toContain('cdn.example');
  });

  it('replaces remote <img> src', () => {
    const r = sanitizeHtml('<img src="http://evil.com/pic.jpg">');
    expect(r).not.toContain('http://evil.com');
    expect(r).toContain('data:image/svg+xml');
  });

  it('replaces remote <img> src (https)', () => {
    const r = sanitizeHtml('<img src="https://cdn.example/pic.png">');
    expect(r).toContain('data:image/svg+xml');
    expect(r).not.toContain('cdn.example');
  });

  it('blocks @import url(http...) in style', () => {
    const r = sanitizeHtml('<style>@import url("http://evil.com/theme.css");</style>');
    expect(r).not.toContain('http://evil.com');
  });

  it('blocks @import url(https...) in style', () => {
    const r = sanitizeHtml('<style>@import url(https://cdn.example/theme.css);</style>');
    expect(r).not.toContain('cdn.example');
  });
});

// ── Benign content preservation ───────────────────

describe('sanitizeHtml — benign content preserved', () => {
  it('preserves plain text', () => {
    const r = sanitizeHtml('<p>Hello World</p>');
    expect(r).toContain('<p>Hello World</p>');
  });

  it('preserves headings', () => {
    const r = sanitizeHtml('<h1>Title</h1><h2>Subtitle</h2>');
    expect(r).toContain('<h1>Title</h1>');
    expect(r).toContain('<h2>Subtitle</h2>');
  });

  it('preserves lists', () => {
    const r = sanitizeHtml('<ul><li>A</li><li>B</li></ul>');
    expect(r).toContain('<li>A</li>');
    expect(r).toContain('<li>B</li>');
  });

  it('preserves tables', () => {
    const r = sanitizeHtml('<table><tr><td>cell</td></tr></table>');
    expect(r).toContain('<td>cell</td>');
  });

  it('preserves local img with relative src', () => {
    const r = sanitizeHtml('<img src="./images/logo.png" alt="logo">');
    expect(r).toContain('logo.png');
    expect(r).toContain('alt="logo"');
  });

  it('preserves strong/em/b tags', () => {
    const r = sanitizeHtml('<p><strong>bold</strong> <em>italic</em></p>');
    expect(r).toContain('<strong>bold</strong>');
    expect(r).toContain('<em>italic</em>');
  });

  it('preserves local <link> with relative href', () => {
    const r = sanitizeHtml('<link rel="stylesheet" href="./local.css">');
    expect(r).toContain('local.css');
  });

  it('handles empty input', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('handles complex safe HTML', () => {
    const input = '<div class="content"><h1>Title</h1><p>Paragraph with <a href="#section">link</a>.</p><ul><li>Item 1</li><li>Item 2</li></ul></div>';
    const r = sanitizeHtml(input);
    expect(r).toContain('Title');
    expect(r).toContain('Paragraph');
    expect(r).toContain('Item 1');
    expect(r).toContain('Item 2');
    expect(r).not.toContain('script');
  });
});

// ── base tag removal ──────────────────────────────

describe('sanitizeHtml — base tag removal', () => {
  it('removes <base> tag', () => {
    const r = sanitizeHtml('<base href="http://evil.com/">');
    expect(r).not.toContain('<base');
    expect(r).not.toContain('evil.com');
  });
});

// ── data:text/html removal ────────────────────────

describe('sanitizeHtml — data URL blocking', () => {
  it('removes src="data:text/html..."', () => {
    const r = sanitizeHtml('<iframe src="data:text/html,<script>alert(1)</script>"></iframe>');
    expect(r).not.toContain('data:text/html');
  });
});
