/**
 * Convert factory photos from Adam's Desktop to production WebP.
 *
 * Usage: npm run convert:factory
 *
 * Source: /Users/adamrozi/Desktop/factory/
 * Output: /public/factory/
 */

import sharp from 'sharp'
import { resolve, join } from 'path'
import { existsSync, statSync } from 'fs'

const SOURCE_DIR = '/Users/adamrozi/Desktop/factory'
const OUTPUT_DIR = resolve(__dirname, '../public/factory')

const EXTENSIONS = ['.jpeg', '.jpg', '.png', '.webp', '.JPG', '.JPEG', '.PNG']

interface Conversion {
  sourceName: string
  targetName: string
  width: number
  height: number
}

const CONVERSIONS: Conversion[] = [
  { sourceName: 'hero', targetName: 'hero.webp', width: 2560, height: 1280 },
  { sourceName: '1', targetName: 'step-01.webp', width: 1280, height: 960 },
  { sourceName: '2', targetName: 'step-02.webp', width: 1280, height: 960 },
  { sourceName: '3', targetName: 'step-03.webp', width: 1280, height: 960 },
  { sourceName: '4', targetName: 'step-04.webp', width: 1280, height: 960 },
]

function findSource(name: string): string | null {
  for (const ext of EXTENSIONS) {
    const path = join(SOURCE_DIR, name + ext)
    if (existsSync(path)) return path
  }
  return null
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function main() {
  console.log('\n=== Factory Photo Conversion ===\n')
  console.log(`Source: ${SOURCE_DIR}`)
  console.log(`Output: ${OUTPUT_DIR}\n`)

  let success = 0
  let failed = 0

  for (const conv of CONVERSIONS) {
    const sourcePath = findSource(conv.sourceName)

    if (!sourcePath) {
      console.log(`MISSING: ${conv.sourceName} (tried ${EXTENSIONS.join(', ')})`)
      failed++
      continue
    }

    try {
      const inputMeta = await sharp(sourcePath).metadata()
      const inputDims = `${inputMeta.width}x${inputMeta.height}`

      const outputPath = join(OUTPUT_DIR, conv.targetName)

      await sharp(sourcePath)
        .resize(conv.width, conv.height, { fit: 'cover', position: 'centre' })
        .webp({ quality: 85 })
        .toFile(outputPath)

      const outputSize = statSync(outputPath).size

      console.log(`${conv.sourceName} → ${conv.targetName}`)
      console.log(`  Input:  ${inputDims} (${inputMeta.format})`)
      console.log(`  Output: ${conv.width}x${conv.height} WebP, ${formatSize(outputSize)}`)
      console.log('')
      success++
    } catch (err) {
      console.error(`ERROR: ${conv.sourceName} → ${conv.targetName}: ${(err as Error).message}`)
      failed++
    }
  }

  console.log(`\nDone: ${success} converted, ${failed} failed/missing`)
}

main().catch(err => {
  console.error('Conversion failed:', err)
  process.exit(1)
})
