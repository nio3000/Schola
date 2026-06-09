import { useEffect, useState, type ReactElement } from 'react';
import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  toggleMaximizeWindow,
} from '../../lib/platform/schola-api';

export function WindowControls(): ReactElement {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isWindowMaximized()
      .then((value) => {
        if (!cancelled) {
          setMaximized(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMaximized(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleMaximize = async (): Promise<void> => {
    const nextMaximized = await toggleMaximizeWindow();
    setMaximized(nextMaximized);
  };

  return (
    <div className="window-controls" data-testid="window-controls" aria-label="窗口控制">
      <button
        type="button"
        className="window-control-button"
        data-testid="window-control-minimize"
        aria-label="最小化窗口"
        title="最小化"
        onClick={() => void minimizeWindow()}
      >
        <span aria-hidden="true">-</span>
      </button>
      <button
        type="button"
        className="window-control-button"
        data-testid="window-control-maximize"
        aria-label={maximized ? '还原窗口' : '最大化窗口'}
        title={maximized ? '还原' : '最大化'}
        onClick={() => void handleToggleMaximize()}
      >
        <span aria-hidden="true">{maximized ? '❐' : '□'}</span>
      </button>
      <button
        type="button"
        className="window-control-button window-control-button-close"
        data-testid="window-control-close"
        aria-label="关闭窗口"
        title="关闭"
        onClick={() => void closeWindow()}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
