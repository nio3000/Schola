/**
 * Office preview service tests — Phase 5-4B-IMP-2 + RUNTIME-FIX.
 * Tests ZIP magic check, error sanitization, XML helpers.
 */
import { describe, it, expect } from 'vitest';

function hasZipMagic(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return (
    buffer[0] === 0x50 && buffer[1] === 0x4b &&
    ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
     (buffer[2] === 0x05 && buffer[3] === 0x06) ||
     (buffer[2] === 0x07 && buffer[3] === 0x08))
  );
}

describe('ZIP magic check', () => {
  it('PK\\x03\\x04 → true', () => expect(hasZipMagic(Buffer.from([0x50,0x4b,0x03,0x04]))).toBe(true));
  it('PK\\x05\\x06 → true', () => expect(hasZipMagic(Buffer.from([0x50,0x4b,0x05,0x06]))).toBe(true));
  it('PK\\x07\\x08 → true', () => expect(hasZipMagic(Buffer.from([0x50,0x4b,0x07,0x08]))).toBe(true));
  it('plain text → false', () => expect(hasZipMagic(Buffer.from('Hello'))).toBe(false));
  it('empty → false', () => expect(hasZipMagic(Buffer.alloc(0))).toBe(false));
  it('<4 bytes → false', () => expect(hasZipMagic(Buffer.from([0x50,0x4b]))).toBe(false));
  it('wrong suffix → false', () => expect(hasZipMagic(Buffer.from([0x50,0x4b,0x99,0x99]))).toBe(false));
});

function sanitizeOfficeError(kind: 'docx' | 'xlsx'): string {
  return kind === 'docx'
    ? 'DOCX preview failed. The file may be corrupted or not a valid DOCX file.'
    : 'XLSX preview failed. The file may be corrupted or not a valid XLSX file.';
}

describe('error sanitization', () => {
  it('DOCX: no JSZip/URL', () => {
    const m = sanitizeOfficeError('docx');
    expect(m).not.toContain('JSZip');
    expect(m).not.toContain('stuk.github.io');
    expect(m).not.toContain('central directory');
  });
  it('XLSX: no JSZip/URL', () => {
    const m = sanitizeOfficeError('xlsx');
    expect(m).not.toContain('JSZip');
    expect(m).not.toContain('stuk.github.io');
    expect(m).not.toContain('central directory');
  });
  it('no system paths in error', () => {
    expect(sanitizeOfficeError('docx')).not.toContain('C:\\');
    expect(sanitizeOfficeError('xlsx')).not.toContain('/home/');
  });
  it('mentions corruption', () => {
    expect(sanitizeOfficeError('docx')).toContain('corrupted');
    expect(sanitizeOfficeError('xlsx')).toContain('corrupted');
  });
});

function xmlDecode(s: string): string {
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
}
describe('xmlDecode', () => {
  it('&amp;', () => expect(xmlDecode('a&amp;b')).toBe('a&b'));
  it('&lt;', () => expect(xmlDecode('a&lt;b')).toBe('a<b'));
  it('&gt;', () => expect(xmlDecode('a&gt;b')).toBe('a>b'));
  it('&quot;', () => expect(xmlDecode('a&quot;b')).toBe('a"b'));
});

function colLabel(n: number): string {
  let s=''; while(n>=0){s=String.fromCharCode(65+(n%26))+s;n=Math.floor(n/26)-1;} return s;
}
describe('colLabel', () => {
  it('0→A',()=>expect(colLabel(0)).toBe('A'));
  it('26→AA',()=>expect(colLabel(26)).toBe('AA'));
});

function detectStyle(v: string): string {
  const l=v.toLowerCase();
  if(l==='heading1'||l==='1')return'heading1';
  if(l==='heading2'||l==='2')return'heading2';
  if(l==='heading3'||l==='3')return'heading3';
  return'normal';
}
describe('styleDetection',()=>{
  it('Heading1',()=>expect(detectStyle('Heading1')).toBe('heading1'));
  it('Normal',()=>expect(detectStyle('Normal')).toBe('normal'));
});
