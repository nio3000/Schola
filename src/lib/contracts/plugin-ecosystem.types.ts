/**
 * Plugin Ecosystem Contract — Phase 5-IMP-1.
 *
 * Defines the types for the Schola plugin ecosystem:
 * Manifest, Capability whitelist, Permission matrix, Lifecycle states.
 *
 * This is the CONTRACT layer only — no plugin runtime, no loader,
 * no marketplace, no third-party execution, no provider, no IPC.
 *
 * Key invariants:
 * - Built-in Feature Module ≠ plugin install system
 * - Official Enhanced Plugin ≠ third-party plugin
 * - Third-party Plugin = blocked / deferred
 * - Plugin Manager ≠ Marketplace
 * - installed ≠ enabled ≠ permission-granted
 * - Capability whitelist = 12 items, unknown rejected
 * - Permission level = always-granted | user-confirm | security-review
 * - All entry points and runtime requirements = runtimeDisabled
 * - No generic IPC, no arbitrary code, no Vault write default
 * - No PPT-master runtime, no real export, no LangGraph
 */

// ── Plugin Type ──────────────────────────────────────────────

export type PluginType = 'built-in-feature' | 'official-enhanced' | 'third-party';

// ── Plugin Capability (whitelist — 12 items) ──────────────────

export type PluginCapability =
  | 'vault.read.selected'
  | 'vault.read.workspace'
  | 'vault.write.generated'
  | 'artifact.preview'
  | 'artifact.export.request'
  | 'provider.use.confirmed'
  | 'context.send.confirmed'
  | 'ui.panel.readonly'
  | 'ui.panel.interactive'
  | 'external.runtime'
  | 'external.network'
  | 'ipc.fixedFunction';

/** Complete capability whitelist — 12 items only. */
export const PLUGIN_CAPABILITY_WHITELIST: readonly PluginCapability[] = [
  'vault.read.selected',
  'vault.read.workspace',
  'vault.write.generated',
  'artifact.preview',
  'artifact.export.request',
  'provider.use.confirmed',
  'context.send.confirmed',
  'ui.panel.readonly',
  'ui.panel.interactive',
  'external.runtime',
  'external.network',
  'ipc.fixedFunction',
];

/** Forbidden capability patterns that must never appear. */
const FORBIDDEN_CAPABILITY_PATTERNS = [
  'generic.ipc',
  'any',
  'execute',
  'eval',
  'code',
  'background',
  'hidden',
  'self-update',
  'auto-update',
  'install-dependency',
  'npm',
  'auto-install',
  'marketplace-install',
] as const;

// ── Plugin Permission ────────────────────────────────────────

export type PluginPermissionLevel = 'always-granted' | 'user-confirm' | 'security-review';

export interface PluginPermission {
  readonly capability: PluginCapability;
  readonly level: PluginPermissionLevel;
  readonly reason: string;
}

/**
 * Static permission matrix.
 * Maps each capability to its minimum required permission level.
 */
export const PLUGIN_PERMISSION_LEVEL_BY_CAPABILITY = {
  'artifact.preview': 'always-granted',
  'ui.panel.readonly': 'always-granted',
  'vault.read.selected': 'user-confirm',
  'artifact.export.request': 'user-confirm',
  'provider.use.confirmed': 'user-confirm',
  'context.send.confirmed': 'user-confirm',
  'vault.read.workspace': 'security-review',
  'vault.write.generated': 'security-review',
  'ui.panel.interactive': 'user-confirm',
  'external.runtime': 'security-review',
  'external.network': 'security-review',
  'ipc.fixedFunction': 'security-review',
} as const satisfies Record<PluginCapability, PluginPermissionLevel>;

// ── Plugin Security Review ───────────────────────────────────

export type PluginSecurityReviewStatus = 'pending' | 'approved' | 'blocked';

// ── Plugin Lifecycle ─────────────────────────────────────────

export type PluginLifecycleState =
  | 'discovered'
  | 'installed'
  | 'disabled'
  | 'enabled'
  | 'permission-pending'
  | 'security-review-required'
  | 'blocked'
  | 'uninstalled';

/** All valid lifecycle states — 8 items. */
export const PLUGIN_LIFECYCLE_STATES: readonly PluginLifecycleState[] = [
  'discovered',
  'installed',
  'disabled',
  'enabled',
  'permission-pending',
  'security-review-required',
  'blocked',
  'uninstalled',
];

// ── Plugin Entry Point ───────────────────────────────────────

export type PluginEntryPointType = 'ui.panel.readonly' | 'artifact.preview' | 'command.placeholder';

export interface PluginEntryPoint {
  readonly id: string;
  readonly type: PluginEntryPointType;
  readonly label: string;
  readonly readonly: true;
  readonly runtimeDisabled: true;
}

// ── Plugin Runtime Requirement ───────────────────────────────

export interface PluginRuntimeRequirement {
  readonly kind: 'none' | 'external.runtime.reserved';
  readonly description: string;
  readonly runtimeDisabled: true;
}

// ── Plugin Manifest ──────────────────────────────────────────

export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly publisher: 'schola.official';
  readonly pluginType: 'official-enhanced' | 'third-party';
  readonly description: string;
  readonly capabilities: readonly PluginCapability[];
  readonly permissions: readonly PluginPermission[];
  readonly entryPoints: readonly PluginEntryPoint[];
  readonly runtimeRequirements: readonly PluginRuntimeRequirement[];
  readonly supportedScholaVersion: string;
  readonly securityReviewStatus: PluginSecurityReviewStatus;
  readonly defaultEnabled: boolean;
  readonly userConsentRequired: boolean;
}

// ── Pure Helpers ─────────────────────────────────────────────

/** Check whether a given string is a known capability. */
export function isKnownPluginCapability(capability: string): capability is PluginCapability {
  return PLUGIN_CAPABILITY_WHITELIST.includes(capability as PluginCapability);
}

/** Get the minimum permission level for a capability. */
export function getPermissionLevelForCapability(capability: PluginCapability): PluginPermissionLevel {
  return PLUGIN_PERMISSION_LEVEL_BY_CAPABILITY[capability];
}

/** Check whether a capability requires user confirmation. */
export function requiresUserConfirmation(capability: PluginCapability): boolean {
  return getPermissionLevelForCapability(capability) === 'user-confirm';
}

/** Check whether a capability requires security review. */
export function requiresSecurityReview(capability: PluginCapability): boolean {
  return getPermissionLevelForCapability(capability) === 'security-review';
}

/** Third-party plugins are blocked by default. */
export function isThirdPartyPluginBlocked(manifest: PluginManifest): boolean {
  return manifest.pluginType === 'third-party';
}

/** All entry points and runtime requirements are runtime-disabled at IMP-1. */
export function isPluginRuntimeDisabled(entry: PluginEntryPoint | PluginRuntimeRequirement): boolean {
  return entry.runtimeDisabled;
}

/** Validate that a capability is not a forbidden pattern. */
export function isCapabilityAllowed(capability: string): boolean {
  if (!isKnownPluginCapability(capability)) return false;
  const lower = capability.toLowerCase();
  return !FORBIDDEN_CAPABILITY_PATTERNS.some((p) => lower.includes(p));
}

// ── Fixture Helpers ──────────────────────────────────────────

/**
 * Create an official enhanced plugin manifest.
 * Defaults: disabled, runtime-disabled, pending review.
 */
export function createOfficialEnhancedManifest(
  params: Pick<PluginManifest, 'id' | 'name' | 'description'> & Partial<PluginManifest>,
): PluginManifest {
  const capabilities = params.capabilities ?? [];
  const hasSensitive = capabilities.some(
    (c) => requiresUserConfirmation(c) || requiresSecurityReview(c),
  );
  return {
    id: params.id,
    name: params.name,
    version: params.version ?? '0.1.0',
    publisher: 'schola.official',
    pluginType: 'official-enhanced',
    description: params.description,
    capabilities,
    permissions: params.permissions ?? capabilities.map((c) => ({
      capability: c,
      level: getPermissionLevelForCapability(c),
      reason: `Required for ${params.name}`,
    })),
    entryPoints: params.entryPoints ?? [],
    runtimeRequirements: params.runtimeRequirements ?? [],
    supportedScholaVersion: params.supportedScholaVersion ?? '>=0.1.0',
    securityReviewStatus: params.securityReviewStatus ?? 'pending',
    defaultEnabled: params.defaultEnabled ?? false,
    userConsentRequired: params.userConsentRequired ?? hasSensitive,
  };
}

/** Create a blocked third-party plugin manifest (never enabled). */
export function createBlockedThirdPartyManifest(
  params: Pick<PluginManifest, 'id' | 'name' | 'description'> & Partial<PluginManifest>,
): PluginManifest {
  return {
    ...createOfficialEnhancedManifest({ ...params, capabilities: params.capabilities ?? [] }),
    pluginType: 'third-party',
    publisher: 'schola.official',
    securityReviewStatus: 'blocked',
    defaultEnabled: false,
    userConsentRequired: true,
  };
}

// ── Official Enhanced Plugin Registry (IMP-2) ─────────────────

/** Official enhanced plugin identifier — 9 plugins. */
export type OfficialEnhancedPluginId =
  | 'schola.ppt-master'
  | 'schola.enhanced-paper-import'
  | 'schola.literature-review-assistant'
  | 'schola.research-writing-assistant'
  | 'schola.courseware-assistant'
  | 'schola.flashcard-quiz'
  | 'schola.frontiers-sentinel'
  | 'schola.local-qa-enhanced'
  | 'schola.submission-helper';

/** Category of an official enhanced plugin. */
export type OfficialEnhancedPluginCategory =
  | 'artifact-generation'
  | 'paper-ingest'
  | 'research-writing'
  | 'courseware'
  | 'learning-tools'
  | 'knowledge-qa'
  | 'research-monitoring'
  | 'submission-support';

/** Static readonly registry of official enhanced plugins. All default-disabled, runtime-disabled. */
export const OFFICIAL_ENHANCED_PLUGIN_REGISTRY = [
  createOfficialEnhancedManifest({
    id: 'schola.ppt-master',
    name: 'PPT-master',
    description: 'Official enhanced PPT artifact generation plugin (placeholder — runtime disabled)',
    capabilities: ['artifact.preview', 'artifact.export.request', 'ui.panel.readonly'],
    securityReviewStatus: 'pending',
  }),
  createOfficialEnhancedManifest({
    id: 'schola.enhanced-paper-import',
    name: 'Enhanced Paper Import',
    description: 'Enhanced paper import with advanced document parsing (placeholder)',
    capabilities: ['vault.read.selected', 'ui.panel.readonly'],
    securityReviewStatus: 'pending',
  }),
  createOfficialEnhancedManifest({
    id: 'schola.literature-review-assistant',
    name: 'Literature Review Assistant',
    description: 'AI-assisted literature review generation (placeholder — provider not connected)',
    capabilities: ['vault.read.selected', 'context.send.confirmed', 'provider.use.confirmed', 'ui.panel.readonly'],
    securityReviewStatus: 'pending',
  }),
  createOfficialEnhancedManifest({
    id: 'schola.research-writing-assistant',
    name: 'Research Writing Assistant',
    description: 'AI-assisted research writing workflow (placeholder — provider not connected)',
    capabilities: ['vault.read.selected', 'context.send.confirmed', 'provider.use.confirmed', 'artifact.preview', 'ui.panel.readonly'],
    securityReviewStatus: 'pending',
  }),
  createOfficialEnhancedManifest({
    id: 'schola.courseware-assistant',
    name: 'Courseware Assistant',
    description: 'AI-assisted courseware and teaching material generation (placeholder — provider not connected)',
    capabilities: ['vault.read.selected', 'context.send.confirmed', 'provider.use.confirmed', 'artifact.preview', 'artifact.export.request', 'ui.panel.readonly'],
    securityReviewStatus: 'pending',
  }),
  createOfficialEnhancedManifest({
    id: 'schola.flashcard-quiz',
    name: 'Flashcard & Quiz',
    description: 'Automated flashcard and quiz generation from notes (placeholder)',
    capabilities: ['vault.read.selected', 'artifact.preview', 'ui.panel.readonly'],
    securityReviewStatus: 'pending',
  }),
  createOfficialEnhancedManifest({
    id: 'schola.frontiers-sentinel',
    name: 'Frontiers Sentinel',
    description: 'Research frontier monitoring (placeholder — external.network requires security review)',
    capabilities: ['external.network', 'ui.panel.readonly'],
    securityReviewStatus: 'pending',
  }),
  createOfficialEnhancedManifest({
    id: 'schola.local-qa-enhanced',
    name: 'Local QA Enhanced',
    description: 'Enhanced local knowledge base Q&A (placeholder — RAG not connected)',
    capabilities: ['vault.read.selected', 'ui.panel.readonly'],
    securityReviewStatus: 'pending',
  }),
  createOfficialEnhancedManifest({
    id: 'schola.submission-helper',
    name: 'Submission Helper',
    description: 'Journal submission materials assistant (placeholder — no auto-submission)',
    capabilities: ['vault.read.selected', 'artifact.preview', 'ui.panel.readonly'],
    securityReviewStatus: 'pending',
  }),
] as const;

/** All valid official enhanced plugin IDs — 9 items. */
export const OFFICIAL_ENHANCED_PLUGIN_IDS: readonly OfficialEnhancedPluginId[] = [
  'schola.ppt-master',
  'schola.enhanced-paper-import',
  'schola.literature-review-assistant',
  'schola.research-writing-assistant',
  'schola.courseware-assistant',
  'schola.flashcard-quiz',
  'schola.frontiers-sentinel',
  'schola.local-qa-enhanced',
  'schola.submission-helper',
];

// ── Registry Helpers ──────────────────────────────────────────

/** Get the manifest for a given official enhanced plugin ID. */
export function getOfficialEnhancedPluginManifest(
  id: OfficialEnhancedPluginId,
): PluginManifest | undefined {
  return OFFICIAL_ENHANCED_PLUGIN_REGISTRY.find((m) => m.id === id);
}

/** List all official enhanced plugin manifests. */
export function listOfficialEnhancedPluginManifests(): readonly PluginManifest[] {
  return OFFICIAL_ENHANCED_PLUGIN_REGISTRY;
}

/** Type guard for official enhanced plugin IDs. */
export function isOfficialEnhancedPluginId(id: string): id is OfficialEnhancedPluginId {
  return (OFFICIAL_ENHANCED_PLUGIN_IDS as readonly string[]).includes(id);
}

/** Check whether a manifest is an official enhanced plugin (not third-party). */
export function isOfficialEnhancedPluginManifest(manifest: PluginManifest): boolean {
  return manifest.pluginType === 'official-enhanced' && manifest.publisher === 'schola.official';
}

/** Check whether a manifest declares sensitive capabilities requiring confirmation/review. */
export function hasSensitiveCapabilities(manifest: PluginManifest): boolean {
  return manifest.capabilities.some(
    (c) => requiresUserConfirmation(c) || requiresSecurityReview(c),
  );
}

// ── Plugin Permission Gate / User Consent (IMP-3) ─────────────

/** Permission gate decision — evaluates whether a plugin is allowed, blocked, or requires consent. */
export type PermissionGateDecision =
  | 'allowed'
  | 'requires-user-confirmation'
  | 'requires-security-review'
  | 'blocked';

/** A single user consent requirement for a capability. */
export interface UserConsentRequirement {
  readonly capability: PluginCapability;
  readonly level: PluginPermissionLevel;
  readonly required: boolean;
  readonly reason: string;
  readonly decision: PermissionGateDecision;
}

/** Summary of a plugin's permission profile. */
export interface PluginPermissionSummary {
  readonly pluginId: string;
  readonly pluginType: PluginType;
  readonly capabilities: readonly PluginCapability[];
  readonly alwaysGrantedCapabilities: readonly PluginCapability[];
  readonly userConfirmCapabilities: readonly PluginCapability[];
  readonly securityReviewCapabilities: readonly PluginCapability[];
  readonly hasSensitiveCapabilities: boolean;
  readonly hasBlockedCapabilities: boolean;
  readonly defaultEnabled: boolean;
  readonly runtimeDisabled: true;
}

/** Result of a permission gate check — contract only, no real authorization. */
export interface PluginPermissionCheckResult {
  readonly pluginId: string;
  readonly decision: PermissionGateDecision;
  readonly requirements: readonly UserConsentRequirement[];
  readonly blockedReasons: readonly string[];
  readonly runtimeDisabled: true;
}

// ── Permission Gate Helpers ────────────────────────────────────

/** Summarize a manifest's capabilities by permission level. */
export function summarizePluginPermissions(manifest: PluginManifest): PluginPermissionSummary {
  const alwaysGranted: PluginCapability[] = [];
  const userConfirm: PluginCapability[] = [];
  const securityReview: PluginCapability[] = [];

  for (const cap of manifest.capabilities) {
    const level = getPermissionLevelForCapability(cap);
    if (level === 'always-granted') alwaysGranted.push(cap);
    else if (level === 'user-confirm') userConfirm.push(cap);
    else securityReview.push(cap);
  }

  return {
    pluginId: manifest.id,
    pluginType: manifest.pluginType,
    capabilities: manifest.capabilities,
    alwaysGrantedCapabilities: alwaysGranted,
    userConfirmCapabilities: userConfirm,
    securityReviewCapabilities: securityReview,
    hasSensitiveCapabilities: userConfirm.length > 0 || securityReview.length > 0,
    hasBlockedCapabilities: manifest.securityReviewStatus === 'blocked' || isThirdPartyPluginBlocked(manifest),
    defaultEnabled: manifest.defaultEnabled,
    runtimeDisabled: true,
  };
}

/** Get user consent requirements for all capabilities in a manifest. */
export function getConsentRequirements(
  manifest: PluginManifest,
): readonly UserConsentRequirement[] {
  return manifest.capabilities.map((cap) => {
    const level = getPermissionLevelForCapability(cap);
    const required = level !== 'always-granted';
    let decision: PermissionGateDecision;
    if (level === 'always-granted') decision = 'allowed';
    else if (level === 'user-confirm') decision = 'requires-user-confirmation';
    else decision = 'requires-security-review';
    return {
      capability: cap,
      level,
      required,
      reason: `Plugin "${manifest.name}" requires ${cap}`,
      decision,
    };
  });
}

/** Evaluate whether a plugin passes the permission gate. */
export function evaluatePluginPermissionGate(
  manifest: PluginManifest,
): PluginPermissionCheckResult {
  const blockedReasons: string[] = [];

  if (isThirdPartyPluginBlocked(manifest)) {
    blockedReasons.push('Third-party plugins are currently blocked');
  }
  if (manifest.securityReviewStatus === 'blocked') {
    blockedReasons.push('Plugin security review status is blocked');
  }

  const requirements = getConsentRequirements(manifest);
  const hasReview = requirements.some((r) => r.decision === 'requires-security-review');
  const hasConfirm = requirements.some((r) => r.decision === 'requires-user-confirmation');

  let decision: PermissionGateDecision;
  if (blockedReasons.length > 0) decision = 'blocked';
  else if (hasReview) decision = 'requires-security-review';
  else if (hasConfirm) decision = 'requires-user-confirmation';
  else decision = 'allowed';

  return {
    pluginId: manifest.id,
    decision,
    requirements,
    blockedReasons,
    runtimeDisabled: true,
  };
}

/** Check whether a plugin is blocked by policy (third-party or blocked review). */
export function isPluginBlockedByPolicy(manifest: PluginManifest): boolean {
  return isThirdPartyPluginBlocked(manifest) || manifest.securityReviewStatus === 'blocked';
}

/** Check whether a plugin requires any user consent. */
export function requiresAnyUserConsent(manifest: PluginManifest): boolean {
  return manifest.capabilities.some((c) => requiresUserConfirmation(c));
}

/** Check whether a plugin requires any security review. */
export function requiresAnySecurityReview(manifest: PluginManifest): boolean {
  return manifest.capabilities.some((c) => requiresSecurityReview(c));
}

// ── Plugin Status Fixtures / Batch Helpers (BATCH-1) ──────────

/** Read-only plugin status fixture for UI preview / testing. */
export interface PluginStatusFixture {
  readonly manifest: PluginManifest;
  readonly permissionSummary: PluginPermissionSummary;
  readonly permissionCheck: PluginPermissionCheckResult;
  readonly lifecycleState: PluginLifecycleState;
  readonly readonly: true;
  readonly runtimeDisabled: true;
}

/** Create a plugin status fixture — contract-only, no real enable/install/runtime. */
export function createPluginStatusFixture(
  manifest: PluginManifest,
  lifecycleState?: PluginLifecycleState,
): PluginStatusFixture {
  return {
    manifest,
    permissionSummary: summarizePluginPermissions(manifest),
    permissionCheck: evaluatePluginPermissionGate(manifest),
    lifecycleState: lifecycleState ?? (isPluginBlockedByPolicy(manifest) ? 'blocked' : 'disabled'),
    readonly: true,
    runtimeDisabled: true,
  };
}

/** Create status fixtures for all official enhanced plugins. */
export function createOfficialPluginStatusFixtures(): readonly PluginStatusFixture[] {
  return OFFICIAL_ENHANCED_PLUGIN_REGISTRY.map((m) =>
    createPluginStatusFixture(m, 'disabled'),
  );
}

/** Group capabilities by permission level. */
export function summarizeCapabilityGroups(manifest: PluginManifest): {
  readonly alwaysGranted: readonly PluginCapability[];
  readonly userConfirm: readonly PluginCapability[];
  readonly securityReview: readonly PluginCapability[];
} {
  return {
    alwaysGranted: manifest.capabilities.filter((c) => !requiresUserConfirmation(c) && !requiresSecurityReview(c)),
    userConfirm: manifest.capabilities.filter((c) => requiresUserConfirmation(c)),
    securityReview: manifest.capabilities.filter((c) => requiresSecurityReview(c)),
  };
}

/** List all sensitive (non-always-granted) capabilities. */
export function listSensitiveCapabilities(
  manifest: PluginManifest,
): readonly PluginCapability[] {
  return manifest.capabilities.filter(
    (c) => requiresUserConfirmation(c) || requiresSecurityReview(c),
  );
}

/** Check whether manifest includes provider or context capabilities. */
export function hasProviderOrContextCapability(manifest: PluginManifest): boolean {
  return manifest.capabilities.includes('provider.use.confirmed')
    || manifest.capabilities.includes('context.send.confirmed');
}

/** Check whether manifest includes export or external capabilities. */
export function hasExportOrExternalCapability(manifest: PluginManifest): boolean {
  return manifest.capabilities.includes('artifact.export.request')
    || manifest.capabilities.includes('external.network')
    || manifest.capabilities.includes('external.runtime');
}
