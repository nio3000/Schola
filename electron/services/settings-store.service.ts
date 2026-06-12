/**
 * Global Settings Store — Phase 5-1-IMP-2.
 *
 * Manages a SQLite database for global application settings stored
 * in the Electron userData directory (NOT inside any user Vault).
 *
 * Tables:
 *   global_provider_configs   — per-provider overrides (no secrets)
 *   global_privacy_consent    — privacy consent state
 *   global_ai_preferences     — AI feature toggles + defaults
 *   global_confirmation_log   — context-send confirmation audit log
 *
 * Uses node:sqlite (DatabaseSync), same as the Vault index DB.
 * NO key/secret/raw_key columns anywhere.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type {
  ProviderConfig,
  PrivacyConsentState,
  AIPreferences,
  ConfirmationLogEntry,
  ContextSendPolicy,
} from '../../src/lib/contracts/settings.types';
import {
  createDefaultProviderConfig,
  createDefaultPrivacyConsentState,
  createDefaultAIPreferences,
} from '../../src/lib/contracts/settings.types';
import { assertString } from '../lib/ipc-validation';

// ── Constants ──────────────────────────────────

const DB_FILENAME = 'schola-settings.db';

// ── Row types (database shapes, not exported) ──

interface ProviderConfigRow {
  provider_id: string;
  display_name: string | null;
  custom_base_url: string | null;
  base_url: string | null;
  selected_model: string | null;
  custom_models: string | null; // JSON array
  remote_models: string | null; // JSON array
  last_model_fetch_at: string | null;
  last_latency_ms: number | null;
  last_latency_test_at: string | null;
  enabled: number; // 0 | 1
  updated_at: string;
}

interface PrivacyConsentRow {
  id: number;
  accepted: number;
  version: string;
  accepted_at: string;
  allow_remote: number;
  default_policy: string;
}

interface AIPreferencesRow {
  id: number;
  ai_enabled: number;
  default_provider_id: string | null;
  default_model: string | null;
  updated_at: string;
}

interface ConfirmationLogRow {
  id: string;
  confirmed: number;
  confirmed_at: string;
  provider_id: string;
  model: string;
  file_count: number;
  total_tokens: number;
  truncated_file_count: number;
  scope: string;
  vault_id: string | null;
}

// ── SCHEMA ─────────────────────────────────────

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS global_provider_configs (
    provider_id    TEXT PRIMARY KEY,
    display_name   TEXT,
    custom_base_url TEXT,
    base_url       TEXT,
    selected_model TEXT,
    custom_models  TEXT,
    remote_models  TEXT,
    last_model_fetch_at TEXT,
    last_latency_ms INTEGER,
    last_latency_test_at TEXT,
    enabled        INTEGER NOT NULL DEFAULT 0,
    updated_at     TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS global_privacy_consent (
    id            INTEGER PRIMARY KEY DEFAULT 1,
    accepted      INTEGER NOT NULL DEFAULT 0,
    version       TEXT NOT NULL DEFAULT '',
    accepted_at   TEXT NOT NULL DEFAULT '',
    allow_remote  INTEGER NOT NULL DEFAULT 0,
    default_policy TEXT NOT NULL DEFAULT 'always-ask'
  )`,

  `CREATE TABLE IF NOT EXISTS global_ai_preferences (
    id                  INTEGER PRIMARY KEY DEFAULT 1,
    ai_enabled          INTEGER NOT NULL DEFAULT 0,
    default_provider_id TEXT,
    default_model       TEXT,
    updated_at          TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS global_confirmation_log (
    id                   TEXT PRIMARY KEY,
    confirmed            INTEGER NOT NULL,
    confirmed_at         TEXT NOT NULL,
    provider_id          TEXT NOT NULL,
    model                TEXT NOT NULL,
    file_count           INTEGER NOT NULL DEFAULT 0,
    total_tokens         INTEGER NOT NULL DEFAULT 0,
    truncated_file_count INTEGER NOT NULL DEFAULT 0,
    scope                TEXT NOT NULL,
    vault_id             TEXT
  )`,
];

// ── Singleton ──────────────────────────────────

let db: DatabaseSync | null = null;

function getDbPath(): string {
  return path.join(app.getPath('userData'), DB_FILENAME);
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getDb(): DatabaseSync {
  if (db) return db;

  const dbPath = getDbPath();
  ensureDir(path.dirname(dbPath));

  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Apply schema
  for (const stmt of SCHEMA_STATEMENTS) {
    db.exec(stmt);
  }

  // Insert default rows if missing
  ensureDefaults(db);

  return db;
}

function ensureDefaults(database: DatabaseSync): void {
  ensureProviderConfigColumns(database);

  // global_privacy_consent default row
  const consentRow = database
    .prepare('SELECT id FROM global_privacy_consent WHERE id = 1')
    .get() as { id: number } | undefined;
  if (!consentRow) {
    const defaults = createDefaultPrivacyConsentState();
    database
      .prepare(
        `INSERT INTO global_privacy_consent (id, accepted, version, accepted_at, allow_remote, default_policy)
         VALUES (1, ?, ?, ?, ?, ?)`,
      )
      .run(
        defaults.privacyConsentAccepted ? 1 : 0,
        defaults.privacyConsentVersion,
        defaults.privacyConsentAcceptedAt,
        defaults.allowRemoteProvider ? 1 : 0,
        defaults.defaultContextSendPolicy,
      );
  }

  // global_ai_preferences default row
  const aiRow = database.prepare('SELECT id FROM global_ai_preferences WHERE id = 1').get() as
    | { id: number }
    | undefined;
  if (!aiRow) {
    const defaults = createDefaultAIPreferences();
    database
      .prepare(
        `INSERT INTO global_ai_preferences (id, ai_enabled, default_provider_id, default_model, updated_at)
         VALUES (1, ?, ?, ?, ?)`,
      )
      .run(
        defaults.aiEnabled ? 1 : 0,
        defaults.defaultProviderId,
        defaults.defaultModel,
        defaults.updatedAt,
      );
  }
}

function ensureProviderConfigColumns(database: DatabaseSync): void {
  const columns = database.prepare('PRAGMA table_info(global_provider_configs)').all() as Array<{
    name: string;
  }>;
  const existing = new Set(columns.map((column) => column.name));
  const migrations: readonly { name: string; sql: string }[] = [
    { name: 'base_url', sql: 'ALTER TABLE global_provider_configs ADD COLUMN base_url TEXT' },
    {
      name: 'selected_model',
      sql: 'ALTER TABLE global_provider_configs ADD COLUMN selected_model TEXT',
    },
    {
      name: 'remote_models',
      sql: 'ALTER TABLE global_provider_configs ADD COLUMN remote_models TEXT',
    },
    {
      name: 'last_model_fetch_at',
      sql: 'ALTER TABLE global_provider_configs ADD COLUMN last_model_fetch_at TEXT',
    },
    {
      name: 'last_latency_ms',
      sql: 'ALTER TABLE global_provider_configs ADD COLUMN last_latency_ms INTEGER',
    },
    {
      name: 'last_latency_test_at',
      sql: 'ALTER TABLE global_provider_configs ADD COLUMN last_latency_test_at TEXT',
    },
  ];

  for (const migration of migrations) {
    if (!existing.has(migration.name)) {
      database.exec(migration.sql);
    }
  }
}

// ── Row → Domain mapping ───────────────────────

function rowToProviderConfig(row: ProviderConfigRow): ProviderConfig {
  let customModels: readonly string[] | undefined;
  let remoteModels: ProviderConfig['remoteModels'];
  if (row.custom_models) {
    try {
      customModels = JSON.parse(row.custom_models) as string[];
    } catch {
      customModels = undefined;
    }
  }
  if (row.remote_models) {
    try {
      remoteModels = JSON.parse(row.remote_models) as ProviderConfig['remoteModels'];
    } catch {
      remoteModels = undefined;
    }
  }

  return {
    providerId: row.provider_id,
    displayName: row.display_name ?? undefined,
    customBaseURL: row.custom_base_url ?? undefined,
    baseUrl: row.base_url ?? row.custom_base_url ?? undefined,
    selectedModel: row.selected_model ?? undefined,
    customModels,
    remoteModels,
    lastModelFetchAt: row.last_model_fetch_at ?? undefined,
    lastLatencyMs: row.last_latency_ms ?? undefined,
    lastLatencyTestAt: row.last_latency_test_at ?? undefined,
    enabled: row.enabled === 1,
    updatedAt: row.updated_at,
  };
}

function rowToPrivacyConsentState(row: PrivacyConsentRow): PrivacyConsentState {
  return {
    privacyConsentAccepted: row.accepted === 1,
    privacyConsentVersion: row.version,
    privacyConsentAcceptedAt: row.accepted_at,
    allowRemoteProvider: row.allow_remote === 1,
    defaultContextSendPolicy: row.default_policy as ContextSendPolicy,
  };
}

function rowToAIPreferences(row: AIPreferencesRow): AIPreferences {
  return {
    aiEnabled: row.ai_enabled === 1,
    defaultProviderId: row.default_provider_id,
    defaultModel: row.default_model,
    updatedAt: row.updated_at,
  };
}

function rowToConfirmationLogEntry(row: ConfirmationLogRow): ConfirmationLogEntry {
  return {
    id: row.id,
    confirmed: row.confirmed === 1,
    confirmedAt: row.confirmed_at,
    providerId: row.provider_id,
    model: row.model,
    fileCount: row.file_count,
    totalTokens: row.total_tokens,
    truncatedFileCount: row.truncated_file_count,
    confirmationScope: row.scope as 'per-request' | 'per-session',
    vaultId: row.vault_id ?? undefined,
  };
}

// ═══════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════

// ── Provider Configs ───────────────────────────

export function getAllProviderConfigs(): readonly ProviderConfig[] {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM global_provider_configs ORDER BY provider_id')
    .all() as unknown as ProviderConfigRow[];
  return rows.map(rowToProviderConfig);
}

export function getProviderConfig(providerId: string): ProviderConfig | null {
  assertString(providerId, 'providerId');
  const database = getDb();
  const row = database
    .prepare('SELECT * FROM global_provider_configs WHERE provider_id = ?')
    .get(providerId) as ProviderConfigRow | undefined;
  return row ? rowToProviderConfig(row) : null;
}

export function setProviderConfig(
  providerId: string,
  partial: Partial<
    Pick<
      ProviderConfig,
      | 'displayName'
      | 'customBaseURL'
      | 'baseUrl'
      | 'selectedModel'
      | 'customModels'
      | 'remoteModels'
      | 'lastModelFetchAt'
      | 'lastLatencyMs'
      | 'lastLatencyTestAt'
      | 'enabled'
    >
  >,
): ProviderConfig {
  assertString(providerId, 'providerId');

  const database = getDb();
  const now = new Date().toISOString();

  // Upsert: insert or update
  const existing = database
    .prepare('SELECT * FROM global_provider_configs WHERE provider_id = ?')
    .get(providerId) as ProviderConfigRow | undefined;

  if (existing) {
    const displayName =
      partial.displayName !== undefined ? partial.displayName : existing.display_name;
    const customBaseURL =
      partial.customBaseURL !== undefined ? partial.customBaseURL : existing.custom_base_url;
    const baseUrl = partial.baseUrl !== undefined ? partial.baseUrl : existing.base_url;
    const selectedModel =
      partial.selectedModel !== undefined ? partial.selectedModel : existing.selected_model;
    const customModels =
      partial.customModels !== undefined
        ? JSON.stringify(partial.customModels)
        : existing.custom_models;
    const remoteModels =
      partial.remoteModels !== undefined
        ? JSON.stringify(partial.remoteModels)
        : existing.remote_models;
    const lastModelFetchAt =
      partial.lastModelFetchAt !== undefined
        ? partial.lastModelFetchAt
        : existing.last_model_fetch_at;
    const lastLatencyMs =
      partial.lastLatencyMs !== undefined ? partial.lastLatencyMs : existing.last_latency_ms;
    const lastLatencyTestAt =
      partial.lastLatencyTestAt !== undefined
        ? partial.lastLatencyTestAt
        : existing.last_latency_test_at;
    const enabled = partial.enabled !== undefined ? (partial.enabled ? 1 : 0) : existing.enabled;

    database
      .prepare(
        `UPDATE global_provider_configs
         SET display_name = ?, custom_base_url = ?, base_url = ?, selected_model = ?,
             custom_models = ?, remote_models = ?, last_model_fetch_at = ?,
             last_latency_ms = ?, last_latency_test_at = ?, enabled = ?, updated_at = ?
         WHERE provider_id = ?`,
      )
      .run(
        displayName,
        customBaseURL,
        baseUrl,
        selectedModel,
        customModels,
        remoteModels,
        lastModelFetchAt,
        lastLatencyMs,
        lastLatencyTestAt,
        enabled,
        now,
        providerId,
      );
  } else {
    const defaults = createDefaultProviderConfig(providerId);
    const displayName =
      partial.displayName !== undefined ? partial.displayName : (defaults.displayName ?? null);
    const customBaseURL =
      partial.customBaseURL !== undefined
        ? partial.customBaseURL
        : (defaults.customBaseURL ?? null);
    const baseUrl = partial.baseUrl !== undefined ? partial.baseUrl : customBaseURL;
    const selectedModel =
      partial.selectedModel !== undefined
        ? partial.selectedModel
        : (defaults.selectedModel ?? null);
    const customModels =
      partial.customModels !== undefined
        ? JSON.stringify(partial.customModels)
        : defaults.customModels
          ? JSON.stringify(defaults.customModels)
          : null;
    const remoteModels =
      partial.remoteModels !== undefined ? JSON.stringify(partial.remoteModels) : null;
    const lastModelFetchAt = partial.lastModelFetchAt ?? null;
    const lastLatencyMs = partial.lastLatencyMs ?? null;
    const lastLatencyTestAt = partial.lastLatencyTestAt ?? null;
    const enabled =
      partial.enabled !== undefined ? (partial.enabled ? 1 : 0) : defaults.enabled ? 1 : 0;

    database
      .prepare(
        `INSERT INTO global_provider_configs
           (provider_id, display_name, custom_base_url, base_url, selected_model,
            custom_models, remote_models, last_model_fetch_at, last_latency_ms,
            last_latency_test_at, enabled, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        providerId,
        displayName,
        customBaseURL,
        baseUrl,
        selectedModel,
        customModels,
        remoteModels,
        lastModelFetchAt,
        lastLatencyMs,
        lastLatencyTestAt,
        enabled,
        now,
      );
  }

  // Return the freshly persisted row
  return getProviderConfig(providerId)!;
}

// ── Privacy Consent ────────────────────────────

export function getPrivacyConsent(): PrivacyConsentState {
  const database = getDb();
  const row = database.prepare('SELECT * FROM global_privacy_consent WHERE id = 1').get() as
    | PrivacyConsentRow
    | undefined;
  if (!row) {
    return createDefaultPrivacyConsentState();
  }
  return rowToPrivacyConsentState(row);
}

export function setPrivacyConsent(consent: PrivacyConsentState): PrivacyConsentState {
  if (!consent || typeof consent !== 'object') {
    throw new Error('INVALID_INPUT: consent must be a valid PrivacyConsentState object.');
  }

  const database = getDb();
  database
    .prepare(
      `UPDATE global_privacy_consent
       SET accepted = ?, version = ?, accepted_at = ?, allow_remote = ?, default_policy = ?
       WHERE id = 1`,
    )
    .run(
      consent.privacyConsentAccepted ? 1 : 0,
      consent.privacyConsentVersion,
      consent.privacyConsentAcceptedAt,
      consent.allowRemoteProvider ? 1 : 0,
      consent.defaultContextSendPolicy,
    );

  return getPrivacyConsent();
}

// ── Context Send Policy ────────────────────────

export function getContextSendPolicy(): ContextSendPolicy {
  return getPrivacyConsent().defaultContextSendPolicy;
}

export function setContextSendPolicy(policy: ContextSendPolicy): ContextSendPolicy {
  const validPolicies: readonly ContextSendPolicy[] = ['never', 'always-ask', 'always-allow-local'];
  if (!validPolicies.includes(policy)) {
    throw new Error(`INVALID_INPUT: policy must be one of: ${validPolicies.join(', ')}.`);
  }

  const current = getPrivacyConsent();
  const updated: PrivacyConsentState = {
    ...current,
    defaultContextSendPolicy: policy,
  };
  setPrivacyConsent(updated);
  return policy;
}

// ── AI Preferences ─────────────────────────────

export function getAIPreferences(): AIPreferences {
  const database = getDb();
  const row = database.prepare('SELECT * FROM global_ai_preferences WHERE id = 1').get() as
    | AIPreferencesRow
    | undefined;
  if (!row) {
    return createDefaultAIPreferences();
  }
  return rowToAIPreferences(row);
}

export function setAIPreferences(
  partial: Partial<Pick<AIPreferences, 'aiEnabled' | 'defaultProviderId' | 'defaultModel'>>,
): AIPreferences {
  if (!partial || typeof partial !== 'object') {
    throw new Error('INVALID_INPUT: prefs must be a valid object.');
  }

  const database = getDb();
  const now = new Date().toISOString();
  const current = getAIPreferences();

  const aiEnabled =
    partial.aiEnabled !== undefined ? (partial.aiEnabled ? 1 : 0) : current.aiEnabled ? 1 : 0;
  const defaultProviderId =
    partial.defaultProviderId !== undefined ? partial.defaultProviderId : current.defaultProviderId;
  const defaultModel =
    partial.defaultModel !== undefined ? partial.defaultModel : current.defaultModel;

  database
    .prepare(
      `UPDATE global_ai_preferences
       SET ai_enabled = ?, default_provider_id = ?, default_model = ?, updated_at = ?
       WHERE id = 1`,
    )
    .run(aiEnabled, defaultProviderId, defaultModel, now);

  return getAIPreferences();
}

// ── Confirmation Log ───────────────────────────

export function getConfirmationLog(limit?: number): readonly ConfirmationLogEntry[] {
  const database = getDb();
  const max = limit !== undefined && limit > 0 ? Math.min(limit, 500) : 100;
  const rows = database
    .prepare('SELECT * FROM global_confirmation_log ORDER BY confirmed_at DESC LIMIT ?')
    .all(max) as unknown as ConfirmationLogRow[];
  return rows.map(rowToConfirmationLogEntry);
}

export function appendConfirmationLog(entry: ConfirmationLogEntry): ConfirmationLogEntry {
  if (!entry || typeof entry !== 'object') {
    throw new Error('INVALID_INPUT: entry must be a valid ConfirmationLogEntry.');
  }
  assertString(entry.id, 'entry.id');
  assertString(entry.providerId, 'entry.providerId');
  assertString(entry.model, 'entry.model');

  const database = getDb();
  database
    .prepare(
      `INSERT INTO global_confirmation_log
         (id, confirmed, confirmed_at, provider_id, model, file_count, total_tokens, truncated_file_count, scope, vault_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      entry.id,
      entry.confirmed ? 1 : 0,
      entry.confirmedAt,
      entry.providerId,
      entry.model,
      entry.fileCount,
      entry.totalTokens,
      entry.truncatedFileCount,
      entry.confirmationScope,
      entry.vaultId ?? null,
    );

  return entry;
}

// ── Lifecycle ──────────────────────────────────

/** Close the settings database. Safe to call multiple times. */
export function closeSettingsDb(): void {
  if (db) {
    try {
      db.close();
    } catch {
      // already closed
    }
    db = null;
  }
}
