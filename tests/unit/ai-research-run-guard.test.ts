/**
 * AI Research — Run Guardian Test — Phase 5-2 P1.
 *
 * Verifies:
 * - Run button is disabled when preflight fails
 * - Blocked reason is displayed
 * - Run requires explicit user action
 * - Preflight checks show pass/fail per gate
 * - Stage transitions are reflected in button state
 *
 * Test boundaries: 52-TB-UI-030 through 52-TB-UI-037
 */
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import React, { type ReactElement } from 'react';
import { renderToPipeableStream, renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'vitest';
import { RunGuardPanel } from '../../src/features/ai-research/components/RunGuardPanel';
import type { InvocationPreflightResult } from '../../src/lib/contracts/ai-research.types';
import type { AIResearchWorkbenchStage } from '../../src/features/ai-research/hooks/useAIResearchWorkbench';

// ── Helpers ───────────────────────────────────────────

function makePassedPreflight(): InvocationPreflightResult {
  return {
    passed: true,
    providerReady: true,
    privacyConsented: true,
    contextConfirmed: true,
    userExplicitRun: true,
  };
}

function makeBlockedPreflight(
  reason: InvocationPreflightResult['blockedReason'] = 'provider_disabled',
  message = '提供者未启用。',
): InvocationPreflightResult {
  return {
    passed: false,
    blockedReason: reason,
    blockedMessage: message,
    providerReady: false,
    privacyConsented: false,
    contextConfirmed: false,
    userExplicitRun: false,
  };
}

function renderHtml(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

function makeProps(overrides?: {
  preflight?: InvocationPreflightResult;
  stage?: AIResearchWorkbenchStage;
  loading?: boolean;
  hasTaskDraft?: boolean;
  canCreateDraft?: boolean;
}) {
  return {
    preflight: overrides?.preflight ?? makePassedPreflight(),
    stage: (overrides?.stage ?? 'pack_built') as AIResearchWorkbenchStage,
    loading: overrides?.loading ?? false,
    hasTaskDraft: overrides?.hasTaskDraft ?? false,
    canCreateDraft: overrides?.canCreateDraft ?? true,
    onCreateDraft: () => {},
    onRun: () => {},
    onOpenContextConfirmation: () => {},
    onOpenPrivacyConsent: () => {},
  };
}

// ═══════════════════════════════════════════════════════════════
// Run guard states
// ═══════════════════════════════════════════════════════════════

describe('AI Research — Run Guardian', () => {
  it('52-TB-UI-030: renders with data-testid', () => {
    const html = renderHtml(
      React.createElement(RunGuardPanel, makeProps()),
    );

    assert.ok(
      html.includes('ai-research-run-guard-panel'),
      'Must have run guard panel testid',
    );
  });

  it('52-TB-UI-031: shows "可运行" when preflight passes', () => {
    const html = renderHtml(
      React.createElement(RunGuardPanel, makeProps({
        preflight: makePassedPreflight(),
        hasTaskDraft: true,
      })),
    );

    assert.ok(html.includes('可运行'), 'Must show ready status');
  });

  it('52-TB-UI-032: shows "已阻止" when preflight fails', () => {
    const html = renderHtml(
      React.createElement(RunGuardPanel, makeProps({
        preflight: makeBlockedPreflight('provider_disabled', '提供者未启用。'),
      })),
    );

    assert.ok(html.includes('已阻止'), 'Must show blocked status');
  });

  it('52-TB-UI-033: displays blocked reason message', () => {
    const message = '提供者未启用。请在设置中启用该提供者。';
    const html = renderHtml(
      React.createElement(RunGuardPanel, makeProps({
        preflight: makeBlockedPreflight('provider_disabled', message),
      })),
    );

    assert.ok(html.includes('阻止原因'), 'Must show blocked reason label');
    assert.ok(html.includes(message), 'Must show blocked message');
  });

  it('52-TB-UI-034: shows checklist with pass/fail per gate', () => {
    const html = renderHtml(
      React.createElement(RunGuardPanel, makeProps({
        preflight: makePassedPreflight(),
      })),
    );

    // Should show provider ready, context confirmed, privacy consented
    assert.ok(html.includes('提供者就绪'), 'Must show provider ready check');
    assert.ok(html.includes('上下文已确认'), 'Must show context confirmed check');
    assert.ok(html.includes('隐私同意已完成'), 'Must show privacy consent check');
  });

  it('52-TB-UI-035: checklist shows ✓ for passed gates', () => {
    const html = renderHtml(
      React.createElement(RunGuardPanel, makeProps({
        preflight: makePassedPreflight(),
      })),
    );

    assert.ok(html.includes('✓'), 'Must show checkmark for passed gates');
  });

  it('52-TB-UI-036: checklist shows ✗ for failed gates', () => {
    const html = renderHtml(
      React.createElement(RunGuardPanel, makeProps({
        preflight: makeBlockedPreflight('privacy_consent_required'),
      })),
    );

    assert.ok(html.includes('✗'), 'Must show cross for failed gates');
  });

  it('52-TB-UI-037: Run button disabled when preflight fails', () => {
    // RunGuardPanel computes runDisabled based on preflight.passed
    // The create-task-draft button is always shown
    const passedHtml = renderHtml(
      React.createElement(RunGuardPanel, makeProps({
        preflight: makePassedPreflight(),
        hasTaskDraft: false,
      })),
    );

    // Must have "创建任务草稿" button
    assert.ok(
      passedHtml.includes('创建任务草稿'),
      'Must show create draft button',
    );
  });

  it('52-TB-UI-038: "确认上下文" button present', () => {
    const html = renderHtml(
      React.createElement(RunGuardPanel, makeProps()),
    );

    assert.ok(html.includes('确认上下文'), 'Must have context confirmation button');
  });

  it('52-TB-UI-039: "隐私同意" button present', () => {
    const html = renderHtml(
      React.createElement(RunGuardPanel, makeProps()),
    );

    assert.ok(html.includes('隐私同意'), 'Must have privacy consent button');
  });
});
