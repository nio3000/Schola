/**
 * ProviderConnectModal — Phase 5-UX-REBASE-IMP-CONTINUE.
 *
 * Secondary modal for connecting to an AI provider by entering an API key.
 * Inspired by OpenCode's provider connection UX.
 *
 * Security: API key only passed via callback, never stored in state
 * longer than necessary. Not written to localStorage. Not logged.
 */

import { useState, useCallback, type ReactElement, type FormEvent } from 'react';
import type { ProviderPreset } from '../../../lib/contracts/provider-preset.types';

export interface ProviderConnectModalProps {
  readonly isOpen: boolean;
  readonly provider: ProviderPreset | null;
  readonly onClose: () => void;
  readonly onConnect: (providerId: string, apiKey: string) => void;
}

export function ProviderConnectModal({
  isOpen,
  provider,
  onClose,
  onConnect,
}: ProviderConnectModalProps): ReactElement | null {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!provider || !apiKey.trim()) return;

      setError(null);
      setSubmitting(true);
      try {
        await onConnect(provider.id, apiKey.trim());
        setApiKey('');
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : '连接失败');
      } finally {
        setSubmitting(false);
      }
    },
    [provider, apiKey, onConnect, onClose],
  );

  const handleClose = useCallback(() => {
    setApiKey('');
    setError(null);
    onClose();
  }, [onClose]);

  if (!isOpen || !provider) return null;

  return (
    <div className="provider-connect-overlay" data-testid="provider-connect-modal-overlay">
      <div className="provider-connect-modal" data-testid="provider-connect-modal" role="dialog" aria-modal="true">
        <div className="provider-connect-header">
          <button type="button" className="provider-connect-back" onClick={handleClose} aria-label="返回">
            ← 返回
          </button>
          <h3 className="provider-connect-title">连接 {provider.displayName}</h3>
          <button type="button" className="provider-connect-close" onClick={handleClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="provider-connect-body">
          <p className="provider-connect-desc">{provider.description}</p>

          <form onSubmit={handleSubmit}>
            <label className="provider-connect-label" htmlFor="provider-api-key-input">
              API Key
            </label>
            <input
              id="provider-api-key-input"
              type="password"
              className="provider-connect-input"
              data-testid="provider-connect-key-input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入 API Key..."
              autoFocus
            />

            {provider.billingMode === 'byok' && (
              <p className="provider-connect-hint">
                获取 Key：请访问 {provider.displayName} 官方网站获取 API 密钥。
              </p>
            )}

            {error && <p className="provider-connect-error">{error}</p>}

            <div className="provider-connect-actions">
              <button
                type="submit"
                className="provider-connect-submit"
                data-testid="provider-connect-submit"
                disabled={!apiKey.trim() || submitting}
              >
                {submitting ? '连接中...' : '提交'}
              </button>
              <button type="button" className="provider-connect-cancel" onClick={handleClose}>
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
