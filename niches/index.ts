import type { NicheConfig } from './types'
import medSpa from './med-spa'
import restaurants from './restaurants'
import dentalPractices from './dental-practices'
import boutiqueFitness from './boutique-fitness'
import tattooShops from './tattoo-shops'
import coffeeShops from './coffee-shops'

export const NICHES: Record<string, NicheConfig> = {
  'med-spa': medSpa,
  'restaurants': restaurants,
  'dental-practices': dentalPractices,
  'boutique-fitness': boutiqueFitness,
  'tattoo-shops': tattooShops,
  'coffee-shops': coffeeShops,
}

export function getNiche(slug: string): NicheConfig {
  const niche = NICHES[slug]
  if (!niche) throw new Error(`Unknown niche: "${slug}". Available: ${Object.keys(NICHES).join(', ')}`)
  return niche
}

export function getAllNiches(): NicheConfig[] {
  return Object.values(NICHES)
}
