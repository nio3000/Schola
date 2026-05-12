import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { AppInfo } from '../lib/contracts/app.types';
import { getAppInfo } from '../lib/platform/schola-api';

interface AppShellState {
  readonly status: 'loading' | 'ready' | 'error';
  readonly info: AppInfo | null;
  readonly message: string;
}

const initialState: AppShellState = {
  status: 'loading',
  info: null,
  message: '正在检查 Schola Phase 0 安全脚手架。',
};

export function App(): ReactElement {
  const [state, setState] = useState<AppShellState>(initialState);

  useEffect(() => {
    let isActive = true;

    async function loadAppInfo(): Promise<void> {
      try {
        const appInfo = await getAppInfo();

        if (isActive) {
          setState({
            status: 'ready',
            info: appInfo,
            message: 'Electron + React 安全脚手架已启动。',
          });
        }
      } catch (error) {
        if (isActive) {
          setState({
            status: 'error',
            info: null,
            message: error instanceof Error ? error.message : '无法读取应用信息。',
          });
        }
      }
    }

    void loadAppInfo();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="app-card" aria-labelledby="app-title">
        <p className="eyebrow">Phase 0</p>
        <h1 id="app-title">Schola</h1>
        <p className="lead">本地优先科研知识工作台的 Electron React 安全底座。</p>

        <div className="status-panel" data-status={state.status}>
          <span className="status-dot" aria-hidden="true" />
          <p>{state.message}</p>
        </div>

        <dl className="info-grid" aria-label="应用信息">
          <div>
            <dt>安全边界</dt>
            <dd>main / preload / renderer 三层隔离</dd>
          </div>
          <div>
            <dt>Preload API</dt>
            <dd>window.schola.app.getInfo</dd>
          </div>
          <div>
            <dt>当前阶段</dt>
            <dd>{state.info?.phase ?? '检测中'}</dd>
          </div>
          <div>
            <dt>运行平台</dt>
            <dd>{state.info?.platform ?? '检测中'}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

