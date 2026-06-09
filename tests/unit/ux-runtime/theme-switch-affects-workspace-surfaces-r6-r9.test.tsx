import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..');
const STYLES = readFileSync(resolve(ROOT, 'src', 'styles.css'), 'utf8');

function block(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = STYLES.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`Missing CSS block for ${selector}`);
  return match[1];
}

describe('theme-switch-affects-workspace-surfaces-r6-r9', () => {
  it('Workspace surfaces consume global aliases instead of menu-only tokens', () => {
    expect(block('.workspace-shell')).toContain('background: var(--schola-bg)');
    expect(block('.workspace-body')).toContain('background: var(--schola-bg)');
    expect(block('.schola-sidebar')).toContain('background: var(--schola-sidebar-bg)');
    expect(block('.workspace-editor-area')).toContain('background: var(--schola-editor-bg)');
    expect(block('.workspace-editor-canvas')).toContain('background: var(--schola-editor-bg)');
    expect(block('.schola-statusbar')).toContain('background: var(--schola-statusbar-bg)');
  });

  it('Preview, Graph, Settings, and AI Research have explicit theme-bound surfaces', () => {
    expect(block('.preview-pane')).toContain('background: var(--schola-preview-bg)');
    expect(block('.graph-workspace')).toContain('background: var(--schola-graph-bg)');
    expect(block('.settings-modal')).toContain('background: var(--schola-settings-bg)');
    expect(block('.workspace-content-ai-research,.workspace-content-graph,.workspace-ai-research-workbench,.workspace-ai-research-main,.workspace-ai-research-codex')).toContain(
      'background: var(--schola-ai-research-bg)',
    );
  });
});
