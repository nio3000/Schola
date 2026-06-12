import { describe, it, expect } from 'vitest';
import { getResourceKindByPath, getResourceSubdir } from '../../src/lib/contracts/resource-classifier';
import { getResourceIconChar, getResourceKindLabel } from '../../src/features/resources/resourceDisplay';

describe('legacy office classifier', () => {
  it('.doc → doc', () => expect(getResourceKindByPath('a.doc')).toBe('doc'));
  it('.xls → xls', () => expect(getResourceKindByPath('a.xls')).toBe('xls'));
  it('doc subdir', () => expect(getResourceSubdir('doc')).toBe('resources/doc'));
  it('xls subdir', () => expect(getResourceSubdir('xls')).toBe('resources/xls'));
  it('.docx unchanged', () => expect(getResourceKindByPath('a.docx')).toBe('docx'));
  it('.xlsx unchanged', () => expect(getResourceKindByPath('a.xlsx')).toBe('xlsx'));
});

describe('legacy office display', () => {
  it('doc badge DOC', () => expect(getResourceIconChar('doc')).toBe('DOC'));
  it('xls badge XLS', () => expect(getResourceIconChar('xls')).toBe('XLS'));
  it('doc label', () => expect(getResourceKindLabel('doc')).toBe('Legacy Word'));
  it('xls label', () => expect(getResourceKindLabel('xls')).toBe('Legacy Excel'));
});
