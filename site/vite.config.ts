import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const base = process.env.SITE_BASE ?? '/';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base,
  server: {
    host: '127.0.0.1',
    port: 4731,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
