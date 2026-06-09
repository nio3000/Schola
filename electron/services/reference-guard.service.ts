/**
 * ReferenceGuardService — Phase 4-3-C.
 *
 * Validates citation markers and reference metadata against known sources.
 * Detects fabricated DOI, PMID, journal metadata, and external database claims.
 *
 * Key invariants:
 * - local-only: no external database lookup
 * - no fabricated references: blocks fake DOI/PMID/journal metadata
 * - no source → no citation: citations must reference known Vault sources
 * - relativePath-only: citation targets never expose absolute paths
 * - deterministic: same input always produces same output
 * - no provider call, no embedding call, no network
 * - no Vault write, no generic IPC
 * - no Phase 4-4 / Phase 5 entry
 */
import type {
  CitationMarker,
  ReferenceGuardResult,
  ReferenceViolation,
  ReferenceViolationReason,
  WritingDraftArtifact,
} from '../../src/lib/contracts/research-writing.types';
import type { SourceRef } from '../../src/lib/contracts/local-qa.types';

/** Patterns that indicate a fabricated DOI. */
const FAKE_DOI_PATTERNS: RegExp[] = [
  /10\.\d{2,}\/[-._;()\/:A-Z0-9]+/i,  // Standard DOI format
  /DOI:\s*10\./i,                       // DOI: prefix
  /doi:\s*10\./i,                       // doi: prefix
  /https?:\/\/doi\.org\//i,             // DOI resolver URL
];

/** Patterns that indicate a fabricated PMID. */
const FAKE_PMID_PATTERNS: RegExp[] = [
  /PMID:\s*\d+/i,          // PMID: followed by numbers
  /pmid:\s*\d+/i,          // pmid: followed by numbers
  /PubMed\s+ID:\s*\d+/i,   // PubMed ID
];

/** Patterns that indicate fabricated journal metadata. */
const FAKE_JOURNAL_PATTERNS: RegExp[] = [
  /Journal\s+of\s+\w+/i,           // "Journal of X"
  /[A-Z][a-z]+\set\sal\.\s*\d+/i,  // "Author et al. 2024"
  /Vol\.\s*\d+/i,                   // "Vol. 123"
  /pp\.\s*\d+/i,                    // "pp. 123-456"
  /\(\d{4}\)/,                      // "(2024)"
];

/** Patterns that indicate an external database claim. */
const EXTERNAL_DB_PATTERNS: RegExp[] = [
  /PubMed/i,
  /Crossref/i,
  /OpenAlex/i,
  /Google\s*Scholar/i,
  /Scopus/i,
  /Web\s*of\s*Science/i,
];

export class ReferenceGuardService {
  /**
   * Run reference guard on an entire draft artifact.
   * Validates all citation markers across all sections.
   */
  guardReferences(draft: WritingDraftArtifact): ReferenceGuardResult {
    const violations: ReferenceViolation[] = [];

    for (const section of draft.sections) {
      // Check section content for fabricated metadata
      const contentViolations = this.guardContent(
        section.content,
        section.citations,
      );
      violations.push(...contentViolations);

      // Check each citation marker
      for (const marker of section.citations) {
        const markerViolations = this.guardCitationMarker(marker);
        violations.push(...markerViolations);
      }
    }

    const totalCitations = draft.allCitations.length;
    const verifiedCitations = totalCitations - violations.length;

    return {
      passes: violations.length === 0,
      totalCitations,
      verifiedCitations: Math.max(0, verifiedCitations),
      violations,
    };
  }

  /**
   * Guard a single citation marker.
   * Checks: source validity, no absolute paths, no fabricated metadata.
   */
  guardCitationMarker(marker: CitationMarker): ReferenceViolation[] {
    const violations: ReferenceViolation[] = [];

    // Check source has valid relativePath
    if (!marker.sourceRef.relativePath || marker.sourceRef.relativePath.trim().length === 0) {
      violations.push({
        citation: marker,
        reason: 'source_not_in_vault',
        detail: 'Citation marker references a source with empty relativePath. Source must exist in Vault.',
      });
    }

    // Check no absolute path leak
    if (this.hasAbsolutePath(marker.sourceRef.relativePath)) {
      violations.push({
        citation: marker,
        reason: 'source_not_in_vault',
        detail: `Source path appears to be absolute: ${marker.sourceRef.relativePath}. All references must use relative paths.`,
      });
    }

    // Check the label doesn't contain fabricated DOI
    if (this.containsFakeDOI(marker.label)) {
      violations.push({
        citation: marker,
        reason: 'fabricated_doi',
        detail: `Citation label "${marker.label}" appears to contain a fabricated or unverified DOI.`,
      });
    }

    // Check the label doesn't contain fabricated PMID
    if (this.containsFakePMID(marker.label)) {
      violations.push({
        citation: marker,
        reason: 'fabricated_pmid',
        detail: `Citation label "${marker.label}" appears to contain a fabricated or unverified PMID.`,
      });
    }

    return violations;
  }

  /**
   * Guard draft content for fabricated metadata and external database claims.
   */
  guardContent(
    content: string,
    citations: readonly CitationMarker[],
  ): ReferenceViolation[] {
    const violations: ReferenceViolation[] = [];

    // Use first citation as the associated marker for content-level violations
    const fallbackMarker = citations.length > 0 ? citations[0] : null;

    // Check for fabricated DOI in content
    if (this.containsFakeDOI(content)) {
      const marker = this.findRelevantCitation(content, citations, 'doi');
      violations.push({
        citation: marker ?? fallbackMarker ?? this.makePlaceholderMarker(),
        reason: 'fabricated_doi',
        detail: 'Document content contains a DOI that cannot be verified against local Vault sources.',
      });
    }

    // Check for fabricated PMID in content
    if (this.containsFakePMID(content)) {
      const marker = this.findRelevantCitation(content, citations, 'pmid');
      violations.push({
        citation: marker ?? fallbackMarker ?? this.makePlaceholderMarker(),
        reason: 'fabricated_pmid',
        detail: 'Document content contains a PMID that cannot be verified against local Vault sources.',
      });
    }

    // Check for fabricated journal metadata
    if (this.containsFakeJournalMetadata(content)) {
      violations.push({
        citation: fallbackMarker ?? this.makePlaceholderMarker(),
        reason: 'fabricated_journal',
        detail: 'Document content contains journal metadata (journal name, volume, pages) not present in local Vault sources.',
      });
    }

    // Check for external database claims
    if (this.containsExternalDatabaseClaim(content)) {
      violations.push({
        citation: fallbackMarker ?? this.makePlaceholderMarker(),
        reason: 'external_database_claim',
        detail: 'Document content references external databases (PubMed, Crossref, etc.) without verified local source integration.',
      });
    }

    return violations;
  }

  /**
   * Validate a single source reference against known Vault sources.
   * Phase 4-3-C: simplified check — source is valid if relativePath is non-empty and not absolute.
   */
  validateKnownSource(source: SourceRef): boolean {
    return (
      typeof source.relativePath === 'string' &&
      source.relativePath.trim().length > 0 &&
      !this.hasAbsolutePath(source.relativePath)
    );
  }

  /**
   * Detect fabricated DOI in a text string.
   */
  detectFabricatedDOI(text: string): boolean {
    return this.containsFakeDOI(text);
  }

  /**
   * Detect fabricated PMID in a text string.
   */
  detectFabricatedPMID(text: string): boolean {
    return this.containsFakePMID(text);
  }

  /**
   * Detect fabricated journal metadata in a text string.
   */
  detectFabricatedJournal(text: string): boolean {
    return this.containsFakeJournalMetadata(text);
  }

  /**
   * Detect external database claim in a text string.
   */
  detectExternalDatabaseClaim(text: string): boolean {
    return this.containsExternalDatabaseClaim(text);
  }

  /**
   * Detect absolute path leak in a text string.
   */
  detectAbsolutePathLeak(text: string): boolean {
    return this.hasAbsolutePath(text);
  }

  // ── Private helpers ───────────────────────────────────

  private containsFakeDOI(text: string): boolean {
    return FAKE_DOI_PATTERNS.some((p) => p.test(text));
  }

  private containsFakePMID(text: string): boolean {
    return FAKE_PMID_PATTERNS.some((p) => p.test(text));
  }

  private containsFakeJournalMetadata(text: string): boolean {
    return FAKE_JOURNAL_PATTERNS.some((p) => p.test(text));
  }

  private containsExternalDatabaseClaim(text: string): boolean {
    return EXTERNAL_DB_PATTERNS.some((p) => p.test(text));
  }

  private hasAbsolutePath(path: string): boolean {
    if (!path) return false;
    return path.includes(':\\') || path.includes('\\\\') || path.startsWith('/');
  }

  /**
   * Find the citation marker most relevant to a detected pattern in the content.
   */
  private findRelevantCitation(
    content: string,
    citations: readonly CitationMarker[],
    pattern: string,
  ): CitationMarker | null {
    const lower = content.toLowerCase();
    const idx = lower.indexOf(pattern.toLowerCase());
    if (idx < 0 || citations.length === 0) return null;

    // Find the citation marker closest to the pattern position
    let closest = citations[0];
    let minDist = Math.abs(closest.position - idx);
    for (const c of citations) {
      const dist = Math.abs(c.position - idx);
      if (dist < minDist) {
        minDist = dist;
        closest = c;
      }
    }
    return closest;
  }

  /**
   * Create a placeholder citation marker for violations not tied to a specific marker.
   */
  private makePlaceholderMarker(): CitationMarker {
    return {
      sourceRef: { relativePath: 'unknown', chunkIndex: 0, headingPath: [], score: 0 },
      label: '[?]',
      position: -1,
      isVerified: false,
    };
  }
}
