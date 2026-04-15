/**
 * Pure mockup verification logic — shared by scripts/verify-mockups.ts (CLI)
 * and src/lib/admin/actions.ts (admin per-prospect button).
 *
 * Fetches the personalized page, finds the mockup <img>, fetches the image,
 * validates status + content-type + size. Pure function — no Supabase writes,
 * no side effects. Callers handle event logging.
 */

const MIN_IMAGE_BYTES = 10 * 1024
const DEFAULT_BASE_URL = 'https://backlitsupply.com'

export interface VerifyResult {
  slug: string
  state: string
  mockup_url: string | null
  page_status: number
  image_url: string | null
  image_status: number | null
  image_content_type: string | null
  image_size: number | null
  ok: boolean
  reason?: string
}

export async function verifyOne(
  slug: string,
  state: string,
  mockupUrl: string | null,
  baseUrl: string = process.env.VERIFY_BASE_URL || DEFAULT_BASE_URL,
): Promise<VerifyResult> {
  const result: VerifyResult = {
    slug, state, mockup_url: mockupUrl,
    page_status: 0, image_url: null, image_status: null,
    image_content_type: null, image_size: null,
    ok: false,
  }

  try {
    const pageRes = await fetch(`${baseUrl}/for/${slug}`, { signal: AbortSignal.timeout(15000) })
    result.page_status = pageRes.status
    if (!pageRes.ok) {
      result.reason = `page status ${pageRes.status}`
      return result
    }
    const html = await pageRes.text()

    const patterns: RegExp[] = [
      /src=["']([^"']*\/mockups\/[^"']+\.webp[^"']*)["']/i,
      /src=["'](\/_next\/image\?url=[^"']*mockups[^"']+)["']/i,
    ]
    let imageUrl: string | null = null
    for (const re of patterns) {
      const m = html.match(re)
      if (m) { imageUrl = m[1].replace(/&amp;/g, '&'); break }
    }

    if (!imageUrl) {
      result.reason = 'no mockup <img> tag found in HTML'
      return result
    }
    if (imageUrl.startsWith('/')) imageUrl = baseUrl + imageUrl
    result.image_url = imageUrl

    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
    result.image_status = imgRes.status
    result.image_content_type = imgRes.headers.get('content-type')

    if (!imgRes.ok) {
      result.reason = `image status ${imgRes.status}`
      return result
    }

    const buffer = Buffer.from(await imgRes.arrayBuffer())
    result.image_size = buffer.length

    if (!result.image_content_type?.startsWith('image/')) {
      result.reason = `non-image content-type: ${result.image_content_type}`
      return result
    }

    if (buffer.length < MIN_IMAGE_BYTES) {
      result.reason = `image too small: ${buffer.length}B < ${MIN_IMAGE_BYTES}B`
      return result
    }

    result.ok = true
    return result
  } catch (err) {
    result.reason = `fetch error: ${(err as Error).message?.slice(0, 80)}`
    return result
  }
}
