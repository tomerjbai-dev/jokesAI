// Generates the app icons (DESIGN.md §2.6): a white Heebo 700 "ב" on a primary-red square.
// The letter is converted to an SVG path, so rendering does not depend on installed fonts.
// Run with: npm run icons
import { readFile, writeFile } from 'node:fs/promises'
import opentype from 'opentype.js'
import sharp from 'sharp'

const RED = '#CF240A'
const FONT = 'node_modules/@fontsource/heebo/files/heebo-hebrew-700-normal.woff'
const OUT = 'public'
const VIEW = 512

const buffer = await readFile(FONT)
const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))

// Path of the letter, centered in the canvas, with its bounding box fitted to `letterSize`.
function letterPath(letterSize) {
  const raw = font.getPath('ב', 0, 0, 1000)
  const box = raw.getBoundingBox()
  const scale = letterSize / Math.max(box.x2 - box.x1, box.y2 - box.y1)
  const x = VIEW / 2 - ((box.x1 + box.x2) / 2) * scale
  const y = VIEW / 2 - ((box.y1 + box.y2) / 2) * scale
  return font.getPath('ב', x, y, 1000 * scale).toPathData(2)
}

function svg({ rounded, letterSize }) {
  const radius = rounded ? VIEW * 0.18 : 0
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}">
  <rect width="${VIEW}" height="${VIEW}" rx="${radius}" fill="${RED}"/>
  <path d="${letterPath(letterSize)}" fill="#FFFFFF"/>
</svg>
`
}

// Standard icon: rounded square, letter about 60% of the side.
const standard = svg({ rounded: true, letterSize: VIEW * 0.6 })
// Maskable icon: full-bleed background, letter well inside the central 80% safe zone.
const maskable = svg({ rounded: false, letterSize: VIEW * 0.46 })
// Apple touch icon: iOS rounds the corners itself and needs no transparency.
const apple = svg({ rounded: false, letterSize: VIEW * 0.6 })

const png = (source, size, file) => sharp(Buffer.from(source)).resize(size, size).png().toFile(`${OUT}/${file}`)

await writeFile(`${OUT}/favicon.svg`, standard)
await png(standard, 192, 'pwa-192x192.png')
await png(standard, 512, 'pwa-512x512.png')
await png(maskable, 512, 'pwa-maskable-512x512.png')
await png(apple, 180, 'apple-touch-icon.png')
console.log('icons written to public/')
