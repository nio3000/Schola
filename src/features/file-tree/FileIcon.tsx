import type { ReactElement } from 'react';

export type FileIconKind =
  | 'markdown'
  | 'pdf'
  | 'folder'
  | 'folder-open'
  | 'docx'
  | 'pptx'
  | 'image'
  | 'latex'
  | 'bibtex'
  | 'csv'
  | 'json'
  | 'yaml'
  | 'generic'
  | 'imported'
  | 'export'
  | 'attachment';

export interface FileIconProps {
  readonly extension?: string;
  readonly isFolder?: boolean;
  readonly isOpen?: boolean;
  readonly size?: number;
}

export const FILE_EXTENSION_ICON_MAP: Readonly<Record<string, FileIconKind>> = {
  '.md': 'markdown',
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.pptx': 'pptx',
  '.png': 'image',
  '.jpg': 'image',
  '.gif': 'image',
  '.svg': 'image',
  '.webp': 'image',
  '.tex': 'latex',
  '.bib': 'bibtex',
  '.csv': 'csv',
  '.xlsx': 'csv',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
};

function normalizeExtension(extension: string | undefined): string {
  if (!extension) {
    return '';
  }

  const normalized = extension.trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  return normalized.startsWith('.') ? normalized : `.${normalized}`;
}

export function getFileIconKind({ extension, isFolder, isOpen }: FileIconProps): FileIconKind {
  if (isFolder) {
    return isOpen ? 'folder-open' : 'folder';
  }

  return FILE_EXTENSION_ICON_MAP[normalizeExtension(extension)] ?? 'generic';
}

function DocumentShell(): ReactElement {
  return (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </>
  );
}

function renderIconPaths(kind: FileIconKind): ReactElement {
  switch (kind) {
    case 'markdown':
      return (
        <>
          <DocumentShell />
          <path d="M7 16v-5l2 3 2-3v5" />
          <path d="M14 11v5" />
          <path d="M12.5 14.5 14 16l1.5-1.5" />
        </>
      );
    case 'pdf':
      return (
        <>
          <DocumentShell />
          <path d="M7 17v-5h2a1.5 1.5 0 0 1 0 3H7" />
          <path d="M12 17v-5h1.5a2.5 2.5 0 0 1 0 5H12" />
          <path d="M17 17v-5h2" />
          <path d="M17 14.5h1.5" />
        </>
      );
    case 'folder':
      return (
        <>
          <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M3 9h18" />
        </>
      );
    case 'folder-open':
      return (
        <>
          <path d="M3 8V6a2 2 0 0 1 2-2h5l2 3h6a2 2 0 0 1 2 2v1" />
          <path d="M4 10h17l-2 8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </>
      );
    case 'docx':
      return (
        <>
          <DocumentShell />
          <path d="M7 11l1.2 6 1.8-4 1.8 4 1.2-6" />
          <path d="M15.5 12h2.5" />
          <path d="M15.5 15h2" />
        </>
      );
    case 'pptx':
      return (
        <>
          <rect x="4" y="4" width="16" height="12" rx="2" />
          <path d="M8 20h8" />
          <path d="M12 16v4" />
          <path d="M8 12V8h3a2 2 0 0 1 0 4z" />
          <path d="M15 8v4" />
        </>
      );
    case 'image':
      return (
        <>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="M5 17l5-5 3 3 2-2 4 4" />
        </>
      );
    case 'latex':
      return (
        <>
          <DocumentShell />
          <path d="M7 16h3" />
          <path d="M8.5 16v-5" />
          <path d="M12 16l2-5 2 5" />
          <path d="M13 14h2" />
          <path d="M17 12l2 4" />
          <path d="M19 12l-2 4" />
        </>
      );
    case 'bibtex':
      return (
        <>
          <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
          <path d="M8 4v16" />
          <path d="M11 8h4" />
          <path d="M11 12h3" />
          <path d="M11 16h4" />
        </>
      );
    case 'csv':
      return (
        <>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M4 10h16" />
          <path d="M4 15h16" />
          <path d="M9 5v14" />
          <path d="M15 5v14" />
        </>
      );
    case 'json':
      return (
        <>
          <DocumentShell />
          <path d="M10 12c-1.5 0-2 .8-2 2s-.5 2-2 2" />
          <path d="M10 20c-1.5 0-2-.8-2-2s-.5-2-2-2" />
          <path d="M14 12c1.5 0 2 .8 2 2s.5 2 2 2" />
          <path d="M14 20c1.5 0 2-.8 2-2s.5-2 2-2" />
        </>
      );
    case 'yaml':
      return (
        <>
          <DocumentShell />
          <path d="M8 11l2 3 2-3" />
          <path d="M10 14v3" />
          <path d="M14 12h3" />
          <path d="M14 16h3" />
        </>
      );
    case 'imported':
      return (
        <>
          <DocumentShell />
          <path d="M8 15h7" />
          <path d="M12 11l3 4-3 4" />
        </>
      );
    case 'export':
      return (
        <>
          <DocumentShell />
          <path d="M10 16h7" />
          <path d="M14 12l3 4-3 4" />
        </>
      );
    case 'attachment':
      return (
        <>
          <path d="M8 12.5l5.5-5.5a3 3 0 0 1 4.25 4.25l-7 7a4.5 4.5 0 0 1-6.36-6.36l7-7" />
          <path d="M10.5 15l6-6" />
        </>
      );
    case 'generic':
      return <DocumentShell />;
  }
}

export function FileIcon(props: FileIconProps): ReactElement {
  const { size = 16 } = props;
  const iconKind = getFileIconKind(props);

  return (
    <svg
      className={`file-icon file-icon-${iconKind}`}
      data-file-icon={iconKind}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {renderIconPaths(iconKind)}
    </svg>
  );
}
