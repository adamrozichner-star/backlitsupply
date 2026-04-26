import type { NicheConfig } from './types'

const config: NicheConfig = {
  slug: 'med-spa',
  displayName: 'Med Spas',
  sources: ['google-places', 'comptroller-tx'],
  geos: [{ city: 'Austin', state: 'TX', county: 'Travis', country: 'US' }],
  qualify: {
    minLogoSize: 150,
    requireOwnerName: false,
    websiteMustExist: true,
    scoreThreshold: 40,
  },
  templates: ['wall-01', 'wall-02', 'wall-05'],
  mockupPrompt: 'A photorealistic close-up of a luxury medical spa storefront sign at night. The sign features the provided logo rendered as polished metal letters with warm amber LED halo backlighting against a textured concrete wall. Soft indirect lighting, premium aesthetic, shallow depth of field. No other text or signage in the frame.',
  mockupPromptRetry: 'Preserve the exact logo from the reference image without modification. Focus on clean centered composition, even backlight glow, dark matte background, and professional signage photography. The logo should appear as a physical illuminated sign mounted on a wall, not a digital rendering. No other text or signage in the frame.',
  copyAngle: 'luxury-aesthetic',
  priceRange: [600, 1400],
  killSwitch: {
    minReplyRate: 0.02,
    maxSpamRate: 0.003,
  },
}

export default config
