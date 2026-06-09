import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';
import { listImageAssets } from '../../../lib/platform/schola-api';

const codeLanguages: readonly Completion[] = [
  { label: 'python', detail: 'py', type: 'keyword' },
  { label: 'typescript', detail: 'ts', type: 'keyword' },
  { label: 'javascript', detail: 'js', type: 'keyword' },
  { label: 'cpp', detail: 'c++, cc, cxx', type: 'keyword' },
  { label: 'c', type: 'keyword' },
  { label: 'bash', detail: 'sh, shell', type: 'keyword' },
  { label: 'json', type: 'keyword' },
  { label: 'yaml', detail: 'yml', type: 'keyword' },
  { label: 'markdown', type: 'keyword' },
  { label: 'latex', detail: 'tex', type: 'keyword' },
  { label: 'html', type: 'keyword' },
  { label: 'css', type: 'keyword' },
  { label: 'java', type: 'keyword' },
  { label: 'go', type: 'keyword' },
  { label: 'rust', type: 'keyword' },
  { label: 'php', type: 'keyword' },
  { label: 'xml', type: 'keyword' },
  { label: 'toml', type: 'keyword' },
  { label: 'ini', type: 'keyword' },
  { label: 'powershell', detail: 'ps1', type: 'keyword' },
  { label: 'dockerfile', detail: 'docker', type: 'keyword' },
];

const tableInsert = '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |';
const tableCursorOffset = '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| '.length;

interface SlashCommandMatch {
  readonly from: number;
  readonly to: number;
  readonly prefix: string;
}

async function imageCompletions(
  context: CompletionContext,
  vaultId: string,
): Promise<CompletionResult | null> {
  const line = context.state.doc.lineAt(context.pos);
  const beforeCursor = line.text.slice(0, context.pos - line.from);
  const imageMatch = /!\[[^\]\n]*(?:\]\([^\)\n]*)?$/.exec(beforeCursor);

  if (!imageMatch) {
    return null;
  }

  const openParenIndex = imageMatch[0].lastIndexOf('(');
  const from = openParenIndex === -1 ? context.pos : line.from + imageMatch.index + openParenIndex + 1;
  const assets = await listImageAssets(vaultId);

  return {
    from,
    options: assets.map((asset) => ({
      label: asset.relativePath,
      type: 'text',
      apply: asset.relativePath,
    })),
  };
}

function slashCommandMatch(context: CompletionContext): SlashCommandMatch | null {
  const line = context.state.doc.lineAt(context.pos);
  const beforeCursor = line.text.slice(0, context.pos - line.from);
  const triggerMatch = /(^|\s)\/(\w*)$/.exec(beforeCursor);

  if (!triggerMatch) {
    return null;
  }

  const prefix = triggerMatch[2];

  return {
    from: context.pos - prefix.length - 1,
    to: context.pos,
    prefix,
  };
}

function replaceWithTable(view: EditorView, from: number, to: number): void {
  view.dispatch({
    changes: { from, to, insert: tableInsert },
    selection: { anchor: from + tableCursorOffset },
  });
}

function replaceWithCodeBlock(view: EditorView, language: string, from: number, to: number): void {
  const insert = `\`\`\`${language}\n\n\`\`\``;

  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + language.length + 4 },
  });
}

export function acceptMarkdownCompletionFallback(view: EditorView): boolean {
  const position = view.state.selection.main.head;
  const line = view.state.doc.lineAt(position);
  const beforeCursor = line.text.slice(0, position - line.from);
  const triggerMatch = /(^|\s)\/(\w*)$/.exec(beforeCursor);

  if (!triggerMatch) {
    return false;
  }

  const prefix = triggerMatch[2];
  const from = position - prefix.length - 1;

  if ('table'.startsWith(prefix) || prefix === 'tab') {
    replaceWithTable(view, from, position);
    return true;
  }

  if ('code'.startsWith(prefix)) {
    replaceWithCodeBlock(view, 'python', from, position);
    return true;
  }

  return false;
}

function slashCommandCompletions(context: CompletionContext): CompletionResult | null {
  const match = slashCommandMatch(context);

  if (!match) {
    return null;
  }

  const options: Completion[] = [];
  const { prefix } = match;

  if ('table'.startsWith(prefix) || prefix === 'tab') {
    options.push({
      label: 'Insert 3-column table',
      detail: '/table',
      type: 'text',
      apply(view: EditorView, _completion: Completion, from: number, to: number) {
        replaceWithTable(view, from, to);
      },
    });
  }

  if ('code'.startsWith(prefix)) {
    options.push(
      ...codeLanguages.map((language) => ({
        ...language,
        detail: language.detail ? `${language.detail} /code` : '/code',
        apply(view: EditorView, _completion: Completion, from: number, to: number) {
          replaceWithCodeBlock(view, language.label, from, to);
        },
      })),
    );
  }

  if (options.length === 0) {
    return null;
  }

  return {
    from: match.from,
    to: match.to,
    filter: false,
    options,
  };
}

export function markdownCompletions(vaultId: string | null) {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    if (vaultId) {
      const imageResult = await imageCompletions(context, vaultId);

      if (imageResult) {
        return imageResult;
      }
    }

    return slashCommandCompletions(context);
  };
}
