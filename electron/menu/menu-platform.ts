/**
 * Menu Platform Utilities — Phase 5-3-IMP.
 *
 * Exports helper to detect platform and configure platform-specific
 * menu behavior.
 */

import type { MenuItemConstructorOptions } from 'electron';

export type PlatformId = 'darwin' | 'win32' | 'linux';

export function getPlatform(): PlatformId {
  return process.platform as PlatformId;
}

export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

/** Build an accelerator string appropriate for the current platform. */
export function accel(key: string): string {
  if (process.platform === 'darwin') return `Cmd+${key}`;
  return `Ctrl+${key}`;
}

/** Create macOS-only menu items (hidden on Windows/Linux). */
export function macOSItems(
  items: readonly MenuItemConstructorOptions[],
): readonly MenuItemConstructorOptions[] {
  if (process.platform !== 'darwin') return [];
  return items;
}

/** Create a separator item. */
export function sep(): MenuItemConstructorOptions {
  return { type: 'separator' };
}
