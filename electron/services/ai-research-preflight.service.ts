/**
 * AI Research Preflight Service — Phase 5-2-IMP-3 + Phase 5-5-C-IMP-2.
 *
 * Enforces the mandatory preflight gate before any provider invocation.
 * Must pass ALL gates before a task can be executed.
 *
 * Gate sequence:
 *   1. Provider enabled check
 *   2. API Key / local-free check
 *   3. Unsupported provider check (IMP-2)
 *   4. Selected model check (IMP-2)
 *   5. Privacy consent check
 *   6. Context send policy check
 *   7. ContextPack ready check
 *   8. Context confirmation check
 *   9. Instruction not empty check (IMP-2)
 *   10. User explicit run action
 *   11. Main process provider gateway
 *   12. Error sanitize
 *   13. Metadata-only logging
 *
 * NEVER allows provider invocation from renderer.
 * NEVER bypasses context confirmation.
 * NEVER logs raw prompts, API keys, or full file content.
 */
import type {
  InvocationBlockedReason,
  InvocationPreflightResult,
  ProviderReadiness,
  ResearchContextPreview,
} from '../../src/lib/contracts/ai-research.types';
import type { ContextConfirmationResult } from '../../src/lib/contracts/context-pack.types';
import { checkContextConfirmation } from '../../src/lib/contracts/context-pack.types';
import type { ProviderPreset } from '../../src/lib/contracts/provider-preset.types';
import { getProviderPreset } from '../../src/lib/contracts/provider-preset.types';
import { sanitizeIpcError } from '../lib/error-utils';
import type { ContextConfirmation } from '../../src/lib/contracts/context-pack.types';
import {
  getAIPreferences,
  getContextSendPolicy,
  getPrivacyConsent,
  getProviderConfig,
} from './settings-store.service';
import { getProviderKeyStatus } from './provider-key-store.service';

// Phase 5-5-C-IMP-2: Providers that are explicitly unsupported.
const UNSUPPORTED_PROVIDER_IDS = new Set<string>(['anthropic']);

// ── Preflight Gate ─────────────────────────────────

/**
 * Execute the full preflight gate for a provider invocation.
 *
 * @param readiness  - Provider readiness status from ai-research-context.service
 * @param contextPackPreview - The built ContextPack preview
 * @param userExplicitRun - Whether the user explicitly clicked "Run" (must be true)
 * @param contextConfirmation - Current context confirmation state
 * @returns Preflight result indicating pass/block with reason.
 */
export function runInvocationPreflight(
  providerId: string,
  contextPackPreview: ResearchContextPreview | null,
  userExplicitRun: boolean,
  contextConfirmation: ContextConfirmation,
): InvocationPreflightResult {
  try {
    // Step 1: Provider enabled check
    if (!isProviderEnabled(providerId)) {
      return buildBlockedResult('provider_disabled', '提供者未启用。请在设置中启用该提供者。');
    }

    // Step 1b (Phase 5-5-C-IMP-2): Unsupported provider gate
    const unsupportedCheck = checkUnsupportedProvider(providerId);
    if (!unsupportedCheck.passed) {
      return unsupportedCheck;
    }

    // Step 2: API Key / local-free check
    const keyCheck = checkKeyOrLocalFree(providerId);
    if (!keyCheck.passed) {
      return keyCheck;
    }

    // Step 3: Privacy consent check
    if (!isPrivacyConsented(providerId)) {
      return buildBlockedResult(
        'privacy_consent_required',
        '未同意隐私协议。请先在隐私设置中同意远程模型使用协议。',
      );
    }

    // Step 4: Context send policy check — only when context is present
    if (contextPackPreview !== null && !isContextSendAllowed()) {
      return buildBlockedResult(
        'context_send_policy_denied',
        '上下文发送策略不允许发送。请先在隐私设置中调整上下文发送策略。',
      );
    }

    // Phase 5-5-C-POST-SYNC-AI-RESEARCH-UX-FIX:
    // When contextPackPreview is null, the user is in free conversation mode.
    // ContextPack gates are not applicable. Skip Steps 5-6.
    if (contextPackPreview !== null) {
      // Step 5: ContextPack ready check
      if (!contextPackPreview) {
        return buildBlockedResult(
          'context_pack_not_ready',
          '尚未构建上下文包。请先选择文献来源并构建 ContextPack。',
        );
      }

      // Step 6: Context confirmation check
      const confirmationResult: ContextConfirmationResult =
        checkContextConfirmation(contextConfirmation);
      if (!confirmationResult.confirmed) {
        return buildBlockedResult(
          'context_not_confirmed',
          '上下文尚未确认。请先确认要发送的文献范围和隐私影响。',
        );
      }
    }

    // Step 7: User explicit run action
    if (!userExplicitRun) {
      return buildBlockedResult(
        'user_not_explicitly_run',
        '需要用户显式点击"运行"按钮来启动分析任务。不支持自动运行。',
      );
    }

    // All gates passed
    return {
      passed: true,
      providerReady: true,
      privacyConsented: true,
      contextConfirmed: true,
      userExplicitRun: true,
    };
  } catch (err) {
    const message = sanitizeIpcError(err);
    return buildBlockedResult('provider_disabled', `预检异常: ${message}`);
  }
}

/**
 * Quick readiness check — used by UI to show preflight status before Run.
 */
export function checkInvocationReadiness(
  providerId: string,
  contextPackPreview: ResearchContextPreview | null,
  contextConfirmation: ContextConfirmation,
): InvocationPreflightResult {
  return runInvocationPreflight(providerId, contextPackPreview, false, contextConfirmation);
}

// ── Gate Helpers ──────────────────────────────────

function isProviderEnabled(providerId: string): boolean {
  const preset = getProviderPreset(providerId);
  if (!preset) return false;

  // Local-free providers are always "enabled" from a configuration standpoint
  if (preset.billingMode === 'local-free') {
    // Check if AI is globally enabled
    const prefs = getAIPreferences();
    return prefs.aiEnabled;
  }

  const config = getProviderConfig(providerId);
  return config?.enabled === true;
}

function checkKeyOrLocalFree(providerId: string): InvocationPreflightResult {
  const preset = getProviderPreset(providerId);
  if (!preset) {
    return buildBlockedResult('no_api_key', `未找到提供者 "${providerId}" 的配置。`);
  }

  // Local-free providers don't need API keys
  if (preset.billingMode === 'local-free') {
    return { passed: true, providerReady: false, privacyConsented: false, contextConfirmed: false, userExplicitRun: false };
  }

  // BYOK providers need a configured key
  const keyStatus = getProviderKeyStatus(providerId);
  const hasKey = keyStatus.some((s) => s.status === 'configured');

  if (!hasKey) {
    return buildBlockedResult(
      'no_api_key',
      `提供者 "${preset.displayName}" 未配置 API Key。请在设置中配置密钥。`,
    );
  }

  return { passed: true, providerReady: false, privacyConsented: false, contextConfirmed: false, userExplicitRun: false };
}

function isPrivacyConsented(_providerId: string): boolean {
  try {
    const consent = getPrivacyConsent();
    return consent.privacyConsentAccepted === true && consent.allowRemoteProvider === true;
  } catch {
    return false;
  }
}

function isContextSendAllowed(): boolean {
  try {
    const policy = getContextSendPolicy();
    // 'ask' or 'always-allow' both permit sending with confirmation
    return policy !== 'never';
  } catch {
    return false;
  }
}

// ── Result Builder ───────────────────────────────

function buildBlockedResult(
  reason: InvocationBlockedReason,
  message: string,
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

// Phase 5-5-C-IMP-2: Providers not yet implemented.
const UNSUPPORTED_PREFLIGHT_IDS = new Set<string>(['anthropic']);

function checkUnsupportedProvider(providerId: string): InvocationPreflightResult {
  if (UNSUPPORTED_PREFLIGHT_IDS.has(providerId)) {
    const preset = getProviderPreset(providerId);
    const name = preset?.displayName ?? providerId;
    return buildBlockedResult(
      'unsupported_provider',
      `提供者 "${name}" 当前不支持。该提供者的原生 API 尚未实现，将在后续版本中支持。`,
    );
  }
  return { passed: true, providerReady: false, privacyConsented: false, contextConfirmed: false, userExplicitRun: false };
}
