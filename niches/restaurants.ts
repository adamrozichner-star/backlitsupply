import type { NicheConfig } from './types'

const config: NicheConfig = {
  slug: 'restaurants',
  displayName: 'Restaurants',
  sources: ['google-places'],
  geos: [{ city: 'Miami', state: 'FL', country: 'US' }],
  // Status: unsupported — pending better enrichment source.
  // Miami test (2026-04-11): 0 real owner names, 0 emails from website scraping.
  // Restaurants don't list owner info on their sites. Revisit after med spas proves out.
  qualify: {
    minLogoSize: 150,
    requireOwnerName: true,
    websiteMustExist: true,
    scoreThreshold: 30,
  },
  templates: ['wall-03', 'wall-04'],
  mockupPrompt: 'A photorealistic close-up of a restaurant storefront sign. The sign features the provided logo in warm metallic letters with amber LED halo backlighting mounted on a dark wood or brick wall. Inviting warm glow. Evening atmosphere. Shallow depth of field. No other text or signage in the frame.',
  copyAngle: 'warm-inviting',
  priceRange: [385, 1200],
  killSwitch: {
    minReplyRate: 0.02,
    maxSpamRate: 0.003,
  },
}

export default config
