import { useState, useCallback } from 'react';
import type { DragEvent, MouseEvent, ReactElement } from 'react';
import type { FileEntry } from '../../../lib/contracts/vault.types';
import { getFileIconDescriptorForPath, getFolderIconDescriptor } from '../../file-tree/FileIconMap';
import { isNonMarkdownResource, getResourceIconChar, getResourceKindCss } from '../../resources/resourceDisplay';
import { getResourceKindByPath } from '../../../lib/contracts/resource-classifier';

export interface FileTreeProps {
  readonly entries: readonly FileEntry[];
  readonly selectedFile?: string | null;
  readonly onSelectFile?: (relativePath: string) => void;
  readonly expandedPaths?: ReadonlySet<string>;
  readonly onToggleExpand?: (path: string) => void;
  readonly onOpenCreateMenu?: (
    parentRelativePath: string,
    entryRelativePath: string | null,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
}

function getContainingFolder(relativePath: string): string {
  const lastSeparatorIndex = relativePath.lastIndexOf('/');
  return lastSeparatorIndex === -1 ? '' : relativePath.slice(0, lastSeparatorIndex);
}

function FileTreeNode({
  entry,
  onSelectFile,
  selectedFile,
  expandedPaths,
  onToggleExpand,
  onOpenCreateMenu,
}: {
  readonly entry: FileEntry;
  readonly onSelectFile?: (relativePath: string) => void;
  readonly selectedFile?: string | null;
  readonly expandedPaths: ReadonlySet<string>;
  readonly onToggleExpand: (path: string) => void;
  readonly onOpenCreateMenu?: (
    parentRelativePath: string,
    entryRelativePath: string | null,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
}): ReactElement {
  if (entry.type === 'directory') {
    const isExpanded = expandedPaths.has(entry.relativePath);
    const hasChildren = entry.children && entry.children.length > 0;
    const folderIcon = getFolderIconDescriptor(isExpanded);

    const handleToggle = (event: MouseEvent): void => {
      event.stopPropagation();
      onToggleExpand(entry.relativePath);
    };

    const handleContextMenu = (event: MouseEvent<HTMLButtonElement>): void => {
      event.preventDefault();
      event.stopPropagation();
      onOpenCreateMenu?.(entry.relativePath, entry.relativePath, event);
    };

    return (
      <li
        className="file-tree-node file-tree-node-directory"
        data-testid={`folder-node-${entry.name}`}
      >
        <button
          type="button"
          className={`file-tree-dir-label${isExpanded ? ' file-tree-dir-expanded' : ''}`}
          onClick={handleToggle}
          onContextMenu={handleContextMenu}
          aria-expanded={isExpanded}
          title={entry.relativePath}
        >
          <span className="file-tree-dir-chevron">{isExpanded ? '▾' : '▸'}</span>
          <img
            className="file-tree-icon file-tree-folder-icon"
            src={folderIcon.src}
            alt=""
            aria-hidden="true"
            data-testid={`file-icon-${entry.name}`}
          />
          <span className="file-tree-dir-name">{entry.name}</span>
        </button>
        {hasChildren && isExpanded ? (
          <FileTree
            entries={entry.children!}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            expandedPaths={expandedPaths}
            onToggleExpand={onToggleExpand}
            onOpenCreateMenu={onOpenCreateMenu}
          />
        ) : null}
      </li>
    );
  }

  const isSelected = selectedFile === entry.relativePath;
  const isResource = isNonMarkdownResource(entry.relativePath);

  const handleDragStart = (event: DragEvent<HTMLButtonElement>): void => {
    event.dataTransfer.setData('application/x-schola-file', entry.relativePath);
    event.dataTransfer.setData('text/plain', entry.relativePath);
    event.dataTransfer.effectAllowed = 'link';
  };
  const fileIcon = isResource ? null : getFileIconDescriptorForPath(entry.relativePath);
  const resourceIcon = isResource ? getResourceIconChar(getResourceKindByPath(entry.relativePath)) : null;
  const resourceCss = isResource ? getResourceKindCss(getResourceKindByPath(entry.relativePath)) : null;

  return (
    <li className="file-tree-node file-tree-node-file" data-testid={`file-node-${entry.name}`}>
      <button
        type="button"
        className={`file-tree-label file-tree-label-button${isSelected ? ' file-tree-label-selected' : ''}`}
        aria-current={isSelected ? 'page' : undefined}
        draggable
        onClick={() => onSelectFile?.(entry.relativePath)}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpenCreateMenu?.(getContainingFolder(entry.relativePath), entry.relativePath, event);
        }}
        onDragStart={handleDragStart}
      >
        {isResource && resourceIcon ? (
          <span className={`resource-icon-label ${resourceCss ?? ''}`} data-testid={`resource-icon-${entry.name}`}>
            {resourceIcon}
          </span>
        ) : (
          <img
            className="file-tree-icon file-tree-file-icon"
            src={fileIcon?.src ?? ''}
            alt=""
            aria-hidden="true"
            data-testid={`file-icon-${entry.name}`}
          />
        )}
        <span className="file-tree-file-name">{entry.name}</span>
      </button>
    </li>
  );
}

export function collectDefaultExpandedPaths(
  entries: readonly FileEntry[],
  depth: number = 0,
): string[] {
  const paths: string[] = [];

  for (const entry of entries) {
    if (entry.type !== 'directory') {
      continue;
    }

    // Expand root (depth 0) and first-level (depth 1) directories by default
    if (depth <= 1) {
      paths.push(entry.relativePath);
    }

    if (entry.children) {
      paths.push(...collectDefaultExpandedPaths(entry.children, depth + 1));
    }
  }

  return paths;
}

export function FileTree({
  entries,
  expandedPaths,
  onOpenCreateMenu,
  onSelectFile,
  onToggleExpand,
  selectedFile,
}: FileTreeProps): ReactElement {
  const [internalExpandedPaths, setInternalExpandedPaths] = useState<Set<string>>(() => {
    return new Set(collectDefaultExpandedPaths(entries));
  });

  const handleInternalToggleExpand = useCallback((path: string): void => {
    setInternalExpandedPaths((prev) => {
      const next = new Set(prev);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  }, []);

  const visibleExpandedPaths = expandedPaths ?? internalExpandedPaths;
  const handleToggleExpand = onToggleExpand ?? handleInternalToggleExpand;

  if (entries.length === 0) {
    return <ul className="file-tree" />;
  }

  return (
    <ul className="file-tree">
      {entries.map((entry) => (
        <FileTreeNode
          key={entry.id}
          entry={entry}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          expandedPaths={visibleExpandedPaths}
          onToggleExpand={handleToggleExpand}
          onOpenCreateMenu={onOpenCreateMenu}
        />
      ))}
    </ul>
  );
}
