import { useMemo, type ReactElement } from 'react';
import DOMPurify from 'dompurify';
import { renderMarkdown } from '../../preview/markdownRenderer';
import './AIResearchMarkdownView.css';

export interface AIResearchMarkdownViewProps {
  readonly content: string;
  readonly className?: string;
}

/**
 * Phase 5-5-C-POST-SYNC-AI-RESEARCH-UX-FIX:
 * Safe Markdown renderer for AI Research response and artifact content.
 * Uses the project's existing renderMarkdown() + DOMPurify for XSS protection.
 * No new dependencies. No dangerouslySetInnerHTML on unsanitized content.
 */
export function AIResearchMarkdownView({
  content,
  className,
}: AIResearchMarkdownViewProps): ReactElement {
  const html = useMemo(() => {
    if (!content || content.trim().length === 0) return '';
    const rawHtml = renderMarkdown(content);
    return DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'strong', 'b', 'em', 'i', 'u', 's', 'del',
        'a', 'img',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'span', 'div',
        'details', 'summary',
        'sub', 'sup',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'lang', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
    });
  }, [content]);

  if (!html) {
    return <span className="workspace-ai-research-empty">暂无内容。</span>;
  }

  return (
    <div
      className={`ai-research-markdown-view ${className ?? ''}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
