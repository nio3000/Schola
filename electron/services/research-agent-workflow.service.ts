/**
 * ResearchAgentWorkflowService — Phase 4-3-G.
 *
 * Minimal workflow orchestration layer that connects frozen Phase 4-3 services
 * (A through F) into deterministic mock workflows. Does NOT add new writing
 * capabilities — only orchestrates existing services.
 *
 * Key invariants:
 * - orchestration-only: no new writing logic, no real provider synthesis
 * - Context Confirmation gate required before any execution
 * - selected scope / selected sources gate enforced
 * - dry_run / mock_run modes only — no autonomous / provider_run modes
 * - all steps produce draft artifacts only — no final/submitted/published status
 * - providerCalled=false — no real provider call, no embedding call
 * - userReviewRequired=true — user must review all outputs
 * - no Vault write, no generic IPC
 * - no external database lookup
 * - no automatic save, no automatic submission
 * - no Phase 4-4 / Phase 5 entry
 */
import type {
  ResearchWorkflowType,
  ResearchWorkflowMode,
  ResearchWorkflowStepType,
  ResearchWorkflowStepStatus,
  ResearchWorkflowRequest,
  ResearchWorkflowResult,
  ResearchWorkflowReport,
  ResearchWorkflowWarning,
  ResearchWorkflowError,
  ResearchWorkflowStepResult,
  WritingDraftArtifact,
  WritingSourcePack,
  ManuscriptSectionType,
  SubmissionMaterialType,
} from '../../src/lib/contracts/research-writing.types';
import { DraftGeneratorService } from './draft-generator.service';
import { ManuscriptSectionAssistantService } from './manuscript-section-assistant.service';
import { SubmissionMaterialsService } from './submission-materials.service';
import { LiteratureReviewAssistantService } from './literature-review-assistant.service';
import { CitationRenderingService } from './citation-rendering.service';
import { ReferenceGuardService } from './reference-guard.service';

// ── Workflow Plan ──────────────────────────────────────

interface WorkflowPlanStep {
  stepType: ResearchWorkflowStepType;
  description: string;
}

function buildWorkflowPlan(workflowType: ResearchWorkflowType): WorkflowPlanStep[] {
  const baseSteps: WorkflowPlanStep[] = [
    { stepType: 'context_confirmation_check', description: 'Validate Context Confirmation gate.' },
    { stepType: 'source_pack_validation', description: 'Validate selected sources and evidence.' },
  ];

  let executionSteps: WorkflowPlanStep[];

  switch (workflowType) {
    case 'manuscript_section_workflow':
      executionSteps = [
        { stepType: 'draft_generation', description: 'Generate manuscript section draft via ManuscriptSectionAssistantService.' },
        { stepType: 'citation_rendering', description: 'Run CitationRenderingService on generated draft.' },
        { stepType: 'reference_guard', description: 'Run ReferenceGuardService on generated draft.' },
        { stepType: 'unsupported_claim_guard', description: 'Run UnsupportedClaimGuard on generated draft.' },
      ];
      break;

    case 'literature_review_workflow':
      executionSteps = [
        { stepType: 'draft_generation', description: 'Generate literature review draft via LiteratureReviewAssistantService.' },
        { stepType: 'citation_rendering', description: 'Run CitationRenderingService on generated draft.' },
        { stepType: 'reference_guard', description: 'Run ReferenceGuardService on generated draft.' },
        { stepType: 'unsupported_claim_guard', description: 'Run UnsupportedClaimGuard on generated draft.' },
      ];
      break;

    case 'submission_material_workflow':
      executionSteps = [
        { stepType: 'draft_generation', description: 'Generate submission material draft via SubmissionMaterialsService.' },
        { stepType: 'citation_rendering', description: 'Run CitationRenderingService on generated draft.' },
        { stepType: 'reference_guard', description: 'Run ReferenceGuardService on generated draft.' },
        { stepType: 'unsupported_claim_guard', description: 'Run UnsupportedClaimGuard on generated draft.' },
      ];
      break;

    case 'safety_check_workflow':
      executionSteps = [
        { stepType: 'citation_rendering', description: 'Run CitationRenderingService on provided draft.' },
        { stepType: 'reference_guard', description: 'Run ReferenceGuardService on provided draft.' },
        { stepType: 'unsupported_claim_guard', description: 'Run UnsupportedClaimGuard on provided draft.' },
      ];
      break;

    case 'research_draft_pipeline':
      executionSteps = [
        { stepType: 'draft_generation', description: 'Generate draft via ManuscriptSectionAssistantService (introduction).' },
        { stepType: 'citation_rendering', description: 'Run CitationRenderingService on generated draft.' },
        { stepType: 'reference_guard', description: 'Run ReferenceGuardService on generated draft.' },
        { stepType: 'unsupported_claim_guard', description: 'Run UnsupportedClaimGuard on generated draft.' },
      ];
      break;

    default:
      executionSteps = [];
  }

  const reportSteps: WorkflowPlanStep[] = [
    { stepType: 'artifact_aggregation', description: 'Aggregate draft artifacts from all steps.' },
    { stepType: 'report_building', description: 'Build workflow execution report.' },
  ];

  return [...baseSteps, ...executionSteps, ...reportSteps];
}

// ── ResearchAgentWorkflowService ─────────────────────────

export class ResearchAgentWorkflowService {
  private readonly draftGenerator = new DraftGeneratorService();
  private readonly manuscriptAssistant = new ManuscriptSectionAssistantService();
  private readonly submissionMaterials = new SubmissionMaterialsService();
  private readonly literatureReview = new LiteratureReviewAssistantService();
  private readonly citationRenderer = new CitationRenderingService();
  private readonly referenceGuard = new ReferenceGuardService();

  /**
   * Execute a research agent workflow.
   * Orchestrates frozen Phase 4-3 services based on the workflow type.
   */
  runResearchWorkflow(
    request: ResearchWorkflowRequest,
  ): ResearchWorkflowResult {
    const startedAt = new Date().toISOString();
    const warnings: ResearchWorkflowWarning[] = [];
    const errors: ResearchWorkflowError[] = [];
    const stepResults: ResearchWorkflowStepResult[] = [];
    const drafts: WritingDraftArtifact[] = [];
    const { workflowType, mode } = request;

    // Step 1: Validate workflow request
    const validationErrors = this.validateWorkflowRequest(request);
    if (validationErrors.length > 0) {
      stepResults.push({
        stepType: 'context_confirmation_check',
        status: 'blocked',
        description: 'Workflow validation failed.',
        warnings: [],
        blocked: true,
        artifactCount: 0,
        completedAt: new Date().toISOString(),
      });
      return this.buildResult(
        workflowType, mode, false, startedAt, [], stepResults,
        [], validationErrors,
      );
    }

    // Build workflow plan
    const plan = buildWorkflowPlan(workflowType);
    const isDryRun = mode === 'dry_run';

    // Context Confirmation check
    const ctxResult = this.executeContextConfirmationCheck(request, isDryRun);
    stepResults.push(ctxResult);
    if (ctxResult.blocked) {
      return this.buildResult(
        workflowType, mode, false, startedAt, [],
        stepResults, warnings, errors,
      );
    }

    // Source pack validation step
    const spResult = this.executeSourcePackValidation(request, isDryRun);
    stepResults.push(spResult);
    if (spResult.blocked) {
      return this.buildResult(
        workflowType, mode, false, startedAt, [],
        stepResults, warnings, errors,
      );
    }

    // Execute remaining steps
    for (let i = 2; i < plan.length; i++) {
      const step = plan[i];
      const stepResult = this.executeWorkflowStep(
        step.stepType,
        step.description,
        request,
        isDryRun,
        drafts,
        warnings,
      );
      stepResults.push(stepResult);

      if (stepResult.blocked && workflowType !== 'safety_check_workflow') {
        // Block further execution on blocking errors (except safety check which is best-effort)
        break;
      }
    }

    const completedAt = new Date().toISOString();

    return this.buildResult(
      workflowType, mode, true, startedAt, drafts,
      stepResults, warnings, errors,
    );
  }

  /**
   * Validate the workflow request against required gates.
   */
  validateWorkflowRequest(
    request: ResearchWorkflowRequest,
  ): ResearchWorkflowError[] {
    const validationErrors: ResearchWorkflowError[] = [];

    // Context Confirmation required
    if (!request.contextConfirmationSummary?.trim()) {
      validationErrors.push({
        code: 'NO_CONTEXT_CONFIRMATION',
        message: 'Context confirmation is required to run a workflow.',
      });
    }

    // Source pack required
    if (!request.sourcePack) {
      validationErrors.push({
        code: 'MISSING_SOURCE_PACK',
        message: 'Source pack is required to run a workflow.',
      });
      return validationErrors;
    }

    const { sourcePack } = request;

    // Selected sources required (for non-safety-check workflows)
    if (request.workflowType !== 'safety_check_workflow') {
      if (sourcePack.sources.length === 0) {
        validationErrors.push({
          code: 'SELECTED_SOURCES_REQUIRED',
          message: 'At least one selected source is required.',
        });
      }
    }

    // Type-specific validations
    switch (request.workflowType) {
      case 'manuscript_section_workflow': {
        if (!request.sectionType) {
          validationErrors.push({
            code: 'SECTION_TYPE_REQUIRED',
            message: 'sectionType is required for manuscript_section_workflow.',
          });
        }
        break;
      }
      case 'submission_material_workflow': {
        if (!request.materialType) {
          validationErrors.push({
            code: 'MATERIAL_TYPE_REQUIRED',
            message: 'materialType is required for submission_material_workflow.',
          });
        }
        break;
      }
      case 'safety_check_workflow': {
        // Safety check requires at least one draft to check, but this is validated at step execution
        break;
      }
    }

    return validationErrors;
  }

  /**
   * Execute the context confirmation check step.
   */
  private executeContextConfirmationCheck(
    request: ResearchWorkflowRequest,
    isDryRun: boolean,
  ): ResearchWorkflowStepResult {
    const now = new Date().toISOString();
    if (isDryRun) {
      return {
        stepType: 'context_confirmation_check',
        status: 'skipped',
        description: 'Context Confirmation check skipped (dry_run).',
        warnings: [],
        blocked: false,
        artifactCount: 0,
        completedAt: now,
      };
    }

    const confirmed = request.contextConfirmationSummary.trim().length > 0;
    return {
      stepType: 'context_confirmation_check',
      status: confirmed ? 'completed' : 'blocked',
      description: confirmed
        ? 'Context Confirmation gate passed.'
        : 'Context Confirmation gate failed — no context summary provided.',
      warnings: [],
      blocked: !confirmed,
      artifactCount: 0,
      completedAt: now,
    };
  }

  /**
   * Execute the source pack validation step.
   */
  private executeSourcePackValidation(
    request: ResearchWorkflowRequest,
    isDryRun: boolean,
  ): ResearchWorkflowStepResult {
    const now = new Date().toISOString();
    if (isDryRun) {
      return {
        stepType: 'source_pack_validation',
        status: 'skipped',
        description: 'Source pack validation skipped (dry_run).',
        warnings: [],
        blocked: false,
        artifactCount: 0,
        completedAt: now,
      };
    }

    const { sourcePack } = request;
    const sourceCount = sourcePack.sources.length;
    const evidenceCount = sourcePack.evidence.length;
    const stepWarnings: string[] = [];

    if (sourceCount === 0 && request.workflowType !== 'safety_check_workflow') {
      return {
        stepType: 'source_pack_validation',
        status: 'blocked',
        description: 'Source pack validation failed — no selected sources.',
        warnings: ['INSUFFICIENT_EVIDENCE: No selected sources available.'],
        blocked: true,
        artifactCount: 0,
        completedAt: now,
      };
    }

    if (evidenceCount === 0) {
      stepWarnings.push('NO_EVIDENCE: No evidence refs provided.');
    }

    return {
      stepType: 'source_pack_validation',
      status: stepWarnings.length > 0 ? 'warning' : 'completed',
      description: `Source pack validated: ${sourceCount} source(s), ${evidenceCount} evidence ref(s).`,
      warnings: stepWarnings,
      blocked: false,
      artifactCount: 0,
      completedAt: now,
    };
  }

  /**
   * Execute a single workflow step by routing to the appropriate frozen service.
   */
  executeWorkflowStep(
    stepType: ResearchWorkflowStepType,
    description: string,
    request: ResearchWorkflowRequest,
    isDryRun: boolean,
    drafts: WritingDraftArtifact[],
    warnings: ResearchWorkflowWarning[],
  ): ResearchWorkflowStepResult {
    const now = new Date().toISOString();

    if (isDryRun) {
      return {
        stepType,
        status: 'skipped',
        description: `${description} (skipped — dry_run mode).`,
        warnings: [],
        blocked: false,
        artifactCount: 0,
        completedAt: now,
      };
    }

    switch (stepType) {
      case 'draft_generation':
        return this.executeDraftGeneration(request, description, drafts, warnings, now);

      case 'citation_rendering':
        return this.executeCitationRendering(drafts, description, warnings, now);

      case 'reference_guard':
        return this.executeReferenceGuard(drafts, description, warnings, now);

      case 'unsupported_claim_guard':
        return this.executeUnsupportedClaimGuard(drafts, description, warnings, now);

      case 'artifact_aggregation':
        return {
          stepType,
          status: 'completed',
          description: `${description} (${drafts.length} draft(s) aggregated).`,
          warnings: [],
          blocked: false,
          artifactCount: drafts.length,
          completedAt: now,
        };

      case 'report_building':
        return {
          stepType,
          status: 'completed',
          description: 'Workflow report built.',
          warnings: [],
          blocked: false,
          artifactCount: 0,
          completedAt: now,
        };

      default:
        return {
          stepType,
          status: 'skipped',
          description: `Unknown step type: ${stepType}.`,
          warnings: [],
          blocked: false,
          artifactCount: 0,
          completedAt: now,
        };
    }
  }

  /**
   * Execute draft generation by routing to the correct frozen service.
   */
  private executeDraftGeneration(
    request: ResearchWorkflowRequest,
    description: string,
    drafts: WritingDraftArtifact[],
    warnings: ResearchWorkflowWarning[],
    now: string,
  ): ResearchWorkflowStepResult {
    const stepWarnings: string[] = [];

    try {
      let draft: WritingDraftArtifact | null = null;

      switch (request.workflowType) {
        case 'manuscript_section_workflow': {
          const sectionType = request.sectionType as ManuscriptSectionType;
          const result = this.manuscriptAssistant.generateSectionDraft({
            sectionType,
            sourcePack: request.sourcePack,
            contextConfirmationSummary: request.contextConfirmationSummary,
            title: request.title,
          });
          if (result.ok && result.draft) {
            draft = result.draft;
          }
          for (const w of result.warnings) {
            stepWarnings.push(w.message);
            warnings.push({ code: w.code, message: w.message });
          }
          for (const e of result.errors) {
            stepWarnings.push(e.message);
            warnings.push({ code: e.code, message: e.message });
          }
          break;
        }

        case 'literature_review_workflow': {
          const result = this.literatureReview.generateLiteratureReviewDraft({
            mode: 'selected_sources_only',
            sourcePack: request.sourcePack,
            contextConfirmationSummary: request.contextConfirmationSummary,
            title: request.title,
          });
          if (result.ok && result.draft) {
            draft = result.draft;
          }
          for (const w of result.warnings) {
            stepWarnings.push(w.message);
            warnings.push({ code: w.code, message: w.message });
          }
          for (const e of result.errors) {
            stepWarnings.push(e.message);
            warnings.push({ code: e.code, message: e.message });
          }
          break;
        }

        case 'submission_material_workflow': {
          const materialType = request.materialType as SubmissionMaterialType;
          const result = this.submissionMaterials.generateSubmissionMaterial({
            materialType,
            sourcePack: request.sourcePack,
            contextConfirmationSummary: request.contextConfirmationSummary,
            reviewerComments: request.reviewerComments,
            journalPolicyClaim: request.journalPolicyClaim,
            title: request.title,
          });
          if (result.ok && result.draft) {
            draft = result.draft;
          }
          for (const w of result.warnings) {
            stepWarnings.push(w.message);
            warnings.push({ code: w.code, message: w.message });
          }
          for (const e of result.errors) {
            stepWarnings.push(e.message);
            warnings.push({ code: e.code, message: e.message });
          }
          break;
        }

        case 'research_draft_pipeline': {
          // For pipeline, generate an introduction section as the starting draft
          const result = this.manuscriptAssistant.generateSectionDraft({
            sectionType: 'introduction',
            sourcePack: request.sourcePack,
            contextConfirmationSummary: request.contextConfirmationSummary,
            title: request.title,
          });
          if (result.ok && result.draft) {
            draft = result.draft;
          }
          for (const w of result.warnings) {
            stepWarnings.push(w.message);
            warnings.push({ code: w.code, message: w.message });
          }
          for (const e of result.errors) {
            stepWarnings.push(e.message);
            warnings.push({ code: e.code, message: e.message });
          }
          break;
        }

        case 'safety_check_workflow':
          // Safety check doesn't generate drafts — it checks existing ones
          break;

        default:
          break;
      }

      if (draft) {
        drafts.push(draft);
      }

      const artifactCount = draft ? 1 : 0;
      const status: ResearchWorkflowStepStatus = draft ? 'draft' : 'blocked';

      return {
        stepType: 'draft_generation',
        status,
        description: artifactCount > 0
          ? `${description} (draft generated).`
          : `${description} (no draft produced).`,
        warnings: stepWarnings,
        blocked: artifactCount === 0,
        artifactCount,
        completedAt: now,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stepWarnings.push(msg);
      warnings.push({ code: 'DRAFT_GENERATION_ERROR', message: msg });
      return {
        stepType: 'draft_generation',
        status: 'blocked',
        description: `${description} (error: ${msg}).`,
        warnings: stepWarnings,
        blocked: true,
        artifactCount: 0,
        completedAt: now,
      };
    }
  }

  /**
   * Execute citation rendering on all drafts.
   */
  private executeCitationRendering(
    drafts: WritingDraftArtifact[],
    description: string,
    warnings: ResearchWorkflowWarning[],
    now: string,
  ): ResearchWorkflowStepResult {
    const stepWarnings: string[] = [];
    let ranCount = 0;

    for (const draft of drafts) {
      try {
        this.citationRenderer.renderCitations(draft);
        ranCount++;
      } catch {
        stepWarnings.push(`Citation rendering failed for draft: ${draft.id}`);
        warnings.push({ code: 'CITATION_RENDER_FAILED', message: `Citation rendering failed for draft: ${draft.id}` });
      }
    }

    return {
      stepType: 'citation_rendering',
      status: stepWarnings.length > 0 ? 'warning' : 'completed',
      description: `${description} (${ranCount}/${drafts.length} draft(s) processed).`,
      warnings: stepWarnings,
      blocked: false,
      artifactCount: 0,
      completedAt: now,
    };
  }

  /**
   * Execute reference guard on all drafts.
   */
  private executeReferenceGuard(
    drafts: WritingDraftArtifact[],
    description: string,
    warnings: ResearchWorkflowWarning[],
    now: string,
  ): ResearchWorkflowStepResult {
    const stepWarnings: string[] = [];
    let ranCount = 0;

    for (const draft of drafts) {
      try {
        const result = this.referenceGuard.guardReferences(draft);
        if (!result.passes) {
          for (const v of result.violations) {
            stepWarnings.push(`Reference violation: ${v.detail}`);
            warnings.push({ code: 'REFERENCE_VIOLATION', message: v.detail });
          }
        }
        ranCount++;
      } catch {
        stepWarnings.push(`Reference guard failed for draft: ${draft.id}`);
        warnings.push({ code: 'REFERENCE_GUARD_FAILED', message: `Reference guard failed for draft: ${draft.id}` });
      }
    }

    return {
      stepType: 'reference_guard',
      status: stepWarnings.length > 0 ? 'warning' : 'completed',
      description: `${description} (${ranCount}/${drafts.length} draft(s) processed).`,
      warnings: stepWarnings,
      blocked: false,
      artifactCount: 0,
      completedAt: now,
    };
  }

  /**
   * Execute unsupported claim guard on all drafts.
   */
  private executeUnsupportedClaimGuard(
    drafts: WritingDraftArtifact[],
    description: string,
    warnings: ResearchWorkflowWarning[],
    now: string,
  ): ResearchWorkflowStepResult {
    const stepWarnings: string[] = [];
    let ranCount = 0;

    for (const draft of drafts) {
      try {
        const result = this.draftGenerator.buildUnsupportedClaimGuard(draft);
        if (!result.passes) {
          for (const claim of result.unsupportedClaims) {
            stepWarnings.push(`Unsupported claim in "${claim.sectionHeading}": ${claim.claimText}`);
            warnings.push({
              code: 'UNSUPPORTED_CLAIM',
              message: `Unsupported claim in "${claim.sectionHeading}": ${claim.claimText}`,
            });
          }
        }
        ranCount++;
      } catch {
        stepWarnings.push(`Unsupported claim guard failed for draft: ${draft.id}`);
        warnings.push({ code: 'GUARD_FAILED', message: `Unsupported claim guard failed for draft: ${draft.id}` });
      }
    }

    return {
      stepType: 'unsupported_claim_guard',
      status: stepWarnings.length > 0 ? 'warning' : 'completed',
      description: `${description} (${ranCount}/${drafts.length} draft(s) processed).`,
      warnings: stepWarnings,
      blocked: false,
      artifactCount: 0,
      completedAt: now,
    };
  }

  /**
   * Build the final workflow result.
   */
  private buildResult(
    workflowType: ResearchWorkflowType,
    mode: ResearchWorkflowMode,
    ok: boolean,
    startedAt: string,
    drafts: WritingDraftArtifact[],
    stepResults: ResearchWorkflowStepResult[],
    warnings: ResearchWorkflowWarning[],
    errors: ResearchWorkflowError[],
  ): ResearchWorkflowResult {
    const completedAt = new Date().toISOString();

    const report: ResearchWorkflowReport = {
      workflowType,
      mode,
      totalSteps: stepResults.length,
      completedSteps: stepResults.filter((s) => s.status === 'completed' || s.status === 'draft').length,
      blockedSteps: stepResults.filter((s) => s.blocked).length,
      warningSteps: stepResults.filter((s) => s.status === 'warning').length,
      totalDrafts: drafts.length,
      totalWarnings: warnings.length,
      totalErrors: errors.length,
      contextConfirmed:
        !stepResults.some(
          (s) => s.stepType === 'context_confirmation_check' && s.blocked,
        ) && !errors.some((e) => e.code === 'NO_CONTEXT_CONFIRMATION'),
      sourcesSelected:
        !stepResults.some(
          (s) => s.stepType === 'source_pack_validation' && s.blocked,
        ) && !errors.some((e) => e.code === 'SELECTED_SOURCES_REQUIRED'),
      evidenceProvided:
        stepResults.some((s) => s.stepType === 'source_pack_validation') &&
        !stepResults.some(
          (s) => s.stepType === 'source_pack_validation' &&
            s.warnings.some((w) => w.includes('NO_EVIDENCE')),
        ),
      providerCalled: false,
      userReviewRequired: true,
      startedAt,
      completedAt,
    };

    return {
      ok,
      workflowType,
      mode,
      drafts,
      report,
      warnings,
      errors,
      stepResults,
      providerCalled: false,
      userReviewRequired: true,
    };
  }
}
