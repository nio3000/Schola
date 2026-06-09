import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';

const sourcePath = path.resolve(process.cwd(), 'electron/services/settings-store.service.ts');
const source = fs.readFileSync(sourcePath, 'utf-8');

const expectedTables = [
  'global_provider_configs',
  'global_privacy_consent',
  'global_ai_preferences',
  'global_confirmation_log',
] as const;

function getCreateTableSql(tableName: string): string {
  const match = source.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName} \\([\\s\\S]*?\\)`));
  assert.ok(match, `${tableName} CREATE TABLE statement should exist`);
  return match[0];
}

function getColumnNames(tableName: string): string[] {
  const createTableSql = getCreateTableSql(tableName);
  const columnBlock = createTableSql.slice(createTableSql.indexOf('(') + 1, createTableSql.lastIndexOf(')'));

  return columnBlock
    .split('\n')
    .map((line) => line.trim().replace(/,$/, ''))
    .filter((line) => line.length > 0)
    .map((line) => line.split(/\s+/)[0]);
}

function assertNoColumns(tableName: string, forbiddenColumns: readonly string[]): void {
  const columnNames = getColumnNames(tableName);
  for (const forbiddenColumn of forbiddenColumns) {
    assert.ok(
      !columnNames.includes(forbiddenColumn),
      `${tableName} must not contain ${forbiddenColumn} column`,
    );
  }
}

describe('Global Settings DB static boundaries', () => {
  it("uses 'schola-settings.db' as the global settings DB filename, not index.db", () => {
    const dbFilenameMatch = source.match(/const DB_FILENAME = '([^']+)'/);

    assert.ok(dbFilenameMatch, 'DB_FILENAME constant should exist');
    assert.equal(dbFilenameMatch[1], 'schola-settings.db');
    assert.notEqual(dbFilenameMatch[1], 'index.db');
  });

  it("builds the DB path from app.getPath('userData')", () => {
    assert.ok(source.includes("app.getPath('userData')"));
    assert.match(source, /path\.join\(app\.getPath\('userData'\), DB_FILENAME\)/);
  });

  it('does not build the DB filename inside a Vault directory pattern', () => {
    assert.doesNotMatch(source, /path\.join\([^)]*vault[^)]*DB_FILENAME/i);
    assert.doesNotMatch(source, /path\.join\([^)]*rootPath[^)]*DB_FILENAME/);
    assert.doesNotMatch(source, /path\.join\([^)]*vaultRoot[^)]*DB_FILENAME/);
  });

  it("global_provider_configs has no key, secret, raw_key, or api_key column", () => {
    assertNoColumns('global_provider_configs', ['key', 'secret', 'raw_key', 'api_key']);
  });

  it('global_privacy_consent has no key or secret column', () => {
    assertNoColumns('global_privacy_consent', ['key', 'secret']);
  });

  it('global_ai_preferences has no key or secret column', () => {
    assertNoColumns('global_ai_preferences', ['key', 'secret']);
  });

  it('global_confirmation_log has no content column', () => {
    assertNoColumns('global_confirmation_log', ['content']);
  });

  it('global_confirmation_log has no relative_path column', () => {
    assertNoColumns('global_confirmation_log', ['relative_path']);
  });

  it('global_confirmation_log has no secret or api_key column', () => {
    assertNoColumns('global_confirmation_log', ['secret', 'api_key']);
  });

  it('uses WAL journal mode for the global settings DB', () => {
    assert.ok(source.includes('WAL') || source.includes('journal_mode'));
    assert.match(source, /PRAGMA\s+journal_mode\s*=\s*WAL/i);
  });

  it('uses node:sqlite DatabaseSync for the global settings DB', () => {
    assert.ok(source.includes('DatabaseSync') || source.includes('node:sqlite'));
    assert.match(source, /import \{ DatabaseSync \} from 'node:sqlite'/);
    assert.match(source, /new DatabaseSync\(dbPath\)/);
  });

  it('defines exactly the four expected global settings tables', () => {
    const tableMatches = [...source.matchAll(/CREATE TABLE IF NOT EXISTS (global_[a-z_]+)/g)];
    const tableNames = tableMatches.map((match) => match[1]);

    assert.deepEqual(tableNames, [...expectedTables]);
    assert.equal(tableNames.length, 4);
  });
});
