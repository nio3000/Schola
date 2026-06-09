import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import type { MouseEvent, ReactElement } from 'react';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';
import type { FileEntry } from '../../lib/contracts/vault.types';
import { resolvePreviewAssetUrl, previewExportHtml, previewExportPdf } from '../../lib/platform/schola-api';
import { renderMarkdown } from './markdownRenderer';
import {
  replaceWikilinksForRendering,
  isWikilinkHref,
  parseWikilinkHref,
} from './wikilink';
import { resolveWikilinkPathEnhanced } from '../wiki/lib/resolveWikilink';
import { flattenFiles, stripExtension } from '../wiki/lib/fileTreeUtils';
import { type PreviewTheme, readStoredTheme, writeStoredTheme, PREVIEW_THEMES } from './previewThemes';
import { PreviewThemeSelector } from './PreviewThemeSelector';

export interface PreviewPanelProps {
  readonly content: string;
  readonly fileTree: readonly FileEntry[];
  readonly vaultId: string | null;
  readonly noteRelativePath: string | null;
  readonly onNavigateToFile: (relativePath: string) => void;
  readonly isVisible: boolean;
  readonly imageAssetVersion?: number;
  readonly onThemeChange?: (theme: string) => void;
}

function buildExistingNotes(fileTree: readonly FileEntry[]): Set<string> {
  const files = flattenFiles(fileTree);
  const notes = new Set<string>();

  for (const file of files) {
    notes.add(stripExtension(file.name));
  }

  return notes;
}

function isRelativeAssetSrc(src: string): boolean {
  // Reject known absolute / non-relative schemes
  if (/^(https?:|data:|mailto:|schola-wikilink:|file:)/i.test(src)) {
    return false;
  }
  // Reject absolute Windows paths (e.g. C:\ or L:\)
  if (/^[A-Za-z]:[/\\]/.test(src)) {
    return false;
  }
  // Reject Unix absolute paths
  if (src.startsWith('/')) {
    return false;
  }
  return true;
}

function sanitizeAndRender(content: string, fileTree: readonly FileEntry[]): string {
  const existingNotes = buildExistingNotes(fileTree);
  const withWikilinks = replaceWikilinksForRendering(content, existingNotes);
  const rawHtml = renderMarkdown(withWikilinks);

  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|schola-wikilink):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    ADD_ATTR: ['data-exists'],
  });
}

interface PreviewRenderResult {
  readonly html: string;
  readonly error: string | null;
}

export function PreviewPanel({
  content,
  fileTree,
  vaultId,
  noteRelativePath,
  onNavigateToFile,
  isVisible,
  imageAssetVersion,
  onThemeChange,
}: PreviewPanelProps): ReactElement {
  const containerRef = useRef<HTMLElement>(null);
  const resolvedRef = useRef<Set<string>>(new Set());

  const renderResult = useMemo<PreviewRenderResult>(() => {
    try {
      return { html: sanitizeAndRender(content ?? '', fileTree), error: null };
    } catch (err) {
      return {
        html: '',
        error: err instanceof Error ? err.message : 'Markdown Preview 渲染失败。',
      };
    }
  }, [content, fileTree]);
  const { html, error: renderError } = renderResult;

  // ── Preview theme ──
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>(() => readStoredTheme());

  // ── Context menu state ──
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // ── Theme CSS extraction ──
  const getThemeCss = useCallback((): string => {
    // Collect all CSS rules matching the current preview theme from stylesheets
    const themeCssParts: string[] = [];
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSStyleRule) {
              const selector = rule.selectorText;
              // Include base preview styles and theme-specific rules
              if (
                selector.includes('schola-markdown-preview') ||
                selector.includes('preview-theme')
              ) {
                themeCssParts.push(rule.cssText);
              }
            }
          }
        } catch {
          // Cross-origin stylesheet access denied — skip
        }
      }
    } catch {
      // Stylesheet access error — continue with base styles
    }
    return themeCssParts.join('\n');
  }, []);

  const handleThemeChange = useCallback((theme: PreviewTheme): void => {
    setPreviewTheme(theme);
    writeStoredTheme(theme);
    onThemeChange?.(theme);
  }, [setPreviewTheme, onThemeChange]);

  // ── Context menu handlers ──
  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>): void => {
      // Only show menu when there is content
      if (!content || !html) return;
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY });
    },
    [content, html],
  );

  const closeContextMenu = useCallback((): void => {
    setContextMenu(null);
  }, []);

  const handleExportHtml = useCallback(async (): Promise<void> => {
    closeContextMenu();
    const container = containerRef.current;
    if (!container) return;
    const sanitizedHtml = container.innerHTML;
    const themeCss = getThemeCss();
    const fileName = noteRelativePath
      ? noteRelativePath.replace(/\.md$/i, '').split(/[/\\]/).pop() || 'export'
      : 'export';
    try {
      const result = await previewExportHtml({
        fileName,
        themeName: previewTheme,
        sanitizedHtml,
        themeCss,
      });
      if (!result.ok) {
        window.alert(result.error);
      }
    } catch {
      window.alert('导出 HTML 失败，请重试。');
    }
  }, [closeContextMenu, noteRelativePath, previewTheme, getThemeCss]);

  const handleExportPdf = useCallback(async (): Promise<void> => {
    closeContextMenu();
    const container = containerRef.current;
    if (!container) return;
    const sanitizedHtml = container.innerHTML;
    const themeCss = getThemeCss();
    const fileName = noteRelativePath
      ? noteRelativePath.replace(/\.md$/i, '').split(/[/\\]/).pop() || 'export'
      : 'export';
    try {
      const result = await previewExportPdf({
        fileName,
        themeName: previewTheme,
        sanitizedHtml,
        themeCss,
      });
      if (!result.ok) {
        window.alert(result.error);
      }
    } catch {
      window.alert('导出 PDF 失败，请重试。');
    }
  }, [closeContextMenu, noteRelativePath, previewTheme, getThemeCss]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !vaultId || !noteRelativePath) {
      return;
    }

    // Clear the resolved-src cache when imageAssetVersion changes
    // so that externally added / modified / deleted images are
    // re-resolved against the current vault state.
    resolvedRef.current.clear();

    let cancelled = false;
    const images = container.querySelectorAll<HTMLImageElement>('img');

    for (const img of images) {
      // Always read the original Markdown-relative src from the
      // data attribute (set on first pass).  Fall back to the
      // element's initial src if this is the first render.
      let originalSrc = img.dataset.scholaOriginalSrc ?? null;

      if (!originalSrc) {
        // First pass — capture the raw src from the rendered HTML
        originalSrc = img.getAttribute('src');
        if (originalSrc) {
          img.dataset.scholaOriginalSrc = originalSrc;
        }
      }

      if (!originalSrc || !isRelativeAssetSrc(originalSrc)) {
        continue;
      }

      if (resolvedRef.current.has(originalSrc)) {
        continue;
      }

      resolvedRef.current.add(originalSrc);

      resolvePreviewAssetUrl(vaultId, noteRelativePath, originalSrc)
        .then((resolvedUrl) => {
          if (!cancelled && container.contains(img)) {
            img.src = resolvedUrl;
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [html, vaultId, noteRelativePath, imageAssetVersion]);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>): void => {
      const target = event.target as HTMLElement;
      const anchor = target.closest('a');

      if (!anchor) {
        return;
      }

      const href = anchor.getAttribute('href');

      if (!href) {
        return;
      }

      if (isWikilinkHref(href)) {
        event.preventDefault();

        const noteName = parseWikilinkHref(href);

        if (!noteName) {
          return;
        }

        const resolved = resolveWikilinkPathEnhanced(noteName, fileTree);

        if (resolved) {
          onNavigateToFile(resolved);
        } else {
          window.alert(`The note "${noteName}" has not been created yet.`);
        }
      }
    },
    [fileTree, onNavigateToFile],
  );

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (): void => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  return (
    <section className="preview-panel" aria-label="Markdown Preview" data-visible={isVisible}>
      <div className="preview-header">
        <span className="preview-title">Preview</span>
        <PreviewThemeSelector value={previewTheme} onChange={handleThemeChange} />
      </div>
      <div className="preview-scroll schola-scrollbar">
        {renderError ? (
          <div className="preview-render-error" data-testid="preview-render-error">
            {renderError}
          </div>
        ) : (
          <article
            ref={containerRef}
            className="schola-markdown-preview"
            data-testid="markdown-preview"
            data-preview-theme={previewTheme}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
      {/* Context menu for preview export */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="preview-context-menu"
          data-testid="preview-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className="preview-context-item"
            data-testid="preview-export-html"
            onClick={handleExportHtml}
          >
            导出为 HTML
          </button>
          <button
            type="button"
            className="preview-context-item"
            data-testid="preview-export-pdf"
            onClick={handleExportPdf}
          >
            导出为 PDF
          </button>
        </div>
      )}
    </section>
  );
}
