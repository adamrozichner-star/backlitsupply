/**
 * Mockup generator interface + implementations.
 *
 * Two implementations:
 * - SharpCompositor: offline, deterministic, for fixture tests only
 * - ReplicateGenerator: single-pass AI image generation via Replicate
 *   (google/gemini-2.5-flash-image with logo as image input)
 *
 * Pipeline picks based on env: REPLICATE_API_TOKEN → Replicate, else → Sharp.
 */

import sharp from 'sharp'
import Replicate from 'replicate'
import { resolve } from 'path'
import type { NicheConfig } from '../../niches/types'

export interface MockupGenerator {
  generate(logo: Buffer, niche: NicheConfig, slug: string): Promise<{
    buffer: Buffer
    cost_usd: number
    model: string
  }>
}

// ─── Sharp compositor (offline fallback for fixture tests) ──

export class SharpCompositor implements MockupGenerator {
  async generate(logo: Buffer, niche: NicheConfig, slug: string) {
    const { compositeMockup } = await import('./composite')
    const { writeFileSync, readFileSync, mkdirSync, existsSync } = await import('fs')

    const tmpDir = resolve(__dirname, '../output/tmp')
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })

    const logoPath = resolve(tmpDir, `${slug}-logo.png`)
    writeFileSync(logoPath, logo)

    const templateId = niche.templates[0] || 'wall-01'
    const outputPath = resolve(tmpDir, `${slug}-mockup.webp`)

    await compositeMockup({ logoPath, templateId, outputPath, slug })

    const buffer = readFileSync(outputPath)
    return { buffer, cost_usd: 0, model: 'sharp-compositor' }
  }
}

// ─── Replicate AI generator (single-pass, batch 1 approach) ──

const PRIMARY_MODEL = 'google/gemini-2.5-flash-image'
const FALLBACK_MODEL = 'black-forest-labs/flux-kontext-pro'

export class ReplicateGenerator implements MockupGenerator {
  private client: Replicate

  constructor() {
    const token = process.env.REPLICATE_API_TOKEN
    if (!token) throw new Error('[ReplicateGenerator] Missing REPLICATE_API_TOKEN')
    this.client = new Replicate({ auth: token })
  }

  async generate(logo: Buffer, niche: NicheConfig, slug: string) {
    const logoDataUri = `data:image/png;base64,${logo.toString('base64')}`
    const prompt = niche.mockupPrompt

    let model: string = PRIMARY_MODEL
    let output: unknown
    let cost_usd = 0.039

    try {
      output = await this.runWithRetry(model, prompt, logoDataUri)
    } catch (err) {
      const msg = (err as Error).message || ''
      console.warn(`[mockup] Primary model failed: ${msg}. Trying fallback...`)
      model = FALLBACK_MODEL
      cost_usd = 0.04
      output = await this.runWithRetry(model, prompt, logoDataUri)
    }

    const imageUrl = this.extractUrl(output)
    if (!imageUrl) {
      throw new Error(`[mockup] No image URL in ${model} response`)
    }

    const res = await fetch(imageUrl)
    if (!res.ok) throw new Error(`[mockup] Failed to download generated image: ${res.status}`)
    const rawBuffer = Buffer.from(await res.arrayBuffer())

    const buffer = await sharp(rawBuffer)
      .resize(1600, 1000, { fit: 'cover', position: 'center' })
      .webp({ quality: 90 })
      .toBuffer()

    return { buffer, cost_usd, model }
  }

  private async runWithRetry(model: string, prompt: string, imageDataUri: string, maxRetries = 3): Promise<unknown> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.runModel(model, prompt, imageDataUri)
      } catch (err) {
        const msg = (err as Error).message || ''
        const is429 = msg.includes('429') || msg.includes('rate limit') || msg.includes('throttled')
        if (is429 && attempt < maxRetries) {
          const retryMatch = msg.match(/resets in ~(\d+)s/)
          const waitSec = retryMatch ? parseInt(retryMatch[1], 10) + 2 : 15
          console.log(`    [mockup] Rate limited, waiting ${waitSec}s (attempt ${attempt + 1}/${maxRetries})...`)
          await new Promise(r => setTimeout(r, waitSec * 1000))
          continue
        }
        throw err
      }
    }
    throw new Error('[mockup] Max retries exceeded')
  }

  private async runModel(model: string, prompt: string, imageDataUri: string): Promise<unknown> {
    if (model === PRIMARY_MODEL) {
      return this.client.run(PRIMARY_MODEL as `${string}/${string}`, {
        input: {
          prompt,
          image_input: [imageDataUri],
          aspect_ratio: '16:9',
          output_format: 'jpg',
        },
      })
    }

    return this.client.run(FALLBACK_MODEL as `${string}/${string}`, {
      input: {
        prompt,
        image_url: imageDataUri,
        aspect_ratio: '16:9',
      },
    })
  }

  private extractUrl(output: unknown): string | null {
    // FileOutput objects: toString() gives the URL, JSON.stringify returns {}
    const str = String(output)
    if (str.startsWith('http')) return str

    if (typeof output === 'string') return output
    if (Array.isArray(output) && output.length > 0) {
      const first = output[0]
      const firstStr = String(first)
      if (firstStr.startsWith('http')) return firstStr
      if (typeof first === 'string') return first
      if (first?.url) return first.url
    }
    if (output && typeof output === 'object') {
      const obj = output as Record<string, unknown>
      if (typeof obj.url === 'string') return obj.url
      if (typeof obj.output === 'string') return obj.output
    }
    return null
  }
}

// ─── Factory ────────────────────────────────────────────

export function createMockupGenerator(): MockupGenerator {
  if (process.env.REPLICATE_API_TOKEN) {
    console.log('[mockup] Using ReplicateGenerator (AI image generation)')
    return new ReplicateGenerator()
  }
  console.log('[mockup] Using SharpCompositor (offline fallback)')
  return new SharpCompositor()
}
