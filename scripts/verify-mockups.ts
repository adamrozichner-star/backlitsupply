/**
 * Verify mockup sanity: dimensions, file size, amber glow pixels.
 * Copies passing mockups to scripts/output/review/.
 */

import sharp from 'sharp'
import { resolve } from 'path'
import { readdirSync, mkdirSync, copyFileSync, existsSync } from 'fs'
import { statSync } from 'fs'

const MOCKUP_DIR = resolve(__dirname, 'output/test-mockups')
const REVIEW_DIR = resolve(__dirname, 'output/review')

const EXPECTED_W = 1600
const EXPECTED_H = 1000
const MIN_SIZE_KB = 50
const MAX_SIZE_KB = 500

// Amber hue range in degrees (HSL)
const AMBER_HUE_MIN = 35
const AMBER_HUE_MAX = 50

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return [h * 360, s, l]
}

async function main() {
  if (!existsSync(MOCKUP_DIR)) {
    console.error(`Mockup directory not found: ${MOCKUP_DIR}`)
    process.exit(1)
  }

  const files = readdirSync(MOCKUP_DIR).filter(f => f.endsWith('.webp'))
  if (files.length === 0) {
    console.error('No .webp files found in mockup directory')
    process.exit(1)
  }

  console.log(`\nVerifying ${files.length} mockup(s) in ${MOCKUP_DIR}\n`)

  let allPassed = true

  for (const file of files) {
    const filePath = resolve(MOCKUP_DIR, file)
    console.log(`--- ${file} ---`)

    const fileStat = statSync(filePath)
    const sizeKB = fileStat.size / 1024

    // Dimension check
    const meta = await sharp(filePath).metadata()
    const dimOk = meta.width === EXPECTED_W && meta.height === EXPECTED_H
    if (dimOk) {
      console.log(`  \u2705 Dimensions: ${meta.width}x${meta.height}`)
    } else {
      console.log(`  \u274C Dimensions: ${meta.width}x${meta.height} (expected ${EXPECTED_W}x${EXPECTED_H})`)
      allPassed = false
    }

    // File size check
    const sizeOk = sizeKB >= MIN_SIZE_KB && sizeKB <= MAX_SIZE_KB
    if (sizeOk) {
      console.log(`  \u2705 File size: ${sizeKB.toFixed(1)} KB`)
    } else {
      console.log(`  \u274C File size: ${sizeKB.toFixed(1)} KB (expected ${MIN_SIZE_KB}-${MAX_SIZE_KB} KB)`)
      allPassed = false
    }

    // Amber pixel check: sample raw pixels and look for amber hue
    const { data } = await sharp(filePath)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true })

    let amberCount = 0
    const totalPixels = (meta.width || 1) * (meta.height || 1)
    // Sample every 100th pixel for speed
    for (let i = 0; i < data.length; i += 400) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const [hue, sat, lum] = rgbToHsl(r, g, b)
      if (hue >= AMBER_HUE_MIN && hue <= AMBER_HUE_MAX && sat > 0.3 && lum > 0.15 && lum < 0.85) {
        amberCount++
      }
    }

    const sampledPixels = Math.floor(data.length / 400)
    const amberRatio = amberCount / sampledPixels

    if (amberCount > 0) {
      console.log(`  \u2705 Amber pixels: found ${amberCount}/${sampledPixels} sampled (${(amberRatio * 100).toFixed(2)}%)`)
    } else {
      console.log(`  \u274C Amber pixels: none detected in ${sampledPixels} sampled pixels`)
      allPassed = false
    }
  }

  // Copy to review directory
  console.log(`\n--- Copying to review directory ---`)
  if (!existsSync(REVIEW_DIR)) mkdirSync(REVIEW_DIR, { recursive: true })

  for (const file of files) {
    const src = resolve(MOCKUP_DIR, file)
    const dst = resolve(REVIEW_DIR, file)
    copyFileSync(src, dst)
  }

  const reviewFiles = readdirSync(REVIEW_DIR)
  console.log(`\nFiles in ${REVIEW_DIR}:`)
  for (const f of reviewFiles) {
    console.log(`  ${f}`)
  }

  console.log(`\n${allPassed ? '\u2705 All checks passed' : '\u274C Some checks failed'}`)
}

main().catch(err => {
  console.error('verify-mockups failed:', err)
  process.exit(1)
})
