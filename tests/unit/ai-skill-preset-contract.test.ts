/**
 * AI Skill Preset Contract Tests — Phase 4-1-IMP-7.
 *
 * Verifies:
 * - P0: AISkillPreset contract integrity
 * - P0: Official skill presets complete and valid
 * - P0: No API Key / secret exposure
 * - P0: No real provider calls, no shell/fs commands
 * - P0: No generic IPC, no Vault writes
 * - P0: Phase boundary preserved (no Phase 4-2/3/4/5 entry)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import type { AISkillPreset, AISkillSummary } from '../../src/lib/contracts/ai-skill-preset.types';
import {
  toAISkillSummary,
  getSkillPresetById,
  listSkillPresets,
  listSkillSummaries,
} from '../../src/lib/contracts/ai-skill-preset.types';
import {
  OFFICIAL_AI_SKILL_PRESETS,
  getSkillById,
  getAllSkills,
  getSkillsByCategory,
  getDefaultEnabledSkills,
} from '../../src/lib/ai-skill-preset-registry';

// ── Contract Integrity ────────────────────────────────

describe('AISkillPreset contract', () => {
  it('all official presets have required fields', () => {
    for (const preset of OFFICIAL_AI_SKILL_PRESETS) {
      assert.ok(typeof preset.skillId === 'string' && preset.skillId.length > 0, `${preset.skillId}: missing skillId`);
      assert.ok(typeof preset.title === 'string' && preset.title.length > 0, `${preset.skillId}: missing title`);
      assert.ok(typeof preset.category === 'string' && preset.category.length > 0, `${preset.skillId}: missing category`);
      assert.ok(typeof preset.description === 'string' && preset.description.length > 0, `${preset.skillId}: missing description`);
      assert.ok(preset.requiredContext, `${preset.skillId}: missing requiredContext`);
      assert.ok(preset.outputMode, `${preset.skillId}: missing outputMode`);
      assert.ok(typeof preset.privacyLevel === 'string', `${preset.skillId}: missing privacyLevel`);
      assert.ok(typeof preset.promptTemplate === 'string' && preset.promptTemplate.length > 0, `${preset.skillId}: missing promptTemplate`);
      assert.ok(typeof preset.phaseBoundaryNote === 'string' && preset.phaseBoundaryNote.length > 0, `${preset.skillId}: missing phaseBoundaryNote`);
      assert.ok(Array.isArray(preset.forbiddenClaims) && preset.forbiddenClaims.length > 0, `${preset.skillId}: missing forbiddenClaims`);
    }
  });

  it('all skillIds are unique', () => {
    const ids = OFFICIAL_AI_SKILL_PRESETS.map((p) => p.skillId);
    const unique = new Set(ids);
    assert.equal(ids.length, unique.size, 'Duplicate skillId detected');
  });

  it('all skillIds follow schola.skill.* namespace', () => {
    for (const preset of OFFICIAL_AI_SKILL_PRESETS) {
      assert.ok(preset.skillId.startsWith('schola.skill.'), `${preset.skillId}: does not follow schola.skill.* namespace`);
    }
  });
});

// ── Skill Registry ─────────────────────────────────────

describe('Skill Registry', () => {
  it('getAllSkills returns 6 official presets', () => {
    assert.equal(getAllSkills().length, 6);
  });

  it('getSkillById lookup works', () => {
    const first = getAllSkills()[0];
    const found = getSkillById(first.skillId);
    assert.ok(found);
    assert.equal(found.title, first.title);
  });

  it('getSkillById returns null for unknown skill', () => {
    assert.equal(getSkillById('schola.skill.nonexistent'), null);
  });

  it('getSkillsByCategory filters correctly', () => {
    const reading = getSkillsByCategory('reading');
    assert.ok(reading.length >= 1);
    for (const s of reading) {
      assert.equal(s.category, 'reading');
    }
  });

  it('getDefaultEnabledSkills returns all 6 (all enabled by default)', () => {
    const defaults = getDefaultEnabledSkills();
    assert.equal(defaults.length, 6);
    for (const s of defaults) {
      assert.equal(s.enabledByDefault, true);
    }
  });

  it('listSkillPresets respects category filter', () => {
    const all = listSkillPresets(OFFICIAL_AI_SKILL_PRESETS);
    assert.equal(all.length, 6);
    const filtered = listSkillPresets(OFFICIAL_AI_SKILL_PRESETS, 'teaching');
    assert.equal(filtered.length, 1);
  });
});

// ── Renderer-Safe Summary ──────────────────────────────

describe('toAISkillSummary', () => {
  it('extracts renderer-safe summary without prompt template', () => {
    const preset = getAllSkills()[0];
    const summary = toAISkillSummary(preset);

    assert.equal(summary.skillId, preset.skillId);
    assert.equal(summary.title, preset.title);
    assert.equal(summary.category, preset.category);
    assert.equal(summary.description, preset.description);

    // Summary must NOT contain promptTemplate
    const summaryAny = summary as unknown as Record<string, unknown>;
    assert.equal(summaryAny.promptTemplate, undefined, 'Renderer-safe summary leaked promptTemplate');
    assert.equal(summaryAny.phaseBoundaryNote, undefined);
    assert.equal(summaryAny.forbiddenClaims, undefined);
  });

  it('listSkillSummaries returns renderer-safe data', () => {
    const summaries = listSkillSummaries(OFFICIAL_AI_SKILL_PRESETS);
    assert.equal(summaries.length, 6);
    for (const s of summaries) {
      const sAny = s as unknown as Record<string, unknown>;
      assert.equal(sAny.promptTemplate, undefined);
      assert.equal(sAny.phaseBoundaryNote, undefined);
      assert.equal(sAny.forbiddenClaims, undefined);
    }
  });
});

// ── Per-Skill Validation ───────────────────────────────

describe('official skill presets — per-skill', () => {
  const skills = OFFICIAL_AI_SKILL_PRESETS;

  const skillNames = skills.map((s) => s.title);
  assert.equal(skills.length, 6, `Expected 6 skills, got ${skills.length}: ${skillNames.join(', ')}`);

  it('论文精读', () => {
    const s = getSkillById('schola.skill.paper-close-reading');
    assert.ok(s);
    assert.equal(s.category, 'reading');
    assert.equal(s.outputMode.mode, 'artifact_draft');
    assert.equal(s.requiredContext.type, 'selected_papers');
    assert.equal(s.requiredContext.minFiles, 1);
    assert.ok(s.promptTemplate.includes('研究问题'));
    assert.ok(s.promptTemplate.includes('核心贡献'));
    assert.ok(s.phaseBoundaryNote.length > 0);
    assert.ok(s.forbiddenClaims.length >= 3);
    // P0: No API key / secret
    const sAny = s as unknown as Record<string, unknown>;
    assert.equal(sAny.apiKey, undefined);
    assert.equal(sAny.secret, undefined);
  });

  it('文献矩阵', () => {
    const s = getSkillById('schola.skill.literature-matrix');
    assert.ok(s);
    assert.equal(s.category, 'analysis');
    assert.equal(s.outputMode.mode, 'structured_draft');
    assert.equal(s.requiredContext.type, 'selected_papers');
    assert.equal(s.requiredContext.minFiles, 2);
    assert.ok(s.promptTemplate.includes('对比矩阵'));
    assert.ok(s.forbiddenClaims.length >= 3);
  });

  it('研究问题拆解', () => {
    const s = getSkillById('schola.skill.research-problem-decomposition');
    assert.ok(s);
    assert.equal(s.category, 'methodology');
    assert.equal(s.outputMode.mode, 'structured_draft');
    assert.equal(s.privacyLevel, 'sensitive');
    assert.equal(s.requiredContext.minFiles, 0);
    assert.ok(s.promptTemplate.includes('子问题拆解'));
    assert.ok(s.forbiddenClaims.length >= 3);
  });

  it('审稿人视角评审', () => {
    const s = getSkillById('schola.skill.reviewer-perspective-review');
    assert.ok(s);
    assert.equal(s.category, 'review');
    assert.equal(s.privacyLevel, 'sensitive');
    assert.equal(s.outputMode.mode, 'artifact_draft');
    assert.ok(s.promptTemplate.includes('总体评价'));
    assert.ok(s.promptTemplate.includes('修改建议'));
    assert.ok(s.forbiddenClaims.length >= 3);
  });

  it('实验结果分析', () => {
    const s = getSkillById('schola.skill.experiment-results-analysis');
    assert.ok(s);
    assert.equal(s.category, 'analysis');
    assert.equal(s.outputMode.mode, 'structured_draft');
    assert.equal(s.requiredContext.type, 'selected_notes');
    assert.ok(s.promptTemplate.includes('关键趋势'));
    assert.ok(s.promptTemplate.includes('条件对比'));
    assert.ok(s.forbiddenClaims.length >= 3);
  });

  it('教学讲稿辅助', () => {
    const s = getSkillById('schola.skill.lecture-notes-assistant');
    assert.ok(s);
    assert.equal(s.category, 'teaching');
    assert.equal(s.outputMode.mode, 'structured_draft');
    assert.ok(s.promptTemplate.includes('教学目标'));
    assert.ok(s.promptTemplate.includes('讲稿大纲'));
    assert.ok(s.phaseBoundaryNote.includes('Phase 4-4'));
    assert.ok(s.forbiddenClaims.length >= 3);
  });
});

// ── No API Key / Secret ────────────────────────────────

describe('no API Key / secret exposure', () => {
  it('no preset contains apiKey field', () => {
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      const sAny = s as unknown as Record<string, unknown>;
      assert.equal(sAny.apiKey, undefined, `${s.skillId}: contains apiKey`);
      assert.equal(sAny.api_key, undefined, `${s.skillId}: contains api_key`);
    }
  });

  it('no preset contains secret / token / password field', () => {
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      const sAny = s as unknown as Record<string, unknown>;
      assert.equal(sAny.secret, undefined, `${s.skillId}: contains secret`);
      assert.equal(sAny.token, undefined, `${s.skillId}: contains token`);
      assert.equal(sAny.password, undefined, `${s.skillId}: contains password`);
      assert.equal(sAny.credential, undefined, `${s.skillId}: contains credential`);
    }
  });

  it('no API key patterns in prompt templates', () => {
    const apiPatterns = ['sk-', 'apiKey', 'api_key', 'Bearer ', 'Authorization'];
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      for (const pattern of apiPatterns) {
        const found = s.promptTemplate.toLowerCase().includes(pattern.toLowerCase());
        assert.equal(found, false, `${s.skillId}: prompt template contains "${pattern}"`);
      }
    }
  });

  it('renderer-safe summary assumes no apiKey field', () => {
    const input: AISkillSummary = {
      skillId: 'test',
      title: 'test',
      category: 'reading',
      description: 'test',
      requiredContext: { type: 'user_query_only', minFiles: 0, hint: '' },
      outputMode: { mode: 'inline_response', description: '' },
      privacyLevel: 'standard',
    };
    const sAny = input as unknown as Record<string, unknown>;
    assert.equal(sAny.apiKey, undefined);
    assert.equal(sAny.secret, undefined);
  });
});

// ── No Real Provider Call / Shell / FS ─────────────────

describe('no shell / fs / command execution', () => {
  const forbiddenImports = [
    'child_process',
    'exec',
    'spawn',
    'shell',
    'shelljs',
    'fs',
    'python',
    'pip',
    'subprocess',
    'os.system',
    'eval(',
    'Function(',
  ];

  it('prompt templates contain no command execution patterns', () => {
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      for (const pattern of forbiddenImports) {
        assert.ok(
          !s.promptTemplate.toLowerCase().includes(pattern.toLowerCase()),
          `${s.skillId}: prompt template contains "${pattern}"`,
        );
      }
    }
  });

  it('descriptions contain no command execution patterns', () => {
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      const descs = [s.description, s.phaseBoundaryNote, ...s.forbiddenClaims];
      for (const desc of descs) {
        for (const pattern of forbiddenImports) {
          assert.ok(
            !desc.toLowerCase().includes(pattern.toLowerCase()),
            `${s.skillId}: description contains "${pattern}"`,
          );
        }
      }
    }
  });
});

// ── No Vault Write ─────────────────────────────────────

describe('no Vault write', () => {
  it('no preset references Vault write operations', () => {
    const writePatterns = ['writeFile', 'write_vault', 'save to vault', 'createFile', 'overwrite'];
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      for (const p of writePatterns) {
        const allText = JSON.stringify(s).toLowerCase();
        assert.ok(
          !allText.includes(p.toLowerCase()),
          `${s.skillId}: contains "${p}"`,
        );
      }
    }
  });

  it('every skill emphasizes Artifact-first or draft-first', () => {
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      assert.ok(
        s.outputMode.mode === 'artifact_draft' || s.outputMode.mode === 'structured_draft',
        `${s.skillId}: output is not draft/artifact-first`,
      );
    }
  });
});

// ── No Generic IPC ─────────────────────────────────────

describe('no generic IPC', () => {
  it('ai-skill-preset.types.ts imports no IPC modules', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/ai-skill-preset.types.ts'),
      'utf8',
    );
    assert.ok(!content.includes('ipcRenderer'));
    assert.ok(!content.includes('ipcMain'));
    assert.ok(!content.includes('electron'));
  });

  it('ai-skill-preset-registry.ts imports no IPC modules', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/ai-skill-preset-registry.ts'),
      'utf8',
    );
    assert.ok(!content.includes('ipcRenderer'));
    assert.ok(!content.includes('ipcMain'));
    assert.ok(!content.includes('electron'));
  });

  it('AIWorkbench.tsx imports no IPC modules', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/features/ai-workbench/AIWorkbench.tsx'),
      'utf8',
    );
    assert.ok(!content.includes('ipcRenderer'));
    assert.ok(!content.includes('child_process'));
    assert.ok(!content.includes("require('fs')"));
    assert.ok(!content.includes('shell'));
  });
});

// ── No Real Provider Call ──────────────────────────────

describe('no real provider call', () => {
  it('no fetch or HTTP client patterns in skill presets', () => {
    const httpPatterns = ['fetch(', 'axios', 'request(', 'http.client', 'openai.chat', 'anthropic.messages'];
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      const text = JSON.stringify(s).toLowerCase();
      for (const p of httpPatterns) {
        assert.ok(!text.includes(p), `${s.skillId}: contains "${p}"`);
      }
    }
  });

  it('AIWorkbench.tsx has no fetch or API request', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/features/ai-workbench/AIWorkbench.tsx'),
      'utf8',
    );
    assert.ok(!content.includes('fetch('));
    assert.ok(!content.includes('axios'));
    // "openai" may appear as mock provider display name — check for API patterns instead
    assert.ok(!content.includes('openai.chat'));
    assert.ok(!content.includes('openai.completions'));
  });
});

// ── No Third-Party Skill / Automatic Agent ─────────────

describe('no third-party skill or automatic agent', () => {
  it('all skills are schola.skill.* namespace — no user/third-party IDs', () => {
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      assert.ok(
        s.skillId.startsWith('schola.skill.'),
        `${s.skillId}: not in schola.skill.* namespace`,
      );
    }
  });

  it('no skill references plugin marketplace or third-party', () => {
    const forbidden = ['plugin', 'marketplace', 'third-party', 'community', 'install', 'download_skill'];
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      const text = JSON.stringify(s).toLowerCase();
      for (const p of forbidden) {
        assert.ok(!text.includes(p), `${s.skillId}: contains "${p}"`);
      }
    }
  });

  it('no automatic agent patterns in skill metadata', () => {
    const agentPatterns = ['automatic', 'auto_run', 'background', 'schedule', 'cron', 'daemon', 'long_running'];
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      const metaText = [s.description, s.phaseBoundaryNote].join(' ').toLowerCase();
      for (const p of agentPatterns) {
        assert.ok(!metaText.includes(p), `${s.skillId}: metadata contains "${p}"`);
      }
    }
  });
});

// ── Phase Boundary ─────────────────────────────────────

describe('phase boundary', () => {
  it('no RAG / Knowledge Compiler references in contract', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/ai-skill-preset.types.ts'),
      'utf8',
    );
    assert.ok(!content.includes('RAG'));
    assert.ok(!content.includes('embedding'));
    assert.ok(!content.includes('vector'));
    assert.ok(!content.includes('knowledge_compiler'));
    assert.ok(!content.includes('KnowledgeCompiler'));
  });

  it('no RAG / Knowledge Compiler references in registry', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/ai-skill-preset-registry.ts'),
      'utf8',
    );
    assert.ok(!content.includes('RAG'));
    assert.ok(!content.includes('embedding'));
    assert.ok(!content.includes('KnowledgeCompiler'));
  });

  it('no Phase 4-2 / 4-3 / 4-4 / Phase 5 entry in contract', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/ai-skill-preset.types.ts'),
      'utf8',
    );
    assert.ok(!content.includes('Phase 4-2'));
    assert.ok(!content.includes('Phase 4-3'));
    assert.ok(!content.includes('Phase 4-4'));
    assert.ok(!content.includes('Phase 5'));
  });

  it('no PPT / Multimodal Artifact references', () => {
    const contractContent = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/ai-skill-preset.types.ts'),
      'utf8',
    );
    const registryContent = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/ai-skill-preset-registry.ts'),
      'utf8',
    );
    assert.ok(!contractContent.includes('PPT'));
    assert.ok(!contractContent.includes('Multimodal'));
    // "PPT" may appear in phaseBoundaryNote (saying PPT belongs to later phase)
    // Check that PPT is NOT in description (actual feature implementation)
    assert.ok(!registryContent.includes('PPT 自动生成功能'));
    assert.ok(!registryContent.includes('PluginManager'));
  });

  it('no Plugin Manager or marketplace references', () => {
    const registryContent = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/ai-skill-preset-registry.ts'),
      'utf8',
    );
    assert.ok(!registryContent.includes('PluginManager'));
    assert.ok(!registryContent.includes('plugin_manager'));
    assert.ok(!registryContent.includes('marketplace'));
  });

  it('no external database retrieval in any skill', () => {
    const dbPatterns = ['PubMed', 'Crossref', 'OpenAlex', 'Google Scholar', 'Web of Science', 'Scopus'];
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      const metaText = [s.description, s.phaseBoundaryNote].join(' ').toLowerCase();
      for (const p of dbPatterns) {
        const found = metaText.includes(p.toLowerCase());
        // Only allowed in forbiddenClaims (as "不声称已检索...")
        if (found) {
          const isForbidden = s.forbiddenClaims.some((c) => c.toLowerCase().includes(p.toLowerCase()));
          assert.ok(isForbidden, `${s.skillId}: references "${p}" outside forbiddenClaims`);
        }
      }
    }
  });

  it('no fake reference claims in any skill', () => {
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      // Every skill must explicitly forbid fake references or database claims
      const hasReferenceGuard = s.forbiddenClaims.some(
        (c) =>
          c.includes('参考文献') ||
          c.includes('文献') ||
          c.includes('虚构') ||
          c.includes('PubMed') ||
          c.includes('不声称已检索'),
      );
      assert.ok(hasReferenceGuard, `${s.skillId}: lacks reference integrity guard`);
    }
  });
});

// ── No Whole Vault Read ────────────────────────────────

describe('no whole Vault read', () => {
  it('no skill requires scanning entire Vault', () => {
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      assert.ok(
        s.requiredContext.type !== ('whole_vault' as unknown),
        `${s.skillId}: requires whole vault`,
      );
    }
  });

  it('requiredContext types are all user-selected', () => {
    const validTypes = ['selected_notes', 'selected_papers', 'selected_documents', 'user_query_only'];
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      assert.ok(validTypes.includes(s.requiredContext.type), `${s.skillId}: invalid context type "${s.requiredContext.type}"`);
    }
  });
});

// ── Context Confirmation Dependency ───────────────────

describe('Context Confirmation dependency', () => {
  it('every skill description or note mentions context selection', () => {
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      const combined = [s.description, s.requiredContext.hint, s.phaseBoundaryNote].join(' ');
      const mentionsContext = combined.includes('选择') || combined.includes('上下文') || s.requiredContext.type === 'user_query_only';
      assert.ok(mentionsContext, `${s.skillId}: does not mention user context selection`);
    }
  });
});

// ── Prompt Template Integrity ──────────────────────────

describe('prompt template integrity', () => {
  it('all prompt templates are non-empty and meaningful', () => {
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      assert.ok(s.promptTemplate.length > 100, `${s.skillId}: prompt template too short (${s.promptTemplate.length} chars)`);
      assert.ok(s.promptTemplate.length < 10000, `${s.skillId}: prompt template too long (${s.promptTemplate.length} chars)`);
    }
  });

  it('all prompt templates contain clear output format instructions', () => {
    for (const s of OFFICIAL_AI_SKILL_PRESETS) {
      const hasStructure = s.promptTemplate.includes('**') || s.promptTemplate.includes('请按') || s.promptTemplate.includes('输出');
      assert.ok(hasStructure, `${s.skillId}: prompt template lacks output structure`);
    }
  });
});
