import type { ReactElement } from 'react';

export type ScholaActivityIconId =
  | 'files'
  | 'search'
  | 'graph'
  | 'ai-research'
  | 'artifacts'
  | 'plugins'
  | 'settings';

export type ScholaIconId = ScholaActivityIconId | 'ai';

export interface ScholaIconDefinition {
  readonly id: ScholaActivityIconId;
  readonly viewBox: '0 0 20 20' | '0 0 22 22';
  readonly paths: ReactElement;
}

export const SCHOLA_ICON_DEFINITIONS: Readonly<Record<ScholaActivityIconId, ScholaIconDefinition>> =
  {
    files: {
      id: 'files',
      viewBox: '0 0 22 22',
      paths: (
        <>
          <path className="schola-icon-line" d="M6 3.75h6.35L16 7.4v10.85H6V3.75Z" />
          <path className="schola-icon-line" d="M12.25 3.85V7.5h3.65" />
          <path className="schola-icon-line" d="M8.4 10.4h5.2" />
          <path className="schola-icon-line" d="M8.4 13.1h5.2" />
          <path className="schola-icon-line" d="M8.4 15.8h3.2" />
        </>
      ),
    },
    search: {
      id: 'search',
      viewBox: '0 0 22 22',
      paths: (
        <>
          <circle className="schola-icon-line" cx="9.4" cy="9.4" r="4.95" />
          <path className="schola-icon-line" d="m13.1 13.1 4.35 4.35" />
          <path className="schola-icon-line" d="M7.45 9.4h3.9" />
        </>
      ),
    },
    graph: {
      id: 'graph',
      viewBox: '0 0 22 22',
      paths: (
        <>
          <path className="schola-icon-line" d="M7.2 8.2 11 5.8l4 3.05" />
          <path className="schola-icon-line" d="M7.15 13.6 11 16.25l4.05-2.45" />
          <path className="schola-icon-line" d="M7.2 8.2v5.4" />
          <path className="schola-icon-line" d="M15.05 8.85v4.95" />
          <circle className="schola-icon-fill" cx="7.2" cy="8.2" r="1.55" />
          <circle className="schola-icon-fill" cx="15.05" cy="8.85" r="1.55" />
          <circle className="schola-icon-fill" cx="7.15" cy="13.6" r="1.55" />
          <circle className="schola-icon-fill" cx="15.05" cy="13.8" r="1.55" />
          <circle className="schola-icon-fill" cx="11" cy="5.8" r="1.35" />
          <circle className="schola-icon-fill" cx="11" cy="16.25" r="1.35" />
        </>
      ),
    },
    'ai-research': {
      id: 'ai-research',
      viewBox: '0 0 22 22',
      paths: (
        <>
          <path
            className="schola-icon-line"
            d="M7.25 15.55c-1.45-.55-2.5-1.95-2.5-3.6 0-1.05.42-2 1.1-2.7-.15-.45-.2-.92-.12-1.42.2-1.35 1.28-2.45 2.62-2.72.45-1.02 1.45-1.73 2.65-1.73 1.18 0 2.2.72 2.65 1.73 1.35.28 2.43 1.38 2.62 2.72.08.5.03.97-.12 1.42.68.7 1.1 1.65 1.1 2.7 0 1.65-1.05 3.05-2.5 3.6"
          />
          <path className="schola-icon-line" d="M8.2 9.6h5.6" />
          <path className="schola-icon-line" d="M9 13.25h4" />
          <path className="schola-icon-line" d="M11 5.8v10.4" />
          <circle className="schola-icon-fill" cx="8.2" cy="9.6" r="1" />
          <circle className="schola-icon-fill" cx="13.8" cy="9.6" r="1" />
          <circle className="schola-icon-fill" cx="9" cy="13.25" r="1" />
          <circle className="schola-icon-fill" cx="13" cy="13.25" r="1" />
        </>
      ),
    },
    artifacts: {
      id: 'artifacts',
      viewBox: '0 0 22 22',
      paths: (
        <>
          <path
            className="schola-icon-line"
            d="M5.05 8.15 11 4.7l5.95 3.45v6.95L11 18.55 5.05 15.1V8.15Z"
          />
          <path className="schola-icon-line" d="m5.35 8.35 5.65 3.25 5.65-3.25" />
          <path className="schola-icon-line" d="M11 11.6v6.55" />
          <path className="schola-icon-line" d="m8.1 6.3 5.8 3.35" />
        </>
      ),
    },
    plugins: {
      id: 'plugins',
      viewBox: '0 0 22 22',
      paths: (
        <>
          <path
            className="schola-icon-line"
            d="M8.2 4.5h2.3v2.2c0 .75.6 1.35 1.35 1.35.72 0 1.32-.6 1.32-1.35V4.5h2.28v4.1h1.4c.9 0 1.65.72 1.65 1.62v2.2c0 .9-.75 1.62-1.65 1.62h-1.4v3.46H8.2v-3.46H6.78c-.9 0-1.62-.72-1.62-1.62v-2.2c0-.9.72-1.62 1.62-1.62H8.2V4.5Z"
          />
          <path className="schola-icon-line" d="M10.25 17.5v1.8" />
          <path className="schola-icon-line" d="M13.4 17.5v1.8" />
        </>
      ),
    },
    settings: {
      id: 'settings',
      viewBox: '0 0 22 22',
      paths: (
        <>
          <path
            className="schola-icon-line"
            d="M11 4.05 12.45 5l1.7-.35 1.18 2.02-1.05 1.35c.05.28.08.6.08.93s-.03.65-.08.93l1.05 1.35-1.18 2.02-1.7-.35-1.45.95-1.45-.95-1.7.35-1.18-2.02 1.05-1.35a5.6 5.6 0 0 1-.08-.93c0-.33.03-.65.08-.93L6.67 6.67l1.18-2.02L9.55 5 11 4.05Z"
          />
          <circle className="schola-icon-line" cx="11" cy="8.95" r="2.05" />
        </>
      ),
    },
  };

export function resolveScholaIconId(iconId: ScholaIconId): ScholaActivityIconId {
  return iconId === 'ai' ? 'ai-research' : iconId;
}
