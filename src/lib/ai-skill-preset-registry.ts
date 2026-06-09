/**
 * AI Skill Preset Registry — Phase 4-1-IMP-7.
 *
 * Official built-in Schola AI Skill Presets (prompt templates / research task recipes).
 * These are static templates, NOT automatic agents, NOT third-party skills.
 *
 * Every skill MUST pass Context Confirmation (IMP-6).
 * Every skill output is Artifact / Draft-first.
 * No real provider calls. No API Key access. No Vault writes. No generic IPC.
 */

import type { AISkillPreset } from './contracts/ai-skill-preset.types';

/** Official built-in AI Skill Presets for Phase 4-1-IMP-7. */
export const OFFICIAL_AI_SKILL_PRESETS: readonly AISkillPreset[] = [
  // ── 1. 论文精读 ──────────────────────────────────
  {
    skillId: 'schola.skill.paper-close-reading',
    title: '论文精读',
    category: 'reading',
    description: '逐段精读学术论文，提取核心论点、方法、贡献与局限，生成结构化阅读笔记。',
    requiredContext: {
      type: 'selected_papers',
      minFiles: 1,
      hint: '请选择需要精读的论文文件（PDF 导入后的 Markdown）。',
    },
    outputMode: {
      mode: 'artifact_draft',
      description: '生成包含核心论点、方法、贡献、局限、关键引用的结构化阅读笔记草稿。',
    },
    privacyLevel: 'standard',
    enabledByDefault: true,
    promptTemplate: `你是一位资深科研导师，请对以下论文进行逐段精读分析。

请按以下结构输出：
1. **研究问题**：本文试图解决什么问题？
2. **核心贡献**：主要创新点是什么？
3. **方法论**：使用了什么方法？实验设计如何？
4. **关键发现**：最重要的实验结果是什么？
5. **局限性**：作者承认了哪些局限？你还观察到了哪些潜在问题？
6. **关键引用**：文中引用了哪些值得跟进的相关工作？
7. **个人思考**：这篇论文对你的研究的启发。

请基于用户提供的论文全文进行分析。`,
    phaseBoundaryNote:
      'Skill 仅提供分析框架和输出模板，不自动检索外部文献，不比对已有知识库，不生成文献综述。',
    forbiddenClaims: [
      '不声称已检索 PubMed / Crossref / Google Scholar / Web of Science',
      '不虚构未在原文中出现的参考文献',
      '不自动检索外部数据库',
      '不声称可替代同行评审',
    ],
  },

  // ── 2. 文献矩阵 ──────────────────────────────────
  {
    skillId: 'schola.skill.literature-matrix',
    title: '文献矩阵',
    category: 'analysis',
    description: '将多篇选定论文的关键信息提取为对比矩阵表格，便于横向比较研究方法和结论。',
    requiredContext: {
      type: 'selected_papers',
      minFiles: 2,
      hint: '请选择 2 篇以上需要对比的论文文件。',
    },
    outputMode: {
      mode: 'structured_draft',
      description: '生成 Markdown 格式的对比矩阵表格，包含方法、数据、结论、局限等维度。',
    },
    privacyLevel: 'standard',
    enabledByDefault: true,
    promptTemplate: `你是一位文献综述专家，请将以下多篇论文整理为对比矩阵。

请按以下维度逐篇提取信息，输出 Markdown 表格：
| 论文 | 研究问题 | 方法 | 数据集 | 核心结论 | 局限 | 与你研究的关联 |

要求：
1. 每篇论文一行，维度列为列；
2. 信息需基于论文原文，不可虚构；
3. 最后增加一行「总结与趋势」汇总跨论文的共同发现和差异。

请基于用户提供的论文全文进行分析。`,
    phaseBoundaryNote:
      'Skill 仅根据用户提供的论文生成对比表格，不自动检索额外文献，不生成完整文献综述。',
    forbiddenClaims: [
      '不声称已检索学术数据库',
      '不声称覆盖了某领域的全部文献',
      '不虚构未在选中论文中出现的信息',
      '不生成带 DOI 检索的文献计量分析',
    ],
  },

  // ── 3. 研究问题拆解 ──────────────────────────────
  {
    skillId: 'schola.skill.research-problem-decomposition',
    title: '研究问题拆解',
    category: 'methodology',
    description: '将模糊的研究想法拆解为可操作的研究子问题、假设和实验设计方案。',
    requiredContext: {
      type: 'selected_notes',
      minFiles: 0,
      hint: '可选择相关笔记提供背景，也可仅输入问题描述。',
    },
    outputMode: {
      mode: 'structured_draft',
      description: '生成包含研究问题树、假设列表、实验设计框架的结构化草案。',
    },
    privacyLevel: 'sensitive',
    enabledByDefault: true,
    promptTemplate: `你是一位研究方法论顾问，请帮助将以下研究想法拆解为可操作的研究计划。

请按以下结构输出：
1. **核心研究问题**：用一句话表述。
2. **子问题拆解**：将核心问题拆解为 3-5 个可独立研究的子问题。
3. **关键假设**：每个子问题对应的可验证假设。
4. **实验/研究设计**：每个假设建议的验证方法。
5. **潜在陷阱**：可能遇到的方法论问题及应对建议。
6. **最小可行实验**：建议先做哪个实验来验证核心假设的可行性。

请严格基于用户提供的研究想法和上下文进行分析，不补充未经用户确认的领域背景。`,
    phaseBoundaryNote:
      'Skill 仅提供方法论框架和研究问题拆解模板，不执行实验，不检索外部文献，不生成完整研究计划书。',
    forbiddenClaims: [
      '不声称可预测实验结果',
      '不声称已掌握某领域全部文献',
      '不保证研究问题的创新性',
      '不替代导师或课题组讨论',
    ],
  },

  // ── 4. 审稿人视角评审 ────────────────────────────
  {
    skillId: 'schola.skill.reviewer-perspective-review',
    title: '审稿人视角评审',
    category: 'review',
    description: '模拟同行评审流程，从审稿人角度对你的论文草稿提出建设性反馈和改进建议。',
    requiredContext: {
      type: 'selected_documents',
      minFiles: 1,
      hint: '请选择你的论文草稿文件。',
    },
    outputMode: {
      mode: 'artifact_draft',
      description: '生成包含总体评价、分项评审意见、具体修改建议的审稿报告草稿。',
    },
    privacyLevel: 'sensitive',
    enabledByDefault: true,
    promptTemplate: `你是一位领域内的资深审稿人，请对以下论文草稿提供建设性评审反馈。

请按以下结构输出：
1. **总体评价**：论文的整体质量、可读性和贡献度评价。
2. **方法论评审**：
   - 实验设计是否合理？
   - 数据和评估指标是否充分？
   - 是否存在明显的方法论缺陷？
3. **论证清晰度**：
   - 核心论点是否表达清楚？
   - 逻辑链条是否有断裂？
   - 图表和示例是否有效支撑论点？
4. **文献关联**：是否遗漏了重要相关工作？定位是否准确？
5. **具体修改建议**：按严重程度排列的具体改进点。
6. **补充实验建议**：哪些额外实验可增强论文的说服力？

请保持建设性和具体性，避免泛泛而谈。`,
    phaseBoundaryNote:
      'Skill 仅提供论文草稿的审稿视角评审，不自动投稿，不生成正式审稿意见，不保证录用。',
    forbiddenClaims: [
      '不声称可替代正式同行评审',
      '不声称可预测投稿结果',
      '不自动匹配期刊或会议',
      '不泄露论文内容至第三方',
      '不声称已检索相关文献数据库',
      '不虚构或补充论文中未引用的参考文献',
    ],
  },

  // ── 5. 实验结果分析 ──────────────────────────────
  {
    skillId: 'schola.skill.experiment-results-analysis',
    title: '实验结果分析',
    category: 'analysis',
    description: '分析实验数据和结果笔记，提取趋势、对比条件、发现异常并生成讨论要点。',
    requiredContext: {
      type: 'selected_notes',
      minFiles: 1,
      hint: '请选择包含实验记录和结果的笔记文件。',
    },
    outputMode: {
      mode: 'structured_draft',
      description: '生成包含趋势分析、条件对比、异常检测、讨论要点的分析报告草稿。',
    },
    privacyLevel: 'standard',
    enabledByDefault: true,
    promptTemplate: `你是一位数据科学家，请分析以下实验结果，帮助发现趋势和见解。

请按以下结构输出：
1. **实验概述**：实验目标、条件和数据来源的简要总结。
2. **关键趋势**：数据中呈现的主要趋势和模式。
3. **条件对比**：不同实验条件之间的关键差异。
4. **异常检测**：是否存在异常数据点、反直觉发现或需要进一步验证的结果？
5. **讨论要点**：
   - 哪些结果支持了假设？
   - 哪些结果出乎意料？可能的原因是什么？
   - 结果的统计可靠性如何？
6. **后续建议**：建议补充哪些实验或分析？

请严格基于用户提供的实验数据进行分析，不对缺失数据进行推测。`,
    phaseBoundaryNote:
      'Skill 仅分析用户提供的实验记录，不执行统计检验软件，不连接实验设备，不生成完整的实验方法论文。',
    forbiddenClaims: [
      '不声称可替代统计软件',
      '不对未提供的数据进行推断',
      '不声称实验结果具有统计显著性',
      '不自动生成图表或可视化',
      '不虚构未在原始数据中出现的结果',
    ],
  },

  // ── 6. 教学讲稿辅助 ──────────────────────────────
  {
    skillId: 'schola.skill.lecture-notes-assistant',
    title: '教学讲稿辅助',
    category: 'teaching',
    description: '基于课程内容和教学目标，生成结构化的课堂讲稿大纲、关键概念讲解和讨论问题。',
    requiredContext: {
      type: 'selected_notes',
      minFiles: 1,
      hint: '请选择课程内容、教学目标或相关知识点笔记。',
    },
    outputMode: {
      mode: 'structured_draft',
      description: '生成包含教学目标、讲稿大纲、关键概念、讨论问题和参考资料的讲稿草案。',
    },
    privacyLevel: 'standard',
    enabledByDefault: true,
    promptTemplate: `你是一位有经验的高校教师，请基于提供的教学内容，生成课堂教学讲稿大纲。

请按以下结构输出：
1. **教学目标**：本课结束后学生应掌握的核心知识和能力。
2. **讲稿大纲**：
   - 导入（5-10分钟）：如何引出本课主题
   - 核心概念讲解（20-30分钟）：逐点讲解框架
   - 案例分析（10-15分钟）：可用的教学案例建议
   - 互动环节（5-10分钟）：课堂讨论或小练习
   - 总结与预习（5分钟）
3. **关键概念**：需要重点讲解的概念清单及讲解要点。
4. **讨论问题**：3-5 个激发思考的课堂讨论问题。
5. **参考资料**：建议布置的阅读材料或延伸学习资源。

请基于用户提供的课程内容生成讲稿大纲，确保逻辑清晰、层次分明。`,
    phaseBoundaryNote:
      'Skill 仅生成讲稿大纲和教学建议，不生成完整 PPT，不生成可编辑 PPTX，不自动备课。PPT 自动生成属于 Phase 4-4。',
    forbiddenClaims: [
      '不声称可生成可编辑 PPTX 文件',
      '不声称可替代教师备课',
      '不自动生成考试题目',
      '不自动评估学生作业',
      '不虚构或补充课程内容中未包含的知识点',
    ],
  },
];

/**
 * Convenience accessors for the official skill preset registry.
 */

export function getSkillById(skillId: string): AISkillPreset | null {
  return OFFICIAL_AI_SKILL_PRESETS.find((p) => p.skillId === skillId) ?? null;
}

export function getAllSkills(): readonly AISkillPreset[] {
  return OFFICIAL_AI_SKILL_PRESETS;
}

export function getSkillsByCategory(category: string): readonly AISkillPreset[] {
  return OFFICIAL_AI_SKILL_PRESETS.filter((p) => p.category === category);
}

export function getDefaultEnabledSkills(): readonly AISkillPreset[] {
  return OFFICIAL_AI_SKILL_PRESETS.filter((p) => p.enabledByDefault);
}
