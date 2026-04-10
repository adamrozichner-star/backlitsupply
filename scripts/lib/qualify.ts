/**
 * Stage 4 — Qualification scoring
 *
 * Score 0–100 based on enriched prospect data.
 * Niche config sets threshold — below threshold → state stays 'discovered', no mockup spent.
 * Mockups have real cost; gate them.
 */

import type { EnrichedProspect } from './types'
import type { QualifyConfig } from '../../niches/types'

export interface QualifyResult {
  score: number
  passed: boolean
  breakdown: Record<string, number>
}

export function qualifyProspect(
  prospect: EnrichedProspect,
  config: QualifyConfig,
): QualifyResult {
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
    breakdown.website = 5  // no website but not required
  }

  // Social presence (0–15)
  if (prospect.instagram) {
    breakdown.social = 15
  } else {
    breakdown.social = 0
  }

  const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0)
  const passed = score >= config.scoreThreshold

  return { score, passed, breakdown }
}
