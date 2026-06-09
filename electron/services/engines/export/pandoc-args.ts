/**
 * Pandoc argument whitelist builder — Phase 3-1-C.
 *
 * Constructs a safe Pandoc CLI argument array from validated
 * PandocOptions.  Every parameter is whitelist-mapped; no raw
 * user args are ever passed to Pandoc.
 *
 * ⚠️  Blacklisted fields (rawArgs, filters, luaFilters, shellEscape,
 *     pdfEngine, dataDir, variables, includeInHeader, includeBeforeBody,
 *     includeAfterBody) are intentionally absent from PandocOptions.
 */

import { resolveVaultPath } from '../../../security/path-guard';
import type { PandocOptions, ExportFormat } from '../../../../src/lib/contracts/export.types';

// ── Types ───────────────────────────────────────

interface PandocArgsInput {
  readonly sourceAbs: string;
  readonly outputAbs: string;
  readonly targetFormat: ExportFormat;
  readonly options: PandocOptions;
}

// ── Resource path validation ────────────────────

/**
 * Validate resourcePaths against the frozen security rules.
 * Returns null on success, or a sanitized error message on failure.
 * Never exposes the offending path in the error message.
 */
export function validateResourcePaths(
  rootPath: string,
  resourcePaths: readonly string[] | undefined,
): string | null {
  if (!resourcePaths || resourcePaths.length === 0) return null;

  for (const rp of resourcePaths) {
    if (typeof rp !== 'string' || rp.trim().length === 0) {
      return 'Resource path must be a non-empty string.';
    }
    // Reject absolute paths
    if (rp.startsWith('/') || rp.match(/^[A-Za-z]:\\/)) {
      return 'Resource path must be a vault-relative path, not absolute.';
    }
    // Reject path traversal
    if (rp.includes('..')) {
      return 'Resource path must not contain path traversal (..).';
    }
    // Validate via resolveVaultPath (throws on escape)
    try {
      resolveVaultPath(rootPath, rp);
    } catch {
      return 'Resource path must be inside the vault.';
    }
  }
  return null;
}

// ── Pandoc format mapping ───────────────────────

function pandocFormat(targetFormat: ExportFormat): string {
  switch (targetFormat) {
    case 'latex': return 'latex';
    case 'pdf': return 'pdf';
    case 'html': return 'html5';
    case 'docx': return 'docx';
  }
}

// ── Main builder ────────────────────────────────

export function buildPandocArgs(rootPath: string, input: PandocArgsInput): string[] {
  const { sourceAbs, outputAbs, targetFormat, options } = input;
  const args: string[] = [];

  // Input / output
  args.push('--from', 'markdown');
  args.push('--to', pandocFormat(targetFormat));
  args.push('--output', outputAbs);
  args.push(sourceAbs);

  // --standalone
  if (options.standalone) {
    args.push('--standalone');
  }

  // --template (only from controlled template directory)
  if (options.templateId) {
    // templateId is validated as a filename inside .schola/export/templates/
    const templatePath = `.schola/export/templates/${options.templateId}`;
    try {
      const absTemplate = resolveVaultPath(rootPath, templatePath);
      args.push('--template', absTemplate);
    } catch {
      // Invalid template path — silently skip (engine should validate earlier)
    }
  }

  // --bibliography (only from controlled bibliography directory)
  if (options.bibliographyId) {
    const bibPath = `.schola/export/bibliography/${options.bibliographyId}`;
    try {
      const absBib = resolveVaultPath(rootPath, bibPath);
      args.push('--bibliography', absBib);
    } catch {
      // skip
    }
  }

  // --csl (only from controlled CSL directory)
  if (options.cslStyleId) {
    const cslPath = `.schola/export/csl/${options.cslStyleId}`;
    try {
      const absCsl = resolveVaultPath(rootPath, cslPath);
      args.push('--csl', absCsl);
    } catch {
      // skip
    }
  }

  // --resource-path (validated before reaching here)
  if (options.resourcePaths && options.resourcePaths.length > 0) {
    const resourceAbsPaths: string[] = [];
    for (const rp of options.resourcePaths) {
      try {
        resourceAbsPaths.push(resolveVaultPath(rootPath, rp));
      } catch {
        // skip invalid — should have been caught by validateResourcePaths
      }
    }
    if (resourceAbsPaths.length > 0) {
      args.push('--resource-path', resourceAbsPaths.join(';'));
    }
  }

  // --metadata (whitelist keys only)
  if (options.metadata) {
    const md = options.metadata;
    if (md.title) args.push('--metadata', 'title=' + md.title);
    if (md.author) args.push('--metadata', 'author=' + md.author);
    if (md.date) args.push('--metadata', 'date=' + md.date);
    if (md.lang) args.push('--metadata', 'lang=' + md.lang);
  }

  return args;
}
