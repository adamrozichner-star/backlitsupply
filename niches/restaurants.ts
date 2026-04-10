import type { NicheConfig } from './types'

const config: NicheConfig = {
  slug: 'restaurants',
  displayName: 'Restaurants',
  sources: ['comptroller-tx'],
  geos: [{ city: 'Austin', state: 'TX', county: 'Travis' }],
  qualify: {
    minLogoSize: 150,
    requireOwnerName: false,
    websiteMustExist: true,
    scoreThreshold: 30,
  },
  templates: ['sign-03', 'sign-06'],
  copyAngle: 'warm-inviting',
  priceRange: [385, 1200],
  killSwitch: {
    minReplyRate: 0.02,
    maxSpamRate: 0.003,
  },
}

export default config
