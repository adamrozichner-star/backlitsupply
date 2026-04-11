import type { NicheConfig } from './types'

const config: NicheConfig = {
  slug: 'restaurants',
  displayName: 'Restaurants',
  sources: ['google-places'],
  geos: [{ city: 'Miami', state: 'FL', country: 'US' }],
  qualify: {
    minLogoSize: 150,
    requireOwnerName: false,
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
