import { dialog } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CreateVaultResult, FileEntry, ImageAsset, VaultInfo } from '../../src/lib/contracts/vault.types';
import { normalizeVaultRoot, resolveVaultPath, toVaultRelativePath, SKIP_SCAN_DIRECTORIES } from '../security/path-guard';

interface RegisteredVault {
  readonly info: VaultInfo;
  readonly rootPath: string;
}

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const RESOURCE_EXTENSIONS = new Set([
  '.pdf', '.html', '.htm', '.docx', '.doc', '.pptx', '.xlsx', '.xls', '.csv', '.txt',
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
]);
const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', ...SKIP_SCAN_DIRECTORIES]);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp']);
const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};
const vaults = new Map<string, RegisteredVault>();
let recentVaults: VaultInfo[] = [];

function createVaultId(rootPath: string): string {
  return Buffer.from(rootPath).toString('base64url');
}

function isMarkdownFile(fileName: string): boolean {
  return MARKDOWN_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function isScannedFile(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return MARKDOWN_EXTENSIONS.has(ext) || RESOURCE_EXTENSIONS.has(ext);
}

function sortFileEntries(entries: FileEntry[]): FileEntry[] {
  return entries.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'directory' ? -1 : 1;
    }

    return left.name.localeCompare(right.name, 'zh-CN');
  });
}

async function countMarkdownFiles(rootPath: string): Promise<number> {
  const entries = await scanDirectory(rootPath, rootPath);
  let count = 0;

  function visit(fileEntries: readonly FileEntry[]): void {
    for (const entry of fileEntries) {
      if (entry.type === 'file') {
        count += 1;
      } else if (entry.children) {
        visit(entry.children);
      }
    }
  }

  visit(entries);
  return count;
}

async function scanDirectory(rootPath: string, directoryPath: string): Promise<FileEntry[]> {
  const directoryEntries = await fs.readdir(directoryPath, { withFileTypes: true });
  const fileEntries: FileEntry[] = [];

  for (const directoryEntry of directoryEntries) {
    if (directoryEntry.name.startsWith('.') || SKIPPED_DIRECTORIES.has(directoryEntry.name)) {
      continue;
    }

    const absolutePath = path.join(directoryPath, directoryEntry.name);
    const relativePath = toVaultRelativePath(rootPath, absolutePath);

    if (directoryEntry.isDirectory()) {
      const children = await scanDirectory(rootPath, absolutePath);

      fileEntries.push({
        id: relativePath,
        name: directoryEntry.name,
        relativePath,
        type: 'directory',
        children,
      });

      continue;
    }

    if (directoryEntry.isFile() && isScannedFile(directoryEntry.name)) {
      const stat = await fs.stat(resolveVaultPath(rootPath, relativePath));
      fileEntries.push({
        id: relativePath,
        name: directoryEntry.name,
        relativePath,
        type: 'file',
        mtime: stat.mtimeMs,
        size: stat.size,
      });
    }
  }

  return sortFileEntries(fileEntries);
}

async function selectVaultRoot(): Promise<string | null> {
  const testVaultPath = process.env.SCHOLA_TEST_VAULT_PATH;

  if (testVaultPath && testVaultPath.trim().length > 0) {
    return normalizeVaultRoot(testVaultPath);
  }

  const result = await dialog.showOpenDialog({
    title: '打开 Schola Vault',
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return normalizeVaultRoot(result.filePaths[0]);
}

async function registerVault(rootPath: string): Promise<VaultInfo> {
  const stat = await fs.stat(rootPath);

  if (!stat.isDirectory()) {
    throw new Error('Selected vault path is not a directory.');
  }

  const id = createVaultId(rootPath);
  const openedAt = Date.now();
  const info: VaultInfo = {
    id,
    name: path.basename(rootPath) || rootPath,
    rootPath,
    // Phase 4-4-B: defer noteCount to scanVault to avoid a full directory scan
    // during registerVault.  scanVault() already walks the full tree and
    // the renderer can compute noteCount from its result.
    noteCount: 0,
    openedAt,
  };

  vaults.set(id, { info, rootPath });
  recentVaults = [info, ...recentVaults.filter((vault) => vault.id !== id)].slice(0, 10);

  return info;
}

export async function openVault(): Promise<VaultInfo | null> {
  const rootPath = await selectVaultRoot();

  if (!rootPath) {
    return null;
  }

  return registerVault(rootPath);
}

export async function openVaultByPath(rawPath: string): Promise<VaultInfo> {
  if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
    throw new Error('INVALID_PATH: rootPath must be a non-empty string.');
  }

  const rootPath = normalizeVaultRoot(rawPath);

  try {
    return registerVault(rootPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('ENOENT') || message.includes('no such file')) {
      throw new Error('PATH_NOT_FOUND: The path does not exist.');
    }

    if (message.includes('not a directory')) {
      throw new Error('NOT_DIRECTORY: The path must be a directory, not a file.');
    }

    throw new Error(`OPEN_VAULT_FAILED: ${message}`);
  }
}

export async function createVault(): Promise<CreateVaultResult> {
  const result = await dialog.showOpenDialog({
    title: '创建 Schola 知识库 — 选择或新建文件夹',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: '在此创建知识库',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, cancelled: true, message: '用户取消了创建。' };
  }

  const rootPath = normalizeVaultRoot(result.filePaths[0]);

  try {
    // Create a welcome Markdown file if the directory is empty of markdown files
    const entries = await fs.readdir(rootPath);
    const hasMarkdown = entries.some((name) => name.endsWith('.md') || name.endsWith('.markdown'));

    if (!hasMarkdown) {
      const welcomePath = path.join(rootPath, '欢迎使用 Schola.md');
      const welcomeContent = [
        '---',
        'title: 欢迎使用 Schola',
        'created: ' + new Date().toISOString().split('T')[0],
        '---',
        '',
        '# 欢迎使用 Schola',
        '',
        'Schola 是一个面向高校科研人员与教育工作者的本地化 Markdown 知识工作平台。',
        '',
        '## 快速开始',
        '',
        '1. 在左侧文件树中创建新的 Markdown 文件',
        '2. 使用 `[[wikilink]]` 语法创建笔记之间的双向链接',
        '3. 在编辑器中撰写内容，右侧预览区实时显示渲染效果',
        '4. 点击左侧 Ribbon 的「图谱」按钮查看知识网络',
        '',
        '## 了解更多',
        '',
        '点击启动页的「打开帮助」按钮查看详细使用说明。',
        '',
        '祝你写作愉快！',
      ].join('\n');
      await fs.writeFile(welcomePath, welcomeContent, 'utf-8');
    }

    const info = await registerVault(rootPath);
    return { ok: true, vault: info };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, message: `CREATE_VAULT_FAILED: ${message}` };
  }
}

export async function scanVault(vaultId: string): Promise<readonly FileEntry[]> {
  const vault = vaults.get(vaultId);

  if (!vault) {
    throw new Error('Vault is not open.');
  }

  return scanDirectory(vault.rootPath, vault.rootPath);
}

export function getRecentVaults(): readonly VaultInfo[] {
  return recentVaults;
}

export function getVaultRootPath(vaultId: string): string {
  const vault = vaults.get(vaultId);

  if (!vault) {
    throw new Error('Vault is not open.');
  }

  return vault.rootPath;
}

export function closeVault(vaultId: string): void {
  vaults.delete(vaultId);
}

async function collectImageAssets(rootPath: string, directoryPath: string): Promise<ImageAsset[]> {
  const directoryEntries = await fs.readdir(directoryPath, { withFileTypes: true });
  const assets: ImageAsset[] = [];

  for (const entry of directoryEntries) {
    if (entry.name.startsWith('.') || SKIPPED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directoryPath, entry.name);
    const relativePath = toVaultRelativePath(rootPath, absolutePath);

    if (entry.isDirectory()) {
      const childAssets = await collectImageAssets(rootPath, absolutePath);
      assets.push(...childAssets);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      assets.push({
        relativePath,
        fileName: entry.name,
        extension: ext,
      });
    }
  }

  return assets;
}

export async function listImageAssets(vaultId: string): Promise<readonly ImageAsset[]> {
  const vault = vaults.get(vaultId);

  if (!vault) {
    throw new Error('Vault is not open.');
  }

  return collectImageAssets(vault.rootPath, vault.rootPath);
}

export async function resolvePreviewAssetUrl(
  vaultId: string,
  noteRelativePath: string,
  assetPath: string,
): Promise<string> {
  if (typeof noteRelativePath !== 'string' || noteRelativePath.trim().length === 0) {
    throw new Error('INVALID_NOTE_PATH: noteRelativePath must be a non-empty string.');
  }

  if (typeof assetPath !== 'string' || assetPath.trim().length === 0) {
    throw new Error('INVALID_ASSET_PATH: assetPath must be a non-empty string.');
  }

  // Reject absolute paths and paths trying to escape
  if (path.isAbsolute(assetPath)) {
    throw new Error('PATH_OUTSIDE_VAULT: Absolute asset paths are not allowed.');
  }

  if (assetPath.includes('..')) {
    // Let resolveVaultPath catch path escapes after normalization
  }

  const rootPath = getVaultRootPath(vaultId);
  const noteDir = path.dirname(noteRelativePath);
  const combinedPath = path.posix.join(noteDir, assetPath);

  let absolutePath: string;

  try {
    absolutePath = resolveVaultPath(rootPath, combinedPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('escapes') || message.includes('absolute')) {
      throw new Error('PATH_OUTSIDE_VAULT: Asset path escapes the vault root.');
    }

    throw new Error(`RESOLVE_ASSET_FAILED: ${message}`);
  }

  const ext = path.extname(absolutePath).toLowerCase();

  if (!IMAGE_EXTENSIONS.has(ext)) {
    throw new Error(`UNSUPPORTED_ASSET_TYPE: '${ext}' is not a supported image format.`);
  }

  try {
    const buffer = await fs.readFile(absolutePath);
    const mime = IMAGE_MIME_TYPES[ext] ?? 'application/octet-stream';
    const base64 = buffer.toString('base64');
    return `data:${mime};base64,${base64}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('ENOENT') || message.includes('no such file')) {
      throw new Error('ASSET_NOT_FOUND: The referenced image file does not exist.');
    }

    throw new Error(`RESOLVE_ASSET_FAILED: ${message}`);
  }
}
