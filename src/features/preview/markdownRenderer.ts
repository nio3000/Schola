import { marked } from 'marked';
import katex from 'katex';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import htmlXml from 'highlight.js/lib/languages/xml';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import latex from 'highlight.js/lib/languages/latex';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import powershell from 'highlight.js/lib/languages/powershell';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import yaml from 'highlight.js/lib/languages/yaml';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('css', css);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('go', go);
hljs.registerLanguage('html', htmlXml);
hljs.registerLanguage('xml', htmlXml);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('toml', ini);
hljs.registerLanguage('java', java);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('latex', latex);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('php', php);
hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('python', python);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('yaml', yaml);

const LANGUAGE_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
  tex: 'latex',
  'c++': 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  ps1: 'powershell',
  docker: 'dockerfile',
};

function resolveLanguage(lang: string): string {
  const normalized = lang.toLowerCase().trim();

  if (LANGUAGE_ALIASES[normalized]) {
    return LANGUAGE_ALIASES[normalized];
  }

  return normalized;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightCode(code: string, lang: string): string {
  if (!lang) {
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }

  const resolved = resolveLanguage(lang);

  if (hljs.getLanguage(resolved)) {
    try {
      const result = hljs.highlight(code, { language: resolved });
      return `<pre><code class="hljs language-${resolved}">${result.value}</code></pre>`;
    } catch {
      // Fall through to plain text
    }
  }

  return `<pre><code>${escapeHtml(code)}</code></pre>`;
}

function createMathInlineExtension() {
  return {
    name: 'mathInline',
    level: 'inline' as const,
    start(src: string): number {
      const idx = src.indexOf('$');
      if (src[idx + 1] === '$') {
        return -1;
      }
      return idx;
    },
    tokenizer(src: string): { type: string; raw: string; text: string } | undefined {
      const match = /^\$([^$\n]+?)\$/.exec(src);
      if (!match) {
        return undefined;
      }
      return {
        type: 'mathInline',
        raw: match[0],
        text: match[1],
      };
    },
    renderer(token: { text: string; raw: string }): string {
      try {
        return katex.renderToString(token.text, { throwOnError: false, output: 'html' });
      } catch {
        return token.raw;
      }
    },
  };
}

function createMathBlockExtension() {
  return {
    name: 'mathBlock',
    level: 'block' as const,
    start(src: string): number {
      return src.indexOf('$$');
    },
    tokenizer(src: string): { type: string; raw: string; text: string; tokens: never[] } | undefined {
      const match = /^\$\$\n?([\s\S]*?)\n?\$\$/.exec(src);
      if (!match) {
        return undefined;
      }
      return {
        type: 'mathBlock',
        raw: match[0],
        text: match[1].trim(),
        tokens: [],
      };
    },
    renderer(token: { text: string; raw: string }): string {
      try {
        return `<div class="math-block">${katex.renderToString(token.text, { throwOnError: false, displayMode: true, output: 'html' })}</div>`;
      } catch {
        return `<pre><code>${token.raw}</code></pre>`;
      }
    },
  };
}

let extensionsRegistered = false;

if (!extensionsRegistered) {
  extensionsRegistered = true;
  marked.use({
    extensions: [createMathInlineExtension(), createMathBlockExtension()],
    renderer: {
      code(token: { text: string; lang?: string }): string {
        return highlightCode(token.text, token.lang ?? '');
      },
    },
  });
}

export function renderMarkdown(content: string): string {
  try {
    const html = marked.parse(content, { async: false });

    if (typeof html !== 'string') {
      return '<p>Preview unavailable.</p>';
    }

    return html;
  } catch {
    return '<p>Preview unavailable.</p>';
  }
}
