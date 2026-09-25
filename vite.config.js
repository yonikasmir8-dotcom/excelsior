import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };
export default defineConfig({
  base: './',
  // the dev server's hot-reload socket is allowed in the CSP only while developing
  plugins: [{ name: 'strip-dev-csp', apply: 'build', transformIndexHtml: (html) => html.replace(' ws://localhost:*', '') }],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { port: 5173, host: true },
  build: { chunkSizeWarningLimit: 2000, target: 'es2020' }
});
