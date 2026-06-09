/**
 * Provider Preset Registry — Phase 4-1-IMP-3.
 *
 * Configuration templates for AI providers.
 * BYOK only. NO built-in API keys. NO built-in credits.
 * Schola Managed Model Service / Billing → Phase 5.
 */
import type { AIProviderKind } from './ai-provider.types';

// ── Types ────────────────────────────────────────────

/** Provider protocol / API compatibility layer. */
export type ProviderProtocol =
  | 'openai-compatible'
  | 'anthropic-compatible'
  | 'ollama';

/** Provider capability tags. */
export type ProviderCapability =
  | 'chat'
  | 'streaming'
  | 'json-mode'
  | 'function-calling'
  | 'vision'
  | 'local';

/** Provider billing / access mode. */
export type ProviderBillingMode =
  | 'byok'           // Bring Your Own Key
  | 'local-free'     // Local model, no key needed
  | 'schola-managed'; // Phase 5 only — NOT in Phase 4-1

/** Provider authentication type. */
export type ProviderAuthType =
  | 'bearer'
  | 'x-api-key'
  | 'none';

/** Provider preset — configuration template, NOT a billing entity. */
export interface ProviderPreset {
  readonly id: string;
  readonly kind: AIProviderKind;
  readonly displayName: string;
  readonly protocol: ProviderProtocol;
  readonly baseURL: string;
  readonly defaultModel: string;
  readonly authType: ProviderAuthType;
  readonly authHeader: string; // HTTP header name for the key
  readonly billingMode: ProviderBillingMode;
  readonly capabilities: readonly ProviderCapability[];
  readonly description: string;
}

// ── Registry ─────────────────────────────────────────

/** Built-in provider presets. BYOK only. No built-in keys. */
export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    id: 'openai',
    kind: 'openai',
    displayName: 'OpenAI',
    protocol: 'openai-compatible',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    authType: 'bearer',
    authHeader: 'Authorization',
    billingMode: 'byok',
    capabilities: ['chat', 'streaming', 'json-mode', 'function-calling', 'vision'],
    description: 'OpenAI GPT-4o, GPT-4o-mini, etc. Requires your own API key from platform.openai.com.',
  },
  {
    id: 'deepseek',
    kind: 'openai',
    displayName: 'DeepSeek',
    protocol: 'openai-compatible',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    authType: 'bearer',
    authHeader: 'Authorization',
    billingMode: 'byok',
    capabilities: ['chat', 'streaming'],
    description: 'DeepSeek V3, R1. Requires your own API key from platform.deepseek.com.',
  },
  {
    id: 'openrouter',
    kind: 'openai',
    displayName: 'OpenRouter',
    protocol: 'openai-compatible',
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o',
    authType: 'bearer',
    authHeader: 'Authorization',
    billingMode: 'byok',
    capabilities: ['chat', 'streaming'],
    description: 'OpenRouter — multi-provider gateway. Requires your own API key from openrouter.ai.',
  },
  {
    id: 'custom-openai',
    kind: 'openai',
    displayName: 'Custom (OpenAI-compatible)',
    protocol: 'openai-compatible',
    baseURL: 'https://your-endpoint/v1',
    defaultModel: '',
    authType: 'bearer',
    authHeader: 'Authorization',
    billingMode: 'byok',
    capabilities: ['chat', 'streaming'],
    description: 'Any OpenAI-compatible endpoint (OneAPI, LiteLLM, local LLM server, etc.).',
  },
  {
    id: 'anthropic',
    kind: 'anthropic',
    displayName: 'Anthropic',
    protocol: 'openai-compatible',
    baseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    authType: 'x-api-key',
    authHeader: 'x-api-key',
    billingMode: 'byok',
    capabilities: ['chat', 'streaming', 'json-mode'],
    description: 'Anthropic Claude — Sonnet, Opus, Haiku. Requires your own API key from console.anthropic.com.',
  },
  {
    id: 'gemini',
    kind: 'openai',
    displayName: 'Gemini',
    protocol: 'openai-compatible',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    authType: 'bearer',
    authHeader: 'Authorization',
    billingMode: 'byok',
    capabilities: ['chat', 'streaming', 'vision'],
    description: 'Google Gemini. Requires your own API key from aistudio.google.com.',
  },
  {
    id: 'ollama',
    kind: 'ollama',
    displayName: 'Ollama (Local)',
    protocol: 'ollama',
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    authType: 'none',
    authHeader: 'Authorization',
    billingMode: 'local-free',
    capabilities: ['chat', 'streaming', 'local'],
    description: 'Local LLM via Ollama. No API key required. Models managed locally.',
  },
];

/** Lookup a provider preset by ID. */
export function getProviderPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find(p => p.id === id);
}
