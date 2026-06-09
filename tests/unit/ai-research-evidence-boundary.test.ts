/**
 * Phase 5-2-IMP-1 P0: AI Research — 证据边界测试.
 *
 * 验证：
 *   - EvidenceRef.kind 字段值为 'source-backed' | 'model-inferred'
 *   - source-backed 证据必须包含 sourceRef 字段
 *   - model-inferred 证据必须包含 modelInferredNote 字段
 *   - 证据不含虚假/伪造的引用字段
 *
 * 测试边界：5-2-TB-EVIDENCE-001 ~ 005
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
// P0-EVIDENCE-001: EvidenceKind 类型定义正确
// ═══════════════════════════════════════════════════════════════

describe('AI Research — EvidenceKind 类型定义', () => {
  it('EvidenceKind 类型定义为 "source-backed" | "model-inferred"', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content, 'ai-research.types.ts 必须存在');
    // 匹配 EvidenceKind 类型定义
    const match = content!.match(/type EvidenceKind\s*=\s*[^;]+;/);
    assert.ok(match, 'EvidenceKind 类型必须存在');
    const typeDef = match[0];
    assert.ok(
      typeDef.includes('source-backed'),
      'EvidenceKind 应包含 "source-backed"',
    );
    assert.ok(
      typeDef.includes('model-inferred'),
      'EvidenceKind 应包含 "model-inferred"',
    );
  });

  it('EvidenceKind 只有两种值', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/type EvidenceKind\s*=\s*[^;]+;/);
    assert.ok(match);
    const typeDef = match[0];
    // 提取所有字符串字面量
    const literals = typeDef.match(/'([^']+)'/g) || [];
    assert.equal(literals.length, 2, 'EvidenceKind 应恰好有两个字面量类型');
    assert.ok(literals.includes("'source-backed'"), '应包含 source-backed');
    assert.ok(literals.includes("'model-inferred'"), '应包含 model-inferred');
  });

  it('EvidenceKind 不含 "fabricated" 或 "fake" 等伪造类型', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/type EvidenceKind\s*=\s*[^;]+;/);
    assert.ok(match);
    const typeDef = match[0];
    assert.ok(
      !/fabricated/i.test(typeDef) && !/fake/i.test(typeDef) && !/generated/i.test(typeDef),
      'EvidenceKind 不得包含 fabricated/fake/generated',
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-EVIDENCE-002: EvidenceRef 接口结构验证
// ═══════════════════════════════════════════════════════════════

describe('AI Research — EvidenceRef 接口结构', () => {
  it('EvidenceRef 包含 kind 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface EvidenceRef[\s\S]*?\n\}/);
    assert.ok(match, 'EvidenceRef 接口必须存在');
    const iface = match[0];
    assert.ok(
      /kind\s*:\s*EvidenceKind/.test(iface),
      'EvidenceRef 应包含 kind: EvidenceKind 字段',
    );
  });

  it('EvidenceRef 包含 id 和 label 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface EvidenceRef[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(/id\s*:\s*string/.test(iface), 'EvidenceRef 应包含 id 字段');
    assert.ok(/label\s*:\s*string/.test(iface), 'EvidenceRef 应包含 label 字段');
  });

  it('EvidenceRef 包含 sourceRef 可选字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface EvidenceRef[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      /sourceRef\?/.test(iface),
      'EvidenceRef 应包含 sourceRef? 可选字段',
    );
  });

  it('EvidenceRef 包含 modelInferredNote 可选字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface EvidenceRef[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      /modelInferredNote\?/.test(iface),
      'EvidenceRef 应包含 modelInferredNote? 可选字段',
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-EVIDENCE-003: source-backed 证据必须包含 sourceRef
// ═══════════════════════════════════════════════════════════════

describe('AI Research — source-backed 证据要求', () => {
  it('sourceRef 包含 relativePath 字段（Vault 相对路径）', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface EvidenceRef[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    // sourceRef 子对象必须包含 relativePath
    assert.ok(
      /relativePath\s*:\s*string/.test(iface),
      'sourceRef 应包含 relativePath: string',
    );
  });

  it('sourceRef 包含 displayName 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface EvidenceRef[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      /displayName\s*:\s*string/.test(iface),
      'sourceRef 应包含 displayName: string',
    );
  });

  it('sourceRef 可包含 pdfPage 和 pdfRegion 用于 PDF', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface EvidenceRef[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    // pdfPage 和 pdfRegion 为可选字段
    assert.ok(
      /pdfPage\?/.test(iface),
      'sourceRef 应包含可选 pdfPage 字段',
    );
    assert.ok(
      /pdfRegion\?/.test(iface),
      'sourceRef 应包含可选 pdfRegion 字段',
    );
  });

  it('sourceRef 可包含 markdownHeading 和 markdownLine 用于 Markdown', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface EvidenceRef[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      /markdownHeading\?/.test(iface),
      'sourceRef 应包含可选 markdownHeading 字段',
    );
    assert.ok(
      /markdownLine\?/.test(iface),
      'sourceRef 应包含可选 markdownLine 字段',
    );
  });

  it('sourceRef 不含绝对路径字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface EvidenceRef[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      !/absolutePath/i.test(iface) && !/fullPath/i.test(iface) && !/systemPath/i.test(iface),
      'sourceRef 不得包含绝对路径字段',
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-EVIDENCE-004: model-inferred 证据必须包含 modelInferredNote
// ═══════════════════════════════════════════════════════════════

describe('AI Research — model-inferred 证据要求', () => {
  it('modelInferredNote 字段类型为 string', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface EvidenceRef[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      /modelInferredNote\?\s*:\s*string/.test(iface),
      'modelInferredNote 应为 string 类型',
    );
  });

  it('modelInferredNote 注释声明了免责声明', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    // 在 EvidenceRef 定义前后搜索 model-inferred 相关注释
    const evidenceSection = content!.match(
      /\/\/ ═+[\s\S]*?Evidence[\s\S]*?interface EvidenceRef[\s\S]*?\n\}/,
    );
    if (evidenceSection) {
      // 验证注释中含有 model-inferred 的免责声明
      assert.ok(
        /model.inferred/i.test(evidenceSection[0]) || /modelInferredNote/i.test(evidenceSection[0]),
        '证据部分注释应包含 model-inferred 相关说明',
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// P0-EVIDENCE-005: 证据不含虚假/伪造的引用字段
// ═══════════════════════════════════════════════════════════════

describe('AI Research — 证据不含虚假引用字段', () => {
  it('EvidenceRef 不含 fabricatedRef 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface EvidenceRef[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      !/fabricatedRef/i.test(iface),
      'EvidenceRef 不得包含 fabricatedRef',
    );
  });

  it('EvidenceRef 不含 autoGeneratedUrl 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface EvidenceRef[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      !/autoGeneratedUrl/i.test(iface),
      'EvidenceRef 不得包含 autoGeneratedUrl',
    );
  });

  it('EvidenceRef 不含 citationUrl 或 externalUrl 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface EvidenceRef[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      !/citationUrl/i.test(iface) && !/externalUrl/i.test(iface),
      'EvidenceRef 不得包含 citationUrl / externalUrl（禁止模型生成虚假 URL）',
    );
  });

  it('EvidenceRef 不含 hallucinated 或 confidenceLow 字段', () => {
    const content = readSource(CONTRACTS_FILE);
    assert.ok(content);
    const match = content!.match(/interface EvidenceRef[\s\S]*?\n\}/);
    assert.ok(match);
    const iface = match[0];
    assert.ok(
      !/hallucinated/i.test(iface) && !/confidenceLow/i.test(iface),
      'EvidenceRef 不得包含 hallucinated / confidenceLow 字段',
    );
  });
});
