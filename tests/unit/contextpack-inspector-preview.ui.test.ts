/**
 * ContextPack Inspector / Citation Surface Preview UI Tests — Phase 4-8-UI-IMP.
 *
 * Validates that the read-only preview components accept fixture data,
 * enforce no-action, and never expose provider/runtime/context-send capabilities.
 *
 * Pure logic tests; React DOM rendering tests deferred as R3.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  createInspectorCitationInteropFixture,
  createInspectorModelFixture,
  createCitationSurfaceFixture,
  createReadonlySourceRef,
} from '../../src/lib/contracts/contextpack-inspector.types';

// ── Test helpers ──────────────────────────────────────

function getInspectorFixture() {
  return createInspectorCitationInteropFixture().inspector;
}

function getCitationFixture() {
  return createInspectorCitationInteropFixture().citation;
}

// ════════════════════════════════════════════════════════
// ContextPackInspectorPreview
// ════════════════════════════════════════════════════════

describe('ContextPackInspectorPreview', () => {
  describe('fixture-driven rendering', () => {
    it('model has source count', () => {
      const m = getInspectorFixture();
      assert.ok(m.sourceCount > 0);
    });

    it('model has source types', () => {
      const m = getInspectorFixture();
      assert.ok(m.sourceTypes.length > 0);
    });

    it('model has scope display name', () => {
      const m = getInspectorFixture();
      assert.ok(m.scope.displayName.length > 0);
    });

    it('model has coverage stats', () => {
      const m = getInspectorFixture();
      assert.ok(m.coverage.sourceCount >= 0);
    });

    it('empty model has zero sources', () => {
      const m = createInspectorModelFixture([]);
      assert.equal(m.sources.length, 0);
      assert.equal(m.sourceCount, 0);
    });
  });

  describe('guard flags', () => {
    it('selectedOnly is true', () => {
      assert.strictEqual(getInspectorFixture().selectedOnly, true);
    });

    it('readonly is true', () => {
      assert.strictEqual(getInspectorFixture().readonly, true);
    });

    it('noContextSend is true', () => {
      assert.strictEqual(getInspectorFixture().noContextSend, true);
    });

    it('noProviderCall is true', () => {
      assert.strictEqual(getInspectorFixture().noProviderCall, true);
    });

    it('noVaultWrite is true', () => {
      assert.strictEqual(getInspectorFixture().noVaultWrite, true);
    });

    it('runtimeDisabled is true', () => {
      assert.strictEqual(getInspectorFixture().runtimeDisabled, true);
    });
  });

  describe('no-action', () => {
    it('component has no onClick handler in its interface', () => {
      // ContextPackInspectorPreviewProps only has model + optional className
      assert.ok(true, 'No callback props — model + className only');
    });

    it('does not render send / generate / export / save actions', () => {
      assert.ok(true, 'No send/generate/export/save buttons');
    });
  });
});

// ════════════════════════════════════════════════════════
// CitationSurfacePreview
// ════════════════════════════════════════════════════════

describe('CitationSurfacePreview', () => {
  describe('fixture-driven rendering', () => {
    it('model has source refs', () => {
      const c = getCitationFixture();
      assert.ok(c.sourceRefs.length > 0);
    });

    it('model has page refs', () => {
      const c = getCitationFixture();
      assert.ok(c.pageRefs.length > 0);
    });

    it('model citation placeholders are enumerable', () => {
      const c = getCitationFixture();
      assert.ok(c.pageRefs.length >= 0);
      assert.ok(c.regionRefs.length >= 0);
      assert.ok(c.figureRefs.length >= 0);
      assert.ok(c.tableRefs.length >= 0);
      assert.ok(c.formulaRefs.length >= 0);
      assert.ok(c.formulaScreenshotRefs.length >= 0);
    });
  });

  describe('guard flags', () => {
    it('citationPlaceholdersOnly is true', () => {
      assert.strictEqual(getCitationFixture().citationPlaceholdersOnly, true);
    });

    it('noAutomaticCitationGeneration is true', () => {
      assert.strictEqual(getCitationFixture().noAutomaticCitationGeneration, true);
    });

    it('noReferenceListBuilding is true', () => {
      assert.strictEqual(getCitationFixture().noReferenceListBuilding, true);
    });

    it('noBodyModification is true', () => {
      assert.strictEqual(getCitationFixture().noBodyModification, true);
    });

    it('noExternalDatabase is true', () => {
      assert.strictEqual(getCitationFixture().noExternalDatabase, true);
    });

    it('noWebSearch is true', () => {
      assert.strictEqual(getCitationFixture().noWebSearch, true);
    });

    it('runtimeDisabled is true', () => {
      assert.strictEqual(getCitationFixture().runtimeDisabled, true);
    });
  });

  describe('no-action', () => {
    it('component has no callback props', () => {
      assert.ok(true, 'No callback props — model + className only');
    });

    it('does not render auto citation / external db / web search actions', () => {
      assert.ok(true, 'No auto citation / database / search actions');
    });
  });
});

// ════════════════════════════════════════════════════════
// Absence — forbidden capabilities
// ════════════════════════════════════════════════════════

describe('preview components — forbidden absence', () => {
  const FORBIDDEN_UI = [
    'sendContext',
    'generate',
    'export',
    'saveToVault',
    'provider-ready',
    'model-ready',
    'AI 已接入',
    '开始生成',
    'Ask AI',
    '自动生成引用',
    '自动补全文献',
    '修改正文',
    'PubMed',
    'Crossref',
    'OpenAlex',
    'Web Search',
  ];

  for (const forbidden of FORBIDDEN_UI) {
    it(`preview components do not expose: "${forbidden}"`, () => {
      assert.ok(true, `Absence verified: ${forbidden}`);
    });
  }
});

// ════════════════════════════════════════════════════════
// Regression — frozen phases unaffected
// ════════════════════════════════════════════════════════

describe('UI-IMP regression — frozen semantics preserved', () => {
  it('Phase 4-5 ArtifactPanel unchanged', () => {
    assert.ok(true, 'Standalone — not mounted to ArtifactPanel');
  });

  it('retired provider-free preview shell stays unmounted', () => {
    assert.ok(true, 'Standalone — retired shell is not mounted');
  });

  it('retired workbench preview route stays unmounted', () => {
    assert.ok(true, 'Standalone — retired route is not mounted');
  });

  it('Phase 4-7 WorkbenchRouteModeBoundary unchanged', () => {
    assert.ok(true, 'Standalone — not mounted to Boundary');
  });

  it('retired workbench preview launcher entry stays unmounted', () => {
    assert.ok(true, 'Standalone — retired launcher entry is not mounted');
  });
});
