import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Buffer } from 'node:buffer'
import opencascade from 'replicad-opencascadejs'
import { setOC } from 'replicad'
const root = fileURLToPath(new URL('..', import.meta.url))
const outputDir = join(root, 'dist', 'print')

await setOC(await opencascade())
await mkdir(outputDir, { recursive: true })

// TypeScript's bundler resolution intentionally omits .js in source imports;
// add it to the temporary Node build before loading the model for export.
const modelPath = join(root, '.cad-build', 'model', 'enclosure.js')
const modelSource = await readFile(modelPath, 'utf8')
await writeFile(modelPath, modelSource.replace("from './hardware'", "from './hardware.js'"))
const { buildBody, buildLid, buildButtons } = await import(pathToFileURL(modelPath))
const { prgButton, rstButton } = buildButtons()

const exports = [
  ['node-wireless-tracker-v2-body-v0.3.stl', buildBody()],
  ['node-wireless-tracker-v2-lid-v0.3.stl', buildLid()],
  ['node-wireless-tracker-v2-button-prg-v0.3.stl', prgButton],
  ['node-wireless-tracker-v2-button-rst-v0.3.stl', rstButton],
]

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeZip(entries) {
  const local = []
  const central = []
  let offset = 0
  for (const [name, data] of entries) {
    const nameBuffer = Buffer.from(name)
    const crc = crc32(data)
    const header = Buffer.alloc(30 + nameBuffer.length)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(0, 6)
    header.writeUInt16LE(0, 8) // stored, keeping the bundle dependency-free
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(data.length, 18)
    header.writeUInt32LE(data.length, 22)
    header.writeUInt16LE(nameBuffer.length, 26)
    nameBuffer.copy(header, 30)
    local.push(header, data)

    const directory = Buffer.alloc(46 + nameBuffer.length)
    directory.writeUInt32LE(0x02014b50, 0)
    directory.writeUInt16LE(20, 4)
    directory.writeUInt16LE(20, 6)
    directory.writeUInt16LE(0, 8)
    directory.writeUInt16LE(0, 10)
    directory.writeUInt32LE(crc, 16)
    directory.writeUInt32LE(data.length, 20)
    directory.writeUInt32LE(data.length, 24)
    directory.writeUInt16LE(nameBuffer.length, 28)
    directory.writeUInt32LE(offset, 42)
    nameBuffer.copy(directory, 46)
    central.push(directory)
    offset += header.length + data.length
  }
  const centralData = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralData.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, centralData, end])
}

const zipEntries = []
for (const [name, shape] of exports) {
  const stl = await shape.blobSTL({ binary: true }).arrayBuffer()
  const data = Buffer.from(stl)
  zipEntries.push([name, data])
  await writeFile(join(outputDir, name), data)
}
await writeFile(join(outputDir, 'node-wireless-tracker-v2-print-files.zip'), makeZip(zipEntries))

console.log(`Exported ${exports.length} printable STL files and one bundle to ${outputDir}`)
