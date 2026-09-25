import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { port: 5173, host: true },
  build: { chunkSizeWarningLimit: 2000, target: 'es2020' }
});
