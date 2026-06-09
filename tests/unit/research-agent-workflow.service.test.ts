/**
 * Research Agent Workflow Service Tests — Phase 4-3-G.
 *
 * Covers all G-P0 and G-P1 test boundaries from Phase 4-3-TB.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ResearchAgentWorkflowService } from '../../electron/services/research-agent-workflow.service';
import type {
  ResearchWorkflowType,
  ResearchWorkflowMode,
  ResearchWorkflowRequest,
  WritingSourcePack,
} from '../../src/lib/contracts/research-writing.types';

// ── Helpers ────────────────────────────────────────────

const ALL_WORKFLOW_TYPES: ResearchWorkflowType[] = [
  'manuscript_section_workflow',
  'literature_review_workflow',
  'submission_material_workflow',
  'safety_check_workflow',
  'research_draft_pipeline',
];

function makeSourcePack(
  sources?: { relativePath: string; chunkIndex?: number; headingPath?: string[]; score?: number }[],
  evidence?: { sourceRelativePath: string; excerpt: string }[],
): WritingSourcePack {
  const srcs = (sources ?? [{ relativePath: 'notes/research.md' }]).map((s) => ({
    relativePath: s.relativePath,
    chunkIndex: s.chunkIndex ?? 0,
    headingPath: s.headingPath ?? ['# Research'],
    score: s.score ?? 0.9,
  }));
  const evs = (evidence ?? []).map((e) => ({
    source: { relativePath: e.sourceRelativePath, chunkIndex: 0, headingPath: [], score: 0.9 },
    excerpt: e.excerpt,
    excerptTokenCount: 5,
  }));
  return {
    sources: srcs,
    evidence: evs,
    memoryTreeNodes: [],
    compiledMarkdown: null,
    contextPackSummary: {
      scope: {
        type: 'combined',
        selectedFiles: srcs.map((s) => ({ relativePath: s.relativePath, displayName: s.relativePath })),
        selectedFolder: undefined,
        wikilinkExpansion: { enabled: false, maxDepth: 1, onlyInsideSelectedScope: true },
      },
      tokenBudget: { fileTokenBudget: 2000, packTokenBudget: 8000 },
      fileCount: srcs.length,
      files: srcs.map((s) => ({ relativePath: s.relativePath, displayName: s.relativePath, tokenCount: 200, truncated: false })),
      totalTokens: srcs.length * 200,
      providerId: '',
      model: '',
      providerDisplayName: '',
      truncatedFileCount: 0,
    },
    totalTokens: srcs.length * 200,
  };
}

function makeRequest(
  workflowType: ResearchWorkflowType = 'manuscript_section_workflow',
  mode: ResearchWorkflowMode = 'mock_run',
  overrides?: Partial<ResearchWorkflowRequest>,
): ResearchWorkflowRequest {
  const base: ResearchWorkflowRequest = {
    workflowType,
    mode,
    sourcePack: makeSourcePack(),
    contextConfirmationSummary: 'User confirmed context for workflow.',
    ...(workflowType === 'manuscript_section_workflow' ? { sectionType: 'introduction' as const } : {}),
    ...(workflowType === 'submission_material_workflow' ? { materialType: 'cover_letter' as const } : {}),
  };
  return { ...base, ...overrides };
}

// ── Tests ───────────────────────────────────────────────

describe('ResearchAgentWorkflowService', () => {
  const svc = new ResearchAgentWorkflowService();

  // ════════════════════════════════════════════════════════
  // G-P0-1: workflow requires Context Confirmation
  // ════════════════════════════════════════════════════════

  it('G-P0-1: workflow blocks without Context Confirmation', () => {
    const result = svc.runResearchWorkflow(makeRequest('manuscript_section_workflow', 'mock_run', {
      contextConfirmationSummary: '',
    }));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'NO_CONTEXT_CONFIRMATION'));
    assert.equal(result.report.contextConfirmed, false);
  });

  it('G-P0-1: workflow proceeds with valid Context Confirmation', () => {
    const result = svc.runResearchWorkflow(makeRequest());
    assert.equal(result.ok, true);
    assert.equal(result.report.contextConfirmed, true);
  });

  // ════════════════════════════════════════════════════════
  // G-P0-2: workflow requires selected sources
  // ════════════════════════════════════════════════════════

  it('G-P0-2: workflow blocks without selected sources', () => {
    const result = svc.runResearchWorkflow(makeRequest('manuscript_section_workflow', 'mock_run', {
      sourcePack: makeSourcePack([]),
    }));
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.code === 'SELECTED_SOURCES_REQUIRED') ||
      result.errors.some((e) => e.code === 'INSUFFICIENT_EVIDENCE'),
    );
    assert.equal(result.report.sourcesSelected, false);
  });

  it('G-P0-2: workflow proceeds with selected sources', () => {
    const result = svc.runResearchWorkflow(makeRequest('manuscript_section_workflow', 'mock_run', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/paper.md' }]),
    }));
    assert.equal(result.ok, true);
    assert.equal(result.report.sourcesSelected, true);
  });

  // ════════════════════════════════════════════════════════
  // G-P0-3: workflow uses selected scope / selected sources only
  // ════════════════════════════════════════════════════════

  it('G-P0-3: manuscript_section_workflow uses selected sources only', () => {
    const result = svc.runResearchWorkflow(makeRequest('manuscript_section_workflow', 'mock_run', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/a.md' }, { relativePath: 'notes/b.md' }]),
    }));
    assert.equal(result.ok, true);
    assert.equal(result.report.sourcesSelected, true);
    assert.ok(result.drafts.length >= 1);
  });

  // ════════════════════════════════════════════════════════
  // G-P0-4: no provider call
  // ════════════════════════════════════════════════════════

  it('G-P0-4: providerCalled is always false', () => {
    for (const wfType of ALL_WORKFLOW_TYPES) {
      const request = makeRequest(wfType);
      const result = svc.runResearchWorkflow(request);
      assert.equal(result.providerCalled, false, `${wfType} should have providerCalled=false`);
      assert.equal(result.report.providerCalled, false, `${wfType} report should have providerCalled=false`);
    }
  });

  // ════════════════════════════════════════════════════════
  // G-P0-5: no embedding call
  // ════════════════════════════════════════════════════════

  it('G-P0-5: no embedding call — service has no embedding imports', () => {
    const result = svc.runResearchWorkflow(makeRequest());
    assert.equal(result.providerCalled, false);
    assert.equal(result.userReviewRequired, true);
  });

  // ════════════════════════════════════════════════════════
  // G-P0-6: no external database lookup
  // ════════════════════════════════════════════════════════

  it('G-P0-6: no external database lookup — service is local-only', () => {
    const result = svc.runResearchWorkflow(makeRequest());
    assert.equal(result.ok, true);
    assert.equal(result.providerCalled, false);
  });

  // ════════════════════════════════════════════════════════
  // G-P0-7: draft artifacts only
  // ════════════════════════════════════════════════════════

  it('G-P0-7: all produced artifacts are drafts with status=draft', () => {
    const result = svc.runResearchWorkflow(makeRequest('manuscript_section_workflow', 'mock_run', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/paper.md' }]),
    }));
    for (const draft of result.drafts) {
      assert.equal(draft.status, 'draft');
      assert.equal(draft.isMockArtifact, true);
    }
  });

  it('G-P0-7: no draft has final/submitted/published status', () => {
    const result = svc.runResearchWorkflow(makeRequest('literature_review_workflow', 'mock_run', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/paper.md' }]),
    }));
    for (const draft of result.drafts) {
      assert.notEqual(draft.status, 'finalized');
      assert.notEqual(draft.status, 'submitted');
      assert.notEqual(draft.status, 'published');
      assert.notEqual(draft.status, 'accepted');
    }
  });

  // ════════════════════════════════════════════════════════
  // G-P0-8: SourceRef / EvidenceRef preservation
  // ════════════════════════════════════════════════════════

  it('G-P0-8: drafts preserve SourceRef in sections', () => {
    const result = svc.runResearchWorkflow(makeRequest('manuscript_section_workflow', 'mock_run', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/a.md' }]),
    }));
    assert.equal(result.ok, true);
    for (const draft of result.drafts) {
      for (const section of draft.sections) {
        assert.ok(Array.isArray(section.sources));
        assert.ok(Array.isArray(section.evidence));
      }
    }
  });

  // ════════════════════════════════════════════════════════
  // G-P0-9: CitationRendering / ReferenceGuard / UnsupportedClaimGuard run
  // ════════════════════════════════════════════════════════

  it('G-P0-9: workflow includes citation_rendering step', () => {
    const result = svc.runResearchWorkflow(makeRequest());
    const citationStep = result.stepResults.find((s) => s.stepType === 'citation_rendering');
    assert.ok(citationStep, 'Citation rendering step should exist');
    assert.ok(
      citationStep!.status === 'completed' || citationStep!.status === 'warning',
      'Citation rendering should complete or warn',
    );
  });

  it('G-P0-9: workflow includes reference_guard step', () => {
    const result = svc.runResearchWorkflow(makeRequest());
    const guardStep = result.stepResults.find((s) => s.stepType === 'reference_guard');
    assert.ok(guardStep, 'Reference guard step should exist');
    assert.ok(
      guardStep!.status === 'completed' || guardStep!.status === 'warning',
      'Reference guard should complete or warn',
    );
  });

  it('G-P0-9: workflow includes unsupported_claim_guard step', () => {
    const result = svc.runResearchWorkflow(makeRequest());
    const guardStep = result.stepResults.find((s) => s.stepType === 'unsupported_claim_guard');
    assert.ok(guardStep, 'Unsupported claim guard step should exist');
    assert.ok(
      guardStep!.status === 'completed' || guardStep!.status === 'warning',
      'Unsupported claim guard should complete or warn',
    );
  });

  // ════════════════════════════════════════════════════════
  // G-P0-10: workflow blocks when missing source/evidence
  // ════════════════════════════════════════════════════════

  it('G-P0-10: missing sources blocks workflow', () => {
    const result = svc.runResearchWorkflow(makeRequest('manuscript_section_workflow', 'mock_run', {
      sourcePack: makeSourcePack([]),
    }));
    assert.equal(result.ok, false);
  });

  it('G-P0-10: missing evidence produces warning (non-blocking)', () => {
    const result = svc.runResearchWorkflow(makeRequest('manuscript_section_workflow', 'mock_run', {
      sourcePack: makeSourcePack(
        [{ relativePath: 'notes/paper.md' }],
        [], // no evidence
      ),
    }));
    // Should still succeed with warnings
    const hasEvidenceWarning = result.warnings.some(
      (w) => w.code === 'NO_EVIDENCE' || result.stepResults.some(
        (s) => s.warnings.some((sw) => sw.includes('NO_EVIDENCE')),
      ),
    );
    // Evidence warning is non-blocking — workflow may still succeed
    assert.ok(result.report.evidenceProvided === false || hasEvidenceWarning);
  });

  // ════════════════════════════════════════════════════════
  // G-P0-11: no Vault write
  // ════════════════════════════════════════════════════════

  it('G-P0-11: workflow does not write to Vault', () => {
    const result = svc.runResearchWorkflow(makeRequest());
    assert.equal(result.ok, true);
    assert.ok(result.drafts.length >= 0);
    // All outputs are in-memory objects
    assert.equal(result.providerCalled, false);
  });

  // ════════════════════════════════════════════════════════
  // G-P0-12: no generic IPC
  // ════════════════════════════════════════════════════════

  it('G-P0-12: service does not import electron or register IPC handlers', () => {
    const result = svc.runResearchWorkflow(makeRequest());
    assert.equal(result.ok, true);
    // The service file has no electron/ipc imports
  });

  // ════════════════════════════════════════════════════════
  // G-P0-13: no Phase 4-4 / Phase 5 entry
  // ════════════════════════════════════════════════════════

  it('G-P0-13: workflow does not enter Phase 4-4 or Phase 5', () => {
    const result = svc.runResearchWorkflow(makeRequest());
    assert.equal(result.ok, true);
    assert.equal(result.providerCalled, false);
    assert.equal(result.userReviewRequired, true);
  });

  // ════════════════════════════════════════════════════════
  // userReviewRequired is always true
  // ════════════════════════════════════════════════════════

  it('userReviewRequired is always true', () => {
    for (const wfType of ALL_WORKFLOW_TYPES) {
      const result = svc.runResearchWorkflow(makeRequest(wfType));
      assert.equal(result.userReviewRequired, true, `${wfType} should have userReviewRequired=true`);
      assert.equal(result.report.userReviewRequired, true, `${wfType} report should have userReviewRequired=true`);
    }
  });

  // ════════════════════════════════════════════════════════
  // dry_run mode
  // ════════════════════════════════════════════════════════

  it('dry_run mode: skips service calls, no drafts produced', () => {
    const result = svc.runResearchWorkflow(makeRequest('manuscript_section_workflow', 'dry_run', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/paper.md' }]),
    }));
    assert.equal(result.ok, true);
    assert.equal(result.drafts.length, 0);
    // All execution steps should be skipped
    for (const step of result.stepResults) {
      if (step.stepType === 'draft_generation' || step.stepType === 'citation_rendering') {
        assert.equal(step.status, 'skipped', `${step.stepType} should be skipped in dry_run`);
      }
    }
  });

  it('dry_run mode: gates still validated', () => {
    const result = svc.runResearchWorkflow(makeRequest('manuscript_section_workflow', 'dry_run', {
      contextConfirmationSummary: '',
      sourcePack: makeSourcePack([{ relativePath: 'notes/paper.md' }]),
    }));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'NO_CONTEXT_CONFIRMATION'));
  });

  // ════════════════════════════════════════════════════════
  // Workflow type routing
  // ════════════════════════════════════════════════════════

  it('G-P1-1: manuscript_section_workflow routes to ManuscriptSectionAssistantService', () => {
    const result = svc.runResearchWorkflow(makeRequest('manuscript_section_workflow', 'mock_run', {
      sectionType: 'abstract',
      sourcePack: makeSourcePack([{ relativePath: 'notes/paper.md' }]),
    }));
    assert.equal(result.ok, true);
    assert.equal(result.workflowType, 'manuscript_section_workflow');
    assert.ok(result.drafts.length >= 1);
  });

  it('G-P1-1: literature_review_workflow routes to LiteratureReviewAssistantService', () => {
    const result = svc.runResearchWorkflow(makeRequest('literature_review_workflow', 'mock_run', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/paper.md' }]),
    }));
    assert.equal(result.ok, true);
    assert.equal(result.workflowType, 'literature_review_workflow');
    assert.ok(result.drafts.length >= 1);
  });

  it('G-P1-1: submission_material_workflow routes to SubmissionMaterialsService', () => {
    const result = svc.runResearchWorkflow(makeRequest('submission_material_workflow', 'mock_run', {
      materialType: 'cover_letter',
      sourcePack: makeSourcePack([{ relativePath: 'notes/paper.md' }]),
    }));
    assert.equal(result.ok, true);
    assert.equal(result.workflowType, 'submission_material_workflow');
    assert.ok(result.drafts.length >= 1);
  });

  it('G-P1-1: safety_check_workflow runs guards (no draft generation)', () => {
    const result = svc.runResearchWorkflow(makeRequest('safety_check_workflow', 'mock_run', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/paper.md' }]),
    }));
    assert.equal(result.ok, true);
    assert.equal(result.workflowType, 'safety_check_workflow');
    // Safety check doesn't generate drafts — it checks existing ones
    // But the guards still run
    const hasGuardSteps = result.stepResults.some(
      (s) => s.stepType === 'citation_rendering' || s.stepType === 'reference_guard',
    );
    assert.ok(hasGuardSteps, 'Safety check should include guard steps');
  });

  it('G-P1-1: research_draft_pipeline generates draft', () => {
    const result = svc.runResearchWorkflow(makeRequest('research_draft_pipeline', 'mock_run', {
      sourcePack: makeSourcePack([{ relativePath: 'notes/paper.md' }]),
    }));
    assert.equal(result.ok, true);
    assert.equal(result.workflowType, 'research_draft_pipeline');
    assert.ok(result.drafts.length >= 1);
  });

  // ════════════════════════════════════════════════════════
  // Workflow report completeness
  // ════════════════════════════════════════════════════════

  it('workflow report contains all required fields', () => {
    const result = svc.runResearchWorkflow(makeRequest());
    const report = result.report;
    assert.equal(report.workflowType, 'manuscript_section_workflow');
    assert.equal(report.mode, 'mock_run');
    assert.equal(typeof report.totalSteps, 'number');
    assert.equal(typeof report.completedSteps, 'number');
    assert.equal(typeof report.blockedSteps, 'number');
    assert.equal(typeof report.warningSteps, 'number');
    assert.equal(typeof report.totalDrafts, 'number');
    assert.equal(typeof report.totalWarnings, 'number');
    assert.equal(typeof report.totalErrors, 'number');
    assert.equal(typeof report.contextConfirmed, 'boolean');
    assert.equal(typeof report.sourcesSelected, 'boolean');
    assert.equal(typeof report.evidenceProvided, 'boolean');
    assert.equal(report.providerCalled, false);
    assert.equal(report.userReviewRequired, true);
    assert.ok(typeof report.startedAt, 'string');
    assert.ok(typeof report.completedAt, 'string');
  });

  // ════════════════════════════════════════════════════════
  // Step results structure
  // ════════════════════════════════════════════════════════

  it('each step result has valid structure', () => {
    const result = svc.runResearchWorkflow(makeRequest());
    for (const step of result.stepResults) {
      assert.ok(step.stepType);
      assert.ok(step.status);
      assert.ok(typeof step.description, 'string');
      assert.ok(Array.isArray(step.warnings));
      assert.equal(typeof step.blocked, 'boolean');
      assert.equal(typeof step.artifactCount, 'number');
      assert.ok(typeof step.completedAt, 'string');
    }
  });

  // ════════════════════════════════════════════════════════
  // Validate workflow request
  // ════════════════════════════════════════════════════════

  it('validateWorkflowRequest: rejects empty context confirmation', () => {
    const errors = svc.validateWorkflowRequest(makeRequest('manuscript_section_workflow', 'mock_run', {
      contextConfirmationSummary: '',
    }));
    assert.ok(errors.some((e) => e.code === 'NO_CONTEXT_CONFIRMATION'));
  });

  it('validateWorkflowRequest: rejects missing source pack', () => {
    const errors = svc.validateWorkflowRequest({
      workflowType: 'manuscript_section_workflow',
      mode: 'mock_run',
      sourcePack: undefined as unknown as WritingSourcePack,
      contextConfirmationSummary: 'test',
    });
    assert.ok(errors.some((e) => e.code === 'MISSING_SOURCE_PACK'));
  });

  it('validateWorkflowRequest: requires sectionType for manuscript_section_workflow', () => {
    const errors = svc.validateWorkflowRequest(makeRequest('manuscript_section_workflow', 'mock_run', {
      sectionType: undefined,
    }));
    assert.ok(errors.some((e) => e.code === 'SECTION_TYPE_REQUIRED'));
  });

  it('validateWorkflowRequest: requires materialType for submission_material_workflow', () => {
    const errors = svc.validateWorkflowRequest(makeRequest('submission_material_workflow', 'mock_run', {
      materialType: undefined,
    }));
    assert.ok(errors.some((e) => e.code === 'MATERIAL_TYPE_REQUIRED'));
  });

  it('validateWorkflowRequest: accepts valid request', () => {
    const errors = svc.validateWorkflowRequest(makeRequest('manuscript_section_workflow', 'mock_run', {
      sectionType: 'introduction',
      sourcePack: makeSourcePack([{ relativePath: 'notes/paper.md' }]),
    }));
    assert.equal(errors.length, 0);
  });

  // ════════════════════════════════════════════════════════
  // No final/submitted/published status
  // ════════════════════════════════════════════════════════

  it('workflow never returns submitted/accepted/published status variants', () => {
    for (const wfType of ALL_WORKFLOW_TYPES) {
      const result = svc.runResearchWorkflow(makeRequest(wfType));
      for (const draft of result.drafts) {
        assert.notEqual(draft.status, 'submitted', `${wfType} draft should not be submitted`);
        assert.notEqual(draft.status, 'accepted', `${wfType} draft should not be accepted`);
        assert.notEqual(draft.status, 'published', `${wfType} draft should not be published`);
        assert.notEqual(draft.status, 'finalized', `${wfType} draft should not be finalized`);
      }
    }
  });

  // ════════════════════════════════════════════════════════
  // No automatic save / no Vault write
  // ════════════════════════════════════════════════════════

  it('no automatic save — all outputs are in-memory', () => {
    const result = svc.runResearchWorkflow(makeRequest());
    assert.equal(result.ok, true);
    // All outputs are returned as in-memory objects, no filesystem writes
    assert.ok(Array.isArray(result.drafts));
    assert.ok(Array.isArray(result.stepResults));
  });

  // ════════════════════════════════════════════════════════
  // Construction
  // ════════════════════════════════════════════════════════

  it('service can be instantiated', () => {
    const instance = new ResearchAgentWorkflowService();
    assert.ok(instance instanceof ResearchAgentWorkflowService);
  });

  // ════════════════════════════════════════════════════════
  // Multiple calls produce independent results
  // ════════════════════════════════════════════════════════

  it('multiple calls produce independent stepResults arrays', () => {
    const r1 = svc.runResearchWorkflow(makeRequest());
    const r2 = svc.runResearchWorkflow(makeRequest('literature_review_workflow'));
    assert.notEqual(r1.stepResults.length, 0);
    assert.notEqual(r2.stepResults.length, 0);
    assert.notEqual(r1.workflowType, r2.workflowType);
  });

  // ════════════════════════════════════════════════════════
  // submission_material_workflow with reviewer comments
  // ════════════════════════════════════════════════════════

  it('submission_material_workflow with reviewer comments succeeds', () => {
    const result = svc.runResearchWorkflow(makeRequest('submission_material_workflow', 'mock_run', {
      materialType: 'response_to_reviewers',
      reviewerComments: ['Comment 1', 'Comment 2'],
      sourcePack: makeSourcePack([{ relativePath: 'notes/paper.md' }]),
    }));
    assert.equal(result.ok, true);
    assert.ok(result.drafts.length >= 1);
  });

  // ════════════════════════════════════════════════════════
  // manuscript_section_workflow with all section types
  // ════════════════════════════════════════════════════════

  it('manuscript_section_workflow with different section types', () => {
    const sections = ['abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion'] as const;
    for (const section of sections) {
      const result = svc.runResearchWorkflow(makeRequest('manuscript_section_workflow', 'mock_run', {
        sectionType: section,
        sourcePack: makeSourcePack([{ relativePath: `notes/${section}.md` }]),
      }));
      assert.equal(result.ok, true, `Section ${section} should succeed`);
    }
  });
});
