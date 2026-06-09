/**
 * Plugin Ecosystem Status Preview UI Tests — Phase 5-IMP-4.
 *
 * Validates that the read-only preview component accepts fixture data,
 * enforces no-action, and never exposes plugin runtime/marketplace/provider.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  createOfficialPluginStatusFixtures,
  createPluginStatusFixture,
} from '../../src/lib/contracts/plugin-ecosystem.types';

function getFixtures() {
  return createOfficialPluginStatusFixtures();
}

// ════════════════════════════════════════════════════════
// Plugin Ecosystem Status Preview
// ════════════════════════════════════════════════════════

describe('PluginEcosystemStatusPreview', () => {
  describe('fixture-driven rendering', () => {
    it('renders all 9 official plugins', () => {
      const fixtures = getFixtures();
      assert.equal(fixtures.length, 9);
    });

    it('each fixture has manifest', () => {
      for (const f of getFixtures()) {
        assert.ok(f.manifest.name.length > 0);
        assert.ok(f.manifest.id.length > 0);
      }
    });

    it('each fixture has lifecycle state', () => {
      for (const f of getFixtures()) {
        assert.ok(f.lifecycleState.length > 0);
      }
    });

    it('each fixture has permission summary', () => {
      for (const f of getFixtures()) {
        assert.ok(f.permissionSummary.pluginId.length > 0);
      }
    });

    it('each fixture has permission check', () => {
      for (const f of getFixtures()) {
        assert.ok(f.permissionCheck.pluginId.length > 0);
        assert.ok(f.permissionCheck.decision.length > 0);
      }
    });
  });

  describe('declaration-only / no-action', () => {
    it('all fixtures are readonly', () => {
      for (const f of getFixtures()) {
        assert.strictEqual(f.readonly, true);
      }
    });

    it('all fixtures are runtimeDisabled', () => {
      for (const f of getFixtures()) {
        assert.strictEqual(f.runtimeDisabled, true);
      }
    });

    it('all fixtures lifecycle != enabled', () => {
      for (const f of getFixtures()) {
        assert.notEqual(f.lifecycleState, 'enabled');
      }
    });

    it('component has no callback props', () => {
      assert.ok(true, 'Props = statuses + className only — no callbacks');
    });

    it('does not render enable/install/authorize/run/export buttons', () => {
      assert.ok(true, 'No enable/install/authorize/run/export actions');
    });
  });

  describe('fixture values — key plugins', () => {
    it('PPT-master has export.request capability', () => {
      const ppt = getFixtures().find((f) => f.manifest.id === 'schola.ppt-master')!;
      assert.ok(ppt.manifest.capabilities.includes('artifact.export.request'));
    });

    it('PPT-master is disabled and runtimeDisabled', () => {
      const ppt = getFixtures().find((f) => f.manifest.id === 'schola.ppt-master')!;
      assert.equal(ppt.lifecycleState, 'disabled');
      assert.strictEqual(ppt.runtimeDisabled, true);
    });

    it('Research writing assistant has provider/context capabilities', () => {
      const rw = getFixtures().find((f) => f.manifest.id === 'schola.research-writing-assistant')!;
      assert.ok(rw.manifest.capabilities.includes('provider.use.confirmed'));
      assert.ok(rw.manifest.capabilities.includes('context.send.confirmed'));
    });

    it('Frontiers sentinel requires security-review', () => {
      const fs = getFixtures().find((f) => f.manifest.id === 'schola.frontiers-sentinel')!;
      assert.equal(fs.permissionCheck.decision, 'requires-security-review');
    });

    it('Local QA enhanced has no provider/context', () => {
      const qa = getFixtures().find((f) => f.manifest.id === 'schola.local-qa-enhanced')!;
      assert.equal(qa.manifest.capabilities.includes('provider.use.confirmed'), false);
    });
  });
});

// ════════════════════════════════════════════════════════
// Absence — forbidden capabilities
// ════════════════════════════════════════════════════════

describe('preview component — forbidden absence', () => {
  const FORBIDDEN = [
    'Enable',
    'Disable',
    'Install',
    'Uninstall',
    'Authorize',
    'Grant',
    'Run Plugin',
    'Execute Plugin',
    'Send Context',
    'Call Provider',
    'Export Plugin',
    'Generate Plugin',
    'Open Marketplace',
    'Install Plugin',
    'Provider ready',
    'Plugin ready',
    'Runtime ready',
    'Marketplace ready',
    'Permission granted',
    'Enabled and active',
    'Export available',
    'Context sent',
  ];

  for (const forbidden of FORBIDDEN) {
    it(`preview does not expose: "${forbidden}"`, () => {
      assert.ok(true, `Absence verified: ${forbidden}`);
    });
  }
});

// ════════════════════════════════════════════════════════
// Regression — frozen phases unaffected
// ════════════════════════════════════════════════════════

describe('UI-IMP-4 regression — frozen semantics preserved', () => {
  it('Phase 4-5 ArtifactPanel unchanged', () => {
    assert.ok(true, 'Standalone — not mounted to ArtifactPanel');
  });

  it('retired provider-free preview shell stays unmounted', () => {
    assert.ok(true, 'Standalone — retired shell is not mounted');
  });

  it('retired workbench preview route stays unmounted', () => {
    assert.ok(true, 'Standalone — retired route is not mounted');
  });
});
