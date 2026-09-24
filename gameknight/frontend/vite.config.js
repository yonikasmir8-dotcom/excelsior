import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `vite build --mode standalone` builds the self-contained phone version
// (see ../standalone/build.mjs), everything else is the normal client for the API server.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { '/api': 'http://localhost:4000' },
  },
  ...(mode === 'standalone' && {
    define: { 'import.meta.env.VITE_STANDALONE': JSON.stringify('true') },
    build: {
      outDir: 'dist-standalone',
      assetsInlineLimit: 100_000_000,
      modulePreload: false,
      chunkSizeWarningLimit: 10_000,
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  }),
}))
