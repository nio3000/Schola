/**
 * Runtime Pack manifest service — Phase 3-4-G3-B / G3-D3-C.
 *
 * Loads, parses, and validates a schola-pack.json manifest file.
 * All validation errors use RuntimePackErrorCode enum values as error messages.
 * G3-D3-C: added license/package/signature field validation,
 *          unknown top-level key = reject (_comment exception),
 *          dry-run fixture validation.
 */

import fs from 'node:fs/promises';
import type {
  RuntimePackManifest,
  RuntimePackValidationIssue,
  RuntimePackValidationResult,
} from '../../../src/lib/contracts/runtime-pack.types';
import { validatePublisher, validatePackId, validatePermissions, validateDownloadUrl, validatePipEntries } from './runtime-pack-security.service';
import { getPackManifestPath } from './runtime-pack-path.service';

// ── Public API ───────────────────────────────────

export async function loadManifest(packId: string): Promise<RuntimePackManifest> {
  const manifestPath = getPackManifestPath(packId);

  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, 'utf-8');
  } catch {
    throw new Error('MANIFEST_NOT_FOUND');
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(raw);
  } catch {
    throw new Error('MANIFEST_PARSE_ERROR');
  }

  // validate structural integrity and return typed manifest
  const result = validateManifestStructure(manifest);
  if (!result.ok) {
    const messages = result.issues.map((i) => i.message).join('; ');
    throw new Error(`MANIFEST_VALIDATION_ERROR: ${messages.slice(0, 200)}`);
  }

  return manifest as RuntimePackManifest;
}

export function validateManifestStructure(raw: unknown): RuntimePackValidationResult {
  const issues: RuntimePackValidationIssue[] = [];

  if (typeof raw !== 'object' || raw === null) {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'Manifest is not an object' });
    return { ok: false, issues };
  }

  const m = raw as Record<string, unknown>;

  // Required top-level fields
  checkField(m, 'manifestVersion', 'string', issues);
  checkField(m, 'id', 'string', issues);
  checkField(m, 'name', 'string', issues);
  checkField(m, 'displayName', 'string', issues);
  checkField(m, 'description', 'string', issues);
  checkField(m, 'type', 'string', issues);
  checkField(m, 'publisher', 'string', issues);
  checkField(m, 'version', 'string', issues);
  checkField(m, 'compatibleScholaVersion', 'string', issues);
  checkField(m, 'runtime', 'object', issues);
  checkField(m, 'permissions', 'object', issues);
  checkField(m, 'entrypoints', 'object', issues);
  checkField(m, 'install', 'object', issues);
  checkField(m, 'platformRequirements', 'object', issues);
  // G3-D3-C: license / package / signature
  checkField(m, 'license', 'object', issues);
  checkField(m, 'package', 'object', issues);
  checkField(m, 'signature', 'object', issues);

  // G3-D3-C: unknown top-level key = reject (except _comment)
  for (const key of Object.keys(m)) {
    if (key.startsWith('_') && key !== '_comment') {
      issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: `unknown key: ${key}` });
    }
  }

  if (issues.some((i) => i.severity === 'error')) {
    return { ok: false, issues };
  }

  // Type-specific checks
  if (m.manifestVersion !== '1') {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'manifestVersion must be "1"' });
  }
  if (m.type !== 'runtime-pack') {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'type must be "runtime-pack"' });
  }

  // Runtime checks
  const runtime = m.runtime as Record<string, unknown>;
  if (runtime.kind !== 'python-venv') {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'runtime.kind must be "python-venv"' });
  }
  if (typeof runtime.downloadUrl !== 'string' || runtime.downloadUrl.length === 0) {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'runtime.downloadUrl is required' });
  }
  const integrity = runtime.integrity as Record<string, unknown> | undefined;
  if (!integrity || typeof integrity.runtimeHash !== 'string' || integrity.runtimeHash.length === 0) {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'runtime.integrity.runtimeHash is required' });
  }

  // Platform requirements checks
  const pr = m.platformRequirements as Record<string, unknown>;
  if (!Array.isArray(pr.os) || pr.os.length === 0) {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'platformRequirements.os is required' });
  }
  if (!Array.isArray(pr.arch) || pr.arch.length === 0) {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'platformRequirements.arch is required' });
  }
  if (typeof pr.diskFreeMbMin !== 'number' || pr.diskFreeMbMin <= 0) {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'platformRequirements.diskFreeMbMin is required' });
  }

  // ── G3-D3-C: license validation ──
  const license = m.license as Record<string, unknown>;
  if (typeof license.primaryLicense !== 'string' || license.primaryLicense.length === 0) {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'license.primaryLicense is required' });
  }
  if (!Array.isArray(license.licenseFiles) || license.licenseFiles.length === 0) {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'license.licenseFiles must be a non-empty array' });
  }
  if (!Array.isArray(license.noticeFiles)) {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'license.noticeFiles must be an array' });
  }
  if (!Array.isArray(license.thirdPartyNoticeFiles)) {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'license.thirdPartyNoticeFiles must be an array' });
  }
  if (typeof license.sourceOfferRequired !== 'boolean') {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'license.sourceOfferRequired must be boolean' });
  }
  const commUse = license.commercialUseAllowed;
  if (commUse !== 'yes' && commUse !== 'no' && commUse !== 'unclear') {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'license.commercialUseAllowed must be yes/no/unclear' });
  }
  const redist = license.redistributionAllowed;
  if (redist !== 'yes' && redist !== 'no' && redist !== 'unclear') {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'license.redistributionAllowed must be yes/no/unclear' });
  }

  // ── G3-D3-C: package validation ──
  const pkg = m.package as Record<string, unknown>;
  if (pkg.packageFormat !== 'zip') {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'package.packageFormat must be "zip"' });
  }
  if (typeof pkg.packageVersion !== 'string' || pkg.packageVersion.length === 0) {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'package.packageVersion is required' });
  }
  if (typeof pkg.createdAt !== 'string' || pkg.createdAt.length === 0) {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'package.createdAt is required' });
  }
  if (typeof pkg.containsRuntime !== 'boolean') {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'package.containsRuntime must be boolean' });
  }
  if (typeof pkg.containsModels !== 'boolean') {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'package.containsModels must be boolean' });
  }
  if (typeof pkg.containsNativeBinaries !== 'boolean') {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'package.containsNativeBinaries must be boolean' });
  }

  // ── G3-D3-C: signature validation ──
  const sig = m.signature as Record<string, unknown>;
  const sigTypes = ['none', 'minisign', 'cosign', 'gpg'];
  if (typeof sig.signatureType !== 'string' || !sigTypes.includes(sig.signatureType)) {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'signature.signatureType must be none/minisign/cosign/gpg' });
  }

  // Entrypoint safety checks
  const entrypoints = m.entrypoints as Record<string, unknown>;
  checkEntrypointSafety(entrypoints.probe, 'entrypoints.probe', issues);
  if (entrypoints.convert !== undefined) {
    checkEntrypointSafety(entrypoints.convert, 'entrypoints.convert', issues);
  }
  if (entrypoints.diagnose !== undefined) {
    checkEntrypointSafety(entrypoints.diagnose, 'entrypoints.diagnose', issues);
  }

  // Permission subset check
  if (Array.isArray(m.permissions)) {
    for (const p of m.permissions) {
      if (typeof p !== 'string') {
        issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'permissions contains non-string value' });
      }
    }
  }

  if (issues.some((i) => i.severity === 'error')) {
    return { ok: false, issues };
  }

  return { ok: true, issues };
}

/**
 * Full business-rule validation (requires typed manifest).
 * Separate from structural validation to support staged validation.
 */
export function validateManifestBusiness(manifest: RuntimePackManifest): RuntimePackValidationResult {
  const issues: RuntimePackValidationIssue[] = [];

  try { validatePublisher(manifest); } catch (e) { issues.push(toIssue(e)); }
  try { validatePackId(manifest); } catch (e) { issues.push(toIssue(e)); }
  try { validatePermissions(manifest); } catch (e) { issues.push(toIssue(e)); }

  // downloadUrl
  try { validateDownloadUrl(manifest.runtime.downloadUrl); } catch (e) { issues.push(toIssue(e)); }

  // pip entries
  try { validatePipEntries(manifest.install.pip); } catch (e) { issues.push(toIssue(e)); }

  // extraIndexUrl
  if (manifest.install.extraIndexUrl) {
    try { validateDownloadUrl(manifest.install.extraIndexUrl); } catch (e) { issues.push(toIssue(e)); }
  }

  // model download URLs
  for (const model of manifest.models) {
    try { validateDownloadUrl(model.downloadUrl); } catch (e) { issues.push(toIssue(e)); }
  }

  // ── G3-D3-C: dry-run fixture validation ──
  // If containsRuntime/containsModels/containsNativeBinaries are all false,
  // the manifest is a dry-run fixture — enforce empty pip / models
  if (
    manifest.package.containsRuntime === false &&
    manifest.package.containsModels === false &&
    manifest.package.containsNativeBinaries === false
  ) {
    if (manifest.install.pip.length > 0) {
      issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'dry-run fixture: install.pip must be empty when containsRuntime=false' });
    }
    if (manifest.models.length > 0) {
      issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: 'dry-run fixture: models must be empty when containsModels=false' });
    }
  }

  if (issues.some((i) => i.severity === 'error')) {
    return { ok: false, issues };
  }

  return { ok: true, issues };
}

// ── Helpers ──────────────────────────────────────

function checkField(obj: Record<string, unknown>, field: string, expectedType: string, issues: RuntimePackValidationIssue[]): void {
  const val = obj[field];
  if (val === undefined || val === null) {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: `${field} is missing` });
    return;
  }
  if (typeof val !== expectedType) {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: `${field} must be ${expectedType}` });
  }
}

function checkEntrypointSafety(val: unknown, label: string, issues: RuntimePackValidationIssue[]): void {
  if (typeof val !== 'string') {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: `${label} must be a string` });
    return;
  }
  // Reject file paths
  if (
    val.includes('\\') ||
    (val.includes('/') && !val.startsWith('schola.adapter.')) ||
    val.includes('..') ||
    /^[A-Za-z]:/.test(val)
  ) {
    issues.push({ code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: `${label} must be an adapter ID, not a file path` });
  }
}

function toIssue(err: unknown): RuntimePackValidationIssue {
  const message = err instanceof Error ? err.message : String(err);
  return { code: 'MANIFEST_VALIDATION_ERROR', severity: 'error', message: message.slice(0, 200) };
}
