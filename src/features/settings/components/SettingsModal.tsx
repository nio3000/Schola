/**
 * SettingsModal — Phase 5-UX-REBASE-IMP.
 *
 * OpenCode-like centered modal for application settings.
 * Replaces Settings-in-SideBar with a proper modal dialog.
 *
 * Security: API Key management uses secondary modals, not displayed here.
 * No API key in localStorage. No provider invocation. No context send.
 */

import { useEffect, useCallback, type ReactElement, type ReactNode } from 'react';

export interface SettingsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

export function SettingsModal({ isOpen, onClose, children }: SettingsModalProps): ReactElement | null {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="settings-modal-overlay"
      data-testid="settings-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="设置"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="settings-modal" data-testid="settings-modal">
        <div className="settings-modal-header">
          <h2 className="settings-modal-title">设置</h2>
          <button
            type="button"
            className="settings-modal-close"
            onClick={onClose}
            aria-label="关闭设置"
            data-testid="settings-modal-close"
          >
            ×
          </button>
        </div>
        <div className="settings-modal-body">
          <div className="settings-modal-content" data-testid="settings-modal-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
