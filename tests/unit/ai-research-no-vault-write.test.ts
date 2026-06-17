/**
 * Phase 5-2-IMP-1 P0: AI Research — 禁止自动 Vault 写入.
 *
 * 验证：
 *   - AI Research IPC 通道列表不含 vault:write-ai-output
 *   - 合同类型不含 save-to-vault 或 auto-save 方法
 *   - AIArtifactDraft 强制 isDraft: true 和 reviewRequired: true
 *
 * 测试边界：5-2-TB-VAULT-001 ~ 004
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

/** Strip JS/TS comments so static analysis does not flag channel names in comment blocks. */
function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

const CONTRACTS_FILE = 'src/lib/contracts/ai-research.types.ts';
const MAIN_FILE = 'electron/main.ts';
const PRELOAD_FILE = 'electron/preload.ts';

// ── Import type definitions ──

import {
  AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL,
  AI_RESEARCH_BUILD_CONTEXT_PACK_CHANNEL,
  AI_RESEARCH_PREVIEW_CONTEXT_PACK_CHANNEL,
  AI_RESEARCH_CREATE_TASK_DRAFT_CHANNEL,
  AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL,
  AI_RESEARCH_CANCEL_TASK_CHANNEL,
  AI_RESEARCH_GET_TASK_STATUS_CHANNEL,
  AI_RESEARCH_GET_TASK_RESULT_CHANNEL,
  AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL,
  AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL,
} from '../../src/lib/contracts/ai-research.types';

// ═══════════════════════════════════════════════════════════════
// P0-VAULT-001: AI Research 通道不含 vault:write-ai-output
// ═══════════════════════════════════════════════════════════════

describe('AI Research — 禁止 Vault 写入通道', () => {
  it('所有白名单通道不含 "vault:" 前缀', () => {
    const allChannels = [
      AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL,
      AI_RESEARCH_BUILD_CONTEXT_PACK_CHANNEL,
      AI_RESEARCH_PREVIEW_CONTEXT_PACK_CHANNEL,
      AI_RESEARCH_CREATE_TASK_DRAFT_CHANNEL,
      AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL,
      AI_RESEARCH_CANCEL_TASK_CHANNEL,
      AI_RESEARCH_GET_TASK_STATUS_CHANNEL,
      AI_RESEARCH_GET_TASK_RESULT_CHANNEL,
      AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL,
      AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL,
    ];
    for (const ch of allChannels) {
      assert.ok(
        !ch.startsWith('vault:'),
        `通道 "${ch}" 不得以 "vault:" 开头`,
      );
    }
  });

  it('ai-research.types.ts 不含 "vault:write-ai-output" 字面量', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content, 'ai-research.types.ts 必须存在');
    // Strip comments: forbidden channel names are listed in a comment block
    const stripped = stripComments(content!);
    assert.ok(
      !stripped.includes('vault:write-ai-output'),
      'ai-research.types.ts 不得含 vault:write-ai-output 通道',
    );
  });

  it('ai-research.types.ts 不含 "vault:write" 字面量', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const stripped = stripComments(content!);
    assert.ok(
      !/['"]vault:write/.test(stripped),
      'ai-research.types.ts 不得含任何 vault:write 通道',
    );
  });

  it('electron/main.ts 不含 "vault:write-ai-output" 注册', () => {
    const content = readSource(MAIN_FILE);
    if (content) {
      assert.ok(
        !content.includes('vault:write-ai-output'),
        'main.ts 不得注册 vault:write-ai-output',
      );
    }
  });

  it('electron/preload.ts 不含 "vault:write-ai-output" 桥接', () => {
    const content = readSource(PRELOAD_FILE);
    if (content) {
      assert.ok(
        !content.includes('vault:write-ai-output'),
        'preload.ts 不得桥接 vault:write-ai-output',
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-VAULT-002: 合同类型不含 save-to-vault 或 auto-save 方法
// ═══════════════════════════════════════════════════════════════

describe('AI Research — 合同类型不含自动保存方法', () => {
  it('ScholaAIResearchApi 不含 saveToVault 方法', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface ScholaAIResearchApi[\s\S]*?\n\}/);
    assert.ok(match, 'ScholaAIResearchApi 接口必须存在');
    const apiBody = match[0];
    assert.ok(
      !/saveToVault/i.test(apiBody) && !/save_to_vault/i.test(apiBody),
      'ScholaAIResearchApi 不得包含 saveToVault 方法',
    );
  });

  it('ScholaAIResearchApi 不含 autoSave 方法', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface ScholaAIResearchApi[\s\S]*?\n\}/);
    assert.ok(match);
    const apiBody = match[0];
    assert.ok(
      !/autoSave/i.test(apiBody),
      'ScholaAIResearchApi 不得包含 autoSave 方法',
    );
  });

  it('ScholaAIResearchApi 不含 writeToVault 方法', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface ScholaAIResearchApi[\s\S]*?\n\}/);
    assert.ok(match);
    const apiBody = match[0];
    assert.ok(
      !/writeToVault/i.test(apiBody),
      'ScholaAIResearchApi 不得包含 writeToVault 方法',
    );
  });

  it('ScholaAIResearchApi 不含 generateAndSave 方法', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface ScholaAIResearchApi[\s\S]*?\n\}/);
    assert.ok(match);
    const apiBody = match[0];
    assert.ok(
      !/generateAndSave/i.test(apiBody),
      'ScholaAIResearchApi 不得包含 generateAndSave 方法',
    );
  });

  it('ScholaAIResearchApi 不含 persistArtifact 方法', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface ScholaAIResearchApi[\s\S]*?\n\}/);
    assert.ok(match);
    const apiBody = match[0];
    assert.ok(
      !/persistArtifact/i.test(apiBody),
      'ScholaAIResearchApi 不得包含 persistArtifact 方法',
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-VAULT-003: AIArtifactDraft 强制草稿属性
// ═══════════════════════════════════════════════════════════════

describe('AI Research — AIArtifactDraft 强制草稿属性', () => {
  it('AIArtifactDraft 接口包含 isDraft 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface AIArtifactDraft[\s\S]*?\n\}/);
    assert.ok(match, 'AIArtifactDraft 接口必须存在');
    const iface = match[0];
    assert.ok(
      /isDraft/.test(iface),
      'AIArtifactDraft 应包含 isDraft 字段',
    );
  });

  it('AIArtifactDraft.isDraft 类型为 true 字面量类型（非 boolean）', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface AIArtifactDraft[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    // 类型应为 readonly isDraft: true（字面量类型 true）
    assert.ok(
      /isDraft\s*:\s*true/.test(iface),
      'AIArtifactDraft.isDraft 应为 true 字面量类型，非 boolean',
    );
    // 不应是 boolean
    assert.ok(
      !/isDraft\s*:\s*boolean/.test(iface),
      'AIArtifactDraft.isDraft 不得为 boolean 类型',
    );
  });

  it('AIArtifactDraft 接口包含 reviewRequired 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface AIArtifactDraft[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      /reviewRequired/.test(iface),
      'AIArtifactDraft 应包含 reviewRequired 字段',
    );
  });

  it('AIArtifactDraft.reviewRequired 类型为 true 字面量类型（非 boolean）', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface AIArtifactDraft[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    // 类型应为 readonly reviewRequired: true
    assert.ok(
      /reviewRequired\s*:\s*true/.test(iface),
      'AIArtifactDraft.reviewRequired 应为 true 字面量类型，非 boolean',
    );
    assert.ok(
      !/reviewRequired\s*:\s*boolean/.test(iface),
      'AIArtifactDraft.reviewRequired 不得为 boolean 类型',
    );
  });

  it('AIArtifactDraft 的 isDraft 和 reviewRequired 均为 true（安全门）', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface AIArtifactDraft[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    // 两个字段都是 true，强制草稿门
    assert.ok(
      /isDraft\s*:\s*true/.test(iface) && /reviewRequired\s*:\s*true/.test(iface),
      'isDraft 和 reviewRequired 必须均为 true，禁止绕过',
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-VAULT-004: AI 输出不得自动覆盖用户原文
// ═══════════════════════════════════════════════════════════════

describe('AI Research — AI 输出不得自动覆盖用户原文', () => {
  it('ai-research.types.ts 不含 "overwrite" 关键词', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    // 自动覆盖原文为危险行为
    assert.ok(
      !/\boverwrite\b/i.test(content!),
      'ai-research.types.ts 不得包含 overwrite 行为',
    );
  });

  it('ai-research.types.ts 不含 "auto-write" 或 "autoSave" 关键词', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    assert.ok(
      !/autoWrite/i.test(content!) && !/autoSave/i.test(content!) && !/auto-write/i.test(content!),
      'ai-research.types.ts 不得包含 auto-write / autoSave',
    );
  });

  it('丢弃 artifact 是唯一的写操作方法', () => {
    // discardArtifact 是唯一与 artifact 持久化相关的操作
    // 但它是丢弃而非保存
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const apiMatch = content!.match(/interface ScholaAIResearchApi[\s\S]*?\n\}/);
    assert.ok(apiMatch);
    const apiBody = apiMatch[0];
    // discardArtifact 存在
    assert.ok(/discardArtifact/.test(apiBody), 'discardArtifact 应存在');
    // saveArtifactDraft 是合法的 fixed-function save 操作
    assert.ok(/saveArtifactDraft/.test(apiBody), 'saveArtifactDraft 应存在（合法 fixed-function）');
    // 但泛型 saveArtifact（不含 Draft 后缀）不得存在
    // 使用 /saveArtifact[^(]*[:(]/ 匹配接口方法声明 "saveArtifact:" 或 "saveArtifact("
    assert.ok(!/saveArtifact\s*[:(]/i.test(apiBody), '不得存在泛型 saveArtifact 方法');
    assert.ok(!/writeArtifact/i.test(apiBody), '不得存在 writeArtifact 方法');
    assert.ok(!/commitArtifact/i.test(apiBody), '不得存在 commitArtifact 方法');
  });
});
