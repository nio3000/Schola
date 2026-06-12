/**
 * CSV parser tests — Phase 5-4B-IMP-1.
 */
import { describe, it, expect } from 'vitest';
import { parseCsv } from '../../src/features/resources/csvParser';

describe('parseCsv', () => {
  it('parses simple CSV', () => {
    const r = parseCsv('a,b,c\n1,2,3\n4,5,6');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.headers).toEqual(['a', 'b', 'c']);
      expect(r.rows).toHaveLength(2);
      expect(r.rows[0]).toEqual(['1', '2', '3']);
    }
  });

  it('parses quoted fields', () => {
    const r = parseCsv('"a,b",c\n"1",2');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.headers).toEqual(['a,b', 'c']);
      expect(r.rows[0]).toEqual(['1', '2']);
    }
  });

  it('handles escaped quotes', () => {
    const r = parseCsv('a,b\n"say ""hello""",2');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows[0][0]).toBe('say "hello"');
    }
  });

  it('returns error for empty string', () => {
    const r = parseCsv('');
    expect(r.ok).toBe(false);
  });

  it('returns error for whitespace only', () => {
    const r = parseCsv('   \n  ');
    expect(r.ok).toBe(false);
  });

  it('truncates rows beyond maxRows', () => {
    const lines = ['h1,h2'];
    for (let i = 0; i < 20; i++) lines.push(`${i},${i * 2}`);
    const r = parseCsv(lines.join('\n'), { maxRows: 5, maxCols: 50 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows.length).toBeLessThanOrEqual(5);
      expect(r.truncatedRows).toBe(true);
    }
  });

  it('truncates columns beyond maxCols', () => {
    const headers = Array.from({ length: 60 }, (_, i) => `c${i}`).join(',');
    const row = Array.from({ length: 60 }, (_, i) => `${i}`).join(',');
    const r = parseCsv(`${headers}\n${row}`, { maxRows: 200, maxCols: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.headers.length).toBeLessThanOrEqual(10);
      expect(r.truncatedColumns).toBe(true);
    }
  });

  it('preserves header count', () => {
    const r = parseCsv('name,age,city\nAlice,30,NYC');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.headers).toHaveLength(3);
  });

  it('preserves row count', () => {
    const r = parseCsv('a,b\n1,2\n3,4\n5,6');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.totalRows).toBe(3);
      expect(r.rows).toHaveLength(3);
    }
  });
});
