export type FileIconName =
  | 'markdown'
  | 'pdf'
  | 'folder'
  | 'folder-open'
  | 'docx'
  | 'pptx'
  | 'image'
  | 'tex'
  | 'bib'
  | 'csv'
  | 'json'
  | 'yaml'
  | 'imported'
  | 'exported'
  | 'attachment'
  | 'unknown-default'
  | 'unknown-missing';

export interface FileIconDescriptor {
  readonly name: FileIconName;
  readonly filename: `${FileIconName}.svg`;
  readonly src: string;
}

export const FILE_ICON_FILENAMES: Readonly<Record<FileIconName, `${FileIconName}.svg`>> = {
  markdown: 'markdown.svg',
  pdf: 'pdf.svg',
  folder: 'folder.svg',
  'folder-open': 'folder-open.svg',
  docx: 'docx.svg',
  pptx: 'pptx.svg',
  image: 'image.svg',
  tex: 'tex.svg',
  bib: 'bib.svg',
  csv: 'csv.svg',
  json: 'json.svg',
  yaml: 'yaml.svg',
  imported: 'imported.svg',
  exported: 'exported.svg',
  attachment: 'attachment.svg',
  'unknown-default': 'unknown-default.svg',
  'unknown-missing': 'unknown-missing.svg',
};

export const FILE_EXTENSION_ICON_MAP: Readonly<Record<string, FileIconName>> = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.pptx': 'pptx',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.gif': 'image',
  '.svg': 'image',
  '.webp': 'image',
  '.tex': 'tex',
  '.latex': 'tex',
  '.bib': 'bib',
  '.csv': 'csv',
  '.xlsx': 'csv',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
};

function resolveIconSrc(filename: string): string {
  try {
    return new URL(`../../assets/file-icons/${filename}`, import.meta.url).href;
  } catch {
    return `../../assets/file-icons/${filename}`;
  }
}

const FILE_ICON_SOURCES: Readonly<Record<FileIconName, string>> = {
  markdown: resolveIconSrc('markdown.svg'),
  pdf: resolveIconSrc('pdf.svg'),
  folder: resolveIconSrc('folder.svg'),
  'folder-open': resolveIconSrc('folder-open.svg'),
  docx: resolveIconSrc('docx.svg'),
  pptx: resolveIconSrc('pptx.svg'),
  image: resolveIconSrc('image.svg'),
  tex: resolveIconSrc('tex.svg'),
  bib: resolveIconSrc('bib.svg'),
  csv: resolveIconSrc('csv.svg'),
  json: resolveIconSrc('json.svg'),
  yaml: resolveIconSrc('yaml.svg'),
  imported: resolveIconSrc('imported.svg'),
  exported: resolveIconSrc('exported.svg'),
  attachment: resolveIconSrc('attachment.svg'),
  'unknown-default': resolveIconSrc('unknown-default.svg'),
  'unknown-missing': resolveIconSrc('unknown-missing.svg'),
};

export const DEFAULT_FILE_ICON_NAME: FileIconName = 'unknown-default';
export const MISSING_FILE_ICON_NAME: FileIconName = 'unknown-missing';

function createFileIconDescriptor(name: FileIconName): FileIconDescriptor {
  return {
    name,
    filename: FILE_ICON_FILENAMES[name],
    src: FILE_ICON_SOURCES[name],
  };
}

export function getFileIconNameForPath(relativePath: string): FileIconName {
  const fileName = relativePath.split('/').pop() ?? relativePath;
  const extensionStart = fileName.lastIndexOf('.');

  if (extensionStart <= 0) {
    return DEFAULT_FILE_ICON_NAME;
  }

  const extension = fileName.slice(extensionStart).toLowerCase();
  return FILE_EXTENSION_ICON_MAP[extension] ?? DEFAULT_FILE_ICON_NAME;
}

export function getFileIconDescriptor(iconName: FileIconName): FileIconDescriptor {
  return createFileIconDescriptor(iconName);
}

export function getFileIconDescriptorForPath(relativePath: string): FileIconDescriptor {
  return createFileIconDescriptor(getFileIconNameForPath(relativePath));
}

export function getFolderIconDescriptor(isExpanded: boolean): FileIconDescriptor {
  return createFileIconDescriptor(isExpanded ? 'folder-open' : 'folder');
}
