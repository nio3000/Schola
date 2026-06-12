/**
 * Provider Presets Tests — Phase 5-5-IMP-1-BATCH.
 *
 * Verifies provider presets, billing modes, no bundled keys.
 */
import { describe, expect, it } from 'vitest';
import { PROVIDER_PRESETS, getProviderPreset } from '../../src/lib/contracts/provider-preset.types';

describe('Provider Presets', () => {
  it('should include common built-in provider presets', () => {
    expect(PROVIDER_PRESETS.length).toBeGreaterThanOrEqual(7);
  });

  it('should include OpenAI, DeepSeek, OpenRouter, Anthropic, Ollama, and common domestic providers', () => {
    const ids = PROVIDER_PRESETS.map((p) => p.id);
    expect(ids).toContain('openai');
    expect(ids).toContain('deepseek');
    expect(ids).toContain('openrouter');
    expect(ids).toContain('anthropic');
    expect(ids).toContain('ollama');
    expect(ids).toContain('moonshot');
    expect(ids).toContain('zhipu');
    expect(ids).toContain('qwen');
    expect(ids).toContain('mimo');
    expect(ids).toContain('minimax');
    expect(ids).not.toContain('baichuan');
    expect(ids).not.toContain('siliconflow');
  });

  it('should have correct display names', () => {
    const names = PROVIDER_PRESETS.map((p) => p.displayName);
    expect(names).toContain('OpenAI');
    expect(names).toContain('DeepSeek');
    expect(names).toContain('OpenRouter');
    expect(names).toContain('Anthropic');
    expect(names).toContain('Ollama (Local)');
    expect(names).toContain('Kimi / Moonshot');
    expect(names).toContain('Zhipu GLM');
    expect(names).toContain('Qwen');
    expect(names).toContain('Xiaomi MiMo');
    expect(names).toContain('MiniMax');
    expect(names).not.toContain('Baichuan');
  });

  it('should have Ollama as local-free billing mode', () => {
    const ollama = PROVIDER_PRESETS.find((p) => p.id === 'ollama');
    expect(ollama?.billingMode).toBe('local-free');
  });

  it('should have all cloud providers as BYOK', () => {
    const cloudIds = [
      'openai',
      'deepseek',
      'openrouter',
      'anthropic',
      'moonshot',
      'zhipu',
      'qwen',
      'mimo',
      'minimax',
    ];
    for (const id of cloudIds) {
      const preset = PROVIDER_PRESETS.find((p) => p.id === id);
      expect(preset?.billingMode).toBe('byok');
    }
  });

  it('should not have any schola-managed billing mode', () => {
    for (const preset of PROVIDER_PRESETS) {
      expect(preset.billingMode).not.toBe('schola-managed');
    }
  });

  it('should have no empty default models for cloud providers', () => {
    for (const preset of PROVIDER_PRESETS) {
      if (preset.billingMode === 'byok') {
        expect(preset.defaultModel).not.toBe('');
      }
    }
  });

  it('should have correct base URLs', () => {
    const baseUrls: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      deepseek: 'https://api.deepseek.com/v1',
      openrouter: 'https://openrouter.ai/api/v1',
      anthropic: 'https://api.anthropic.com/v1',
      moonshot: 'https://api.moonshot.cn/v1',
      zhipu: 'https://open.bigmodel.cn/api/paas/v4',
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      mimo: 'https://api.mimodou.com/v1',
      minimax: 'https://api.minimax.chat/v1',
      ollama: 'http://localhost:11434/v1',
    };
    for (const preset of PROVIDER_PRESETS) {
      expect(preset.baseURL).toBe(baseUrls[preset.id]);
    }
  });

  it('should not contain bundled secrets', () => {
    for (const preset of PROVIDER_PRESETS) {
      const serialized = JSON.stringify(preset);
      expect(serialized).not.toMatch(/secret|token|password/i);
    }
  });

  it('should not contain hardcoded API keys', () => {
    for (const preset of PROVIDER_PRESETS) {
      const serialized = JSON.stringify(preset);
      // Ensure no realistic API key pattern in descriptions
      expect(serialized).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
    }
  });

  it('should lookup by ID correctly', () => {
    expect(getProviderPreset('openai')?.displayName).toBe('OpenAI');
    expect(getProviderPreset('nonexistent')).toBeUndefined();
  });

  it('should have Ollama authType none', () => {
    const ollama = PROVIDER_PRESETS.find((p) => p.id === 'ollama');
    expect(ollama?.authType).toBe('none');
  });

  it('should have provider kind openai for OpenAI-compatible providers', () => {
    const openaiLike = [
      'openai',
      'deepseek',
      'openrouter',
      'moonshot',
      'zhipu',
      'qwen',
      'mimo',
      'minimax',
    ];
    for (const id of openaiLike) {
      const preset = PROVIDER_PRESETS.find((p) => p.id === id);
      expect(preset?.kind).toBe('openai');
    }
  });
});
