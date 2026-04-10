/**
 * Convert sign photos from /public/work/ to 1600x1000 webp templates.
 * Picks the 5 cleanest shots for compositing.
 *
 * Output: scripts/templates/sign-{id}.webp
 */

import sharp from 'sharp'
import { resolve } from 'path'

const TEMPLATES = [
  'sign-01.avif',  // Wellness & Medical — grey wall
  'sign-02.avif',  // Restaurants & Bars — outdoor wall
  'sign-03.avif',  // Restaurants & Cafés — veranda exterior
  'sign-04.avif',  // Studios & Concept Spaces — raw concrete
  'sign-06.webp',  // Hospitality — architectural facade
]

const INPUT_DIR = resolve(__dirname, '../public/work')
const OUTPUT_DIR = resolve(__dirname, 'templates')

async function main() {
  for (const file of TEMPLATES) {
    const id = file.replace(/\.(avif|webp)$/, '')
    const input = resolve(INPUT_DIR, file)
    const output = resolve(OUTPUT_DIR, `${id}.webp`)

    await sharp(input)
      .resize(1600, 1000, { fit: 'cover', position: 'center' })
      .webp({ quality: 90 })
      .toFile(output)

    console.log(`✅ ${id}.webp — 1600x1000`)
  }

  console.log(`\nDone. ${TEMPLATES.length} templates in ${OUTPUT_DIR}`)
}

main().catch(console.error)
