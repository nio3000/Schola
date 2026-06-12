/**
 * HTML sanitizer — Phase 5-4A-IMP-4.
 * Strips scripts, event handlers, iframes, remote assets, javascript: URLs.
 * No dependencies. Regex-based minimal sanitizer.
 */
export function sanitizeHtml(raw: string): string {
  let html = raw;

  // 1. Remove <script>...</script> (including attributes)
  html = html.replace(/<script[\s>][\s\S]*?<\/script\s*>/gi, '');
  html = html.replace(/<script\b[^>]*\/\s*>/gi, '');

  // 2. Remove <iframe>, <object>, <embed>
  html = html.replace(/<iframe[\s>][\s\S]*?<\/iframe\s*>/gi, '');
  html = html.replace(/<object[\s>][\s\S]*?<\/object\s*>/gi, '');
  html = html.replace(/<embed[\s>][\s\S]*?>/gi, '');

  // 3. Strip on* event handlers (onerror, onload, onclick, etc.)
  html = html.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');

  // 4. Remove remote <link> (CSS)
  html = html.replace(/<link\s[^>]*href\s*=\s*["']https?:\/\/[^"']*["'][^>]*>/gi, '');

  // 5. Remove remote <img> src
  html = html.replace(/(<img\s[^>]*src\s*=\s*["'])https?:\/\/[^"']+(["'][^>]*>)/gi, '$1data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>$2');

  // 6. Remove <base> tag
  html = html.replace(/<base\s[^>]*>/gi, '');

  // 7. Remove <meta refresh> redirect
  html = html.replace(/<meta\s[^>]*http-equiv\s*=\s*["']refresh["'][^>]*>/gi, '');

  // 8. Strip javascript: URLs
  html = html.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  html = html.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, '');

  // 9. Strip data:text/html in iframes/src (already removed, but catch any remaining)
  html = html.replace(/src\s*=\s*["']data:text\/html[^"']*["']/gi, '');

  // 10. Remove <style> with @import url(http...)
  html = html.replace(/@import\s+url\s*\(\s*["']?https?:\/\/[^)"']+["']?\s*\)/gi, '');

  return html;
}
