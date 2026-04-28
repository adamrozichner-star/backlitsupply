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
  generate(logo: Buffer, niche: NicheConfig, slug: string, retryCount?: number): Promise<{
    buffer: Buffer
    cost_usd: number
    model: string
    prediction_id?: string | null
    prompt_used: 'default' | 'retry'
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
    return { buffer, cost_usd: 0, model: 'sharp-compositor', prediction_id: null, prompt_used: 'default' as const }
  }
}

// ─── Replicate AI generator (single-pass, batch 1 approach) ──

const PRIMARY_MODEL = 'google/gemini-2.5-flash-image'
const PRIMARY_RETRY_DELAYS = [30_000, 60_000]

export class ReplicateGenerator implements MockupGenerator {
  private client: Replicate

  constructor() {
    const token = process.env.REPLICATE_API_TOKEN
    if (!token) throw new Error('[ReplicateGenerator] Missing REPLICATE_API_TOKEN')
    this.client = new Replicate({ auth: token })
  }

  async generate(logo: Buffer, niche: NicheConfig, slug: string, retryCount: number = 0) {
    // Detect format from buffer magic bytes
    const isWebp = logo[0] === 0x52 && logo[1] === 0x49  // RIFF
    const isJpeg = logo[0] === 0xFF && logo[1] === 0xD8
    const mime = isWebp ? 'image/webp' : isJpeg ? 'image/jpeg' : 'image/png'
    const logoDataUri = `data:${mime};base64,${logo.toString('base64')}`

    // Select prompt: use retry variant if retryCount > 0 and niche has one
    const useRetry = retryCount > 0 && !!niche.mockupPromptRetry
    const prompt = useRetry ? niche.mockupPromptRetry! : niche.mockupPrompt
    const prompt_used = useRetry ? 'retry' as const : 'default' as const

    if (useRetry) {
      console.log(`    [mockup] Using RETRY prompt (retry_count=${retryCount})`)
    }

    const model = PRIMARY_MODEL
    let runResult!: { output: unknown; predictionId: string | null }

    // Retry primary model with increasing backoff — no fallback model
    let lastErr: Error | null = null
    for (let attempt = 0; attempt < 1 + PRIMARY_RETRY_DELAYS.length; attempt++) {
      try {
        if (attempt > 0) {
          const delay = PRIMARY_RETRY_DELAYS[attempt - 1]
          console.log(`    [mockup] Primary failed, retry ${attempt}/${PRIMARY_RETRY_DELAYS.length} in ${delay / 1000}s...`)
          await new Promise(r => setTimeout(r, delay))
        }
        runResult = await this.runWithRetry(model, prompt, logoDataUri)
        lastErr = null
        break
      } catch (err) {
        lastErr = err as Error
        console.warn(`    [mockup] Attempt ${attempt + 1} failed: ${lastErr.message?.slice(0, 100)}`)
      }
    }

    if (lastErr) {
      throw new Error(`[mockup] All ${1 + PRIMARY_RETRY_DELAYS.length} attempts failed for ${slug}: ${lastErr.message?.slice(0, 100)}`)
    }

    const imageUrl = this.extractUrl(runResult.output)
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

    // Fetch actual cost from the prediction (Replicate bills per-prediction)
    let cost_usd = 0.039
    const prediction_id = runResult.predictionId
    if (prediction_id) {
      try {
        const prediction = await this.client.predictions.get(prediction_id)
        if (prediction.metrics?.predict_time) {
          // Replicate bills by GPU-second. The prediction object doesn't directly
          // expose cost, but we can use the official billing data if available.
          // For now, trust the metrics and use hardware-specific rates.
        }
        // Some models expose cost directly — check multiple fields
        const rawCost = (prediction as unknown as Record<string, unknown>).cost
          ?? (prediction.metrics as Record<string, unknown> | undefined)?.cost
        if (typeof rawCost === 'number' && rawCost > 0) {
          cost_usd = rawCost
        }
      } catch {
        // prediction.get() failed — keep estimate
      }
    }

    return { buffer, cost_usd, model, prediction_id, prompt_used }
  }

  private async runWithRetry(model: string, prompt: string, imageDataUri: string, maxRetries = 3): Promise<{ output: unknown; predictionId: string | null }> {
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

  private async runModel(model: string, prompt: string, imageDataUri: string): Promise<{ output: unknown; predictionId: string | null }> {
    const input = { prompt, image_input: [imageDataUri], aspect_ratio: '16:9', output_format: 'jpg' }

    const prediction = await this.client.predictions.create({
      model: model as `${string}/${string}`,
      input,
    })

    const completed = await this.client.wait(prediction, { interval: 1000 })

    if (completed.status === 'failed') {
      throw new Error(`Prediction failed: ${completed.error || 'unknown'}`)
    }

    return {
      output: completed.output,
      predictionId: completed.id || null,
    }
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
