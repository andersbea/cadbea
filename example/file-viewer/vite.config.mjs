import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // cadbea is a `file:` dependency symlinked from outside this project — see
  // the root README's "If you're on Vite" section for why preserveSymlinks
  // and deduping react/three matter here (avoids duplicate-instance bugs).
  resolve: {
    preserveSymlinks: true,
    dedupe: ['three', 'react', 'react-dom'],
  },
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
  // cadbea/ui (a symlinked, unbundled package) imports 'react-dom/client'.
  // Vite's dependency scanner doesn't reliably discover deep subpath imports
  // reached only through a linked package, so without this it serves the raw
  // CJS file unconverted and the named `createRoot` import fails at runtime.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
  },
})
