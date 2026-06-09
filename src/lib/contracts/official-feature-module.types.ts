/**
 * Official Feature Module Registry — Phase 4-0-D-5.
 *
 * Defines the minimal contract for Schola official built-in modules.
 * NOT a Plugin Manager. NOT a third-party plugin marketplace.
 * NOT an extension host. NOT a hot-reload system.
 *
 * Official modules are Schola-team-reviewed, built-in, and controlled
 * via feature flags. Third-party plugins belong to Phase 5.
 */

import type { ModuleRuntimeManifest } from './enhanced-runtime.types';

/** Phase of an official feature module. */
export type OfficialModulePhase = 'design' | 'poc' | 'production' | 'frozen';

/** An official built-in feature module. */
export interface OfficialFeatureModule {
  /** Unique module id using Schola namespace: schola.<domain>.<name> */
  readonly id: string;
  /** Human-readable display name (Chinese). */
  readonly displayName: string;
  /** Brief description. */
  readonly description: string;
  /** Module lifecycle phase. */
  readonly phase: OfficialModulePhase;
  /** Feature flag key in FeatureFlags. */
  readonly featureFlag: string;
  /** Whether this module is enabled by default (always false for now). */
  readonly enabledByDefault: boolean;
  /** IDs of required modules (schola.* namespace). */
  readonly requires: readonly string[];
  /** Capability tags. */
  readonly capabilities: readonly string[];
  /**
   * Phase 4-0-E: runtime dependency for enhanced modules.
   * Present when this module needs a managed Python runtime.
   * Absent (undefined) for modules that don't need Python.
   */
  readonly runtimeDependency?: ModuleRuntimeManifest;
}

/**
 * Feature flags — Phase 4-0-D-5.
 *
 * Controls which official modules are enabled.
 * Default all OFF. Read from .schola/config/features.json (future).
 * NOT exposed to renderer via IPC — renderer sees aggregated productModes.
 */
export interface FeatureFlags {
  /** Phase 4-0-D-4: enable Marker-based enhanced import. */
  readonly enhancedImportEnabled: boolean;
  /** Phase 4-1: enable AI Workbench. */
  readonly aiWorkbenchEnabled: boolean;
}

/** Default feature flags — all OFF. */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  enhancedImportEnabled: false,
  aiWorkbenchEnabled: false,
};

/** Official feature module registry. */
export const OFFICIAL_FEATURE_MODULES: readonly OfficialFeatureModule[] = [
  {
    id: 'schola.import.enhanced',
    displayName: '增强导入',
    description: '基于 Marker 外部 runtime 的高质量论文 PDF 导入。需用户自行安装 Python 3.10+ 与 marker-pdf。',
    phase: 'poc',
    featureFlag: 'enhancedImportEnabled',
    enabledByDefault: false,
    requires: ['schola.core.import'],
    capabilities: ['import.pdf.highfidelity', 'formula-extraction', 'figure-extraction'],
    runtimeDependency: {
      moduleId: 'schola.import.enhanced',
      pythonVersion: '>=3.10',
      pipPackages: [
        { name: 'marker-pdf', reason: 'PDF to Markdown conversion' },
        { name: 'torch', reason: 'ML inference backend' },
      ],
      models: [
        { name: 'surya_ocr', source: 'huggingface:VikParuchuri/surya_ocr', estimatedSizeMb: 1500, license: 'CC-BY-NC-SA-4.0', required: true },
        { name: 'surya_layout', source: 'huggingface:VikParuchuri/surya_layout', estimatedSizeMb: 800, license: 'CC-BY-NC-SA-4.0', required: true },
      ],
      estimatedDiskMb: 4000,
      licenseSummary: 'marker-pdf: GPL-3.0-or-later. Models: CC-BY-NC-SA-4.0. User-managed external runtime.',
      venvName: 'schola-marker',
    },
  },
  {
    id: 'schola.ai.workbench',
    displayName: 'AI 工作台',
    description: 'Schola AI Workbench — 三列式 AI 辅助界面。支持 BYOK、OpenAI/Anthropic/Ollama。',
    phase: 'design',
    featureFlag: 'aiWorkbenchEnabled',
    enabledByDefault: false,
    requires: [],
    capabilities: ['ai.chat', 'ai.streaming', 'ai.provider.openai', 'ai.provider.anthropic', 'ai.provider.ollama'],
  },
];
