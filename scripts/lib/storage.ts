/**
 * Stage 6 — Mockup storage
 *
 * Interface + two implementations:
 * - LocalStorage: writes to public/mockups/, returns /mockups/{slug}.webp
 * - R2Storage: stubbed, throws if no creds
 *
 * Pipeline uses LocalStorage when R2 vars absent → personalized pages render
 * locally with zero cloud keys.
 */

import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, basename } from 'path'

export interface MockupStorage {
  /**
   * Upload a mockup file. Returns the public URL or path.
   */
  upload(slug: string, filePath: string): Promise<string>
}

// ─── Local storage ──────────────────────────────────────

export class LocalMockupStorage implements MockupStorage {
  private outputDir: string

  constructor(outputDir?: string) {
    this.outputDir = outputDir || resolve(__dirname, '../../public/mockups')
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true })
    }
  }

  async upload(slug: string, filePath: string): Promise<string> {
    const ext = basename(filePath).split('.').pop() || 'webp'
    const destFile = `${slug}.${ext}`
    const destPath = resolve(this.outputDir, destFile)
    copyFileSync(filePath, destPath)
    return `/mockups/${destFile}`
  }
}

// ─── R2 storage (stubbed) ───────────────────────────────

export class R2MockupStorage implements MockupStorage {
  constructor() {
    const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
    const missing = required.filter(k => !process.env[k])
    if (missing.length > 0) {
      throw new Error(`[R2Storage] Missing env vars: ${missing.join(', ')}`)
    }
  }

  async upload(_slug: string, _filePath: string): Promise<string> {
    // TODO: Implement R2 upload via S3-compatible API
    throw new Error('[R2Storage] Not implemented yet — use LocalStorage until R2 keys arrive')
  }
}

// ─── Factory ────────────────────────────────────────────

export function createStorage(): MockupStorage {
  if (process.env.R2_ACCOUNT_ID) {
    return new R2MockupStorage()
  }
  return new LocalMockupStorage()
}
