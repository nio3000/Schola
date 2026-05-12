import type { ScholaApi } from '../lib/contracts/app.types';

declare global {
  interface Window {
    readonly schola: ScholaApi;
  }
}

export {};
