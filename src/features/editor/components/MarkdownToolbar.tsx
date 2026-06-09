/**
 * MarkdownToolbar — Phase 5 MWeb Toolbar.
 *
 * Inline Markdown formatting toolbar placed above the editor.
 * Inserts/wraps markdown syntax at cursor or around selection.
 *
 * Operations: Bold, Italic, Strikethrough, Heading, Quote, Link, Code,
 * CodeBlock, UnorderedList, OrderedList, TaskList, Table.
 *
 * Source reference: MWeb toolbar pattern.
 */
import { type ReactElement, type MutableRefObject } from 'react';
import type { EditorView } from '@codemirror/view';

export interface MarkdownToolbarProps {
  readonly editorViewRef: MutableRefObject<EditorView | null>;
  readonly disabled: boolean;
}

interface ToolbarButton {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly icon: string;
}

const BUTTONS: readonly ToolbarButton[] = [
  { id: 'heading', label: 'H', title: '标题 (##)', icon: 'H' },
  { id: 'bold', label: 'B', title: '加粗 (**text**) ', icon: 'B' },
  { id: 'italic', label: 'I', title: '斜体 (*text*)', icon: 'I' },
  { id: 'strikethrough', label: 'S', title: '删除线 (~~text~~)', icon: 'S' },
  { id: 'quote', label: '"', title: '引用 (> )', icon: '"' },
  { id: 'link', label: '🔗', title: '链接 ([text](url))', icon: '🔗' },
  { id: 'code', label: '<>', title: '行内代码 (`code`)', icon: '<>' },
  { id: 'codeblock', label: '{ }', title: '代码块 (```)', icon: '{ }' },
  { id: 'ul', label: '•', title: '无序列表 (- )', icon: '•' },
  { id: 'ol', label: '1.', title: '有序列表 (1. )', icon: '1.' },
  { id: 'task', label: '☑', title: '任务列表 (- [ ] )', icon: '☑' },
  { id: 'table', label: '⊞', title: '表格', icon: '⊞' },
];

function wrapSelection(
  view: EditorView,
  before: string,
  after: string,
  placeholder: string,
): void {
  const { from, to } = view.state.selection.main;
  const hasSelection = from !== to;
  const selectedText = hasSelection
    ? view.state.sliceDoc(from, to)
    : placeholder;
  view.dispatch({
    changes: { from, to, insert: `${before}${selectedText}${after}` },
    selection: { anchor: from + before.length + selectedText.length },
  });
}

function insertAtLineStart(view: EditorView, prefix: string): void {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  view.dispatch({
    changes: { from: line.from, insert: prefix },
    selection: { anchor: from + prefix.length },
  });
}

function insertBlock(view: EditorView, template: string): void {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const isLineEmpty = line.text.trim() === '';
  const insertText = isLineEmpty ? template : '\n' + template;
  const insertPos = isLineEmpty ? line.from : line.to;
  view.dispatch({
    changes: { from: insertPos, insert: insertText },
    selection: { anchor: insertPos + 2 },
  });
}

export function MarkdownToolbar({ editorViewRef, disabled }: MarkdownToolbarProps): ReactElement {
  function handleClick(id: string): void {
    const view = editorViewRef.current;
    if (!view || disabled) return;
    view.focus();
    switch (id) {
      case 'heading':
        insertAtLineStart(view, '## ');
        break;
      case 'bold':
        wrapSelection(view, '**', '**', '加粗文本');
        break;
      case 'italic':
        wrapSelection(view, '*', '*', '斜体文本');
        break;
      case 'strikethrough':
        wrapSelection(view, '~~', '~~', '删除文本');
        break;
      case 'quote':
        insertAtLineStart(view, '> ');
        break;
      case 'link':
        wrapSelection(view, '[', '](url)', '链接文本');
        break;
      case 'code':
        wrapSelection(view, '`', '`', '代码');
        break;
      case 'codeblock':
        insertBlock(view, '```\n\n```');
        break;
      case 'ul':
        insertAtLineStart(view, '- ');
        break;
      case 'ol':
        insertAtLineStart(view, '1. ');
        break;
      case 'task':
        insertAtLineStart(view, '- [ ] ');
        break;
      case 'table': {
        const tableTemplate =
          '| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n|     |     |     |\n';
        insertBlock(view, tableTemplate);
        break;
      }
    }
  }

  return (
    <div
      className="schola-markdown-toolbar"
      data-testid="markdown-toolbar"
      role="toolbar"
      aria-label="Markdown 格式工具栏"
    >
      {BUTTONS.map((btn) => (
        <button
          key={btn.id}
          type="button"
          className="schola-markdown-toolbar-btn"
          title={btn.title}
          aria-label={btn.title}
          disabled={disabled}
          data-testid={`md-toolbar-${btn.id}`}
          onClick={() => handleClick(btn.id)}
        >
          {btn.icon}
        </button>
      ))}
    </div>
  );
}