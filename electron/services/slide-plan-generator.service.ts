/**
 * SlidePlanGeneratorService — Phase 4-4-B.
 *
 * Generates deterministic mock SlidePlans from user-selected Vault sources,
 * existing artifacts, or user-provided content. Produces source-backed,
 * evidence-backed slide deck artifacts with draft-only status.
 *
 * Key invariants:
 * - selected input required: at least one of sources/artifacts/userContent must be non-empty
 * - no input → insufficient_evidence error
 * - source-backed / evidence-backed: every factual SlideContentBlock carries SourceRef/EvidenceRef
 * - no invented facts / metrics / figures / tables
 * - draft-only: status always 'draft', never 'final'/'presented'/'published'
 * - providerCalled=false: no real provider call, no embedding call, no network
 * - userReviewRequired=true: user must review all outputs
 * - no PPT rendering, no PPT export, no PPT-master reference
 * - no Vault write, no generic IPC
 * - no Phase 5 plugin entry
 * - slide count limit: enforced via maxSlides
 * - deterministic mock: same input → same output
 */
import type {
  SlidePlanGenerationRequest,
  SlidePlanGenerationResult,
  SlidePlanGenerationReport,
  SlidePlanGenerationWarning,
  SlidePlanGenerationError,
  SlidePlan,
  SlideSectionPlan,
  SlideItem,
  SlideContentBlock,
  SlideDeckArtifact,
} from '../../src/lib/contracts/ppt-artifact.types';
import { generateSlideDeckId } from '../../src/lib/contracts/ppt-artifact.types';
import type { SourceRef, EvidenceRef } from '../../src/lib/contracts/local-qa.types';

// ── Constants ──────────────────────────────────────────

/** Default maximum slides if request does not specify. */
const DEFAULT_MAX_SLIDES = 50;

/** Minimum slide count to include an agenda slide. */
const MIN_SLIDES_FOR_AGENDA = 3;

/** Error codes for validation failures. */
const ERROR_CODES = {
  NO_INPUT: 'insufficient_evidence',
  EMPTY_TOPIC: 'empty_topic',
  EMPTY_REQUEST_ID: 'empty_request_id',
  INVALID_MAX_SLIDES: 'invalid_max_slides',
  CONTEXT_NOT_CONFIRMED: 'context_not_confirmed',
} as const;

/** Slide layout assignments by slide role. */
const LAYOUT = {
  TITLE: 'title_slide' as const,
  AGENDA: 'content' as const,
  CONTENT: 'content' as const,
  SUMMARY: 'content' as const,
};

// ── Helpers ────────────────────────────────────────────

/** Extract a section name from a source's heading path. */
function sectionNameFromSource(source: SourceRef, index: number): string {
  if (source.headingPath.length > 0) {
    const lastHeading = source.headingPath[source.headingPath.length - 1];
    // Strip leading "# " markers for display
    return lastHeading.replace(/^#+\s*/, '');
  }
  // Fall back to filename from relativePath
  const parts = source.relativePath.replace(/\\/g, '/').split('/');
  const fileName = parts[parts.length - 1] || `Source ${index + 1}`;
  return fileName.replace(/\.[^.]+$/, '');
}

/** Build an EvidenceRef from a SourceRef using heading path as excerpt. */
function evidenceFromSource(source: SourceRef): EvidenceRef {
  const headingText =
    source.headingPath.length > 0
      ? source.headingPath.join(' > ').replace(/^#+\s*/g, '')
      : `Source: ${source.relativePath}`;
  return {
    source,
    excerpt: headingText.slice(0, 200),
    excerptTokenCount: Math.max(1, Math.ceil(headingText.length / 4)),
  };
}

/** Derive section titles from selected sources. */
function deriveSectionsFromSources(sources: readonly SourceRef[]): string[] {
  return sources.map((s, i) => sectionNameFromSource(s, i));
}

/** Derive a section title from user-provided content. */
function deriveSectionFromUserContent(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length === 0) return 'User Content';
  // Use first non-empty line as section title, truncated
  const firstLine = trimmed.split('\n')[0].trim();
  return firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine;
}

// ── Content Block Factories ─────────────────────────────

function makeTextBlock(
  text: string,
  sources: readonly SourceRef[],
  evidence: readonly EvidenceRef[],
  confidence?: number,
): SlideContentBlock {
  const hasSources = sources.length > 0;
  return {
    blockType: 'text',
    content: text,
    items: [],
    sources,
    evidence,
    assetRef: null,
    confidence: confidence ?? (hasSources ? 0.85 : 0.5),
    hasUnsupportedClaims: !hasSources,
  };
}

function makeBulletBlock(
  items: readonly string[],
  sources: readonly SourceRef[],
  evidence: readonly EvidenceRef[],
): SlideContentBlock {
  const hasSources = sources.length > 0;
  return {
    blockType: 'bullet_list',
    content: '',
    items,
    sources,
    evidence,
    assetRef: null,
    confidence: hasSources ? 0.85 : 0.5,
    hasUnsupportedClaims: !hasSources,
  };
}

function makeTitleBlock(title: string): SlideContentBlock {
  return {
    blockType: 'title',
    content: title,
    items: [],
    sources: [],
    evidence: [],
    assetRef: null,
    confidence: 1.0,
    hasUnsupportedClaims: false,
  };
}

function makeSubtitleBlock(subtitle: string): SlideContentBlock {
  return {
    blockType: 'subtitle',
    content: subtitle,
    items: [],
    sources: [],
    evidence: [],
    assetRef: null,
    confidence: 1.0,
    hasUnsupportedClaims: false,
  };
}

// ── Slide Builders ──────────────────────────────────────

function buildTitleSlide(
  request: SlidePlanGenerationRequest,
): SlideItem {
  const blocks: SlideContentBlock[] = [makeTitleBlock(request.topic)];

  const purposeInfo = `Purpose: ${request.purpose} | Audience: ${request.audience}`;
  blocks.push(makeTextBlock(purposeInfo, [], []));

  return {
    index: 0,
    title: request.topic,
    layout: LAYOUT.TITLE,
    blocks,
    notes: '',
    allSources: [],
    allEvidence: [],
    hasUnsupportedClaims: false,
  };
}

function buildAgendaSlide(
  _request: SlidePlanGenerationRequest,
  plan: SlidePlan,
  slideIndex: number,
): SlideItem {
  const items = plan.sections.map((s) => s.title);
  const evidence = plan.allSources.map((s) => evidenceFromSource(s));
  const agendaBlock = makeBulletBlock(items, plan.allSources, evidence);

  return {
    index: slideIndex,
    title: 'Outline',
    layout: LAYOUT.AGENDA,
    blocks: [agendaBlock],
    notes: '',
    allSources: plan.allSources,
    allEvidence: evidence,
    hasUnsupportedClaims: false,
  };
}

function buildContentSlide(
  section: SlideSectionPlan,
  slideIndex: number,
): SlideItem {
  const evidence = section.sources.map((s) => evidenceFromSource(s));
  const blocks: SlideContentBlock[] = [];

  // Section header block
  blocks.push(makeTextBlock(section.description, section.sources, evidence, 0.85));

  // Bullet points derived from source headings
  const bulletItems = section.sources.map((s, i) => {
    const heading = s.headingPath.length > 0
      ? s.headingPath[s.headingPath.length - 1].replace(/^#+\s*/, '')
      : `Reference from ${s.relativePath}`;
    return `Key point from "${heading}"`;
  });

  if (bulletItems.length > 0) {
    blocks.push(makeBulletBlock(bulletItems, section.sources, evidence));
  }

  return {
    index: slideIndex,
    title: section.title,
    layout: LAYOUT.CONTENT,
    blocks,
    notes: '',
    allSources: section.sources,
    allEvidence: evidence,
    hasUnsupportedClaims: false,
  };
}

function buildSummarySlide(
  request: SlidePlanGenerationRequest,
  plan: SlidePlan,
  slideIndex: number,
): SlideItem {
  const summaryText =
    `This presentation covers ${plan.sections.length} sections across ` +
    `${plan.totalEstimatedSlides} estimated slides. ` +
    `Backed by ${plan.allSources.length} source(s) from the Vault.`;

  const evidence = plan.allSources.map((s) => evidenceFromSource(s));
  const summaryBlock = makeTextBlock(summaryText, plan.allSources, evidence, 0.8);

  return {
    index: slideIndex,
    title: 'Summary',
    layout: LAYOUT.SUMMARY,
    blocks: [summaryBlock],
    notes: '',
    allSources: plan.allSources,
    allEvidence: evidence,
    hasUnsupportedClaims: false,
  };
}

// ── SlidePlanGeneratorService ───────────────────────────

export class SlidePlanGeneratorService {
  /**
   * Generate a SlidePlan from selected sources, artifacts, or user content.
   * Produces a deterministic mock slide deck artifact.
   */
  generateSlidePlan(request: SlidePlanGenerationRequest): SlidePlanGenerationResult {
    const errors = this.validateSlidePlanRequest(request);
    if (errors.length > 0) {
      return this.failureResult(request, errors);
    }

    const plan = this.buildSlidePlanFromSelectedSources(request);
    const slides = this.buildAllSlides(request, plan);
    const deck = this.buildSlideDeckArtifact(request, plan, slides);
    const warnings = this.collectSlidePlanWarnings(request, slides.length, deck.slideCount);
    const report = this.buildSlidePlanReport(request, plan, deck, warnings);

    return {
      ok: true,
      plan,
      deck,
      report,
      warnings,
      errors: [],
      providerCalled: false,
      userReviewRequired: true,
    };
  }

  /**
   * Validate the request.
   * Returns errors that prevent generation. Empty array = valid.
   */
  validateSlidePlanRequest(request: SlidePlanGenerationRequest): SlidePlanGenerationError[] {
    const errors: SlidePlanGenerationError[] = [];

    // requestId required
    if (!request.requestId || request.requestId.trim().length === 0) {
      errors.push({
        code: ERROR_CODES.EMPTY_REQUEST_ID,
        message: 'requestId is required and must not be empty.',
      });
    }

    // topic required
    if (!request.topic || request.topic.trim().length === 0) {
      errors.push({
        code: ERROR_CODES.EMPTY_TOPIC,
        message: 'topic is required and must not be empty.',
      });
    }

    // At least one input source required
    const hasSources = request.selectedSources.length > 0;
    const hasArtifacts = request.selectedArtifacts.length > 0;
    const hasUserContent =
      request.userProvidedContent && request.userProvidedContent.trim().length > 0;

    if (!hasSources && !hasArtifacts && !hasUserContent) {
      errors.push({
        code: ERROR_CODES.NO_INPUT,
        message:
          'No input provided. At least one of selectedSources, selectedArtifacts, or userProvidedContent is required.',
        details:
          'Select Vault sources, reference existing artifacts, or provide content to generate a slide plan.',
      });
    }

    // maxSlides must be positive
    if (request.maxSlides <= 0) {
      errors.push({
        code: ERROR_CODES.INVALID_MAX_SLIDES,
        message: `maxSlides must be greater than 0. Got: ${request.maxSlides}.`,
      });
    }

    // confirmedContext required
    if (!request.confirmedContext) {
      errors.push({
        code: ERROR_CODES.CONTEXT_NOT_CONFIRMED,
        message: 'Context must be confirmed by the user before generation.',
      });
    }

    return errors;
  }

  // ── Private: Plan Construction ────────────────────────

  /**
   * Build a SlidePlan from the request's selected sources,
   * artifacts, and user-provided content.
   */
  private buildSlidePlanFromSelectedSources(
    request: SlidePlanGenerationRequest,
  ): SlidePlan {
    const sections: SlideSectionPlan[] = [];
    const allSourcesSet = new Set<SourceRef>();

    // Sections from selected sources
    const sourceSectionNames = deriveSectionsFromSources(request.selectedSources);
    for (let i = 0; i < request.selectedSources.length; i++) {
      const source = request.selectedSources[i];
      const title = sourceSectionNames[i];
      const desc = `Content derived from source: ${source.relativePath}`;
      sections.push({
        title,
        estimatedSlideCount: 1,
        sources: [source],
        description: desc,
      });
      allSourcesSet.add(source);
    }

    // Section from user-provided content
    if (
      request.userProvidedContent &&
      request.userProvidedContent.trim().length > 0
    ) {
      const ucTitle = deriveSectionFromUserContent(request.userProvidedContent);
      sections.push({
        title: ucTitle,
        estimatedSlideCount: 1,
        sources: [],
        description: 'User-provided content section.',
      });
    }

    const allSources = [...allSourcesSet];

    return {
      title: request.topic,
      subtitle: `${request.purpose} — ${request.audience}`,
      sections,
      totalEstimatedSlides: sections.reduce((sum, s) => sum + s.estimatedSlideCount, 0),
      allSources,
    };
  }

  // ── Private: Slide Assembly ───────────────────────────

  /**
   * Build all slides for the deck: title, optional agenda, content, summary.
   * Enforces maxSlides limit.
   */
  private buildAllSlides(
    request: SlidePlanGenerationRequest,
    plan: SlidePlan,
  ): SlideItem[] {
    const effectiveMax = request.maxSlides > 0 ? request.maxSlides : DEFAULT_MAX_SLIDES;
    const slides: SlideItem[] = [];
    let index = 0;

    // 1. Title slide (always)
    slides.push(buildTitleSlide(request));
    index++;

    // 2. Agenda slide (if enough room)
    const canFitAgenda = index < effectiveMax - 2; // need room for at least 1 content + summary
    const hasEnoughSections = plan.sections.length >= MIN_SLIDES_FOR_AGENDA;
    if (canFitAgenda && hasEnoughSections) {
      slides.push(buildAgendaSlide(request, plan, index));
      index++;
    }

    // 3. Content slides — one per section, respecting maxSlides
    for (const section of plan.sections) {
      if (index >= effectiveMax - 1) break; // reserve last slot for summary
      slides.push(buildContentSlide(section, index));
      index++;
    }

    // 4. Summary slide (always last, unless maxSlides is 1)
    if (index < effectiveMax) {
      slides.push(buildSummarySlide(request, plan, index));
    }

    return slides;
  }

  // ── Private: Artifact Construction ────────────────────

  private buildSlideDeckArtifact(
    request: SlidePlanGenerationRequest,
    plan: SlidePlan,
    slides: SlideItem[],
  ): SlideDeckArtifact {
    const now = new Date().toISOString();
    const allSrcs: SourceRef[] = [];
    const allEvs: EvidenceRef[] = [];
    const seenSourceKeys = new Set<string>();

    for (const slide of slides) {
      for (const block of slide.blocks) {
        for (const src of block.sources) {
          const key = `${src.relativePath}:${src.chunkIndex}`;
          if (!seenSourceKeys.has(key)) {
            seenSourceKeys.add(key);
            allSrcs.push(src);
          }
        }
        for (const ev of block.evidence) {
          allEvs.push(ev);
        }
      }
    }

    return {
      id: generateSlideDeckId(),
      title: request.topic,
      subtitle: plan.subtitle,
      slides,
      plan,
      status: 'draft',
      slideCount: slides.length,
      totalSourceRefs: allSrcs.length,
      totalEvidenceRefs: allEvs.length,
      isMockArtifact: true,
      providerCalled: false,
      providerId: '',
      userReviewRequired: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  // ── Private: Report ────────────────────────────────────

  private buildSlidePlanReport(
    request: SlidePlanGenerationRequest,
    plan: SlidePlan,
    deck: SlideDeckArtifact,
    warnings: readonly SlidePlanGenerationWarning[],
  ): SlidePlanGenerationReport {
    const effectiveMax = request.maxSlides > 0 ? request.maxSlides : DEFAULT_MAX_SLIDES;
    let totalBlocks = 0;
    let unsupported = 0;

    for (const slide of deck.slides) {
      totalBlocks += slide.blocks.length;
      for (const block of slide.blocks) {
        if (block.hasUnsupportedClaims) unsupported++;
      }
    }

    // Count blocks from user-provided content sections as unsupported
    const hasUserContent = !!(
      request.userProvidedContent && request.userProvidedContent.trim().length > 0
    );

    return {
      requestId: request.requestId,
      topic: request.topic,
      sourceCount: request.selectedSources.length,
      artifactCount: request.selectedArtifacts.length,
      hasUserProvidedContent: hasUserContent,
      totalSlides: deck.slideCount,
      totalBlocks,
      totalSourceRefs: deck.totalSourceRefs,
      totalEvidenceRefs: deck.totalEvidenceRefs,
      unsupportedClaimCount: unsupported,
      generatedSections: plan.sections.map((s) => s.title),
      slideCountLimited: deck.slideCount >= effectiveMax,
      isMockGeneration: true,
      providerCalled: false,
      userReviewRequired: true,
      generatedAt: new Date().toISOString(),
      warnings: warnings.map((w) => w.message),
    };
  }

  // ── Private: Warnings ──────────────────────────────────

  private collectSlidePlanWarnings(
    request: SlidePlanGenerationRequest,
    generatedCount: number,
    finalCount: number,
  ): SlidePlanGenerationWarning[] {
    const warnings: SlidePlanGenerationWarning[] = [];
    const effectiveMax = request.maxSlides > 0 ? request.maxSlides : DEFAULT_MAX_SLIDES;

    // Warn if slide count was limited
    if (finalCount >= effectiveMax) {
      warnings.push({
        code: 'slide_count_limited',
        message: `Slide count limited to ${effectiveMax}. Some sections may have been omitted.`,
      });
    }

    // Warn if no sources provided (content relies purely on user input)
    if (request.selectedSources.length === 0) {
      warnings.push({
        code: 'no_source_references',
        message:
          'No Vault sources selected. Generated content has limited source backing.',
      });
    }

    // Warn if content slides were omitted due to limit
    if (generatedCount > finalCount) {
      warnings.push({
        code: 'content_truncated',
        message: `${generatedCount - finalCount} section(s) omitted due to slide count limit.`,
      });
    }

    return warnings;
  }

  // ── Private: Failure Result ────────────────────────────

  private failureResult(
    request: SlidePlanGenerationRequest,
    errors: SlidePlanGenerationError[],
  ): SlidePlanGenerationResult {
    const now = new Date().toISOString();
    const effectiveMax = request.maxSlides > 0 ? request.maxSlides : DEFAULT_MAX_SLIDES;
    const hasUserContent = !!(
      request.userProvidedContent && request.userProvidedContent.trim().length > 0
    );

    const failureReport: SlidePlanGenerationReport = {
      requestId: request.requestId || '',
      topic: request.topic || '',
      sourceCount: request.selectedSources.length,
      artifactCount: request.selectedArtifacts.length,
      hasUserProvidedContent: hasUserContent,
      totalSlides: 0,
      totalBlocks: 0,
      totalSourceRefs: 0,
      totalEvidenceRefs: 0,
      unsupportedClaimCount: 0,
      generatedSections: [],
      slideCountLimited: false,
      isMockGeneration: true,
      providerCalled: false,
      userReviewRequired: true,
      generatedAt: now,
      warnings: errors.map((e) => e.message),
    };

    return {
      ok: false,
      plan: null,
      deck: null,
      report: failureReport,
      warnings: [],
      errors,
      providerCalled: false,
      userReviewRequired: true,
    };
  }
}
