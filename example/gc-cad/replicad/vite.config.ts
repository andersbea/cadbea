import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import { reviewBridgePlugin } from '../../../bridge/start-bridge.mjs'

export default defineConfig({
  plugins: [reviewBridgePlugin(), wasm(), topLevelAwait()],
  // cadbea is a `file:` dependency symlinked from outside this project. Without
  // this, Vite resolves its bare imports (e.g. `three`) against cadbea's own
  // real path instead of this project's node_modules, finds no local copy
  // there, and either fails to resolve or (if cadbea has its own copy) loads
  // a second three.js instance — which silently breaks cross-instance calls
  // like BufferGeometryUtils.mergeVertices() on a geometry built with this
  // project's three.js instance.
  resolve: {
    preserveSymlinks: true,
    dedupe: ['three'],
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  optimizeDeps: {
    exclude: ['replicad-opencascadejs'],
    force: true,
  },
  worker: {
    plugins: () => [wasm(), topLevelAwait()],
  },
})
