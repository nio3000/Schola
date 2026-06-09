import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Phase 4-4-B: Vendor chunk splitting.
    // Splits large, rarely-updated vendor libraries so the main
    // entry stays lean and browser caching works across builds.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@codemirror')) return 'vendor-codemirror';
            if (id.includes('katex')) return 'vendor-katex';
            if (id.includes('marked') || id.includes('dompurify') || id.includes('highlight')) return 'vendor-markdown';
          }
        },
      },
    },
  },
});