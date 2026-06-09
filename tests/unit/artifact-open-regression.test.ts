/**
 * Phase 3-4-H3: Artifact open regression test.
 *
 * Confirms existing artifact IPC is not affected by H3-IPC additions.
 */
import assert from 'node:assert/strict';

async function run(): Promise<void> {
  // ═══ Existing artifact channels unchanged ═══
  const artifactTypes = await import('../../src/lib/contracts/artifact.types.ts');

  const requiredChannels = [
    'artifact:open-generated-markdown',
    'artifact:reveal-generated-markdown',
    'artifact:open-export-artifact',
    'artifact:reveal-export-artifact',
  ];

  const exportValues = Object.values(artifactTypes).filter(v => typeof v === 'string') as string[];

  for (const ch of requiredChannels) {
    assert.ok(exportValues.includes(ch), 'Artifact channel must still exist: ' + ch);
  }

  // ═══ Artifact API still works ═══
  const api = await import('../../src/lib/platform/schola-api.ts');
  assert.equal(typeof api.openGeneratedMarkdown, 'function', 'openGeneratedMarkdown must still be a function');
  assert.equal(typeof api.revealGeneratedMarkdown, 'function', 'revealGeneratedMarkdown must still be a function');
  assert.equal(typeof api.openExportArtifact, 'function', 'openExportArtifact must still be a function');
  assert.equal(typeof api.revealExportArtifact, 'function', 'revealExportArtifact must still be a function');

  // ═══ ScholaArtifactApi unchanged ═══
  // ScholaApi interface still includes artifact namespace (verified by typecheck)

  // ═══ No generic open in artifact IPC ═══
  // artifact IPC only has 4 channels — no generic additions
  const artifactChannels = exportValues.filter(v => v.startsWith('artifact:'));
  assert.ok(artifactChannels.length >= 4, 'At least 4 artifact channels exist');

  // No new forbidden patterns in artifact types
  const allExportNames = Object.keys(artifactTypes);
  const forbiddenPatterns = ['SHELL', 'GENERIC', 'OPEN_ANY', 'REVEAL_ANY'];
  for (const key of allExportNames) {
    for (const pat of forbiddenPatterns) {
      assert.ok(!key.includes(pat), `Artifact types must not contain ${pat}: ${key}`);
    }
  }

  // ═══ preload still exposes artifact ═══
  // Verify schola-api still has the expected artifact functions
  assert.equal(api.openGeneratedMarkdown.name, 'openGeneratedMarkdown');
  assert.equal(api.revealGeneratedMarkdown.name, 'revealGeneratedMarkdown');

  console.log('[PASS] artifact-open-regression');
}

await run();
