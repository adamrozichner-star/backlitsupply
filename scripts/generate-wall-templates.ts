/**
 * Generate 5 empty wall plate templates for sign compositing.
 *
 * Each template is 1600x1000 webp with:
 * - A textured wall surface (concrete, plaster, wood, metal, white)
 * - Warm ambient lighting from above (gradient overlay)
 * - No signage, no text — just a blank wall ready for logo compositing
 *
 * Output: scripts/templates/wall-01.webp through wall-05.webp
 */

import sharp from 'sharp'
import { resolve } from 'path'

const W = 1600
const H = 1000
const OUTPUT_DIR = resolve(__dirname, 'templates')

interface WallConfig {
  id: string
  baseColor: { r: number; g: number; b: number }
  grainIntensity: number
  warmth: number       // 0-1, how strong the warm light overlay is
  lightY: number       // vertical center of light cone (0=top, 1=bottom)
  vignette: number     // 0-1, how dark the edges are
  description: string
}

const WALLS: WallConfig[] = [
  {
    id: 'wall-01',
    baseColor: { r: 58, g: 56, b: 52 },    // warm dark concrete
    grainIntensity: 18,
    warmth: 0.35,
    lightY: 0.15,
    vignette: 0.6,
    description: 'Dark concrete, warm overhead light',
  },
  {
    id: 'wall-02',
    baseColor: { r: 42, g: 40, b: 38 },    // charcoal plaster
    grainIntensity: 12,
    warmth: 0.4,
    lightY: 0.1,
    vignette: 0.7,
    description: 'Charcoal plaster, strong warm downlight',
  },
  {
    id: 'wall-03',
    baseColor: { r: 35, g: 32, b: 28 },    // dark brushed surface
    grainIntensity: 22,
    warmth: 0.3,
    lightY: 0.2,
    vignette: 0.5,
    description: 'Dark brushed texture, subtle warm ambient',
  },
  {
    id: 'wall-04',
    baseColor: { r: 50, g: 42, b: 34 },    // warm brown/wood tone
    grainIntensity: 25,
    warmth: 0.45,
    lightY: 0.12,
    vignette: 0.65,
    description: 'Warm brown panel, rich amber spotlight',
  },
  {
    id: 'wall-05',
    baseColor: { r: 28, g: 28, b: 30 },    // near-black slate
    grainIntensity: 15,
    warmth: 0.5,
    lightY: 0.08,
    vignette: 0.75,
    description: 'Dark slate, dramatic overhead warm wash',
  },
]

async function generateWall(config: WallConfig): Promise<void> {
  const { id, baseColor, grainIntensity, warmth, lightY, vignette } = config

  // 1. Create base color with noise/grain texture via SVG
  const grainSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
    </defs>
    <rect width="${W}" height="${H}" fill="rgb(${baseColor.r},${baseColor.g},${baseColor.b})" />
    <rect width="${W}" height="${H}" filter="url(#noise)" opacity="${grainIntensity / 100}" />
  </svg>`

  const base = await sharp(Buffer.from(grainSvg)).png().toBuffer()

  // 2. Create warm light gradient (radial-ish from top center)
  // Amber/warm light that fades from top center downward
  const cx = W / 2
  const cy = H * lightY
  const lightSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="light" cx="${cx / W}" cy="${cy / H}" r="0.7" fx="${cx / W}" fy="${cy / H}">
        <stop offset="0%" stop-color="rgb(245,180,80)" stop-opacity="${warmth}" />
        <stop offset="30%" stop-color="rgb(220,150,50)" stop-opacity="${warmth * 0.6}" />
        <stop offset="60%" stop-color="rgb(180,120,40)" stop-opacity="${warmth * 0.25}" />
        <stop offset="100%" stop-color="rgb(0,0,0)" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#light)" />
  </svg>`

  const lightLayer = await sharp(Buffer.from(lightSvg)).png().toBuffer()

  // 3. Create vignette (dark edges)
  const vignetteSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="vig" cx="0.5" cy="0.45" r="0.65">
        <stop offset="0%" stop-color="black" stop-opacity="0" />
        <stop offset="70%" stop-color="black" stop-opacity="0" />
        <stop offset="100%" stop-color="black" stop-opacity="${vignette}" />
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#vig)" />
  </svg>`

  const vignetteLayer = await sharp(Buffer.from(vignetteSvg)).png().toBuffer()

  // 4. Composite: base + warm light (screen blend) + vignette (multiply-ish via over)
  const result = await sharp(base)
    .composite([
      { input: lightLayer, blend: 'screen' },
      { input: vignetteLayer, blend: 'over' },
    ])
    .webp({ quality: 92 })
    .toFile(resolve(OUTPUT_DIR, `${id}.webp`))

  console.log(`✅ ${id}.webp — ${config.description}`)
}

async function main() {
  for (const wall of WALLS) {
    await generateWall(wall)
  }
  console.log(`\nDone. ${WALLS.length} wall templates in ${OUTPUT_DIR}`)
}

main().catch(console.error)
