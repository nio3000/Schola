export type AppPlatform =
  | 'aix'
  | 'android'
  | 'darwin'
  | 'freebsd'
  | 'haiku'
  | 'linux'
  | 'openbsd'
  | 'sunos'
  | 'win32'
  | 'cygwin'
  | 'netbsd';

export const APP_GET_INFO_CHANNEL = 'app:get-info';

/** Phase 0 application metadata exposed through the safe preload API. */
export interface AppInfo {
  readonly name: 'Schola';
  readonly version: string;
  readonly platform: AppPlatform;
  readonly phase: 'phase-0';
}

/** Narrow Phase 0 app namespace exposed to the renderer. */
export interface ScholaAppApi {
  readonly getInfo: () => Promise<AppInfo>;
}

/** Complete renderer-visible API surface for Phase 0. */
export interface ScholaApi {
  readonly app: ScholaAppApi;
}