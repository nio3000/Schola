/**
 * Chunking Strategy Service — Phase 4-2-C.
 *
 * Implements heading-based, paragraph-based, and fixed-window chunking
 * for Markdown files in the Vault.
 *
 * Key invariants:
 * - Deterministic: same input + same options → same output
 * - relativePath-only: no absolute paths in chunk metadata
 * - No API Key / secret: chunk metadata is renderer-safe
 * - No whole-Vault scan: chunks one file at a time
 * - No Vault writes: read-only operation
 *
 * Skeleton — no IPC hooks yet. No real provider calls. BYOK only.
 */
import type {
  Chunk,
  ChunkSource,
  ChunkingOptions,
  ChunkingResult,
} from '../../src/lib/contracts/chunk.types';
import {
  estimateChunkTokens,
  generateChunkId,
  DEFAULT_CHUNKING_OPTIONS,
} from '../../src/lib/contracts/chunk.types';

// ── Public API ────────────────────────────────────────

/**
 * Chunk a single Markdown file according to the given options.
 * Returns a ChunkingResult with all produced chunks and metadata.
 *
 * @param source - Source file reference (relativePath-only).
 * @param content - Full file content as string.
 * @param options - Chunking options (defaults used if omitted).
 */
export function chunkMarkdownFile(
  source: ChunkSource,
  content: string,
  options?: Partial<ChunkingOptions>,
): ChunkingResult {
  const opts = { ...DEFAULT_CHUNKING_OPTIONS, ...options };

  // Extract frontmatter
  const { frontmatter, body } = extractFrontmatter(content);

  // Handle empty file
  if (!body || body.trim().length === 0) {
    return {
      source,
      strategy: opts.strategy,
      chunks: [],
      truncatedChunkCount: 0,
      totalTokens: 0,
      frontmatter,
    };
  }

  let chunks: Chunk[];
  switch (opts.strategy) {
    case 'heading':
      chunks = chunkByHeading(source, body, frontmatter, opts);
      break;
    case 'paragraph':
      chunks = chunkByParagraph(source, body, frontmatter, opts);
      break;
    case 'fixed':
      chunks = chunkFixedWindow(source, body, frontmatter, opts);
      break;
    default:
      // Fallback to heading
      chunks = chunkByHeading(source, body, frontmatter, opts);
  }

  // Post-process: apply token budget truncation
  let truncatedCount = 0;
  const MAX_TOKENS = opts.maxTokensPerChunk;

  for (const chunk of chunks) {
    if (chunk.tokenCount > MAX_TOKENS) {
      // Mark as truncated but don't actually truncate here —
      // actual truncation happens at the caller level when assembling context
      (chunk as { truncated: boolean }).truncated = true;
      truncatedCount++;
    }
  }

  const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

  return {
    source,
    strategy: opts.strategy,
    chunks,
    truncatedChunkCount: truncatedCount,
    totalTokens,
    frontmatter,
  };
}

// ── Heading-based Chunking ─────────────────────────────

/**
 * Split content by Markdown headings (ATX-style: #, ##, ###, etc.).
 * Each heading + its following content becomes a chunk.
 * Accumulates headingPath as we descend through heading levels.
 */
function chunkByHeading(
  source: ChunkSource,
  body: string,
  frontmatter: Record<string, unknown> | null,
  options: ChunkingOptions,
): Chunk[] {
  const chunks: Chunk[] = [];
  const headingPattern = /^(#{1,6})\s+(.+)$/gm;

  // Split body into sections by heading
  const lines = body.split('\n');
  const sections: Array<{ heading: string; level: number; content: string }> = [];
  let currentHeading = '';
  let currentLevel = 0;
  let currentContent: string[] = [];
  const headingStack: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = headingPattern.exec(lines[i]);
    headingPattern.lastIndex = 0; // Reset for next iteration

    if (match) {
      // Save previous section
      if (currentHeading || currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          level: currentLevel,
          content: currentContent.join('\n').trim(),
        });
      }

      currentLevel = match[1].length;
      currentHeading = `${match[1]} ${match[2]}`;
      currentContent = [lines[i]];

      // Update heading stack
      headingStack.length = currentLevel - 1;
      headingStack.push(currentHeading);
    } else {
      currentContent.push(lines[i]);
    }
  }

  // Save last section
  if (currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      level: currentLevel,
      content: currentContent.join('\n').trim(),
    });
  }

  // If no headings found, treat entire body as one chunk
  if (sections.length === 0) {
    const cleanBody = body.trim();
    if (cleanBody.length > 0) {
      chunks.push(createChunk(source, 0, cleanBody, [], options));
    }
    return chunks;
  }

  // Build headingPath for each section and create chunks
  const headingStack2: string[] = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const level = section.level;

    if (level > 0) {
      // Maintain heading stack at correct depth
      if (headingStack2.length >= level) {
        headingStack2.length = level - 1;
      }
      headingStack2.push(section.heading);
    }

    const headingPath = [...headingStack2];
    const text = section.content;

    if (text.trim().length > 0) {
      chunks.push(createChunk(source, i, text, headingPath, options));
    }
  }

  return chunks;
}

// ── Paragraph-based Chunking ───────────────────────────

/**
 * Split content by blank-line-separated paragraphs.
 * Adjacent chunks can overlap by the configured overlap amount.
 * Code blocks (fenced by ```) are kept atomic.
 */
function chunkByParagraph(
  source: ChunkSource,
  body: string,
  frontmatter: Record<string, unknown> | null,
  options: ChunkingOptions,
): Chunk[] {
  const chunks: Chunk[] = [];
  const overlap = options.overlap;

  // Split into paragraph blocks, preserving code fences
  const blocks = splitIntoBlocks(body, options.preserveCodeBlocks);

  // Group blocks into chunks respecting maxTokensPerChunk
  let chunkIndex = 0;
  let currentText = '';
  let blockStart = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const candidate = currentText ? currentText + '\n\n' + block : block;
    const candidateTokens = estimateChunkTokens(candidate);

    if (candidateTokens <= options.maxTokensPerChunk && i < blocks.length - 1) {
      // Accumulate
      currentText = candidate;
    } else {
      // Flush current chunk
      if (currentText.trim().length > 0 || i === blocks.length - 1) {
        const finalText = currentText ? (i === blocks.length - 1 ? candidate : currentText) : block;
        const trimmedText = finalText.trim();

        if (trimmedText.length > 0) {
          // Determine overlap with previous chunk
          let overlapPrev = 0;
          if (overlap > 0 && chunks.length > 0) {
            overlapPrev = Math.min(overlap, trimmedText.length);
          }

          chunks.push({
            ...createChunk(source, chunkIndex, trimmedText, [], options),
            overlapPrev,
            overlapNext: 0, // Will be set in next iteration
          });

          // Update previous chunk's overlapNext
          if (chunks.length > 1 && overlap > 0) {
            const prev = chunks[chunks.length - 2] as { overlapNext: number };
            prev.overlapNext = Math.min(overlap, trimmedText.length);
          }

          chunkIndex++;
        }

        // Start new chunk with current block if we flushed early
        if (i < blocks.length - 1) {
          currentText = block;
        } else {
          currentText = '';
        }
      }
    }
  }

  // Flush remaining
  if (currentText.trim().length > 0) {
    chunks.push({
      ...createChunk(source, chunkIndex, currentText.trim(), [], options),
      overlapPrev: chunks.length > 0 && overlap > 0 ? Math.min(overlap, currentText.length) : 0,
      overlapNext: 0,
    });
  }

  return chunks;
}

// ── Fixed-window Chunking (Skeleton) ───────────────────

/**
 * Fixed-window chunking — splits content into fixed token windows.
 * SKELETON implementation for Phase 4-2-C.
 * Full implementation deferred to Phase 4-2-D when token budget constraints
 * are exercised in RAG context assembly.
 */
function chunkFixedWindow(
  source: ChunkSource,
  body: string,
  frontmatter: Record<string, unknown> | null,
  options: ChunkingOptions,
): Chunk[] {
  const chunks: Chunk[] = [];
  const windowTokens = options.maxTokensPerChunk;
  const overlap = options.overlap;
  const text = body.trim();

  if (text.length === 0) return chunks;

  // Crude character-based window (skeleton — 4 chars ≈ 1 token)
  const charsPerWindow = windowTokens * 4;
  const step = overlap > 0 ? charsPerWindow - Math.floor(overlap / 4) * 4 : charsPerWindow;
  let chunkIndex = 0;
  let pos = 0;

  while (pos < text.length) {
    const end = Math.min(pos + charsPerWindow, text.length);
    const window = text.slice(pos, end).trim();

    if (window.length > 0) {
      chunks.push({
        ...createChunk(source, chunkIndex, window, [], options),
        overlapPrev: pos > 0 ? Math.min(overlap, window.length) : 0,
        overlapNext: end < text.length ? overlap : 0,
      });
      chunkIndex++;
    }

    pos += step;
    if (step <= 0) break; // Safety
  }

  return chunks;
}

// ── Helpers ────────────────────────────────────────────

/**
 * Create a single Chunk object with computed metadata.
 */
function createChunk(
  source: ChunkSource,
  chunkIndex: number,
  content: string,
  headingPath: readonly string[],
  options: ChunkingOptions,
): Chunk {
  return {
    chunkId: generateChunkId(source.relativePath, chunkIndex),
    chunkIndex,
    source,
    content,
    tokenCount: estimateChunkTokens(content),
    byteLength: Buffer.byteLength(content, 'utf8'),
    headingPath,
    strategy: options.strategy,
    overlapPrev: 0,
    overlapNext: 0,
    truncated: false,
  };
}

/**
 * Extract YAML frontmatter from Markdown content.
 * Returns { frontmatter, body }.
 * Frontmatter is between --- delimiters at the very start of the file.
 */
export function extractFrontmatter(content: string): {
  frontmatter: Record<string, unknown> | null;
  body: string;
} {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) {
    return { frontmatter: null, body: content };
  }

  const endIdx = trimmed.indexOf('---', 3);
  if (endIdx === -1) {
    return { frontmatter: null, body: content };
  }

  const fmText = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 3).trimStart();

  // Parse YAML frontmatter (simple key: value parser)
  const frontmatter: Record<string, unknown> = {};
  const lines = fmText.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value: string = line.slice(colonIdx + 1).trim();
      // Unquote if needed
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // Parse arrays [a, b, c]
      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''));
      } else {
        frontmatter[key] = value;
      }
    }
  }

  return { frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : null, body };
}

/**
 * Split text into logical blocks, preserving code fences as atomic units.
 */
function splitIntoBlocks(text: string, preserveCodeBlocks: boolean): string[] {
  if (!preserveCodeBlocks) {
    return text.split(/\n\s*\n/).filter((b) => b.trim().length > 0);
  }

  const blocks: string[] = [];
  const lines = text.split('\n');
  let inFence = false;
  let currentBlock: string[] = [];

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      if (inFence) {
        // End of code block
        currentBlock.push(line);
        inFence = false;
      } else {
        // Start of code block — flush current block first
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join('\n'));
          currentBlock = [];
        }
        currentBlock.push(line);
        inFence = true;
      }
    } else if (!inFence && line.trim() === '') {
      // Blank line outside fence = paragraph break
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
    } else {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }

  return blocks.filter((b) => b.trim().length > 0);
}
