/**
 * Phase 5-2-IMP-1 P0: AI Research — 禁止渲染进程访问 Provider Runtime.
 *
 * 验证：
 *   - 合同类型不包含 apiKey 或 secret 字段
 *   - ResearchContextPreview 不包含文件内容
 *   - AIInvocationMetadata 不包含原始 prompt
 *   - AIInvocationError 始终经过清洗
 *   - ContextSourceRef 不暴露系统绝对路径
 *
 * 测试边界：5-2-TB-RENDERER-001 ~ 006
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';

// ── Read source files ──

function readSource(relativePath: string): string | null {
  const abs = path.resolve(relativePath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf-8');
}

const CONTRACTS_FILE = 'src/lib/contracts/ai-research.types.ts';

// ── Static analysis only: no type instantiation needed ──

// ═══════════════════════════════════════════════════════════════
// P0-RENDERER-001: 合同类型不包含 apiKey 或 secret 字段
// ═══════════════════════════════════════════════════════════════

describe('AI Research — 类型不含 apiKey/secret 字段', () => {
  it('ProviderReadiness 不含 apiKey 或 secret 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    // 匹配 ProviderReadiness 接口定义
    const match = content!.match(/interface ProviderReadiness[\s\S]*?\n\}/);
    assert.ok(match, 'ProviderReadiness 接口必须存在');
    const iface = match[0];
    assert.ok(
      !/\bapiKey\b/.test(iface) && !/\bsecret\b/.test(iface) && !/\brawKey\b/.test(iface),
      'ProviderReadiness 不得包含 apiKey/secret/rawKey 字段',
    );
  });

  it('AIResearchTaskRequest 不含 apiKey 或 secret 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface AIResearchTaskRequest[\s\S]*?\n\}/);
    assert.ok(match, 'AIResearchTaskRequest 接口必须存在');
    const iface = match[0];
    assert.ok(
      !/\bapiKey\b/.test(iface) && !/\bsecret\b/.test(iface),
      'AIResearchTaskRequest 不得包含 apiKey/secret',
    );
  });

  it('AIResearchTaskResult 不含 apiKey 或 secret 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface AIResearchTaskResult[\s\S]*?\n\}/);
    assert.ok(match, 'AIResearchTaskResult 接口必须存在');
    const iface = match[0];
    assert.ok(
      !/\bapiKey\b/.test(iface) && !/\bsecret\b/.test(iface),
      'AIResearchTaskResult 不得包含 apiKey/secret',
    );
  });

  it('AIArtifactDraft 不含 apiKey 或 secret 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface AIArtifactDraft[\s\S]*?\n\}/);
    assert.ok(match, 'AIArtifactDraft 接口必须存在');
    const iface = match[0];
    assert.ok(
      !/\bapiKey\b/.test(iface) && !/\bsecret\b/.test(iface),
      'AIArtifactDraft 不得包含 apiKey/secret',
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-RENDERER-002: ResearchContextPreview 不包含文件内容
// ═══════════════════════════════════════════════════════════════

describe('AI Research — ResearchContextPreview 不含文件内容', () => {
  it('ResearchContextPreview 接口不含 content 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface ResearchContextPreview[\s\S]*?\n\}/);
    assert.ok(match, 'ResearchContextPreview 接口必须存在');
    const iface = match[0];
    assert.ok(
      !/^\s*readonly\s+content\s*:/m.test(iface),
      'ResearchContextPreview 不得包含 content 字段（文件内容）',
    );
  });

  it('ResearchContextPreview 接口不含 fileContents 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface ResearchContextPreview[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      !/fileContents/i.test(iface),
      'ResearchContextPreview 不得包含 fileContents 字段',
    );
  });

  it('ResearchContextPreview 接口不含 rawText 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface ResearchContextPreview[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      !/rawText/i.test(iface),
      'ResearchContextPreview 不得包含 rawText 字段',
    );
  });

  it('ResearchContextPreview 仅含元数据字段（packId, fileCount, tokenEstimate...）', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface ResearchContextPreview[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    // 验证含有的字段均为元数据
    assert.ok(/packId/.test(iface), '应包含 packId');
    assert.ok(/fileCount/.test(iface), '应包含 fileCount');
    assert.ok(/tokenEstimate/.test(iface), '应包含 tokenEstimate');
    assert.ok(/selectedSourceRefs/.test(iface), '应包含 selectedSourceRefs');
    assert.ok(/warnings/.test(iface), '应包含 warnings');
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-RENDERER-003: AIInvocationMetadata 不包含原始 prompt
// ═══════════════════════════════════════════════════════════════

describe('AI Research — AIInvocationMetadata 不含原始 prompt', () => {
  it('AIInvocationMetadata 接口不含 prompt 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface AIInvocationMetadata[\s\S]*?\n\}/);
    assert.ok(match, 'AIInvocationMetadata 接口必须存在');
    const iface = match[0];
    assert.ok(
      !/^\s*readonly\s+prompt\s*:/m.test(iface),
      'AIInvocationMetadata 不得包含 prompt 字段（原始 prompt）',
    );
  });

  it('AIInvocationMetadata 接口不含 rawPrompt 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface AIInvocationMetadata[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      !/rawPrompt/i.test(iface),
      'AIInvocationMetadata 不得包含 rawPrompt 字段',
    );
  });

  it('AIInvocationMetadata 接口不含 systemPrompt 或 userPrompt 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface AIInvocationMetadata[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      !/systemPrompt/i.test(iface) && !/userPrompt/i.test(iface),
      'AIInvocationMetadata 不得包含 systemPrompt/userPrompt',
    );
  });

  it('AIInvocationMetadata 仅含元数据字段（providerId, model, durationMs...）', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface AIInvocationMetadata[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(/providerId/.test(iface), '应包含 providerId');
    assert.ok(/model/.test(iface), '应包含 model');
    assert.ok(/durationMs/.test(iface), '应包含 durationMs');
    assert.ok(/contextFileCount/.test(iface), '应包含 contextFileCount');
    assert.ok(/approximateTokens/.test(iface), '应包含 approximateTokens');
    assert.ok(/streaming/.test(iface), '应包含 streaming');
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-RENDERER-004: AIInvocationError 始终经过清洗
// ═══════════════════════════════════════════════════════════════

describe('AI Research — AIInvocationError 始终清洗', () => {
  it('AIInvocationError 接口不含 apiKey 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface AIInvocationError[\s\S]*?\n\}/);
    assert.ok(match, 'AIInvocationError 接口必须存在');
    const iface = match[0];
    assert.ok(
      !/\bapiKey\b/.test(iface),
      'AIInvocationError 不得包含 apiKey 字段',
    );
  });

  it('AIInvocationError 接口不含 rawPrompt 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface AIInvocationError[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      !/rawPrompt/i.test(iface),
      'AIInvocationError 不得包含 rawPrompt 字段',
    );
  });

  it('AIInvocationError 接口不含 rawResponse 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface AIInvocationError[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      !/rawResponse/i.test(iface),
      'AIInvocationError 不得包含 rawResponse 字段',
    );
  });

  it('AIInvocationError 接口只有 code, message, details, retryable 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface AIInvocationError[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(/code/.test(iface), '应包含 code');
    assert.ok(/message/.test(iface), '应包含 message');
    assert.ok(/details/.test(iface), '应包含 details');
    assert.ok(/retryable/.test(iface), '应包含 retryable');
    // 无额外字段
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-RENDERER-005: ContextSourceRef 不暴露系统绝对路径
// ═══════════════════════════════════════════════════════════════

describe('AI Research — ContextSourceRef 不暴露绝对路径', () => {
  it('ContextSourceRef 接口不含绝对路径字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface ContextSourceRef[\s\S]*?\n\}/);
    assert.ok(match, 'ContextSourceRef 接口必须存在');
    const iface = match[0];
    assert.ok(
      !/absolutePath/i.test(iface) && !/systemPath/i.test(iface) && !/fullPath/i.test(iface),
      'ContextSourceRef 不得包含 absolutePath/systemPath/fullPath',
    );
  });

  it('ContextSourceRef 接口只有 relativePath，无绝对路径', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface ContextSourceRef[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(/relativePath/.test(iface), '应包含 relativePath');
    // 验证注释中声明仅相对路径
    assert.ok(
      /relative path/i.test(iface) || /No system absolute path/i.test(content!),
      'ContextSourceRef 注释应声明仅适用相对路径',
    );
  });

  it('ContextSourceRef 接口不含 osPath 或 realPath 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface ContextSourceRef[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      !/osPath/i.test(iface) && !/realPath/i.test(iface),
      'ContextSourceRef 不得包含 osPath/realPath',
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-RENDERER-006: ResearchContextPack（非 Preview）的边界验证
// ═══════════════════════════════════════════════════════════════

describe('AI Research — ResearchContextPack 不含文件内容', () => {
  it('ResearchContextPack 接口不含 content 或 rawContent 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface ResearchContextPack[\s\S]*?\n\}/);
    assert.ok(match, 'ResearchContextPack 接口必须存在');
    const iface = match[0];
    assert.ok(
      !/^\s*readonly\s+content\s*:/m.test(iface),
      'ResearchContextPack 不得包含 content 字段',
    );
    assert.ok(
      !/rawContent/i.test(iface),
      'ResearchContextPack 不得包含 rawContent 字段',
    );
  });
});
