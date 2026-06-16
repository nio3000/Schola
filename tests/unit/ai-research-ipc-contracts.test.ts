/**
 * Phase 5-2-IMP-1 P0: AI Research IPC Contracts Test.
 *
 * 验证 AI Research Workbench 的 IPC 通道契约：
 *   - 所有 10 个白名单通道已定义
 *   - 禁止的通道不存在
 *   - 通道名称遵循 'ai-research:*' 模式
 *   - 不存在通用 'invoke' 通道
 *
 * 测试边界：5-2-TB-IPC-001 ~ 005
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';

// ── Read source files for static analysis ──

function readSource(relativePath: string): string | null {
  const abs = path.resolve(relativePath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf-8');
}

/** Strip JS/TS comments so static analysis does not flag channel names in comment blocks. */
function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/\/\/.*$/gm, ''); // single-line comments
}

const CONTRACTS_FILE = 'src/lib/contracts/ai-research.types.ts';
const PRELOAD_FILE = 'electron/preload.ts';
const MAIN_FILE = 'electron/main.ts';

// Import constants for verification
import {
  AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL,
  AI_RESEARCH_BUILD_CONTEXT_PACK_CHANNEL,
  AI_RESEARCH_PREVIEW_CONTEXT_PACK_CHANNEL,
  AI_RESEARCH_CONFIRM_CONTEXT_PACK_CHANNEL,
  AI_RESEARCH_CREATE_TASK_DRAFT_CHANNEL,
  AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL,
  AI_RESEARCH_CANCEL_TASK_CHANNEL,
  AI_RESEARCH_GET_TASK_STATUS_CHANNEL,
  AI_RESEARCH_GET_TASK_RESULT_CHANNEL,
  AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL,
  AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL,
  AI_RESEARCH_SAVE_ARTIFACT_DRAFT_CHANNEL,
  AI_RESEARCH_SUBSCRIBE_TASK_CHANNEL,
} from '../../src/lib/contracts/ai-research.types';

// ═══════════════════════════════════════════════════════════════
// P0-IPC-001: 所有 10 个白名单 AI Research IPC 通道已定义
// ═══════════════════════════════════════════════════════════════

describe('AI Research IPC — 白名单通道定义', () => {
  const ALLOWED_CHANNELS = [
    {
      name: 'AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL',
      value: AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL,
      expected: 'ai-research:get-provider-readiness',
    },
    {
      name: 'AI_RESEARCH_BUILD_CONTEXT_PACK_CHANNEL',
      value: AI_RESEARCH_BUILD_CONTEXT_PACK_CHANNEL,
      expected: 'ai-research:build-context-pack',
    },
    {
      name: 'AI_RESEARCH_PREVIEW_CONTEXT_PACK_CHANNEL',
      value: AI_RESEARCH_PREVIEW_CONTEXT_PACK_CHANNEL,
      expected: 'ai-research:preview-context-pack',
    },
    {
      name: 'AI_RESEARCH_CONFIRM_CONTEXT_PACK_CHANNEL',
      value: AI_RESEARCH_CONFIRM_CONTEXT_PACK_CHANNEL,
      expected: 'ai-research:confirm-context-pack',
    },
    {
      name: 'AI_RESEARCH_CREATE_TASK_DRAFT_CHANNEL',
      value: AI_RESEARCH_CREATE_TASK_DRAFT_CHANNEL,
      expected: 'ai-research:create-task-draft',
    },
    {
      name: 'AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL',
      value: AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL,
      expected: 'ai-research:run-confirmed-task',
    },
    {
      name: 'AI_RESEARCH_CANCEL_TASK_CHANNEL',
      value: AI_RESEARCH_CANCEL_TASK_CHANNEL,
      expected: 'ai-research:cancel-task',
    },
    {
      name: 'AI_RESEARCH_GET_TASK_STATUS_CHANNEL',
      value: AI_RESEARCH_GET_TASK_STATUS_CHANNEL,
      expected: 'ai-research:get-task-status',
    },
    {
      name: 'AI_RESEARCH_GET_TASK_RESULT_CHANNEL',
      value: AI_RESEARCH_GET_TASK_RESULT_CHANNEL,
      expected: 'ai-research:get-task-result',
    },
    {
      name: 'AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL',
      value: AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL,
      expected: 'ai-research:clear-task-result',
    },
    {
      name: 'AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL',
      value: AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL,
      expected: 'ai-research:discard-artifact',
    },
    {
      name: 'AI_RESEARCH_SAVE_ARTIFACT_DRAFT_CHANNEL',
      value: AI_RESEARCH_SAVE_ARTIFACT_DRAFT_CHANNEL,
      expected: 'ai-research:save-artifact-draft',
    },
    {
      name: 'AI_RESEARCH_SUBSCRIBE_TASK_CHANNEL',
      value: AI_RESEARCH_SUBSCRIBE_TASK_CHANNEL,
      expected: 'ai-research:subscribe-task',
    },
  ];

  it('共定义了 13 个 AI Research IPC 通道常量', () => {
    assert.equal(ALLOWED_CHANNELS.length, 13, '应恰好定义 13 个通道常量');
  });

  it('所有通道常量均为非空字符串', () => {
    for (const ch of ALLOWED_CHANNELS) {
      assert.equal(typeof ch.value, 'string', `${ch.name} 应为字符串`);
      assert.ok(ch.value.length > 0, `${ch.name} 不应为空字符串`);
    }
  });

  it('所有通道名称以 "ai-research:" 为前缀', () => {
    for (const ch of ALLOWED_CHANNELS) {
      assert.ok(
        ch.value.startsWith('ai-research:'),
        `${ch.name} = "${ch.value}" 应以 "ai-research:" 开头`,
      );
    }
  });

  it('所有通道名称不与白名单期望值冲突', () => {
    for (const ch of ALLOWED_CHANNELS) {
      assert.equal(
        ch.value,
        ch.expected,
        `${ch.name} 的值应为 "${ch.expected}"，实际为 "${ch.value}"`,
      );
    }
  });

  it('所有通道常量在 contracts 源文件中存在字符串字面量', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content, 'ai-research.types.ts 必须存在');
    for (const ch of ALLOWED_CHANNELS) {
      assert.ok(
        content!.includes(ch.expected),
        `通道字符串字面量 "${ch.expected}" 未在 ${CONTRACTS_FILE} 中找到`,
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-IPC-002: 禁止的 IPC 通道不存在
// ═══════════════════════════════════════════════════════════════

describe('AI Research IPC — 禁止通道验证', () => {
  const FORBIDDEN_CHANNELS = [
    'ai:chat-start',
    'ai:chat-stream',
    'ai:raw-completion',
    'ai:send-context',
    'provider:invoke',
    'provider:stream',
    'context:send',
    'context:upload',
    'vault:write-ai-output',
    'artifact:auto-save',
    'plugin:run',
    'shell:open-provider-url',
    'settings:get-api-key',
  ];

  // Scan all IPC-relevant source files
  const IPC_SOURCES = [CONTRACTS_FILE, MAIN_FILE, PRELOAD_FILE, 'electron/ipc/ai-research.ipc.ts'];

  for (const forbidden of FORBIDDEN_CHANNELS) {
    it(`禁止通道 "${forbidden}" 未在任何 IPC 源文件中注册`, () => {
      const escaped = forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`['"]${escaped}['"]`);

      for (const src of IPC_SOURCES) {
        const rawContent = readSource(src);
        if (!rawContent) continue;
        // Strip comments: forbidden channel names are listed in a comment block
        // as documentation of what must NOT exist
        const content = stripComments(rawContent);
        assert.ok(!pattern.test(content), `禁止通道 "${forbidden}" 在 ${src} 中被发现 — 不得注册`);
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// P0-IPC-003: 不存在通用 invoke 通道
// ═══════════════════════════════════════════════════════════════

describe('AI Research IPC — 无通用 invoke 通道', () => {
  it('ai-research.types.ts 不含通用 "invoke" 通道字面量', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content, 'ai-research.types.ts 必须存在');
    assert.ok(
      !/['"]ai-research:invoke['"]/.test(content!),
      '不得存在通用 "ai-research:invoke" 通道',
    );
  });

  it('ai-research.types.ts 的 ScholaAIResearchApi 接口不含通用 invoke 方法', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const apiMatch = content!.match(/interface ScholaAIResearchApi[\s\S]*?\n\}/);
    assert.ok(apiMatch, 'ScholaAIResearchApi 接口必须存在');
    const apiBody = apiMatch[0];
    assert.ok(!/invoke\s*\(/.test(apiBody), 'ScholaAIResearchApi 不得包含通用 invoke 方法');
  });

  it('ai-research.types.ts 不含 "ai-research:" 以外的通道前缀', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const channelAssignments = content!.matchAll(/export const (\w+)\s*=\s*'([^']+)'/g);
    for (const [, name, value] of channelAssignments) {
      assert.ok(
        value.startsWith('ai-research:'),
        `通道 "${name}" = "${value}" 应以 "ai-research:" 开头`,
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-IPC-004: 通道名称唯一性
// ═══════════════════════════════════════════════════════════════

describe('AI Research IPC — 通道名称唯一性', () => {
  it('所有 13 个通道的值各不相同', () => {
    const values = [
      AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL,
      AI_RESEARCH_BUILD_CONTEXT_PACK_CHANNEL,
      AI_RESEARCH_PREVIEW_CONTEXT_PACK_CHANNEL,
      AI_RESEARCH_CONFIRM_CONTEXT_PACK_CHANNEL,
      AI_RESEARCH_CREATE_TASK_DRAFT_CHANNEL,
      AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL,
      AI_RESEARCH_CANCEL_TASK_CHANNEL,
      AI_RESEARCH_GET_TASK_STATUS_CHANNEL,
      AI_RESEARCH_GET_TASK_RESULT_CHANNEL,
      AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL,
      AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL,
      AI_RESEARCH_SAVE_ARTIFACT_DRAFT_CHANNEL,
      AI_RESEARCH_SUBSCRIBE_TASK_CHANNEL,
    ];
    const unique = new Set(values);
    assert.equal(unique.size, 13, '所有通道值必须唯一，避免重复注册');
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-IPC-005: 通道功能覆盖完整性
// ═══════════════════════════════════════════════════════════════

describe('AI Research IPC — 功能覆盖完整性', () => {
  it('Provider readiness 模块有对应通道', () => {
    assert.equal(AI_RESEARCH_GET_PROVIDER_READINESS_CHANNEL, 'ai-research:get-provider-readiness');
  });

  it('ContextPack 构建/预览模块有对应通道', () => {
    assert.equal(AI_RESEARCH_BUILD_CONTEXT_PACK_CHANNEL, 'ai-research:build-context-pack');
    assert.equal(AI_RESEARCH_PREVIEW_CONTEXT_PACK_CHANNEL, 'ai-research:preview-context-pack');
    assert.equal(AI_RESEARCH_CONFIRM_CONTEXT_PACK_CHANNEL, 'ai-research:confirm-context-pack');
  });

  it('Task 生命周期（创建/运行/取消/状态/结果/清除）有对应通道', () => {
    assert.equal(AI_RESEARCH_CREATE_TASK_DRAFT_CHANNEL, 'ai-research:create-task-draft');
    assert.equal(AI_RESEARCH_RUN_CONFIRMED_TASK_CHANNEL, 'ai-research:run-confirmed-task');
    assert.equal(AI_RESEARCH_CANCEL_TASK_CHANNEL, 'ai-research:cancel-task');
    assert.equal(AI_RESEARCH_SUBSCRIBE_TASK_CHANNEL, 'ai-research:subscribe-task');
    assert.equal(AI_RESEARCH_GET_TASK_STATUS_CHANNEL, 'ai-research:get-task-status');
    assert.equal(AI_RESEARCH_GET_TASK_RESULT_CHANNEL, 'ai-research:get-task-result');
    assert.equal(AI_RESEARCH_CLEAR_TASK_RESULT_CHANNEL, 'ai-research:clear-task-result');
  });

  it('Artifact 生命周期（保存/丢弃）有对应通道', () => {
    assert.equal(AI_RESEARCH_DISCARD_ARTIFACT_CHANNEL, 'ai-research:discard-artifact');
    assert.equal(
      AI_RESEARCH_SAVE_ARTIFACT_DRAFT_CHANNEL,
      'ai-research:save-artifact-draft',
    );
  });
});
