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

export interface NicheConfig {
  slug: string
  displayName: string
  sources: string[]         // source plugin slugs, e.g. ['comptroller-tx', 'travis-dba']
  geos: GeoConfig[]
  qualify: QualifyConfig
  templates: string[]       // template IDs for SharpCompositor fallback, e.g. ['wall-01']
  mockupPrompt: string      // AI image generation prompt for ReplicateGenerator
  copyAngle: string         // prompt variant for outreach copy, e.g. 'luxury-aesthetic'
  priceRange: [number, number]  // [min, max] USD
  killSwitch: KillSwitchConfig
}
