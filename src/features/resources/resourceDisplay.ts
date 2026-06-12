/**
 * Resource display utilities — Phase 5-4A-IMP-2-BATCH.
 *
 * Maps ResourceKind to display labels and icon characters for the Explorer.
 * No file I/O, no network, no system paths.
 */
import type { ResourceKind, ResourceViewerKind } from '../../lib/contracts/resource.types';
import { getResourceKindByPath } from '../../lib/contracts/resource-classifier';

// ── Display Labels ──────────────────────────────

export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  markdown: 'Markdown',
  pdf: 'PDF',
  html: 'HTML',
  docx: 'Word',
  doc: 'Legacy Word',
  pptx: 'PPT',
  xlsx: 'Excel',
  xls: 'Legacy Excel',
  csv: 'CSV',
  txt: 'TXT',
  image: 'Image',
  other: 'File',
};

export const RESOURCE_VIEWER_LABEL: Record<ResourceViewerKind, string> = {
  'markdown-editor': 'Editor',
  'pdf-viewer': 'PDF Viewer',
  'html-viewer': 'HTML Viewer',
  'image-viewer': 'Image Viewer',
  'text-viewer': 'Text Viewer',
  'metadata-viewer': 'Metadata',
  'unsupported': 'Unsupported',
};

// ── Icon Characters (simple unicode, no icon library) ──

const KIND_ICON: Record<ResourceKind, string> = {
  markdown: '',
  pdf: 'PDF',
  html: 'HTM',
  docx: 'DOC',
  doc: 'DOC',
  pptx: 'PPT',
  xlsx: 'XLS',
  xls: 'XLS',
  csv: 'CSV',
  txt: 'TXT',
  image: 'IMG',
  other: '???',
};

// ── CSS Classes ──────────────────────────────────

const KIND_CSS: Record<ResourceKind, string> = {
  markdown: 'resource-kind-markdown',
  pdf: 'resource-kind-pdf',
  html: 'resource-kind-html',
  docx: 'resource-kind-docx',
  doc: 'resource-kind-doc',
  pptx: 'resource-kind-pptx',
  xlsx: 'resource-kind-xlsx',
  xls: 'resource-kind-xls',
  csv: 'resource-kind-csv',
  txt: 'resource-kind-txt',
  image: 'resource-kind-image',
  other: 'resource-kind-other',
};

// ── Public API ────────────────────────────────────

export function getResourceKindLabel(kind: ResourceKind): string {
  return RESOURCE_KIND_LABEL[kind];
}

export function getResourceIconChar(kind: ResourceKind): string {
  return KIND_ICON[kind];
}

export function getResourceKindCss(kind: ResourceKind): string {
  return KIND_CSS[kind];
}

export function getResourceKindLabelForPath(relativePath: string): string {
  return getResourceKindLabel(getResourceKindByPath(relativePath));
}

export function getResourceIconForPath(relativePath: string): string {
  return getResourceIconChar(getResourceKindByPath(relativePath));
}

export function getResourceCssForPath(relativePath: string): string {
  return getResourceKindCss(getResourceKindByPath(relativePath));
}

export function isNonMarkdownResource(relativePath: string): boolean {
  return getResourceKindByPath(relativePath) !== 'markdown';
}
