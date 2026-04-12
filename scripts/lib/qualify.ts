/**
 * Stage 4 — Qualification scoring + chain detection
 *
 * Score 0–100 based on enriched prospect data.
 * Niche config sets threshold — below threshold → no mockup spent.
 *
 * Chain businesses are auto-killed before scoring. Chains are never real prospects.
 *
 * Niche config can also provide:
 * - `chainBlocklist`: niche-specific chain names (merged with global list)
 * - `qualifyBoosts`: role-evidence pattern boosts (e.g. +10 for DDS/DMD)
 */

import type { EnrichedProspect } from './types'
import type { QualifyConfig, QualifyBoost } from '../../niches/types'

// ─── Chain detection ────────────────────────────────────

const KNOWN_CHAINS = new Set([
  'starbucks', 'mcdonalds', "mcdonald's", 'subway', 'chipotle', 'panera',
  'chick-fil-a', "wendy's", 'wendys', 'taco bell', 'burger king', 'popeyes',
  "applebee's", 'applebees', 'olive garden', 'red lobster', 'outback',
  'cheesecake factory', 'ihop', "denny's", 'dennys', 'cracker barrel',
  'buffalo wild wings', 'chilis', "chili's", 'hooters', 'waffle house',
  'five guys', 'in-n-out', 'whataburger', "zaxby's", 'zaxbys',
  'massage envy', 'hand & stone', 'hand and stone', 'european wax center',
  'ideal image', 'laser away', 'laseraway', 'milan laser', 'sola salons',
  'orangetheory', 'planet fitness', 'equinox', 'lifetime fitness',
  "gordon ramsay", 'nobu', 'hakkasan', 'catch', 'carbone',
])

function isChainByName(name: string, extraChains: Set<string>): boolean {
  const lower = name.toLowerCase().trim()
  for (const chain of KNOWN_CHAINS) {
    if (lower.includes(chain)) return true
  }
  for (const chain of extraChains) {
    if (lower.includes(chain)) return true
  }
  return false
}

function isChainByWebsite(website?: string): boolean {
  if (!website) return false
  const lower = website.toLowerCase()
  return /\/(locations|franchise|find-a-|our-locations|store-locator)/.test(lower)
}

export interface QualifyResult {
  score: number
  passed: boolean
  killed_as_chain: boolean
  chain_reason?: string
  breakdown: Record<string, number>
}

export function qualifyProspect(
  prospect: EnrichedProspect,
  config: QualifyConfig,
  options: { chainBlocklist?: string[]; qualifyBoosts?: QualifyBoost[] } = {},
): QualifyResult {
  // Merge niche chain list with global
  const extraChains = new Set(
    (options.chainBlocklist || []).map(c => c.toLowerCase().trim()),
  )

  // ── Chain kill check (before scoring) ──
  if (isChainByName(prospect.business_name, extraChains)) {
    return {
      score: 0, passed: false, killed_as_chain: true,
      chain_reason: 'known chain name',
      breakdown: {},
    }
  }
  if (isChainByWebsite(prospect.website)) {
    return {
      score: 0, passed: false, killed_as_chain: true,
      chain_reason: 'website has /locations or /franchise path',
      breakdown: {},
    }
  }

  // ── Scoring ──
  const breakdown: Record<string, number> = {}

  // Logo quality (0–25)
  if (prospect.logo_url) {
    const w = prospect.logo_width || 0
    if (w >= 500) breakdown.logo = 25
    else if (w >= 300) breakdown.logo = 20
    else if (w >= config.minLogoSize) breakdown.logo = 15
    else breakdown.logo = 5
  } else {
    breakdown.logo = 0
  }

  // Owner info (0–20)
  if (prospect.owner_first_name && prospect.owner_last_name) {
    breakdown.owner = 20
  } else if (prospect.owner_first_name) {
    breakdown.owner = 12
  } else {
    breakdown.owner = 0
  }

  // Contact info (0–20)
  if (prospect.email) {
    breakdown.contact = 20
  } else if (prospect.phone) {
    breakdown.contact = 10
  } else {
    breakdown.contact = 0
  }

  // Website presence (0–20)
  if (prospect.website) {
    breakdown.website = 20
  } else if (config.websiteMustExist) {
    breakdown.website = 0
  } else {
    breakdown.website = 5
  }

  // Social presence (0–15)
  if (prospect.instagram) {
    breakdown.social = 15
  } else {
    breakdown.social = 0
  }

  // Niche-specific role-evidence boosts (variable)
  if (options.qualifyBoosts && prospect.owner_role_evidence) {
    const evidence = prospect.owner_role_evidence.toLowerCase()
    let boost = 0
    const matched: string[] = []
    for (const b of options.qualifyBoosts) {
      if (evidence.includes(b.pattern.toLowerCase())) {
        boost += b.points
        matched.push(b.pattern)
      }
    }
    if (boost > 0) {
      breakdown.role_boost = boost
    }
  }

  const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0)
  const passed = score >= config.scoreThreshold

  return { score, passed, killed_as_chain: false, breakdown }
}
