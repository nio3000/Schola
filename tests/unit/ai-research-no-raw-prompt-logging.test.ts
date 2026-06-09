/**
 * AI Research — No Raw Prompt Logging Test — Phase 5-2 P0.
 *
 * Verifies:
 * - AIInvocationMetadata does NOT contain raw prompt field
 * - AIResearchTaskResult does NOT contain raw prompt
 * - Error sanitization strips sensitive content
 * - Task request does NOT log full file contents
 * - Invocation metadata is metadata-only (file count, tokens, duration)
 *
 * Test boundaries: 52-TB-SEC-030 through 52-TB-SEC-037
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';

// ── Source analysis ──

function readSource(relativePath: string): string | null {
  const abs = path.resolve(relativePath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf-8');
}

// ═══════════════════════════════════════════════════════════════
// Metadata structure
// ═══════════════════════════════════════════════════════════════

describe('AI Research — No Raw Prompt Logging (Types)', () => {
  it('52-TB-SEC-030: AIInvocationMetadata has NO rawPrompt field', () => {
    const content = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(content, 'ai-research.types.ts must exist');

    const match = content.match(/interface AIInvocationMetadata\s*\{[\s\S]*?\n\}/);
    assert.ok(match, 'AIInvocationMetadata must exist');
    const iface = match[0];

    // Must NOT have raw prompt content
    assert.ok(!/rawPrompt/i.test(iface), 'AIInvocationMetadata must not contain rawPrompt');
    assert.ok(!/prompt\s*[?:]\s*string/.test(iface), 'AIInvocationMetadata must not contain prompt string field');
    assert.ok(!/userMessage/i.test(iface), 'AIInvocationMetadata must not contain userMessage');
    assert.ok(!/systemPrompt/i.test(iface), 'AIInvocationMetadata must not contain systemPrompt');
    assert.ok(!/fullContent/i.test(iface), 'AIInvocationMetadata must not contain fullContent');
  });

  it('52-TB-SEC-031: AIResearchTaskResult does NOT contain raw prompt', () => {
    const content = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(content, 'ai-research.types.ts must exist');

    const match = content.match(/interface AIResearchTaskResult\s*\{[\s\S]*?\n\}/);
    assert.ok(match, 'AIResearchTaskResult must exist');
    const iface = match[0];

    assert.ok(!/rawPrompt/i.test(iface), 'AIResearchTaskResult must not contain rawPrompt');
    assert.ok(!/prompt\s*[?:]\s*string/.test(iface), 'AIResearchTaskResult must not contain prompt field');

    // Must have metadata (which is already verified to be clean)
    assert.ok(/metadata/.test(iface), 'AIResearchTaskResult must have metadata field');
  });

  it('52-TB-SEC-032: AIResearchTaskRequest does NOT contain full file content', () => {
    const content = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(content, 'ai-research.types.ts must exist');

    const match = content.match(/interface AIResearchTaskRequest\s*\{[\s\S]*?\n\}/);
    assert.ok(match, 'AIResearchTaskRequest must exist');
    const iface = match[0];

    assert.ok(!/fileContent/i.test(iface), 'AIResearchTaskRequest must not contain fileContent');
    assert.ok(!/contextContent/i.test(iface), 'AIResearchTaskRequest must not contain contextContent');
    assert.ok(!/rawData/i.test(iface), 'AIResearchTaskRequest must not contain rawData');

    // Must have instruction (user-written, no secrets) and contextPackId (reference, not content)
    assert.ok(/instruction/.test(iface), 'AIResearchTaskRequest must have instruction');
    assert.ok(/contextPackId/.test(iface), 'AIResearchTaskRequest must have contextPackId');
  });

  it('52-TB-SEC-033: ContextPackPreview is renderer-safe (no file content)', () => {
    const content = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(content, 'ai-research.types.ts must exist');

    const match = content.match(/interface ResearchContextPreview\s*\{[\s\S]*?\n\}/);
    assert.ok(match, 'ResearchContextPreview must exist');
    const iface = match[0];

    assert.ok(!/fileContent/i.test(iface), 'ResearchContextPreview must not contain fileContent');
    assert.ok(!/fullContent/i.test(iface), 'ResearchContextPreview must not contain fullContent');
    assert.ok(!/contents\s*[?:]\s*string/i.test(iface), 'ResearchContextPreview must not contain contents string');

    // Must have metadata-only fields
    assert.ok(/fileCount/.test(iface), 'ResearchContextPreview must have fileCount');
    assert.ok(/selectedSourceRefs/.test(iface), 'ResearchContextPreview must have selectedSourceRefs');
  });
});

// ═══════════════════════════════════════════════════════════════
// Gateway and service logging safety
// ═══════════════════════════════════════════════════════════════

describe('AI Research — No Raw Prompt Logging (Services)', () => {
  it('52-TB-SEC-034: provider gateway has NO console.log with prompt content', () => {
    const content = readSource('electron/services/ai-provider-gateway.service.ts');
    assert.ok(content, 'ai-provider-gateway.service.ts must exist');

    // Check there are no console.log calls that could leak prompts
    const logCalls = content.match(/console\.\w+\s*\(/g) || [];
    // console.log calls are already banned by project rules
    assert.ok(
      !logCalls.some((call) => call.startsWith('console.log')),
      'Provider gateway must not use console.log',
    );

    // Must use sanitizeIpcError for error handling
    assert.ok(/sanitizeIpcError/.test(content), 'Provider gateway must use sanitizeIpcError');
  });

  it('52-TB-SEC-035: task service has NO raw prompt in error payloads', () => {
    const content = readSource('electron/services/ai-research-task.service.ts');
    assert.ok(content, 'ai-research-task.service.ts must exist');

    // Should use sanitization
    assert.ok(/sanitizeIpcError/.test(content), 'Task service must use sanitizeIpcError');

    // Must not have console.log
    const logCalls = content.match(/console\.log\s*\(/g) || [];
    assert.equal(logCalls.length, 0, 'Task service must not use console.log');
  });

  it('52-TB-SEC-036: preflight service sanitizes errors', () => {
    const content = readSource('electron/services/ai-research-preflight.service.ts');
    assert.ok(content, 'ai-research-preflight.service.ts must exist');

    // Should use sanitizeIpcError
    assert.ok(/sanitizeIpcError/.test(content), 'Preflight service must use sanitizeIpcError');

    // Preflight error messages should be human-readable, not contain raw data
    assert.ok(!/console\.log/.test(content), 'Preflight must not use console.log');
  });

  it('52-TB-SEC-037: ContextPack service has NO full file content logging', () => {
    const content = readSource('electron/services/ai-research-context.service.ts');
    assert.ok(content, 'ai-research-context.service.ts must exist');

    // Must not use console.log for content
    const logCalls = content.match(/console\.log\s*\(/g) || [];
    assert.equal(logCalls.length, 0, 'Context service must not use console.log');
  });
});
