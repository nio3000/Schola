/**
 * Feature Flag Service — Phase 4-0-D-5.
 *
 * Centralized feature flag management for official modules.
 * Currently uses DEFAULT_FEATURE_FLAGS (all OFF).
 * Future: read from .schola/config/features.json on app start.
 */
import type { FeatureFlags } from '../../src/lib/contracts/official-feature-module.types';
import { DEFAULT_FEATURE_FLAGS } from '../../src/lib/contracts/official-feature-module.types';

let _flags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };

export function getFeatureFlags(): Readonly<FeatureFlags> {
  return _flags;
}

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return _flags[flag] === true;
}

export function loadFeatureFlags(): void {
  // Phase 4-0-D-5: static defaults. D-5+ or Phase 4-0-E: read from config file.
  _flags = { ...DEFAULT_FEATURE_FLAGS };
}
