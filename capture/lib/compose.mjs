/**
 * Generic sharp-based grid compositor — no CAD/project knowledge. Takes a
 * list of PNG buffers with labels and returns one composed PNG.
 */

import sharp from 'sharp'

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function labelSvg(width, height, text) {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
       <rect x="0" y="0" width="${width}" height="24" fill="#0a0a14" fill-opacity="0.65"/>
       <text x="7" y="17" font-family="monospace" font-size="13" fill="#dfe8ff">${escapeXml(text)}</text>
     </svg>`,
  )
}

function bannerSvg(width, height, text) {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${width}" height="${height}" fill="#10101c"/>
       <text x="10" y="${Math.round(height * 0.7)}" font-family="monospace" font-size="16" fill="#e0e8ff">${escapeXml(text)}</text>
     </svg>`,
  )
}

/**
 * @param {{ buffer: Buffer, label: string }[]} cells
 * @param {{ cols?: number, cellWidth?: number, cellHeight?: number, title?: string, background?: string }} [options]
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function composeContactSheet(cells, options = {}) {
  const { cols = Math.ceil(Math.sqrt(cells.length)), cellWidth = 640, cellHeight = 411, title, background = '#0f0f1a' } = options
  const rows = Math.ceil(cells.length / cols)
  const headerH = title ? 32 : 0
  const sheetW = cellWidth * cols
  const sheetH = headerH + cellHeight * rows

  const labeled = await Promise.all(
    cells.map(async ({ buffer, label }) => {
      const resized = await sharp(buffer).resize(cellWidth, cellHeight, { fit: 'cover' }).png().toBuffer()
      return sharp(resized)
        .composite([{ input: labelSvg(cellWidth, cellHeight, label), top: 0, left: 0 }])
        .png()
        .toBuffer()
    }),
  )

  const composite = []
  if (title) composite.push({ input: bannerSvg(sheetW, headerH, title), top: 0, left: 0 })
  labeled.forEach((buf, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    composite.push({ input: buf, left: col * cellWidth, top: headerH + row * cellHeight })
  })

  return sharp({ create: { width: sheetW, height: sheetH, channels: 4, background } })
    .composite(composite)
    .png()
    .toBuffer()
}
