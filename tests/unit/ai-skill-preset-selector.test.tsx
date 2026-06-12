import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import React, { type ReactElement } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { describe, it } from 'vitest';
import { AIResearchMainView } from '../../src/features/ai-research/AIResearchMainView';
import { getAllSkills } from '../../src/lib/ai-skill-preset-registry';

function renderAsync(element: ReactElement): Promise<string> {
  return new Promise((resolve, reject) => {
    let html = '';
    let settled = false;
    const output = new PassThrough();
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Render timed out'));
    }, 5000);

    output.on('data', (chunk: Buffer) => {
      html += chunk.toString('utf8');
    });
    output.on('end', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(html);
    });

    try {
      const stream = renderToPipeableStream(element, {
        onAllReady() {
          stream.pipe(output);
        },
        onError(error) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      });
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

describe('AI skill preset selector', () => {
  it('renders skill selector from official registry', async () => {
    const html = await renderAsync(
      React.createElement(AIResearchMainView, {
        vaultId: null,
        fileTree: [],
        selectedFile: null,
      }),
    );

    assert.ok(html.includes('ai-research-skill-select'), 'Skill select must render');
    for (const skill of getAllSkills()) {
      assert.ok(html.includes(skill.title), `Skill option must render: ${skill.title}`);
    }
  });

  it('keeps skill presets static and provider-free', () => {
    for (const skill of getAllSkills()) {
      assert.ok(skill.skillId.startsWith('schola.skill.'), 'Skill must use official namespace');
      assert.equal(
        skill.phaseBoundaryNote.includes('不自动') || skill.phaseBoundaryNote.includes('不执行'),
        true,
        'Skill boundary note must forbid automatic external action',
      );
    }
  });
});
