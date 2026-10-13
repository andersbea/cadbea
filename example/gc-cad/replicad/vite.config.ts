import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import { reviewBridgePlugin } from 'cadbea/bridge/vite-plugin'

export default defineConfig({
  plugins: [reviewBridgePlugin(), react(), wasm(), topLevelAwait()],
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
    // cadbea must stay excluded from pre-bundling: once cadbea/ui (JSX) gave
    // Vite's scanner a reason to treat the whole `cadbea` package as an
    // optimizable dependency, esbuild's pre-bundle step inlined its own copy
    // of `three` into that chunk instead of sharing this project's instance
    // — a second "Multiple instances of Three.js" instance, distinct from
    // (and in addition to) the dedupe/preserveSymlinks case the comment
    // above already guards against. Excluding it keeps cadbea served as raw,
    // live-reloadable source, which is also what makes editing cadbea's own
    // source hot-reload here instead of requiring a manual cache clear.
    exclude: ['replicad-opencascadejs', 'cadbea'],
    // react-dom/client is imported only through cadbea/ui, a symlinked/
    // unbundled package — Vite's scanner doesn't reliably discover a deep
    // subpath import reached only through a linked dependency, so without
    // this it serves the raw CJS file unconverted and the named `createRoot`
    // import fails at runtime. `three` must be forced in too, for a related
    // reason: once other packages here (react-dom, replicad-threejs-helper)
    // get their own pre-bundled chunk, Vite only shares one `three` instance
    // across all of them if `three` also has its own recognized optimized
    // entry — otherwise each chunk that reaches `three` through a different
    // path (e.g. cadbea's unbundled source vs. a pre-bundled dependency)
    // inlines its own private copy, and `dedupe` alone doesn't prevent that.
    include: ['react', 'react-dom', 'react-dom/client', 'three'],
    force: true,
  },
  worker: {
    plugins: () => [wasm(), topLevelAwait()],
  },
})
