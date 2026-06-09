/**
 * Phase 5-2-IMP-1 P0: AI Research — API Key 非泄漏测试.
 *
 * 验证：
 *   - 所有 AI Research 合同类型不含 'apiKey'、'secret'、'key' 等可泄漏密钥的字段名
 *   - 覆盖 14 个关键合同类型
 *
 * 测试边界：5-2-TB-KEY-001 ~ 003
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

// ═══════════════════════════════════════════════════════════════
// P0-KEY-001: 合同类型定义不含 apiKey/secret/key 字段
// ═══════════════════════════════════════════════════════════════

describe('AI Research — 合同类型不含密钥字段', () => {
  const TYPES_TO_CHECK = [
    'ResearchContextPack',
    'ResearchContextPreview',
    'AIResearchTaskRequest',
    'AIResearchTaskResult',
    'AIArtifactDraft',
    'AIInvocationMetadata',
    'AIInvocationError',
    'ProviderReadiness',
    'ContextSourceRef',
    'EvidenceRef',
    'AIResearchTaskStatus',
    'InvocationPreflightResult',
    'ContextConfirmationSnapshot',
    'AIResearchWarning',
  ];

  const FORBIDDEN_FIELD_PATTERNS = [
    /\bapiKey\b/i,
    /\bapi_key\b/i,
    /\bsecret\b/i,
    /\brawKey\b/i,
    /\baccessToken\b/i,
    /\bprivateKey\b/i,
    /\bpassword\b/i,
    /\bcredential\b/i,
  ];

  for (const typeName of TYPES_TO_CHECK) {
    it(`接口 ${typeName} 不含 apiKey/secret/key/token/password/credential 字段`, () => {
      const content = readSource(CONTRACTS_FILE);
      assert.ok(content, 'ai-research.types.ts 必须存在');

      const regex = new RegExp(
        `interface ${typeName}[\\s\\S]*?\\n\\}`,
        'm',
      );
      const match = content!.match(regex);
      assert.ok(match, `接口 ${typeName} 必须在 ai-research.types.ts 中存在`);

      const iface = match[0];
      for (const pattern of FORBIDDEN_FIELD_PATTERNS) {
        assert.ok(
          !pattern.test(iface),
          `接口 ${typeName} 不得包含匹配 "${pattern}" 的字段`,
        );
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// P0-KEY-002: ProviderReadiness 的 keyConfigured 仅暴露状态
// ═══════════════════════════════════════════════════════════════

describe('AI Research — ProviderReadiness 密钥状态隔离', () => {
  it('ProviderReadiness 暴露 keyConfigured (boolean) 而非密钥值', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface ProviderReadiness[\s\S]*?\n\}/);
    assert.ok(match, 'ProviderReadiness 接口必须存在');
    const iface = match[0];

    assert.ok(
      /keyConfigured\s*:\s*boolean/.test(iface),
      'ProviderReadiness.keyConfigured 应为 boolean 类型',
    );

    assert.ok(
      !/\bapiKey\b/.test(iface) && !/\bsecret\b/.test(iface) && !/\bkey\s*:\s*string/.test(iface),
      'ProviderReadiness 不得包含字符串类型的 key/secret 字段',
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-KEY-003: 整个 contracts 文件不含密钥泄漏
// ═══════════════════════════════════════════════════════════════

describe('AI Research — 整个 contracts 文件密钥非泄漏', () => {
  it('ai-research.types.ts 不含 apiKey 字段定义', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);

    const fieldPattern = /^\s*readonly\s+apiKey\s*:/m;
    assert.ok(
      !fieldPattern.test(content!),
      'ai-research.types.ts 不得定义 apiKey 字段',
    );
  });

  it('ai-research.types.ts 不含 secret 字段定义', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);

    const fieldPattern = /^\s*readonly\s+secret\s*:/m;
    assert.ok(
      !fieldPattern.test(content!),
      'ai-research.types.ts 不得定义 secret 字段',
    );
  });

  it('ai-research.types.ts 不含 rawKey 字段定义', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);

    const fieldPattern = /^\s*readonly\s+rawKey\s*:/m;
    assert.ok(
      !fieldPattern.test(content!),
      'ai-research.types.ts 不得定义 rawKey 字段',
    );
  });

  it('ai-research.types.ts 不含 accessToken 字段定义', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);

    const fieldPattern = /accessToken\s*:/i;
    assert.ok(
      !fieldPattern.test(content!),
      'ai-research.types.ts 不得定义 accessToken 字段',
    );
  });

  it('ai-research.types.ts 文件头注释声明了密钥非泄漏约定', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    assert.ok(
      /NO apiKey or secret/i.test(content!),
      'ai-research.types.ts 文件头应声明密钥非泄漏约定',
    );
  });
});
