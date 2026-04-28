/**
 * Pattern-based email enrichment — replaces Hunter.io.
 *
 * Generates candidate emails from prospect's domain and verifies
 * the domain has MX records (accepts mail). Zero cost, no API keys.
 *
 * Tier order (descending preference — role-based first for local businesses):
 *   Tier 1 (confidence 80): info@, hello@, contact@ — owner checks these directly
 *   Tier 2 (confidence 70): {firstname}@ — if owner name from Places
 *   Tier 3 (confidence 65): {firstname}.{lastname}@ — if full name available
 */

import { promises as dns, setServers } from 'dns'

// Use public DNS resolvers to avoid ISP/router throttling on bulk queries
setServers(['1.1.1.1', '8.8.8.8', '8.8.4.4'])

export interface PatternEmailResult {
  found: boolean
  email?: string
  confidence?: number
  is_role_based?: boolean
  tier?: 1 | 2 | 3
  mx_verified?: boolean
  candidates?: string[]
}

function extractDomain(website: string): string | null {
  try {
    return new URL(website).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

async function checkMxRecords(domain: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await Promise.race([
        dns.resolveMx(domain),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('MX timeout')), 5000)),
      ])
      return Array.isArray(result) && result.length > 0
    } catch {
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      return false
    }
  }
  return false
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '')
}

export async function enrichEmailViaPattern(
  website: string,
  ownerFirstName?: string,
  ownerLastName?: string,
): Promise<PatternEmailResult> {
  const domain = extractDomain(website)
  if (!domain) {
    console.log('    [pattern] Cannot extract domain from:', website)
    return { found: false }
  }

  await new Promise(r => setTimeout(r, 500))
  const hasMx = await checkMxRecords(domain)
  if (!hasMx) {
    console.log(`    [pattern] No MX records for ${domain}`)
    return { found: false, mx_verified: false }
  }

  const candidates: Array<{ email: string; tier: 1 | 2 | 3; confidence: number; is_role_based: boolean }> = []

  // Tier 1: role-based (most reliable for local businesses)
  for (const prefix of ['info', 'hello', 'contact']) {
    candidates.push({ email: `${prefix}@${domain}`, tier: 1, confidence: 80, is_role_based: true })
  }

  // Tier 2: firstname@ (if owner name available)
  const first = ownerFirstName ? normalize(ownerFirstName) : null
  if (first && first.length >= 2) {
    candidates.push({ email: `${first}@${domain}`, tier: 2, confidence: 70, is_role_based: false })
  }

  // Tier 3: firstname.lastname@ (if full name available)
  const last = ownerLastName ? normalize(ownerLastName) : null
  if (first && last && first.length >= 2 && last.length >= 2) {
    candidates.push({ email: `${first}.${last}@${domain}`, tier: 3, confidence: 65, is_role_based: false })
  }

  // Sort by tier (1 = best)
  candidates.sort((a, b) => a.tier - b.tier)

  const best = candidates[0]
  if (!best) {
    return { found: false, mx_verified: true }
  }

  console.log(`    [pattern] ${domain}: MX verified, selected ${best.email} (tier ${best.tier}, confidence ${best.confidence}${best.is_role_based ? ', role-based' : ''})`)

  return {
    found: true,
    email: best.email,
    confidence: best.confidence,
    is_role_based: best.is_role_based,
    tier: best.tier,
    mx_verified: true,
    candidates: candidates.map(c => c.email),
  }
}
