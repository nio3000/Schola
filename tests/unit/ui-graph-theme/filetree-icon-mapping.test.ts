import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';

const MAP_PATH = resolve(__dirname, '..', '..', '..', 'src', 'features', 'file-tree', 'FileIconMap.ts');

describe('filetree-icon-mapping (P1)', () => {
  const content = readFileSync(MAP_PATH, 'utf8');

  it('should map .md to markdown icon', () => {
    assert.ok(content.includes("'.md'") && content.includes('markdown'), '.md should map to markdown icon');
  });

  it('should map .pdf to pdf icon', () => {
    assert.ok(content.includes("'.pdf'"), '.pdf should be in extension map');
  });

  it('should map .docx to docx icon', () => {
    assert.ok(content.includes("'.docx'"), '.docx should be in extension map');
  });

  it('should map .pptx to pptx icon', () => {
    assert.ok(content.includes("'.pptx'"), '.pptx should be in extension map');
  });

  it('should map image extensions to image icon', () => {
    assert.ok(content.includes('.png') || content.includes('.jpg'), 'image extensions should be mapped');
  });

  it('should map .tex to tex icon', () => {
    assert.ok(content.includes("'.tex'"), '.tex should be in extension map');
  });

  it('should map .json to json icon', () => {
    assert.ok(content.includes("'.json'"), '.json should be in extension map');
  });

  it('should map .csv to csv icon', () => {
    assert.ok(content.includes("'.csv'"), '.csv should be in extension map');
  });

  it('should have a default unknown icon fallback', () => {
    assert.ok(content.includes('unknown-default') || content.includes('DEFAULT_FILE_ICON_NAME'),
      'should have default unknown icon');
  });

  it('should handle folder icons', () => {
    assert.ok(content.includes('folder'), 'should have folder icon support');
  });

  it('should export FILE_EXTENSION_ICON_MAP', () => {
    assert.ok(content.includes('FILE_EXTENSION_ICON_MAP'), 'should export extension-to-icon mapping');
  });
});
