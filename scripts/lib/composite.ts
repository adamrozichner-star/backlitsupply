/**
 * Stage 5 — Sharp compositing pipeline
 *
 * Takes a prospect's logo and composites it onto a sign template photo.
 * CRITICAL: Logo fidelity is sacred — no diffusion, no regeneration.
 *
 * Pipeline:
 * 1. Auto-trim transparent edges
 * 2. Detect dark-on-light by avg luminance → invert to white-on-transparent if needed
 * 3. Resize preserving aspect into per-template bbox
 * 4. Halo: blur(20) + amber tint (#f59e0b) + screen blend below logo layer
 * 5. Composite onto template at 1600x1000 webp, quality 90
 */

import sharp from 'sharp'
import { resolve } from 'path'
import type { MockupResult } from './types'

// ─── Template configs ───────────────────────────────────

export interface TemplateConfig {
  id: string
  file: string           // filename in scripts/templates/
  bbox: { x: number; y: number; w: number; h: number }
  glowIntensity: number  // blur radius multiplier (1.0 = standard)
}

export const TEMPLATES: Record<string, TemplateConfig> = {
  'wall-01': {
    id: 'wall-01',
    file: 'wall-01.webp',
    bbox: { x: 250, y: 250, w: 1100, h: 400 },
    glowIntensity: 1.0,
  },
  'wall-02': {
    id: 'wall-02',
    file: 'wall-02.webp',
    bbox: { x: 200, y: 280, w: 1200, h: 380 },
    glowIntensity: 1.1,
  },
  'wall-03': {
    id: 'wall-03',
    file: 'wall-03.webp',
    bbox: { x: 250, y: 260, w: 1100, h: 400 },
    glowIntensity: 1.0,
  },
  'wall-04': {
    id: 'wall-04',
    file: 'wall-04.webp',
    bbox: { x: 200, y: 250, w: 1200, h: 420 },
    glowIntensity: 1.2,
  },
  'wall-05': {
    id: 'wall-05',
    file: 'wall-05.webp',
    bbox: { x: 300, y: 260, w: 1000, h: 380 },
    glowIntensity: 1.3,
  },
}

const TEMPLATES_DIR = resolve(__dirname, '../templates')
const GLOW_BASE_BLUR = 50          // high blur for wide LED halo spread
const AMBER = { r: 245, g: 158, b: 11 }  // #f59e0b

// ─── Logo analysis ──────────────────────────────────────

/**
 * Detect if a logo is dark-on-light (needs inversion to white-on-transparent).
 *
 * Strategy: check if the image is mostly opaque with bright edges.
 * - If the image has significant transparency → already has alpha, no inversion needed.
 * - If mostly opaque AND edge pixels are bright → dark logo on light background → needs inversion.
 */
async function needsInversion(logoBuffer: Buffer): Promise<boolean> {
  const { data, info } = await sharp(logoBuffer)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true })

  const w = info.width
  const h = info.height
  const totalPixels = w * h

  // Count transparent pixels
  let transparentPixels = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) transparentPixels++
  }

  // If >10% of pixels are transparent, the logo already has alpha — no inversion
  if (transparentPixels / totalPixels > 0.1) return false

  // Sample edge pixels (top row, bottom row, left col, right col)
  let edgeLuminance = 0
  let edgeCount = 0

  for (let x = 0; x < w; x++) {
    // Top row
    const ti = (0 * w + x) * 4
    edgeLuminance += 0.299 * data[ti] + 0.587 * data[ti + 1] + 0.114 * data[ti + 2]
    // Bottom row
    const bi = ((h - 1) * w + x) * 4
    edgeLuminance += 0.299 * data[bi] + 0.587 * data[bi + 1] + 0.114 * data[bi + 2]
    edgeCount += 2
  }
  for (let y = 0; y < h; y++) {
    // Left col
    const li = (y * w + 0) * 4
    edgeLuminance += 0.299 * data[li] + 0.587 * data[li + 1] + 0.114 * data[li + 2]
    // Right col
    const ri = (y * w + (w - 1)) * 4
    edgeLuminance += 0.299 * data[ri] + 0.587 * data[ri + 1] + 0.114 * data[ri + 2]
    edgeCount += 2
  }

  const avgEdgeLuminance = edgeLuminance / edgeCount

  // Bright edges (> 200) on a fully opaque image → dark content on light bg
  return avgEdgeLuminance > 200
}

/**
 * Convert dark-on-light logo to white-on-transparent.
 * Raw pixel approach: dark pixels → white + opaque, light pixels → transparent.
 */
async function invertToWhiteOnTransparent(logoBuffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(logoBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const out = Buffer.alloc(data.length)

  // Two thresholds: below dark = definitely text, above light = definitely bg
  const darkThreshold = 140
  const lightThreshold = 200

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b

    out[i] = 255
    out[i + 1] = 255
    out[i + 2] = 255

    if (luminance < darkThreshold) {
      // Definitely text → fully opaque white
      out[i + 3] = 255
    } else if (luminance > lightThreshold) {
      // Definitely background → fully transparent
      out[i + 3] = 0
    } else {
      // Transition zone — smooth alpha
      const t = (luminance - darkThreshold) / (lightThreshold - darkThreshold)
      out[i + 3] = Math.round(255 * (1 - t))
    }
  }

  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer()
}

// ─── Compositing ────────────────────────────────────────

export interface CompositeOptions {
  logoPath: string        // path to prospect logo file
  templateId: string      // which template to use
  outputPath: string      // where to write the result
  slug: string            // prospect slug for naming
}

export async function compositeMockup(opts: CompositeOptions): Promise<MockupResult> {
  const template = TEMPLATES[opts.templateId]
  if (!template) {
    throw new Error(`Unknown template: "${opts.templateId}". Available: ${Object.keys(TEMPLATES).join(', ')}`)
  }

  const templatePath = resolve(TEMPLATES_DIR, template.file)
  const { bbox, glowIntensity } = template

  // 1. Load and auto-trim logo
  let logoBuffer = await sharp(opts.logoPath)
    .trim()   // remove transparent edges
    .toBuffer()

  // 2. Detect dark-on-light logos — invert to white-on-transparent
  const wasInverted = await needsInversion(logoBuffer)
  if (wasInverted) {
    logoBuffer = await invertToWhiteOnTransparent(logoBuffer)
    // Re-trim after inversion (original trim can't remove white bg)
    logoBuffer = await sharp(logoBuffer).trim().toBuffer()
  }

  // 3. Resize logo to fit within bbox, preserving aspect ratio, never upscaling
  const logoMeta = await sharp(logoBuffer).metadata()
  const logoW = logoMeta.width || 400
  const logoH = logoMeta.height || 100

  // Calculate fit dimensions (contain within bbox, never upscale)
  const scaleX = Math.min(1, bbox.w / logoW)
  const scaleY = Math.min(1, bbox.h / logoH)
  const scale = Math.min(scaleX, scaleY)
  const fitW = Math.round(logoW * scale)
  const fitH = Math.round(logoH * scale)

  const resizedLogo = await sharp(logoBuffer)
    .resize(fitW, fitH, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .toBuffer()

  // 4. Generate amber LED halo glow
  // Strategy: render an SVG radial gradient in amber, shaped to the logo's
  // bounding rectangle but expanded outward. This guarantees visible glow
  // regardless of the logo's alpha channel after blur.
  const glowSpread = Math.round(70 * glowIntensity)  // px of glow beyond logo edges
  const glowW = fitW + glowSpread * 2
  const glowH = fitH + glowSpread * 2

  const glowSvg = `<svg width="${glowW}" height="${glowH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
        <stop offset="0%" stop-color="rgb(${AMBER.r},${AMBER.g},${AMBER.b})" stop-opacity="0.85" />
        <stop offset="40%" stop-color="rgb(${AMBER.r},${AMBER.g},${AMBER.b})" stop-opacity="0.45" />
        <stop offset="70%" stop-color="rgb(200,130,20)" stop-opacity="0.15" />
        <stop offset="100%" stop-color="rgb(200,130,20)" stop-opacity="0" />
      </radialGradient>
    </defs>
    <ellipse cx="${glowW / 2}" cy="${glowH / 2}" rx="${glowW / 2}" ry="${glowH / 2}" fill="url(#g)" />
  </svg>`

  const glowLayer = await sharp(Buffer.from(glowSvg)).png().toBuffer()

  // 5. Center logo + glow within bbox
  const offsetX = bbox.x + Math.round((bbox.w - fitW) / 2)
  const offsetY = bbox.y + Math.round((bbox.h - fitH) / 2)
  const glowOffsetX = offsetX - glowSpread
  const glowOffsetY = offsetY - glowSpread

  // 6. Composite onto template: glow behind, logo on top
  // Skip glow for inverted logos — the residual alpha creates a visible rectangle
  const layers = wasInverted
    ? [{ input: resizedLogo, left: offsetX, top: offsetY, blend: 'over' as const }]
    : [
        { input: glowLayer, left: glowOffsetX, top: glowOffsetY, blend: 'screen' as const },
        { input: resizedLogo, left: offsetX, top: offsetY, blend: 'over' as const },
      ]

  await sharp(templatePath)
    .composite(layers)
    .webp({ quality: 90 })
    .toFile(opts.outputPath)

  return {
    slug: opts.slug,
    template_id: opts.templateId,
    mockup_path: opts.outputPath,
    width: 1600,
    height: 1000,
  }
}

/**
 * Composite a logo onto all enabled templates for a niche.
 * Round-robins across templates in a batch.
 */
export async function compositeAll(
  logoPath: string,
  templateIds: string[],
  outputDir: string,
  slug: string,
  batchIndex: number = 0,
): Promise<MockupResult> {
  // Round-robin: pick template based on batch index
  const templateId = templateIds[batchIndex % templateIds.length]
  const outputPath = resolve(outputDir, `${slug}.webp`)

  return compositeMockup({
    logoPath,
    templateId,
    outputPath,
    slug,
  })
}
