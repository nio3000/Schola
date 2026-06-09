import type { GraphEdge, GraphNode } from '../../../lib/contracts/graph-query.types';

export type GraphScope = 'current-file' | 'selected-files' | 'folder-project' | 'custom' | 'whole-vault';

export const DEFAULT_SCOPE: GraphScope = 'current-file';

export const SCOPE_LABELS: Record<GraphScope, string> = {
  'current-file': '当前文件',
  'selected-files': '已选文件',
  'folder-project': '当前文件夹',
  custom: '自定义范围',
  'whole-vault': '整个知识库',
};

export interface ScopedGraphData {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

function matchesPath(node: GraphNode, relativePath: string): boolean {
  return node.relativePath === relativePath || node.id === relativePath;
}

function folderOf(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index + 1) : '';
}

function fileSetForScope(
  scope: GraphScope,
  activeFile?: string | null,
  selectedFiles: readonly string[] = [],
  customFiles: readonly string[] = [],
): Set<string> | null {
  if (scope === 'whole-vault') return null;
  if (scope === 'current-file') return activeFile ? new Set([activeFile]) : new Set();
  if (scope === 'selected-files') return new Set(selectedFiles.length > 0 ? selectedFiles : activeFile ? [activeFile] : []);
  if (scope === 'custom') return new Set(customFiles);

  const folderAnchor = activeFile ?? selectedFiles[0] ?? customFiles[0] ?? null;
  if (!folderAnchor) return new Set();
  const folder = folderOf(folderAnchor);
  return new Set([...selectedFiles, ...customFiles, folderAnchor].filter((path) => folderOf(path) === folder));
}

export function filterNodesByScope(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  scope: GraphScope,
  activeFile?: string | null,
  selectedFiles: readonly string[] = [],
  customFiles: readonly string[] = [],
): ScopedGraphData {
  const scopedFiles = fileSetForScope(scope, activeFile, selectedFiles, customFiles);
  if (scopedFiles === null) return { nodes, edges };
  if (scopedFiles.size === 0) return { nodes: [], edges: [] };

  const baseNodeIds = new Set<string>();

  if (scope === 'folder-project') {
    const folderAnchor = activeFile ?? selectedFiles[0] ?? customFiles[0] ?? null;
    const folder = folderAnchor ? folderOf(folderAnchor) : null;
    if (!folder) return { nodes: [], edges: [] };
    for (const node of nodes) {
      if (node.relativePath && folderOf(node.relativePath) === folder) {
        baseNodeIds.add(node.id);
      }
    }
  } else {
    for (const node of nodes) {
      for (const relativePath of scopedFiles) {
        if (matchesPath(node, relativePath)) {
          baseNodeIds.add(node.id);
          break;
        }
      }
    }
  }

  if (baseNodeIds.size === 0) return { nodes: [], edges: [] };

  const visibleNodeIds = new Set(baseNodeIds);
  const visibleEdges = edges.filter((edge) => {
    const touchesScope = baseNodeIds.has(edge.source) || baseNodeIds.has(edge.target);
    if (touchesScope) {
      visibleNodeIds.add(edge.source);
      visibleNodeIds.add(edge.target);
    }
    return touchesScope;
  });

  const visibleNodes = nodes.filter((node) => visibleNodeIds.has(node.id));
  const existingNodeIds = new Set(visibleNodes.map((node) => node.id));
  const connectedEdges = visibleEdges.filter((edge) => existingNodeIds.has(edge.source) && existingNodeIds.has(edge.target));

  return { nodes: visibleNodes, edges: connectedEdges };
}

/** Wrapper with object-based input for test compatibility. */
export interface ScopeFilterInput {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly scope: GraphScope;
  readonly activeFile: string | null;
  readonly selectedFiles: readonly string[];
  readonly customFileSet: readonly string[];
}

export function applyScopeFilter(input: ScopeFilterInput): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const result = filterNodesByScope(
    input.nodes,
    input.edges,
    input.scope,
    input.activeFile,
    input.selectedFiles,
    input.customFileSet,
  );
  return { nodes: [...result.nodes], edges: [...result.edges] };
}
