export interface GeoConfig {
  city: string
  state: string
  county?: string
  country?: string      // ISO code, defaults to 'US'
}

export interface QualifyConfig {
  minLogoSize: number       // minimum logo width in px
  requireOwnerName: boolean
  websiteMustExist: boolean
  scoreThreshold: number    // 0–100, below this = no mockup
}

export interface KillSwitchConfig {
  minReplyRate: number      // pause niche if reply rate drops below (e.g. 0.02 = 2%)
  maxSpamRate: number       // pause niche if spam complaints exceed (e.g. 0.003 = 0.3%)
}

/**
 * Role-evidence keyword boost: if the owner's role_evidence snippet matches
 * a pattern (case-insensitive substring), add points to the qualify score.
 * Lets niches upweight prospects with domain-specific signal (DDS for dental,
 * "artist" for tattoo, "roaster" for coffee).
 */
export interface QualifyBoost {
  pattern: string      // case-insensitive substring to match in owner_role_evidence
  points: number       // added to score if matched (typically 10–15)
}

export interface NicheConfig {
  slug: string
  displayName: string
  sources: string[]           // source plugin slugs
  placesQueries?: string[]    // Places search queries (if absent, displayName used)
  geos: GeoConfig[]
  qualify: QualifyConfig
  qualifyBoosts?: QualifyBoost[]  // niche-specific role-evidence boosts
  chainBlocklist?: string[]   // niche-specific chain names (merged with global list)
  templates: string[]         // template IDs for SharpCompositor fallback
  mockupPrompt: string        // AI image generation prompt for ReplicateGenerator
  mockupPromptRetry?: string  // composition-focused retry prompt for wrong_composition rejections
  mockupGate?: boolean        // default true — gate mockup gen on owner+email present
  copyAngle: string           // prompt variant for outreach copy
  priceRange: [number, number]  // [min, max] USD
  killSwitch: KillSwitchConfig
}
