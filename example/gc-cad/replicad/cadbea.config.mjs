export default {
  url: 'http://127.0.0.1:5173',
  outDir: '../screenshots/latest',
  title: 'GC Node Enclosure',
  // Standard views are axis-derived and physically meaningless on their own
  // (see cadbea README) — PARTS.md records which one actually shows which
  // physical face once observed, rather than guessing here.
  //
  // No project-specific extraViews needed for corner inspection — cadbea's
  // generic corner-tl/tr/bl/br views (derived from the bounding box, not
  // hand-typed coordinates) replaced this project's original hand-aimed
  // corner-near/corner-far cameras. Use `npm run contact-sheet -- --corners`
  // or `npm run views -- --view=corner-tl,corner-tr,corner-bl,corner-br`.
}
