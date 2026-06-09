/**
 * LintWorkflow Service — Phase 4-2-E.
 *
 * Report-only lint rules for Vault knowledge quality.
 * No file modification — lint is diagnostic only.
 *
 * Rules:
 * - broken_links: wikilinks pointing to nonexistent files
 * - missing_metadata: missing title/date/tags in frontmatter
 * - duplicate_notes: skeleton (placeholder for similarity check)
 * - orphan_notes: skeleton (notes with no incoming wikilinks)
 * - stale_compiled: skeleton (compiled pages with outdated sources)
 *
 * All local-only. No API Key required. No cloud calls.
 */
import type {
  LintRequest,
  LintResult,
  LintFinding,
  WorkflowError,
  LintRule,
} from '../../src/lib/contracts/workflow.types';

export class LintWorkflow {
  async execute(
    request: LintRequest,
    fileContents?: Map<string, string>,
  ): Promise<LintResult> {
    const startTime = Date.now();
    const findings: LintFinding[] = [];
    const errors: WorkflowError[] = [];
    let totalFiles = 0;

    if (!fileContents || fileContents.size === 0) {
      return {
        status: 'completed',
        totalFiles: 0,
        totalFindings: 0,
        findings: [],
        errors: [],
        warnings: [],
        elapsedMs: Date.now() - startTime,
      };
    }

    totalFiles = fileContents.size;

    // Collect all known file paths for broken_link detection
    const allPaths = new Set<string>(fileContents.keys());

    for (const rule of request.rules) {
      try {
        switch (rule) {
          case 'broken_links':
            findings.push(...this.checkBrokenLinks(fileContents, allPaths));
            break;
          case 'missing_metadata':
            findings.push(...this.checkMissingMetadata(fileContents));
            break;
          case 'duplicate_notes':
            findings.push(...this.checkDuplicateNotes(fileContents));
            break;
          case 'orphan_notes':
            findings.push(...this.checkOrphanNotes(fileContents, allPaths));
            break;
          case 'stale_compiled':
            findings.push(...this.checkStaleCompiled(fileContents));
            break;
        }
      } catch (err) {
        errors.push({
          code: `LINT_${rule.toUpperCase()}_ERROR`,
          message: `Lint rule ${rule} failed: ${String(err)}`,
        });
      }
    }

    return {
      status: 'completed',
      totalFiles,
      totalFindings: findings.length,
      findings,
      errors,
      warnings: [],
      elapsedMs: Date.now() - startTime,
    };
  }

  // ── Rule: broken_links ──────────────────────────

  private checkBrokenLinks(
    fileContents: Map<string, string>,
    allPaths: Set<string>,
  ): LintFinding[] {
    const findings: LintFinding[] = [];
    const wikilinkPattern = /\[\[([^\]|#]+)(?:[^\]])*\]\]/g;

    for (const [filePath, content] of fileContents) {
      let match: RegExpExecArray | null;
      wikilinkPattern.lastIndex = 0;

      while ((match = wikilinkPattern.exec(content)) !== null) {
        const target = match[1].trim();
        // Resolution: try exact path match, with .md extension, or by filename
        const resolved =
          allPaths.has(target) ||
          allPaths.has(target + '.md') ||
          Array.from(allPaths).some((p) => {
            const base = p.split('/').pop() ?? p;
            return p === target || p === target + '.md' || base === target || base === target + '.md';
          });

        if (!resolved) {
          findings.push({
            rule: 'broken_links',
            severity: 'warning',
            relativePath: filePath,
            message: `Broken wikilink: [[${target}]]`,
            suggestion: `Target "${target}" not found in Vault`,
          });
        }
      }
    }

    return findings;
  }

  // ── Rule: missing_metadata ──────────────────────

  private checkMissingMetadata(
    fileContents: Map<string, string>,
  ): LintFinding[] {
    const findings: LintFinding[] = [];
    const requiredFields = ['title', 'date'];

    for (const [filePath, content] of fileContents) {
      const fm = this.extractSimpleFrontmatter(content);

      if (!fm) {
        findings.push({
          rule: 'missing_metadata',
          severity: 'warning',
          relativePath: filePath,
          message: 'No YAML frontmatter found',
          suggestion: 'Add ---\ntitle: ...\ndate: ...\n--- to the top of the file',
        });
        continue;
      }

      for (const field of requiredFields) {
        if (!fm[field]) {
          findings.push({
            rule: 'missing_metadata',
            severity: 'warning',
            relativePath: filePath,
            message: `Missing metadata field: ${field}`,
            suggestion: `Add "${field}" to frontmatter`,
          });
        }
      }
    }

    return findings;
  }

  // ── Rule: duplicate_notes (skeleton) ────────────

  private checkDuplicateNotes(
    _fileContents: Map<string, string>,
  ): LintFinding[] {
    // Skeleton — real similarity check requires embedding comparison (Phase 4-2-F)
    return [];
  }

  // ── Rule: orphan_notes (skeleton) ───────────────

  private checkOrphanNotes(
    fileContents: Map<string, string>,
    allPaths: Set<string>,
  ): LintFinding[] {
    const findings: LintFinding[] = [];
    const wikilinkPattern = /\[\[([^\]|#]+)(?:[^\]])*\]\]/g;

    // For each file, check if any other file links TO it
    for (const [filePath] of fileContents) {
      let hasIncoming = false;
      const baseName = filePath.replace(/\.md$/, '');

      for (const [otherPath, otherContent] of fileContents) {
        if (otherPath === filePath) continue;

        let match: RegExpExecArray | null;
        wikilinkPattern.lastIndex = 0;

        while ((match = wikilinkPattern.exec(otherContent)) !== null) {
          const target = match[1].trim();
          if (target === baseName || target === filePath || target === filePath.replace(/\.md$/, '')) {
            hasIncoming = true;
            break;
          }
        }

        if (hasIncoming) break;
      }

      if (!hasIncoming) {
        findings.push({
          rule: 'orphan_notes',
          severity: 'info',
          relativePath: filePath,
          message: 'No incoming wikilinks from other notes',
          suggestion: 'Consider linking to this note from related content',
        });
      }
    }

    return findings;
  }

  // ── Rule: stale_compiled (skeleton) ─────────────

  private checkStaleCompiled(
    _fileContents: Map<string, string>,
  ): LintFinding[] {
    // Skeleton — requires compiled page tracking (Phase 4-2-G)
    return [];
  }

  // ── Helpers ─────────────────────────────────────

  private extractSimpleFrontmatter(content: string): Record<string, string> | null {
    const trimmed = content.trimStart();
    if (!trimmed.startsWith('---')) return null;

    const endIdx = trimmed.indexOf('---', 3);
    if (endIdx === -1) return null;

    const fmText = trimmed.slice(3, endIdx).trim();
    const result: Record<string, string> = {};
    const lines = fmText.split('\n');

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        let value = line.slice(colonIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        result[key] = value;
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  }
}
