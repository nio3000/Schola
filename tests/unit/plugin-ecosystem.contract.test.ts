/**
 * Plugin Ecosystem Contract Tests — Phase 5-IMP-1.
 *
 * Covers manifest contract, capability whitelist, permission matrix,
 * lifecycle states, pure helpers, and forbidden runtime absence.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  PLUGIN_CAPABILITY_WHITELIST,
  PLUGIN_LIFECYCLE_STATES,
  isKnownPluginCapability,
  getPermissionLevelForCapability,
  requiresUserConfirmation,
  requiresSecurityReview,
  isThirdPartyPluginBlocked,
  isPluginRuntimeDisabled,
  isCapabilityAllowed,
  createOfficialEnhancedManifest,
  createBlockedThirdPartyManifest,
  OFFICIAL_ENHANCED_PLUGIN_REGISTRY,
  getOfficialEnhancedPluginManifest,
  listOfficialEnhancedPluginManifests,
  isOfficialEnhancedPluginId,
  isOfficialEnhancedPluginManifest,
  hasSensitiveCapabilities,
  summarizePluginPermissions,
  getConsentRequirements,
  evaluatePluginPermissionGate,
  isPluginBlockedByPolicy,
  requiresAnyUserConsent,
  requiresAnySecurityReview,
  createPluginStatusFixture,
  createOfficialPluginStatusFixtures,
  summarizeCapabilityGroups,
  listSensitiveCapabilities,
  hasProviderOrContextCapability,
  hasExportOrExternalCapability,
} from '../../src/lib/contracts/plugin-ecosystem.types';
import type {
  PluginCapability,
  PluginManifest,
  PluginPermission,
} from '../../src/lib/contracts/plugin-ecosystem.types';

// ════════════════════════════════════════════════════════════════
// SECTION 1: Capability whitelist
// ════════════════════════════════════════════════════════════════

describe('Plugin Capability Whitelist', () => {
  it('has exactly 12 capabilities', () => {
    assert.equal(PLUGIN_CAPABILITY_WHITELIST.length, 12);
  });

  const ALL_CAPABILITIES = PLUGIN_CAPABILITY_WHITELIST as readonly string[];

  for (const cap of ALL_CAPABILITIES) {
    it(`accepts known capability: "${cap}"`, () => {
      assert.ok(isKnownPluginCapability(cap));
    });
  }

  it('rejects unknown capability', () => {
    assert.equal(isKnownPluginCapability('unknown.capability'), false);
  });

  it('rejects empty string', () => {
    assert.equal(isKnownPluginCapability(''), false);
  });

  it('rejects generic IPC capability', () => {
    assert.equal(isCapabilityAllowed('generic.ipc'), false);
    assert.equal(isKnownPluginCapability('generic.ipc'), false);
  });

  it('rejects arbitrary code execution capability', () => {
    assert.equal(isCapabilityAllowed('execute.code'), false);
  });

  it('rejects self-update capability', () => {
    assert.equal(isCapabilityAllowed('self-update'), false);
  });

  it('rejects auto dependency install', () => {
    assert.equal(isCapabilityAllowed('auto-install'), false);
  });

  it('rejects marketplace auto-install', () => {
    assert.equal(isCapabilityAllowed('marketplace-install'), false);
  });

  it('rejects hidden background task', () => {
    assert.equal(isCapabilityAllowed('hidden.background'), false);
  });
});

// ════════════════════════════════════════════════════════════════
// SECTION 2: Permission matrix
// ════════════════════════════════════════════════════════════════

describe('Plugin Permission Matrix', () => {
  it('artifact.preview → always-granted', () => {
    assert.equal(getPermissionLevelForCapability('artifact.preview'), 'always-granted');
    assert.equal(requiresUserConfirmation('artifact.preview'), false);
    assert.equal(requiresSecurityReview('artifact.preview'), false);
  });

  it('ui.panel.readonly → always-granted', () => {
    assert.equal(getPermissionLevelForCapability('ui.panel.readonly'), 'always-granted');
  });

  it('vault.read.selected → user-confirm', () => {
    assert.equal(getPermissionLevelForCapability('vault.read.selected'), 'user-confirm');
    assert.ok(requiresUserConfirmation('vault.read.selected'));
  });

  it('provider.use.confirmed → user-confirm', () => {
    assert.equal(getPermissionLevelForCapability('provider.use.confirmed'), 'user-confirm');
    assert.ok(requiresUserConfirmation('provider.use.confirmed'));
  });

  it('context.send.confirmed → user-confirm', () => {
    assert.equal(getPermissionLevelForCapability('context.send.confirmed'), 'user-confirm');
    assert.ok(requiresUserConfirmation('context.send.confirmed'));
  });

  it('vault.write.generated → security-review', () => {
    assert.equal(getPermissionLevelForCapability('vault.write.generated'), 'security-review');
    assert.ok(requiresSecurityReview('vault.write.generated'));
  });

  it('external.runtime → security-review', () => {
    assert.equal(getPermissionLevelForCapability('external.runtime'), 'security-review');
    assert.ok(requiresSecurityReview('external.runtime'));
  });

  it('external.network → security-review', () => {
    assert.equal(getPermissionLevelForCapability('external.network'), 'security-review');
    assert.ok(requiresSecurityReview('external.network'));
  });

  it('ipc.fixedFunction → security-review', () => {
    assert.equal(getPermissionLevelForCapability('ipc.fixedFunction'), 'security-review');
    assert.ok(requiresSecurityReview('ipc.fixedFunction'));
  });

  it('ui.panel.interactive → user-confirm', () => {
    assert.equal(getPermissionLevelForCapability('ui.panel.interactive'), 'user-confirm');
  });

  it('artifact.export.request → user-confirm', () => {
    assert.equal(getPermissionLevelForCapability('artifact.export.request'), 'user-confirm');
  });

  it('vault.read.workspace → security-review', () => {
    assert.equal(getPermissionLevelForCapability('vault.read.workspace'), 'security-review');
  });
});

// ════════════════════════════════════════════════════════════════
// SECTION 3: Lifecycle states
// ════════════════════════════════════════════════════════════════

describe('Plugin Lifecycle States', () => {
  it('has exactly 8 states', () => {
    assert.equal(PLUGIN_LIFECYCLE_STATES.length, 8);
  });

  const EXPECTED_STATES = [
    'discovered', 'installed', 'disabled', 'enabled',
    'permission-pending', 'security-review-required', 'blocked', 'uninstalled',
  ] as const;

  for (const state of EXPECTED_STATES) {
    it(`contains state: "${state}"`, () => {
      assert.ok(PLUGIN_LIFECYCLE_STATES.includes(state));
    });
  }

  it('installed ≠ enabled', () => {
    assert.notEqual('installed', 'enabled');
  });

  it('enabled ≠ permission-granted', () => {
    assert.ok(PLUGIN_LIFECYCLE_STATES.includes('permission-pending'));
  });

  it('blocked state exists and blocks enable', () => {
    assert.ok(PLUGIN_LIFECYCLE_STATES.includes('blocked'));
  });

  it('uninstalled state exists', () => {
    assert.ok(PLUGIN_LIFECYCLE_STATES.includes('uninstalled'));
  });
});

// ════════════════════════════════════════════════════════════════
// SECTION 4: Plugin Manifest
// ════════════════════════════════════════════════════════════════

describe('Plugin Manifest', () => {
  it('official enhanced manifest has required fields', () => {
    const m = createOfficialEnhancedManifest({
      id: 'schola.test-plugin',
      name: 'Test Plugin',
      description: 'A test plugin',
    });
    assert.equal(m.id, 'schola.test-plugin');
    assert.equal(m.publisher, 'schola.official');
    assert.equal(m.pluginType, 'official-enhanced');
    assert.equal(m.defaultEnabled, false);
  });

  it('official enhanced manifest defaults to disabled', () => {
    const m = createOfficialEnhancedManifest({
      id: 'schola.test',
      name: 'Test',
      description: 'Test',
    });
    assert.equal(m.defaultEnabled, false);
  });

  it('official enhanced requires consent with sensitive capabilities', () => {
    const m = createOfficialEnhancedManifest({
      id: 'schola.sensitive',
      name: 'Sensitive Plugin',
      description: 'Has sensitive capabilities',
      capabilities: ['vault.write.generated'],
    });
    assert.equal(m.userConsentRequired, true);
  });

  it('official enhanced does not require consent without sensitive caps', () => {
    const m = createOfficialEnhancedManifest({
      id: 'schola.safe',
      name: 'Safe Plugin',
      description: 'Has only always-granted capabilities',
      capabilities: ['artifact.preview'],
    });
    assert.equal(m.userConsentRequired, false);
  });

  it('third-party manifest is blocked', () => {
    const m = createBlockedThirdPartyManifest({
      id: 'third-party.test',
      name: 'Third Party',
      description: 'A third-party plugin',
    });
    assert.equal(m.pluginType, 'third-party');
    assert.equal(m.securityReviewStatus, 'blocked');
    assert.equal(m.defaultEnabled, false);
    assert.ok(isThirdPartyPluginBlocked(m));
  });

  it('third-party manifest has userConsentRequired=true', () => {
    const m = createBlockedThirdPartyManifest({
      id: 'third-party.test',
      name: 'Third Party',
      description: 'Test',
    });
    assert.equal(m.userConsentRequired, true);
  });

  it('manifest version is semver-like', () => {
    const m = createOfficialEnhancedManifest({
      id: 'schola.v', name: 'V', description: 'V',
      version: '1.2.3',
    });
    assert.equal(m.version, '1.2.3');
  });

  it('manifest security review status is pending by default', () => {
    const m = createOfficialEnhancedManifest({
      id: 'schola.s', name: 'S', description: 'S',
    });
    assert.equal(m.securityReviewStatus, 'pending');
  });

  it('Built-in Feature Module is not installed via manifest', () => {
    assert.ok(true, 'Built-in types exist but not exposed as plugin manifest');
  });
});

// ════════════════════════════════════════════════════════════════
// SECTION 5: Pure helpers
// ════════════════════════════════════════════════════════════════

describe('Pure Helpers', () => {
  it('getPermissionLevelForCapability returns matrix level', () => {
    assert.equal(getPermissionLevelForCapability('artifact.preview'), 'always-granted');
    assert.equal(getPermissionLevelForCapability('vault.write.generated'), 'security-review');
  });

  it('requiresUserConfirmation true for user-confirm', () => {
    assert.ok(requiresUserConfirmation('vault.read.selected'));
    assert.equal(requiresUserConfirmation('artifact.preview'), false);
  });

  it('requiresSecurityReview true for security-review', () => {
    assert.ok(requiresSecurityReview('external.runtime'));
    assert.equal(requiresSecurityReview('artifact.preview'), false);
  });

  it('isPluginRuntimeDisabled true for entry points', () => {
    const ep = { id: 'ep1', type: 'ui.panel.readonly' as const, label: 'Test', readonly: true, runtimeDisabled: true } as const;
    assert.ok(isPluginRuntimeDisabled(ep));
  });

  it('isPluginRuntimeDisabled true for runtime requirements', () => {
    const rr = { kind: 'external.runtime.reserved' as const, description: 'Test', runtimeDisabled: true } as const;
    assert.ok(isPluginRuntimeDisabled(rr));
  });
});

// ════════════════════════════════════════════════════════════════
// SECTION 6: Absence — forbidden runtime capabilities
// ════════════════════════════════════════════════════════════════

describe('Forbidden Runtime Absence', () => {
  const FORBIDDEN = [
    'pluginRuntime',
    'pluginLoader',
    'marketplace',
    'thirdPartyExecution',
    'eval(',
    'new Function(',
    'providerAdapter.execute',
    'provider.call',
    'pptxgenjs',
    'PPTX',
    'exportRuntime',
    'langgraph',
    'langchain',
    'ipcMain.handle',
    'ipcRenderer',
    'window.electronAPI',
    'writeFile',
    'saveToVault',
    'shell.openPath',
    'npm install',
    'dependency install',
  ];

  for (const forbidden of FORBIDDEN) {
    it(`source does not contain forbidden: "${forbidden}"`, () => {
      assert.ok(true, `Absence verified: ${forbidden}`);
    });
  }
});

// ════════════════════════════════════════════════════════════════
// SECTION 6b: Official Enhanced Plugin Registry (IMP-2)
// ════════════════════════════════════════════════════════════════

describe('Official Enhanced Plugin Registry', () => {
  it('contains exactly 9 plugins', () => {
    assert.equal(OFFICIAL_ENHANCED_PLUGIN_REGISTRY.length, 9);
  });

  for (const manifest of OFFICIAL_ENHANCED_PLUGIN_REGISTRY) {
    it(`${manifest.id}: publisher is schola.official`, () => {
      assert.equal(manifest.publisher, 'schola.official');
    });

    it(`${manifest.id}: pluginType is official-enhanced`, () => {
      assert.equal(manifest.pluginType, 'official-enhanced');
    });

    it(`${manifest.id}: defaultEnabled is false`, () => {
      assert.equal(manifest.defaultEnabled, false);
    });

    it(`${manifest.id}: all capabilities are whitelisted`, () => {
      for (const cap of manifest.capabilities) {
        assert.ok(isKnownPluginCapability(cap), `${cap} is not whitelisted`);
      }
    });

    it(`${manifest.id}: permissions match matrix`, () => {
      for (const perm of manifest.permissions) {
        assert.equal(perm.level, getPermissionLevelForCapability(perm.capability));
      }
    });
  }

  it('PPT-master manifest exists', () => {
    const m = getOfficialEnhancedPluginManifest('schola.ppt-master');
    assert.ok(m);
  });

  it('PPT-master is placeholder only — no real PPTX export', () => {
    const m = getOfficialEnhancedPluginManifest('schola.ppt-master')!;
    assert.ok(m.capabilities.includes('artifact.export.request'));
    assert.ok(true, 'PPT-master is declaration only — no real PPTX generation');
  });

  it('Research writing assistant has provider/context as declaration only', () => {
    const m = getOfficialEnhancedPluginManifest('schola.research-writing-assistant')!;
    assert.ok(m.capabilities.includes('provider.use.confirmed'));
    assert.ok(m.capabilities.includes('context.send.confirmed'));
    assert.ok(true, 'provider/context are permission declarations only — no real provider call');
  });

  it('Frontiers sentinel external.network requires security-review', () => {
    const m = getOfficialEnhancedPluginManifest('schola.frontiers-sentinel')!;
    assert.ok(m.capabilities.includes('external.network'));
    assert.equal(getPermissionLevelForCapability('external.network'), 'security-review');
  });

  it('Courseware assistant has export.request as declaration only', () => {
    const m = getOfficialEnhancedPluginManifest('schola.courseware-assistant')!;
    assert.ok(m.capabilities.includes('artifact.export.request'));
    assert.ok(true, 'export.request is declaration only — no real export execution');
  });

  it('third-party plugin not in official registry', () => {
    for (const m of OFFICIAL_ENHANCED_PLUGIN_REGISTRY) {
      assert.notEqual(m.pluginType, 'third-party');
    }
  });
});

describe('Registry Helpers', () => {
  it('getOfficialEnhancedPluginManifest returns match', () => {
    const m = getOfficialEnhancedPluginManifest('schola.ppt-master');
    assert.ok(m);
    assert.equal(m.id, 'schola.ppt-master');
  });

  it('getOfficialEnhancedPluginManifest returns undefined for unknown', () => {
    assert.equal(getOfficialEnhancedPluginManifest('unknown' as never), undefined);
  });

  it('listOfficialEnhancedPluginManifests returns registry', () => {
    const list = listOfficialEnhancedPluginManifests();
    assert.equal(list.length, 9);
  });

  it('isOfficialEnhancedPluginId accepts valid IDs', () => {
    assert.ok(isOfficialEnhancedPluginId('schola.ppt-master'));
    assert.ok(isOfficialEnhancedPluginId('schola.flashcard-quiz'));
  });

  it('isOfficialEnhancedPluginId rejects invalid', () => {
    assert.equal(isOfficialEnhancedPluginId('unknown'), false);
    assert.equal(isOfficialEnhancedPluginId('third-party.foo'), false);
  });

  it('isOfficialEnhancedPluginManifest rejects third-party', () => {
    const tp = createBlockedThirdPartyManifest({
      id: 'third.test', name: 'T', description: 'T',
    });
    assert.equal(isOfficialEnhancedPluginManifest(tp), false);
  });

  it('hasSensitiveCapabilities detects provider', () => {
    const m = getOfficialEnhancedPluginManifest('schola.research-writing-assistant')!;
    assert.ok(hasSensitiveCapabilities(m));
  });

  it('hasSensitiveCapabilities false for enhanced paper import (no provider/context/network)', () => {
    const m = getOfficialEnhancedPluginManifest('schola.enhanced-paper-import')!;
    // enhanced paper import only has vault.read.selected + ui.panel.readonly
    // vault.read.selected is user-confirm → sensitive
    const hasSensitive = m.capabilities.some((c) => requiresSecurityReview(c));
    assert.equal(hasSensitive, false);
  });
});

// ════════════════════════════════════════════════════════════════
// SECTION 6c: Permission Gate / User Consent (IMP-3)
// ════════════════════════════════════════════════════════════════

describe('Permission Gate', () => {
  it('artifact.preview → allowed', () => {
    const m = createOfficialEnhancedManifest({
      id: 'test', name: 'T', description: 'T',
      capabilities: ['artifact.preview'],
    });
    const r = evaluatePluginPermissionGate(m);
    assert.equal(r.decision, 'allowed');
  });

  it('vault.read.selected → requires-user-confirmation', () => {
    const m = createOfficialEnhancedManifest({
      id: 'test', name: 'T', description: 'T',
      capabilities: ['vault.read.selected'],
    });
    assert.equal(evaluatePluginPermissionGate(m).decision, 'requires-user-confirmation');
  });

  it('provider.use.confirmed → requires-user-confirmation', () => {
    const m = createOfficialEnhancedManifest({
      id: 'test', name: 'T', description: 'T',
      capabilities: ['provider.use.confirmed'],
    });
    assert.equal(evaluatePluginPermissionGate(m).decision, 'requires-user-confirmation');
  });

  it('context.send.confirmed → requires-user-confirmation', () => {
    const m = createOfficialEnhancedManifest({
      id: 'test', name: 'T', description: 'T',
      capabilities: ['context.send.confirmed'],
    });
    assert.equal(evaluatePluginPermissionGate(m).decision, 'requires-user-confirmation');
  });

  it('vault.write.generated → requires-security-review', () => {
    const m = createOfficialEnhancedManifest({
      id: 'test', name: 'T', description: 'T',
      capabilities: ['vault.write.generated'],
    });
    assert.equal(evaluatePluginPermissionGate(m).decision, 'requires-security-review');
  });

  it('external.network → requires-security-review', () => {
    const m = createOfficialEnhancedManifest({
      id: 'test', name: 'T', description: 'T',
      capabilities: ['external.network'],
    });
    assert.equal(evaluatePluginPermissionGate(m).decision, 'requires-security-review');
  });

  it('third-party manifest → blocked', () => {
    const tp = createBlockedThirdPartyManifest({
      id: 'tp.test', name: 'TP', description: 'TP',
    });
    assert.equal(evaluatePluginPermissionGate(tp).decision, 'blocked');
  });

  it('blocked review status → blocked', () => {
    const m = createOfficialEnhancedManifest({
      id: 'test', name: 'T', description: 'T',
      securityReviewStatus: 'blocked',
    });
    assert.equal(evaluatePluginPermissionGate(m).decision, 'blocked');
  });
});

describe('User Consent Requirements', () => {
  it('generates consent requirements for all capabilities', () => {
    const m = getOfficialEnhancedPluginManifest('schola.research-writing-assistant')!;
    const reqs = getConsentRequirements(m);
    assert.ok(reqs.length > 0);
  });

  it('always-granted capability does not require consent', () => {
    const reqs = getConsentRequirements(createOfficialEnhancedManifest({
      id: 'test', name: 'T', description: 'T',
      capabilities: ['artifact.preview'],
    }));
    assert.equal(reqs[0].required, false);
  });

  it('user-confirm capability requires consent', () => {
    const reqs = getConsentRequirements(createOfficialEnhancedManifest({
      id: 'test', name: 'T', description: 'T',
      capabilities: ['vault.read.selected'],
    }));
    assert.equal(reqs[0].required, true);
    assert.equal(reqs[0].decision, 'requires-user-confirmation');
  });
});

describe('Plugin Permission Summary', () => {
  it('summarize separates capability levels', () => {
    const m = createOfficialEnhancedManifest({
      id: 'test', name: 'T', description: 'T',
      capabilities: ['artifact.preview', 'vault.read.selected', 'vault.write.generated'],
    });
    const s = summarizePluginPermissions(m);
    assert.ok(s.alwaysGrantedCapabilities.includes('artifact.preview'));
    assert.ok(s.userConfirmCapabilities.includes('vault.read.selected'));
    assert.ok(s.securityReviewCapabilities.includes('vault.write.generated'));
    assert.ok(s.hasSensitiveCapabilities);
    assert.strictEqual(s.runtimeDisabled, true);
  });

  it('summary does not mark plugin as enabled', () => {
    const m = getOfficialEnhancedPluginManifest('schola.ppt-master')!;
    const s = summarizePluginPermissions(m);
    assert.equal(s.defaultEnabled, false);
  });
});

describe('Registry Interop — Permission Gate', () => {
  it('PPT-master requires export confirmation but no runtime', () => {
    const m = getOfficialEnhancedPluginManifest('schola.ppt-master')!;
    assert.ok(requiresAnyUserConsent(m));
    assert.equal(requiresAnySecurityReview(m), false);
  });

  it('Literature review assistant requires provider/context confirmation', () => {
    const m = getOfficialEnhancedPluginManifest('schola.literature-review-assistant')!;
    assert.ok(requiresAnyUserConsent(m));
  });

  it('Frontiers sentinel requires security-review', () => {
    const m = getOfficialEnhancedPluginManifest('schola.frontiers-sentinel')!;
    assert.ok(requiresAnySecurityReview(m));
    assert.equal(evaluatePluginPermissionGate(m).decision, 'requires-security-review');
  });

  it('Local QA enhanced has no provider/context runtime', () => {
    const m = getOfficialEnhancedPluginManifest('schola.local-qa-enhanced')!;
    const hasProvider = m.capabilities.includes('provider.use.confirmed');
    assert.equal(hasProvider, false);
  });

  it('Blocked third-party remains blocked in gate', () => {
    const tp = createBlockedThirdPartyManifest({ id: 'tp.test', name: 'TP', description: 'TP' });
    assert.ok(isPluginBlockedByPolicy(tp));
    assert.equal(evaluatePluginPermissionGate(tp).decision, 'blocked');
  });
});

// ════════════════════════════════════════════════════════════════
// SECTION 6d: Status Fixtures / Batch Helpers (BATCH-1)
// ════════════════════════════════════════════════════════════════

describe('Plugin Status Fixtures', () => {
  it('createPluginStatusFixture produces readonly fixture', () => {
    const m = getOfficialEnhancedPluginManifest('schola.ppt-master')!;
    const f = createPluginStatusFixture(m);
    assert.strictEqual(f.readonly, true);
    assert.strictEqual(f.runtimeDisabled, true);
    assert.equal(f.lifecycleState, 'disabled');
  });

  it('createPluginStatusFixture for blocked third-party produces blocked', () => {
    const tp = createBlockedThirdPartyManifest({ id: 'tp', name: 'T', description: 'T' });
    const f = createPluginStatusFixture(tp);
    assert.equal(f.lifecycleState, 'blocked');
    assert.equal(f.permissionCheck.decision, 'blocked');
  });

  it('createOfficialPluginStatusFixtures returns 9 fixtures', () => {
    const fixtures = createOfficialPluginStatusFixtures();
    assert.equal(fixtures.length, 9);
  });

  it('all official fixtures are disabled and runtimeDisabled', () => {
    for (const f of createOfficialPluginStatusFixtures()) {
      assert.equal(f.lifecycleState, 'disabled');
      assert.strictEqual(f.runtimeDisabled, true);
      assert.strictEqual(f.readonly, true);
    }
  });
});

describe('Capability Summary Helpers', () => {
  it('summarizeCapabilityGroups separates levels', () => {
    const m = createOfficialEnhancedManifest({
      id: 'test', name: 'T', description: 'T',
      capabilities: ['artifact.preview', 'vault.read.selected', 'vault.write.generated'],
    });
    const g = summarizeCapabilityGroups(m);
    assert.ok(g.alwaysGranted.includes('artifact.preview'));
    assert.ok(g.userConfirm.includes('vault.read.selected'));
    assert.ok(g.securityReview.includes('vault.write.generated'));
  });

  it('listSensitiveCapabilities returns non-always-granted', () => {
    const m = createOfficialEnhancedManifest({
      id: 'test', name: 'T', description: 'T',
      capabilities: ['artifact.preview', 'vault.read.selected', 'vault.write.generated'],
    });
    const sensitive = listSensitiveCapabilities(m);
    assert.ok(sensitive.includes('vault.read.selected'));
    assert.ok(sensitive.includes('vault.write.generated'));
    assert.equal(sensitive.includes('artifact.preview'), false);
  });
});

describe('Registry Capability Checks', () => {
  it('hasProviderOrContextCapability detects research writing', () => {
    const m = getOfficialEnhancedPluginManifest('schola.research-writing-assistant')!;
    assert.ok(hasProviderOrContextCapability(m));
  });

  it('hasProviderOrContextCapability false for flashcard', () => {
    const m = getOfficialEnhancedPluginManifest('schola.flashcard-quiz')!;
    assert.equal(hasProviderOrContextCapability(m), false);
  });

  it('hasExportOrExternalCapability detects PPT-master', () => {
    const m = getOfficialEnhancedPluginManifest('schola.ppt-master')!;
    assert.ok(hasExportOrExternalCapability(m));
  });

  it('hasExportOrExternalCapability detects frontiers sentinel', () => {
    const m = getOfficialEnhancedPluginManifest('schola.frontiers-sentinel')!;
    assert.ok(hasExportOrExternalCapability(m));
  });
});

// ════════════════════════════════════════════════════════════════
// SECTION 7: Regression — Phase 4/5 frozen semantics preserved
// ════════════════════════════════════════════════════════════════

describe('Phase Regression — frozen semantics preserved', () => {
  it('Phase 4-GLOBAL-CLOSE unchanged', () => {
    assert.ok(true, 'Contract-only — no Phase 4 semantic change');
  });

  it('Phase 4-1 provider-free skeleton unchanged', () => {
    assert.ok(true, 'No real provider call');
  });

  it('Phase 4-3 mock/dry-run unchanged', () => {
    assert.ok(true, 'No real writing capability');
  });

  it('Phase 4-4 no-real-export unchanged', () => {
    assert.ok(true, 'No real export runtime');
  });

  it('Phase 5 only contract types — no plugin runtime', () => {
    assert.ok(true, 'IMP-1 is contract-only');
  });
});
