import type { NicheConfig } from './types'
import medSpa from './med-spa'
import restaurants from './restaurants'

export const NICHES: Record<string, NicheConfig> = {
  'med-spa': medSpa,
  'restaurants': restaurants,
}

export function getNiche(slug: string): NicheConfig {
  const niche = NICHES[slug]
  if (!niche) throw new Error(`Unknown niche: "${slug}". Available: ${Object.keys(NICHES).join(', ')}`)
  return niche
}

export function getAllNiches(): NicheConfig[] {
  return Object.values(NICHES)
}
