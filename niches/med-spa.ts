import type { NicheConfig } from './types'

const config: NicheConfig = {
  slug: 'med-spa',
  displayName: 'Med Spas',
  sources: ['comptroller-tx', 'travis-dba'],
  geos: [{ city: 'Austin', state: 'TX', county: 'Travis' }],
  qualify: {
    minLogoSize: 150,
    requireOwnerName: true,
    websiteMustExist: true,
    scoreThreshold: 40,
  },
  templates: ['sign-01', 'sign-03', 'sign-06'],
  copyAngle: 'luxury-aesthetic',
  priceRange: [600, 1400],
  killSwitch: {
    minReplyRate: 0.02,
    maxSpamRate: 0.003,
  },
}

export default config
