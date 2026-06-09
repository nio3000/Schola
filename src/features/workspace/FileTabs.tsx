import { useCallback, type MouseEvent, type WheelEvent, type ReactElement } from 'react';

interface ExternalFileConflict {
  readonly kind: 'modified' | 'deleted';
}

export interface FileTabsProps {
  readonly openFiles: readonly string[];
  readonly activeFile: string | null;
  readonly onSelectTab: (relativePath: string) => void;
  readonly onCloseTab: (relativePath: string) => void;
  readonly externalConflicts?: ReadonlyMap<string, ExternalFileConflict>;
}

function tabLabel(relativePath: string): string {
  return relativePath.split('/').pop() ?? relativePath;
}

export function FileTabs({ openFiles, activeFile, onSelectTab, onCloseTab, externalConflicts }: FileTabsProps): ReactElement {
  if (openFiles.length === 0) {
    return <div className="file-tabs file-tabs-empty" />;
  }

  const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, []);

  return (
    <div
      className="file-tabs"
      role="tablist"
      aria-label="Open files"
      onWheel={handleWheel}
    >
      {openFiles.map((filePath) => {
        const isActive = filePath === activeFile;
        const conflict = externalConflicts?.get(filePath);

        const handleClose = (event: MouseEvent): void => {
          event.stopPropagation();
          onCloseTab(filePath);
        };

        let tabClass = 'file-tab';
        if (isActive) tabClass += ' file-tab-active';
        if (conflict?.kind === 'deleted') tabClass += ' file-tab-external-deleted';
        else if (conflict?.kind === 'modified') tabClass += ' file-tab-external-modified';

        return (
          <button
            key={filePath}
            type="button"
            role="tab"
            className={tabClass}
            aria-selected={isActive}
            data-testid={`tab-${tabLabel(filePath)}`}
            title={filePath}
            onClick={() => onSelectTab(filePath)}
          >
            <span className="file-tab-label">{tabLabel(filePath)}</span>

            {conflict?.kind === 'deleted' ? (
              <span className="file-tab-conflict-deleted" data-testid={`tab-conflict-${tabLabel(filePath)}`} title="文件已在外部删除">✕</span>
            ) : conflict?.kind === 'modified' ? (
              <span className="file-tab-conflict-modified" data-testid={`tab-conflict-${tabLabel(filePath)}`} title="文件已在外部修改">⚠</span>
            ) : (
              <span
                className="file-tab-close"
                role="button"
                aria-label={`Close ${tabLabel(filePath)}`}
                data-testid={`tab-close-${tabLabel(filePath)}`}
                onClick={handleClose}
              >
                ×
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
