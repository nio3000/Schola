import type { AppInfo } from '../contracts/app.types';

export async function getAppInfo(): Promise<AppInfo> {
  return window.schola.app.getInfo();
}
