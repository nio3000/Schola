/**
 * Provider Model Selection Tests — Phase 5-5-IMP-1-BATCH.
 * Tests model aggregation from presets + custom models.
 */
import { describe, it, expect } from 'vitest';
import { PROVIDER_PRESETS, getProviderPreset } from '../../src/lib/contracts/provider-preset.types';
import type { AIModelInfo } from '../../src/lib/contracts/ai-provider.types';

describe('Provider Model Selection', () => {
  function aggregateModels(
    providerId: string,
    customModels?: readonly string[],
  ): readonly AIModelInfo[] {
    const preset = getProviderPreset(providerId);
    if (!preset) return [];
    const models: AIModelInfo[] = [];
    models.push({
      id: 'gpt5.5',
      providerId,
      displayName: 'GPT-5.5',
      contextWindow: 0,
      capabilities: preset ? [...preset.capabilities] : [],
    });

    if (preset?.defaultModel && preset.defaultModel !== 'gpt5.5') {
      models.push({
        id: preset.defaultModel,
        providerId,
        displayName: preset.defaultModel,
        contextWindow: 0,
        capabilities: [...preset.capabilities],
      });
    }

    if (customModels) {
      for (const modelId of customModels) {
        if (models.some((m) => m.id === modelId)) continue;
        models.push({
          id: modelId,
          providerId,
          displayName: modelId,
          contextWindow: 0,
          capabilities: preset ? [...preset.capabilities] : [],
        });
      }
    }

    return models;
  }

  it('should include preset default model', () => {
    const models = aggregateModels('openai');
    expect(models.length).toBeGreaterThanOrEqual(1);
    expect(models[0].id).toBe('gpt5.5');
    expect(models[0].providerId).toBe('openai');
  });

  it('should merge custom models with preset default', () => {
    const models = aggregateModels('openai', ['gpt-4o-mini', 'o3-mini']);
    expect(models.length).toBe(3);
    const ids = models.map((m) => m.id);
    expect(ids).toContain('gpt5.5');
    expect(ids).toContain('gpt-4o-mini');
    expect(ids).toContain('o3-mini');
  });

  it('should not duplicate preset model in custom list', () => {
    const models = aggregateModels('deepseek', ['deepseek-chat', 'deepseek-reasoner']);
    expect(models.length).toBe(3);
  });

  it('should return empty array for unknown provider', () => {
    const models = aggregateModels('unknown-provider');
    expect(models).toEqual([]);
  });

  it('should handle empty customModels', () => {
    const models = aggregateModels('openai', []);
    expect(models.length).toBe(1);
  });

  it('should handle undefined customModels', () => {
    const models = aggregateModels('openai');
    expect(models.length).toBe(1);
  });

  it('ollama preset model is included', () => {
    const models = aggregateModels('ollama');
    expect(models.length).toBeGreaterThanOrEqual(1);
    expect(models.map((model) => model.id)).toContain('llama3.2');
  });

  it('domestic provider preset model is included', () => {
    const models = aggregateModels('moonshot');
    expect(models.length).toBeGreaterThanOrEqual(1);
    expect(models.map((model) => model.id)).toContain('moonshot-v1-8k');
  });

  it('model capabilities inherit from preset', () => {
    const openaiModels = aggregateModels('openai');
    expect(openaiModels[0].capabilities).toContain('chat');

    const ollamaModels = aggregateModels('ollama');
    expect(ollamaModels[0].capabilities).toContain('local');
  });

  it('all providers have default models', () => {
    for (const preset of PROVIDER_PRESETS) {
      const models = aggregateModels(preset.id);
      expect(models.length).toBeGreaterThanOrEqual(1);
      expect(models.map((model) => model.id)).toContain(preset.defaultModel);
    }
  });

  it('gpt5.5 is always available as default manual candidate', () => {
    for (const preset of PROVIDER_PRESETS) {
      const models = aggregateModels(preset.id);
      expect(models[0].id).toBe('gpt5.5');
      expect(models[0].displayName).toBe('GPT-5.5');
    }
  });
});
