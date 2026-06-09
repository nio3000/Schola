/**
 * AI Skill Preset Registry — Phase 4-1-IMP-7.
 *
 * Defines the contract for official built-in AI Skill Presets.
 * These are static prompt templates / research task recipes, NOT automatic agents.
 * NOT a third-party skill marketplace. NOT a background task runner.
 *
 * Every skill MUST pass Context Confirmation (IMP-6) before use.
 * Every skill output is Artifact / Draft-first — never directly writes to Vault.
 *
 * BYOK only. No API Key access. No real provider calls through the preset layer.
 */

// ── Skill Category ───────────────────────────────────

/** Broad classification of what a skill helps with. */
export type AISkillCategory =
  | 'reading'       // 文献阅读 / 精读
  | 'analysis'      // 数据分析 / 实验分析
  | 'writing'       // 写作辅助
  | 'review'        // 审稿 / 评审
  | 'teaching'      // 教学 / 课件辅助
  | 'methodology';  // 研究方法 / 问题拆解

// ── Required Context ─────────────────────────────────

/** What kind of context files the skill expects from the user. */
export type AISkillRequiredContext =
  | 'selected_notes'      // 用户选择的笔记文件
  | 'selected_papers'     // 用户选择的论文（PDF/Markdown）
  | 'selected_documents'  // 用户选择的任意文档
  | 'user_query_only';    // 仅用户问题，无需文件上下文

/** Declaration of what context the skill needs. */
export interface AISkillContextRequirement {
  /** Type of context expected. */
  readonly type: AISkillRequiredContext;
  /** Minimum number of files (0 for user_query_only). */
  readonly minFiles: number;
  /** Human-readable hint for the user. */
  readonly hint: string;
}

// ── Output Mode ───────────────────────────────────────

/** How the skill produces output. */
export type AISkillOutputMode =
  | 'artifact_draft'   // Artifact-first: output goes to Artifact preview, user saves manually
  | 'inline_response'  // Inline in chat — short-form Q&A style
  | 'structured_draft'; // Structured output (e.g., matrix / outline) in Artifact preview

/** Declaration of output behavior. */
export interface AISkillOutputRequirement {
  /** Output delivery mode. */
  readonly mode: AISkillOutputMode;
  /** Human-readable description of what output looks like. */
  readonly description: string;
}

// ── Privacy Level ─────────────────────────────────────

/** Privacy classification for what the skill may expose to the cloud model. */
export type AISkillPrivacyLevel =
  | 'standard'    // Standard: user-selected files only, standard privacy notice
  | 'sensitive'   // Sensitive: extra warning before sending, suitable for unpublished work
  | 'restricted'; // Restricted: requires explicit user opt-in per use

// ── Skill Preset ──────────────────────────────────────

/** A single official built-in AI Skill Preset (prompt template / recipe). */
export interface AISkillPreset {
  /** Unique skill identifier: schola.skill.<name> */
  readonly skillId: string;
  /** Human-readable title (Chinese). */
  readonly title: string;
  /** Skill category. */
  readonly category: AISkillCategory;
  /** Brief description of what the skill does. */
  readonly description: string;
  /** What context files the skill needs. */
  readonly requiredContext: AISkillContextRequirement;
  /** How the skill delivers output. */
  readonly outputMode: AISkillOutputRequirement;
  /** Privacy classification. */
  readonly privacyLevel: AISkillPrivacyLevel;
  /** Whether this skill is enabled by default. */
  readonly enabledByDefault: boolean;
  /** The prompt template — static text with optional placeholders. */
  readonly promptTemplate: string;
  /** What this skill is designed for and what it explicitly does NOT do. */
  readonly phaseBoundaryNote: string;
  /** Claims this skill must never make. */
  readonly forbiddenClaims: readonly string[];
}

// ── Renderer-Safe Summary ─────────────────────────────

/** Lightweight skill summary for renderer display — no prompt template. */
export interface AISkillSummary {
  /** Unique skill identifier. */
  readonly skillId: string;
  /** Human-readable title. */
  readonly title: string;
  /** Skill category. */
  readonly category: AISkillCategory;
  /** Brief description. */
  readonly description: string;
  /** Context requirement summary. */
  readonly requiredContext: AISkillContextRequirement;
  /** Output mode summary. */
  readonly outputMode: AISkillOutputRequirement;
  /** Privacy level. */
  readonly privacyLevel: AISkillPrivacyLevel;
}

// ── Registry Functions ────────────────────────────────

/**
 * Extract a renderer-safe summary from a full skill preset.
 * Strips the prompt template — renderer only sees metadata.
 */
export function toAISkillSummary(preset: AISkillPreset): AISkillSummary {
  return {
    skillId: preset.skillId,
    title: preset.title,
    category: preset.category,
    description: preset.description,
    requiredContext: preset.requiredContext,
    outputMode: preset.outputMode,
    privacyLevel: preset.privacyLevel,
  };
}

/**
 * Get a skill preset by its ID.
 * @returns The preset or null if not found.
 */
export function getSkillPresetById(
  presets: readonly AISkillPreset[],
  skillId: string,
): AISkillPreset | null {
  return presets.find((p) => p.skillId === skillId) ?? null;
}

/**
 * List all skill presets, optionally filtered by category.
 */
export function listSkillPresets(
  presets: readonly AISkillPreset[],
  category?: AISkillCategory,
): readonly AISkillPreset[] {
  if (!category) return presets;
  return presets.filter((p) => p.category === category);
}

/**
 * List renderer-safe skill summaries, optionally filtered by category.
 */
export function listSkillSummaries(
  presets: readonly AISkillPreset[],
  category?: AISkillCategory,
): readonly AISkillSummary[] {
  return listSkillPresets(presets, category).map(toAISkillSummary);
}
