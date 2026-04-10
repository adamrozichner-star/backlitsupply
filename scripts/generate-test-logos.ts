/**
 * Generate test logo fixtures for compositing tests.
 *
 * Creates two PNGs:
 * 1. scripts/fixtures/sample-logo-light.png — white "NORTH & PINE" on transparent (standard case)
 * 2. scripts/fixtures/sample-logo-dark.png — dark "NORTH & PINE" on white bg (tests luminance-invert branch)
 */

import sharp from 'sharp'
import { resolve } from 'path'

const WIDTH = 800
const HEIGHT = 200

async function generateLogo(filename: string, textFill: string, bgFill: string | null) {
  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${bgFill ? `<rect width="${WIDTH}" height="${HEIGHT}" fill="${bgFill}" />` : ''}
      <text
        x="50%" y="55%"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="Helvetica, Arial, sans-serif"
        font-size="72"
        font-weight="bold"
        letter-spacing="8"
        fill="${textFill}"
      >NORTH &amp; PINE</text>
    </svg>
  `

  const outPath = resolve(__dirname, 'fixtures', filename)
  await sharp(Buffer.from(svg)).png().toFile(outPath)
  console.log(`✅ Generated ${outPath}`)
}

async function main() {
  // Light logo: white text on transparent — standard case
  await generateLogo('sample-logo-light.png', '#ffffff', null)

  // Dark logo: dark text on white background — tests invert branch
  await generateLogo('sample-logo-dark.png', '#1a1a1a', '#ffffff')

  console.log('\nDone. Two fixture logos ready for compositing tests.')
}

main().catch(console.error)
