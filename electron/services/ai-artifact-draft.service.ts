/**
 * AI Artifact Draft Service — Phase 5-5-C-IMP-4.
 *
 * Saves in-memory AI artifact drafts only after an explicit user action.
 * All writes are Vault-relative, Markdown-only, and PathGuard validated.
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import type {
  AIArtifactDraft,
  EvidenceRef,
  SaveArtifactDraftInput,
  SaveArtifactDraftResult,
} from '../../src/lib/contracts/ai-research.types';
import { assertString, assertVaultId } from '../lib/ipc-validation';
import { sanitizeIpcError } from '../lib/error-utils';
import { assertPathInsideRoot, resolveVaultPath } from '../security/path-guard';
import { getArtifactDraft, markArtifactDraftSaved } from './ai-research-task.service';
import { getVaultRootPath } from './vault.service';

const DEFAULT_DRAFT_DIR = '_ai_drafts';
const MARKDOWN_EXTENSION = '.md';
const WINDOWS_DRIVE_PATH_PATTERN = /^[a-zA-Z]:[\\/]/;
const UNC_PATH_PATTERN = /^(?:\\\\|\/\/)/;
const BLOCKED_SEGMENTS = new Set(['.schola', '_trash', '_exports']);

export async function saveArtifactDraft(
  input: SaveArtifactDraftInput,
): Promise<SaveArtifactDraftResult> {
  try {
    const vaultId = assertVaultId(input.vaultId);
    const artifactId = assertString(input.artifactId, 'artifactId');
    const artifact = getArtifactDraft(artifactId);
    const rootPath = getVaultRootPath(vaultId);
    const targetRelativePath = normalizeTargetRelativePath(
      input.targetRelativePath ?? buildDefaultTargetRelativePath(artifact),
    );
    const targetAbsolutePath = await resolveSafeWritePath(rootPath, targetRelativePath);
    const exists = await fileExists(targetAbsolutePath);

    if (exists && input.overwriteConfirmed !== true) {
      throw new Error('OVERWRITE_CONFIRMATION_REQUIRED: 保存目标已存在，请确认覆盖后重试。');
    }

    const markdown = buildSavedMarkdown(artifact);
    await fs.mkdir(path.dirname(targetAbsolutePath), { recursive: true });
    await fs.writeFile(targetAbsolutePath, markdown, {
      encoding: 'utf-8',
      flag: exists ? 'w' : 'wx',
    });

    const savedArtifact = markArtifactDraftSaved(artifactId, targetRelativePath);
    return {
      ok: true,
      artifactId,
      relativePath: targetRelativePath,
      artifact: savedArtifact,
    };
  } catch (err) {
    throw new Error(`AI_ARTIFACT_SAVE_ERROR: ${sanitizeIpcError(err)}`);
  }
}

export function buildSavedMarkdown(artifact: AIArtifactDraft): string {
  const lines = [
    `# ${sanitizeMarkdownLine(artifact.title)}`,
    '',
    '> AI 生成内容需人工核验。本文档由用户显式保存，非自动写入。',
    '',
    '## Metadata',
    '',
    `- Generated at: ${artifact.createdAt}`,
    `- Provider / Model: ${sanitizeMarkdownLine(artifact.providerId)} / ${sanitizeMarkdownLine(artifact.model)}`,
    `- Skill: ${sanitizeMarkdownLine(artifact.skillId)}`,
    `- Task ID: ${sanitizeMarkdownLine(artifact.taskId)}`,
    `- ContextPack: ${sanitizeMarkdownLine(artifact.sourcePackId)}`,
    '',
    '## Draft',
    '',
    sanitizeArtifactContent(artifact.content),
    '',
    ...buildEvidenceMarkdown(artifact.evidenceRefs.length > 0 ? artifact.evidenceRefs : artifact.evidence),
    '',
  ];

  return sanitizeArtifactContent(lines.join('\n'));
}

export function buildDefaultTargetRelativePath(artifact: AIArtifactDraft): string {
  const date = new Date(artifact.createdAt).toISOString().slice(0, 10);
  return `${DEFAULT_DRAFT_DIR}/${date}-${sanitizeFileStem(artifact.title)}${MARKDOWN_EXTENSION}`;
}

export function normalizeTargetRelativePath(input: string): string {
  const trimmed = assertString(input, 'targetRelativePath').trim().replace(/\\/g, '/');

  if (
    trimmed.length === 0 ||
    path.posix.isAbsolute(trimmed) ||
    WINDOWS_DRIVE_PATH_PATTERN.test(trimmed) ||
    UNC_PATH_PATTERN.test(trimmed)
  ) {
    throw new Error('INVALID_ARTIFACT_PATH: 保存路径必须是 Vault 相对路径。');
  }

  const segments = trimmed.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('INVALID_ARTIFACT_PATH: 保存路径不能包含 ../ 或空路径片段。');
  }

  if (segments.some((segment) => segment.startsWith('.'))) {
    throw new Error('INVALID_ARTIFACT_PATH: 保存路径不能写入隐藏目录。');
  }

  if (segments.some((segment) => BLOCKED_SEGMENTS.has(segment))) {
    throw new Error('INVALID_ARTIFACT_PATH: 保存路径不能写入系统目录。');
  }

  const fileName = segments.at(-1) ?? '';
  if (path.posix.extname(fileName).length > 0 && !fileName.toLowerCase().endsWith(MARKDOWN_EXTENSION)) {
    throw new Error('INVALID_ARTIFACT_PATH: Artifact 只能保存为 .md 文件。');
  }
  const safeName = `${sanitizeFileStem(fileName.replace(/\.md$/i, ''))}${MARKDOWN_EXTENSION}`;
  const normalized = [...segments.slice(0, -1), safeName].join('/');

  if (!normalized.toLowerCase().endsWith(MARKDOWN_EXTENSION)) {
    throw new Error('INVALID_ARTIFACT_PATH: Artifact 只能保存为 .md 文件。');
  }

  return normalized;
}

async function resolveSafeWritePath(rootPath: string, relativePath: string): Promise<string> {
  const absolutePath = resolveVaultPath(rootPath, relativePath);
  const parentPath = path.dirname(absolutePath);
  await fs.mkdir(parentPath, { recursive: true });
  const realRootPath = await fs.realpath(rootPath);
  const realParentPath = await fs.realpath(parentPath);
  assertPathInsideRoot(realRootPath, realParentPath);

  if (fsSync.existsSync(absolutePath)) {
    const realTargetPath = await fs.realpath(absolutePath);
    assertPathInsideRoot(realRootPath, realTargetPath);
  }

  return absolutePath;
}

async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

function buildEvidenceMarkdown(evidence: readonly EvidenceRef[]): string[] {
  const sourceBacked = evidence.filter((item) => item.kind === 'source-backed');
  const inferred = evidence.filter((item) => item.kind === 'model-inferred');
  const lines = ['## Evidence', '', '### Source-backed'];

  if (sourceBacked.length === 0) {
    lines.push('- None.');
  } else {
    for (const item of sourceBacked) {
      const sourcePath = item.relativePath ?? item.sourceRef?.relativePath ?? 'unknown-source';
      const note = item.note ?? 'Context source';
      lines.push(
        `- \`${sanitizeMarkdownLine(sourcePath)}\` — ${sanitizeMarkdownLine(note)}, confidence: ${item.confidence ?? 'medium'}`,
      );
      if (item.quotePreview) {
        lines.push(`  - quotePreview: ${sanitizeMarkdownLine(item.quotePreview)}`);
      }
    }
  }

  lines.push('', '### Model-inferred');
  if (inferred.length === 0) {
    lines.push('- None.');
  } else {
    for (const item of inferred) {
      lines.push(
        `- ${sanitizeMarkdownLine(item.modelInferredNote ?? item.note ?? '本段为模型综合推断，需人工核验。')}`,
      );
    }
  }

  return lines;
}

function sanitizeArtifactContent(content: string): string {
  return content
    .replace(/sk-[a-zA-Z0-9_-]{12,}/g, '[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9_-]+/g, 'Bearer [REDACTED]')
    .replace(/Authorization:\s*.+/gi, 'Authorization: [REDACTED]')
    .replace(/[A-Za-z]:\\[^\s,;)\]]*/g, '[PATH]');
}

function sanitizeMarkdownLine(value: string): string {
  return sanitizeArtifactContent(value).replace(/\r?\n/g, ' ').trim();
}

function sanitizeFileStem(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .replace(/\.md$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized.length > 0 ? normalized : 'ai-artifact-draft';
}
