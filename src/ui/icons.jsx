/**
 * Minimal, dependency-free inline SVG icons for cadbea/ui's own chrome.
 * Path data matches the equivalent lucide-react (MIT/ISC) icon, so a
 * project that uses the real lucide-react package for its own controls
 * (e.g. explode/section toggles) gets a visually consistent icon set,
 * without making lucide a dependency of this generic package.
 */
const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
}

/** lucide "Download" */
export function DownloadIcon({ size = 14 }) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  )
}

/** lucide "MousePointer2" — represents clicking a single part. */
export function SelectPartIcon({ size = 14 }) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z" />
    </svg>
  )
}

/** lucide "BoxSelect" (aka "SquareDashed") — represents a drag-selected area. */
export function SelectAreaIcon({ size = 14 }) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M5 3a2 2 0 0 0-2 2" />
      <path d="M19 3a2 2 0 0 1 2 2" />
      <path d="M21 19a2 2 0 0 1-2 2" />
      <path d="M5 21a2 2 0 0 1-2-2" />
      <path d="M9 3h1" />
      <path d="M9 21h1" />
      <path d="M14 3h1" />
      <path d="M14 21h1" />
      <path d="M3 9v1" />
      <path d="M21 9v1" />
      <path d="M3 14v1" />
      <path d="M21 14v1" />
    </svg>
  )
}
