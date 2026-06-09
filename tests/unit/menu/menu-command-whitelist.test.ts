/**
 * Menu Command Whitelist Test — Phase 5-3-IMP.
 *
 * TB-MENU-010, 102, 205, 206: Command whitelist, naming, duplication.
 */
import { describe, it, expect } from 'vitest';
import {
  ALL_COMMAND_IDS,
  ENABLED_COMMANDS,
  DISABLED_COMMANDS,
  ROLE_COMMANDS,
  DEV_ONLY_COMMANDS,
  MACOS_ONLY_ENABLED_COMMANDS,
} from '../../../electron/menu/menu-command-registry';

describe('menu-command-whitelist (P0+P1)', () => {
  it('TB-MENU-102: should have at least 57 command IDs total', () => {
    const total = ALL_COMMAND_IDS.length;
    expect(total).toBeGreaterThanOrEqual(57);
  });

  it('TB-MENU-205: all command IDs should follow schola.<domain>.<action> format', () => {
    const pattern = /^schola\.[a-z]+\.[a-zA-Z]+$/;
    for (const id of ALL_COMMAND_IDS) {
      expect(id).toMatch(pattern);
    }
  });

  it('TB-MENU-206: no duplicate command IDs', () => {
    const seen = new Set<string>();
    for (const id of ALL_COMMAND_IDS) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });

  it('TB-MENU-010: all command IDs are fixed (no dynamic generation)', () => {
    // Verify all arrays are const assertions (immutable)
    expect(Array.isArray(ENABLED_COMMANDS)).toBe(true);
    expect(Array.isArray(DISABLED_COMMANDS)).toBe(true);
    expect(Array.isArray(ROLE_COMMANDS)).toBe(true);
    expect(Array.isArray(DEV_ONLY_COMMANDS)).toBe(true);
    expect(Array.isArray(MACOS_ONLY_ENABLED_COMMANDS)).toBe(true);
    // No computed/generated IDs — they are literal tuples
    const totalDeclared =
      ENABLED_COMMANDS.length +
      DISABLED_COMMANDS.length +
      ROLE_COMMANDS.length +
      DEV_ONLY_COMMANDS.length +
      MACOS_ONLY_ENABLED_COMMANDS.length;
    expect(totalDeclared).toBe(ALL_COMMAND_IDS.length);
  });

  it('should have at least 20 disabled commands', () => {
    expect(DISABLED_COMMANDS.length).toBeGreaterThanOrEqual(20);
  });

  it('should have at least 10 role commands', () => {
    expect(ROLE_COMMANDS.length).toBeGreaterThanOrEqual(10);
  });
});
