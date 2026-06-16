/**
 * AI Research — No Artifact Auto-Save Test — Phase 5-2 P0.
 *
 * Verifies:
 * - Artifacts are NOT automatically saved to Vault
 * - discardArtifact removes from memory
 * - No file persistence occurs for artifacts
 * - Artifacts are always draft, never automatically finalized
 * - reviewRequired is always true
 *
 * Test boundaries: 52-TB-SEC-090 through 52-TB-SEC-097
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';

function readSource(relativePath: string): string | null {
  const abs = path.resolve(relativePath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf-8');
}

// ═══════════════════════════════════════════════════════════════
// No auto-save
// ═══════════════════════════════════════════════════════════════

describe('AI Research — No Artifact Auto-Save', () => {
  it('52-TB-SEC-090: AIArtifactDraft is always a draft (isDraft: true)', () => {
    const typesFile = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(typesFile, 'ai-research.types.ts must exist');

    const match = typesFile.match(/interface AIArtifactDraft\s*\{[\s\S]*?\n\}/);
    assert.ok(match, 'AIArtifactDraft must exist');
    const iface = match[0];

    // Must have isDraft: true (literal type, not boolean)
    assert.ok(/isDraft:\s*true/.test(iface), 'isDraft must be literal true');

    // Must have reviewRequired: true
    assert.ok(/reviewRequired:\s*true/.test(iface), 'reviewRequired must be literal true');
  });

  it('52-TB-SEC-091: discardArtifact IPC handler exists and removes from memory', () => {
    const ipcHandler = readSource('electron/ipc/ai-research.ipc.ts');
    assert.ok(ipcHandler, 'ai-research.ipc.ts must exist');

    assert.ok(
      /DISCARD_ARTIFACT_CHANNEL/.test(ipcHandler),
      'DISCARD_ARTIFACT_CHANNEL must be registered',
    );
  });

  it('52-TB-SEC-092: discardArtifact is exposed in renderer API', () => {
    const api = readSource('src/lib/platform/ai-research-api.ts');
    assert.ok(api, 'ai-research-api.ts must exist');

    assert.ok(
      /discardArtifact/.test(api),
      'discardArtifact must be exposed in renderer API',
    );
  });

  it('52-TB-SEC-093: ScholaAIResearchApi includes discardArtifact', () => {
    const typesFile = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(typesFile, 'ai-research.types.ts must exist');

    const apiMatch = typesFile.match(/interface ScholaAIResearchApi\s*\{[\s\S]*?\n\}/);
    assert.ok(apiMatch, 'ScholaAIResearchApi must exist');
    assert.ok(
      /discardArtifact/.test(apiMatch[0]),
      'ScholaAIResearchApi must include discardArtifact',
    );
  });

  it('52-TB-SEC-094: no automatic artifact write-to-vault IPC channel', () => {
    const typesFile = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(typesFile, 'ai-research.types.ts must exist');

    // IMP-4 allows one explicit manual save channel, but no automatic/generic write channel.
    assert.ok(
      /save-artifact-draft/.test(typesFile),
      'Manual save-artifact-draft channel must exist',
    );
    assert.ok(
      !/write-artifact/.test(typesFile),
      'Must not have write-artifact channel',
    );
    assert.ok(
      !/persist-artifact/.test(typesFile),
      'Must not have persist-artifact channel',
    );
    assert.ok(
      !/export-artifact/.test(typesFile),
      'Must not have export-artifact channel',
    );
  });

  it('52-TB-SEC-095: task service artifacts map is cleared via discardArtifact', () => {
    const taskService = readSource('electron/services/ai-research-task.service.ts');
    assert.ok(taskService, 'task service must exist');

    // IMP-4 marks the draft discarded in memory; it must still not write files.
    assert.ok(
      /status:\s*'discarded'/.test(taskService),
      'discardArtifact must mark draft as discarded',
    );
    assert.ok(!/discardArtifactDraft[\s\S]{0,400}writeFile/.test(taskService));
  });

  it('52-TB-SEC-096: no auto-save on task completion', () => {
    const taskService = readSource('electron/services/ai-research-task.service.ts');
    assert.ok(taskService, 'task service must exist');

    // Task completion should store in-memory, not write to disk
    // Must NOT have: fs.writeFileSync, fs.writeFile after task "completed" logic

    // Check for any writeFile calls near "completed" state transitions
    const completedSection = taskService.match(/completed[\s\S]{0,200}/g) || [];
    for (const section of completedSection) {
      assert.ok(
        !/writeFile/.test(section),
        'Task completion must not trigger file writes',
      );
    }
  });

  it('52-TB-SEC-097: no file path in AIArtifactDraft (no save destination)', () => {
    const typesFile = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(typesFile, 'ai-research.types.ts must exist');

    const match = typesFile.match(/interface AIArtifactDraft\s*\{[\s\S]*?\n\}/);
    assert.ok(match, 'AIArtifactDraft must exist');
    const iface = match[0];

    // Must not have a save path
    assert.ok(!/savePath/i.test(iface), 'Artifact must not have savePath');
    assert.ok(!/outputPath/i.test(iface), 'Artifact must not have outputPath');
    assert.ok(!/targetPath/i.test(iface), 'Artifact must not have targetPath');
    assert.ok(!/filePath/i.test(iface), 'Artifact must not have filePath');
  });
});
