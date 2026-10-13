#!/usr/bin/env node
/**
 * Scaffolds a cadbea review project in the current directory — with or
 * without an existing project already there. Meant to be run after a global
 * install (`npm install -g cadbea`) from a clean folder, or inside an
 * existing Vite project to wire in the review bridge and viewer.
 *
 * Without an existing package.json: writes a complete turnkey review app
 * (package.json, vite.config.mjs, index.html, src/main.jsx) — zero project
 * code, drag-and-drop a .glb/.gltf/.stl to review it.
 *
 * With an existing package.json: only adds the "cadbea" dependency,
 * cadbea.config.mjs, and the AGENTS.md section — your app's own vite config
 * and source are left alone; see the printed instructions for wiring
 * reviewBridgePlugin() in yourself.
 *
 * Either way, writes (or appends to) AGENTS.md with agent-agnostic
 * instructions for starting a review session and listening for comments —
 * not tied to any particular coding agent or tool.
 *
 * Usage:
 *   cadbea-init                 # scaffold + npm install
 *   cadbea-init --no-install    # scaffold only, skip npm install
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// This file lives at <cadbea package root>/init/init.mjs, both in this repo
// and once installed (globally or as a project dependency) — two levels up
// is always the package root, which is what a scaffolded project's "cadbea"
// dependency needs to point at.
const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const cadbeaDependency = `file:${packageRoot.split(path.sep).join('/')}`

const cwd = process.cwd()
const skipInstall = process.argv.slice(2).includes('--no-install')

function writeIfMissing(filePath, content) {
  if (existsSync(filePath)) {
    console.log(`  skip   ${path.relative(cwd, filePath)} (already exists)`)
    return
  }
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, content)
  console.log(`  create ${path.relative(cwd, filePath)}`)
}

function packageJsonTemplate(name) {
  return {
    name,
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      bridge: 'cadbea-bridge',
      check: 'cadbea-check',
      views: 'cadbea-capture',
      'contact-sheet': 'cadbea-contact-sheet',
    },
    dependencies: {
      cadbea: cadbeaDependency,
      react: '^18.3.0',
      'react-dom': '^18.3.0',
      three: '^0.170.0',
    },
    devDependencies: {
      '@vitejs/plugin-react': '^4.3.0',
      vite: '^6.0.0',
    },
  }
}

const VITE_CONFIG_TEMPLATE = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { reviewBridgePlugin } from 'cadbea/bridge/vite-plugin'

export default defineConfig({
  // reviewBridgePlugin() auto-starts (or reuses an already-healthy) the
  // review bridge alongside the dev server — one "npm run dev" is enough.
  plugins: [reviewBridgePlugin(), react()],
  // cadbea is a \`file:\` dependency symlinked from outside this project —
  // see cadbea's own README ("If you're on Vite") for why this matters:
  // without it you risk loading a second three.js instance.
  resolve: {
    preserveSymlinks: true,
    dedupe: ['three', 'react', 'react-dom'],
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
  },
})
`

const INDEX_HTML_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>cadbea review</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`

const MAIN_JSX_TEMPLATE = `import 'cadbea/ui/style.css'
import { mountCadbeaApp } from 'cadbea/ui'

// Turnkey: no project code, just drop in an exported model. Build your own
// parametric model instead by replacing this with a hand-wired createViewer()
// + addThreeGeometry() call — see AGENTS.md and cadbea's README.
mountCadbeaApp(document.getElementById('root'), {
  status: 'Drop a .glb, .gltf, or .stl file to review it.',
  viewerOptions: {
    reviewWebhook: 'http://127.0.0.1:8787/review',
  },
})
`

const GITIGNORE_TEMPLATE = `node_modules/
dist/
screenshots/
`

const CADBEA_CONFIG_TEMPLATE = `export default {
  url: 'http://localhost:5173',
  outDir: './screenshots/latest',
  title: 'cadbea review',
}
`

// Agent-agnostic on purpose: plain shell commands any coding agent working
// through a terminal can follow, not tied to a specific tool's background-
// process/notification primitives.
const AGENTS_SECTION_MARKER = '<!-- cadbea:review-session:start -->'
const AGENTS_SECTION = `${AGENTS_SECTION_MARKER}
## cadbea review session

This project uses [cadbea](https://github.com/andersbea/cadbea): a person
marks up the 3D model in the browser, and an AI agent acts on those
comments. If you are an AI coding agent working in this repository, this
section is for you.

### Start the session

1. Start the dev server — this also auto-starts the review bridge on
   \`http://127.0.0.1:8787\` unless something else is already listening
   there: \`npm run dev\`
2. Confirm the bridge is up: \`curl -s http://127.0.0.1:8787/health\` should
   return \`{"ok":true,...}\`.
3. Open the printed dev server URL (typically \`http://localhost:5173\`) in
   a real browser so the user can see and mark up the model — whatever opens
   a URL in a GUI browser for this OS/agent, e.g. \`start <url>\` (Windows),
   \`open <url>\` (macOS), \`xdg-open <url>\` (Linux).

### Listen for comments

A comment only exists once the user clicks **"Mark for AI"** in the review
panel. Selecting/clicking a part alone fires a separate, much noisier
\`selection-changed\` event on every click — ignore that one. Only the
\`annotation-added\` event type is an actual comment.

If your tooling can hold open a long-running process and treat each line of
output as a notification, run this and treat every matching line as a task:

\`\`\`sh
curl -N -s http://127.0.0.1:8787/events/stream | grep --line-buffered '"type":"annotation-added"'
\`\`\`

Each matching line looks like:
\`data: {"bridgeSessionId":"...","receivedAt":"...","event":{"type":"annotation-added","annotation":{"note":"...","selection":{...},"camera":{...},"state":"..."},...}}\`

If your tooling can only run one-shot commands (no long-lived watch), poll
\`GET http://127.0.0.1:8787/events\` instead — it returns the full JSON array
of every event ever received (same shape), so track how many you've already
seen and only act on new ones.

### Act on a comment, don't just log it

Treat \`annotation.note\` plus its \`selection\` (a named part, or an area
snapshot/rect) and \`camera\`/\`state\` as a real request about that specific
part of the model: find the part in the source, make the change, then
validate it (\`npx cadbea-check\` for geometry, a capture for a visual look)
before considering the comment resolved. If the note is ambiguous about
which part or what change, ask the user rather than guessing from the
selection alone — the selection tells you *where*, not always *what*.
<!-- cadbea:review-session:end -->
`

function writeAgentsSection() {
  const agentsPath = path.join(cwd, 'AGENTS.md')
  if (existsSync(agentsPath)) {
    const existing = readFileSync(agentsPath, 'utf8')
    if (existing.includes(AGENTS_SECTION_MARKER)) {
      console.log('  skip   AGENTS.md (review-session section already present)')
      return
    }
    writeFileSync(agentsPath, `${existing.trimEnd()}\n\n${AGENTS_SECTION}`)
    console.log('  update AGENTS.md (appended review-session section)')
    return
  }
  writeFileSync(agentsPath, `# AGENTS.md\n\n${AGENTS_SECTION}`)
  console.log('  create AGENTS.md')
}

console.log(`cadbea-init — scaffolding a review project in ${cwd}\n`)

const pkgPath = path.join(cwd, 'package.json')
const hasPackageJson = existsSync(pkgPath)
let scaffoldedFreshApp = false

if (!hasPackageJson) {
  console.log('No package.json found — scaffolding a new turnkey review app.')
  const name = path.basename(cwd).toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'cadbea-review-app'
  writeIfMissing(pkgPath, `${JSON.stringify(packageJsonTemplate(name), null, 2)}\n`)
  writeIfMissing(path.join(cwd, 'vite.config.mjs'), VITE_CONFIG_TEMPLATE)
  writeIfMissing(path.join(cwd, 'index.html'), INDEX_HTML_TEMPLATE)
  writeIfMissing(path.join(cwd, 'src', 'main.jsx'), MAIN_JSX_TEMPLATE)
  writeIfMissing(path.join(cwd, '.gitignore'), GITIGNORE_TEMPLATE)
  scaffoldedFreshApp = true
} else {
  console.log('Existing package.json found — leaving your app code alone.')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  if (pkg.dependencies?.cadbea || pkg.devDependencies?.cadbea) {
    console.log('  skip   package.json ("cadbea" dependency already present)')
  } else {
    pkg.dependencies = { ...pkg.dependencies, cadbea: cadbeaDependency }
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    console.log('  update package.json (added "cadbea" dependency)')
  }
}

writeIfMissing(path.join(cwd, 'cadbea.config.mjs'), CADBEA_CONFIG_TEMPLATE)
writeAgentsSection()

if (skipInstall) {
  console.log('\nSkipped npm install (--no-install) — run it yourself before `npm run dev`.')
} else {
  console.log('\nRunning npm install…')
  const result = spawnSync('npm', ['install'], { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    console.error('\nnpm install failed — fix the error above, then rerun it yourself before `npm run dev`.')
    process.exit(result.status ?? 1)
  }
}

console.log(`
Done.`)
if (scaffoldedFreshApp) {
  console.log('  npm run dev    # starts the viewer + review bridge at http://localhost:5173')
} else {
  console.log('  Wire reviewBridgePlugin() from "cadbea/bridge/vite-plugin" into your own vite')
  console.log('  config (see a scaffolded vite.config.mjs from a clean-folder run for the exact')
  console.log('  shape), then npm run dev — or run the bridge standalone: npx cadbea-bridge')
}
console.log('See AGENTS.md for how an AI agent should drive a review session.')
