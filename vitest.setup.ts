/** Vitest setup — mock browser globals for unit tests. */

// Mock window for Node.js test environment
const win = {
  schola: undefined as any,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
} as unknown as Window & typeof globalThis;

(globalThis as any).window = win;
(globalThis as any).self = win;
