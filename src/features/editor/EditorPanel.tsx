import { useEffect, useRef, useCallback, useState } from "react";
import type { DragEvent, ReactElement } from "react";
import { acceptCompletion, autocompletion, completionKeymap, startCompletion } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { readNote, saveNote } from "../../lib/platform/schola-api";
import { acceptMarkdownCompletionFallback, markdownCompletions } from "./completions/markdownCompletions";
import { logEditorReadyOnce } from "../../lib/platform/perf";
import { readStoredTheme } from "../preview/previewThemes";

export interface EditorPanelProps {
  readonly vaultId: string | null;
  readonly selectedFile: string | null;
  readonly onFileClosed: () => void;
  readonly onContentChange?: (content: string) => void;
  readonly onSaved?: () => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly reloadKey?: number;
  readonly activeConflict?: { readonly kind: "modified" | "deleted" } | null;
  readonly onResolveConflict?: (action: "keep" | "reload") => void;
  readonly previewTheme?: string;
  readonly onEditorViewReady?: (view: EditorView | null) => void;
}

function deriveWikilinkName(relativePath: string): string {
  return relativePath.replace(/\.(md|markdown)$/i, "").replace(/\\/g, "/");
}

function insertWikilinkAtCursor(view: EditorView, relativePath: string): void {
  const linkText = `[[${deriveWikilinkName(relativePath)}]]`;
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: linkText },
    selection: { anchor: from + linkText.length },
  });
}

function shouldStartMarkdownCompletion(view: EditorView): boolean {
  const position = view.state.selection.main.head;
  const line = view.state.doc.lineAt(position);
  const beforeCursor = line.text.slice(0, position - line.from);
  const slashMatch = /(^|\s)\/(\w*)$/.exec(beforeCursor);

  if (slashMatch) {
    const prefix = slashMatch[2];

    if ("table".startsWith(prefix) || "code".startsWith(prefix) || prefix === "tab") {
      return true;
    }
  }

  return /!\[[^\]\n]*$/.test(beforeCursor) || /!\[[^\]\n]*\]\([^\)\n]*$/.test(beforeCursor);
}

export function EditorPanel({
  vaultId,
  selectedFile,
  onFileClosed,
  onContentChange,
  onSaved,
  onDirtyChange,
  reloadKey,
  activeConflict,
  onResolveConflict,
  previewTheme,
  onEditorViewReady,
}: EditorPanelProps): ReactElement {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [content, setContent] = useState("");
  const [currentHash, setCurrentHash] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFile, setLoadedFile] = useState<string | null>(null);
  const [viewReady, setViewReady] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const onContentChangeRef = useRef(onContentChange);

  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  // Propagate dirty state upward so rename / close logic
  // can prevent data loss when files have unsaved changes.
  const onDirtyChangeRef = useRef(onDirtyChange);
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  }, [onDirtyChange]);
  useEffect(() => {
    onDirtyChangeRef.current?.(isDirty);
  }, [isDirty]);

  // ---- Markdown syntax highlighting colors ----
  const markdownHighlightStyle = HighlightStyle.define([
    { tag: tags.heading1, fontSize: "1.6em", fontWeight: "700", color: "#e06c75" },
    { tag: tags.heading2, fontSize: "1.4em", fontWeight: "700", color: "#e5c07b" },
    { tag: tags.heading3, fontSize: "1.2em", fontWeight: "600", color: "#98c379" },
    { tag: tags.heading4, fontSize: "1.1em", fontWeight: "600", color: "#56b6c2" },
    { tag: tags.heading5, fontWeight: "600", color: "#61afef" },
    { tag: tags.heading6, fontWeight: "600", color: "#c678dd" },
    { tag: tags.strong, fontWeight: "800", color: "#d19a66" },
    { tag: tags.emphasis, fontStyle: "italic", color: "#e5c07b" },
    { tag: tags.strikethrough, textDecoration: "line-through", color: "#7f848e" },
    { tag: tags.link, color: "#61afef", textDecoration: "underline" },
    { tag: tags.url, color: "#56b6c2" },
    { tag: tags.monospace, fontFamily: "var(--editor-font-family, monospace)", color: "#d19a66" },
    { tag: tags.quote, color: "#98c379" },
    { tag: tags.list, color: "#e5c07b" },
    { tag: tags.contentSeparator, color: "#5c6370" },
    { tag: tags.processingInstruction, color: "#7f848e" },
    { tag: tags.meta, color: "#abb2bf" },
  ]);

  // Sync editor theme from localStorage (independent of prop, survives re-renders)
  useEffect(() => {
    const el = editorRef.current;
    if (el) {
      el.setAttribute("data-editor-theme", readStoredTheme());
    }
  });

  // Create editor view once per mount
  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const view = new EditorView({
      state: EditorState.create({
        doc: "",
        extensions: [
          autocompletion({
            override: [markdownCompletions(vaultId)],
            activateOnTyping: true,
            defaultKeymap: false,
          }),
          keymap.of([{ key: "Enter", run: acceptCompletion }, ...completionKeymap, ...defaultKeymap]),
          markdown(),
          syntaxHighlighting(markdownHighlightStyle),
          EditorView.domEventHandlers({
            keydown(event, view) {
              if (event.key !== "Enter") {
                return false;
              }

              const accepted = acceptCompletion(view) || acceptMarkdownCompletionFallback(view);

              if (accepted) {
                event.preventDefault();
              }

              return accepted;
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              if (shouldStartMarkdownCompletion(update.view)) {
                window.setTimeout(() => startCompletion(update.view), 0);
              }

              const newContent = update.state.doc.toString();
              setContent(newContent);
              setIsDirty(true);
              setError(null);
              onContentChangeRef.current?.(newContent);
            }
          }),
        ],
      }),
      parent: editorRef.current,
    });

    const handleCompletionEnter = (event: KeyboardEvent): void => {
      if (event.key !== "Enter") {
        return;
      }

      const activeElement = document.activeElement;
      const editorHasFocus = activeElement ? editorRef.current?.contains(activeElement) === true : false;
      const completionOpen = document.querySelector(".cm-tooltip-autocomplete") !== null;

      if (!editorHasFocus && !completionOpen) {
        return;
      }

      const accepted = acceptCompletion(view) || acceptMarkdownCompletionFallback(view);

      if (!accepted) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("keydown", handleCompletionEnter, true);

    viewRef.current = view;
    setViewReady(true);
    onEditorViewReady?.(view);

    // ---- Performance: editor ready timing (once per application lifecycle) ----
    logEditorReadyOnce();

    return () => {
      window.removeEventListener("keydown", handleCompletionEnter, true);
      view.destroy();
      viewRef.current = null;
      setViewReady(false);
    };
  }, [vaultId]);

  // Load file when selectedFile changes and view is ready.
  // Also reload when reloadKey changes (external modification).
  useEffect(() => {
    if (!vaultId || !selectedFile || !viewReady) {
      return;
    }

    if (selectedFile === loadedFile && !reloadKey) {
      return;
    }

    let isActive = true;

    async function load(): Promise<void> {
      setIsReading(true);
      setError(null);

      try {
        const result = await readNote(vaultId!, selectedFile!);

        if (!isActive) {
          return;
        }

        const view = viewRef.current;
        if (!view) {
          return;
        }

        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: result.content },
        });
        // Ensure CodeMirror re-measures after async content load on initial mount
        view.requestMeasure();

        setContent(result.content);
        setCurrentHash(result.hash);
        setIsDirty(false);
        setIsReading(false);
        setLoadedFile(selectedFile!);
        onContentChangeRef.current?.(result.content);
      } catch (err) {
        if (!isActive) {
          return;
        }

        setIsReading(false);
        setError(err instanceof Error ? err.message : "Failed to read file.");
      }
    }

    void load();

    return () => {
      isActive = false;
    };
  }, [vaultId, selectedFile, loadedFile, viewReady, reloadKey]);

  // Notify parent when component unmounts
  useEffect(() => {
    return () => {
      onFileClosed();
    };
  }, [onFileClosed]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!vaultId || !loadedFile || !currentHash) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await saveNote(vaultId, loadedFile, content, currentHash);
      setCurrentHash(result.hash);
      setIsDirty(false);
      onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save file.";

      if (message.includes("HASH_CONFLICT")) {
        setError("File was modified externally. Reload the file to see changes.");
      } else {
        setError(message);
      }
    } finally {
      setIsSaving(false);
    }
  }, [vaultId, loadedFile, currentHash, content, onSaved]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "link";
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((): void => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      setDragOver(false);

      const view = viewRef.current;
      if (!view) {
        return;
      }

      const relativePath = event.dataTransfer.getData("text/plain");
      if (!relativePath) {
        return;
      }

      insertWikilinkAtCursor(view, relativePath);
    },
    [],
  );

  if (!vaultId) {
    return (
      <section className="editor-panel" data-testid="markdown-editor" aria-label="Editor">
        <div className="editor-empty">
          <p>Open a Vault and select a Markdown file from the tree to start editing.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="editor-panel"
      data-testid="markdown-editor"
      data-selected-file={selectedFile ?? ""}
      data-loaded-file={loadedFile ?? ""}
      aria-label="Editor"
    >
      <div className="editor-header">
        <span className="editor-file-path">{selectedFile ?? "No file selected"}</span>
        <button
          type="button"
          className="editor-save-btn"
          data-testid="save-note"
          onClick={handleSave}
          disabled={!isDirty || isSaving || !selectedFile}
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>

      {error ? (
        <div className="editor-error" data-testid="editor-error">
          {error}
        </div>
      ) : null}

      {activeConflict ? (
        <div className="editor-conflict-banner" data-testid="external-change-banner">
          {activeConflict.kind === "modified" ? (
            <>
              <span className="conflict-message">
                文件已在外部修改，当前有未保存内容。Schola 未自动覆盖你的编辑。
              </span>
              <span className="conflict-actions">
                <button
                  type="button"
                  className="conflict-btn-keep"
                  data-testid="conflict-keep"
                  onClick={() => onResolveConflict?.("keep")}
                >
                  保留当前内容
                </button>
                <button
                  type="button"
                  className="conflict-btn-reload"
                  data-testid="conflict-reload"
                  onClick={() => onResolveConflict?.("reload")}
                >
                  重新加载外部版本
                </button>
              </span>
            </>
          ) : (
            <>
              <span className="conflict-message">
                该文件已在外部删除，但当前有未保存修改。Schola 已保留当前编辑内容。
              </span>
              <span className="conflict-actions">
                <button
                  type="button"
                  className="conflict-btn-keep"
                  data-testid="conflict-dismiss"
                  onClick={() => onResolveConflict?.("keep")}
                >
                  我知道了
                </button>
              </span>
            </>
          )}
        </div>
      ) : null}

      <div
        className={`editor-body${dragOver ? " editor-body-drag-over" : ""}`}
        data-testid="editor-body"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div ref={editorRef} className="editor-cm schola-scrollbar" data-testid="editor-cm" data-editor-theme={previewTheme} />
        {viewReady ? <span className="sr-only" data-testid="editor-codemirror-ready" /> : null}
        {!selectedFile ? (
          <div className="editor-empty-overlay">
            <p>Select a Markdown file from the file tree to start editing.</p>
          </div>
        ) : null}
        {isReading ? <div className="editor-loading">Loading file...</div> : null}
      </div>
    </section>
  );
}
