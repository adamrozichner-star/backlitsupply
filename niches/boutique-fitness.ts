import type { NicheConfig } from './types'

/**
 * Boutique fitness — Miami, FL.
 *
 * Prospect signal: owner-operated studios (yoga, pilates, barre, indie
 * strength/HIIT) where members photograph the space. The sign IS the brand
 * — it shows up in every Instagram post, every tag. Founders are typically
 * ex-instructors who care about aesthetic. Chains (F45, OTF, Barry's) are
 * franchise networks with standardized signage controlled by corporate.
 *
 * Threshold 60 because Miami has a lot of coworking-gym hybrids with thin
 * sites — we want real studio operators with clear owner signal.
 */
const config: NicheConfig = {
  slug: 'boutique-fitness',
  displayName: 'Boutique Fitness Studios',
  sources: ['google-places'],
  placesQueries: [
    'boutique fitness studio',
    'yoga studio',
    'pilates studio',
    'barre studio',
  ],
  geos: [
    { city: 'Miami', state: 'FL', country: 'US' },
    { city: 'Austin', state: 'TX', country: 'US' },
    { city: 'Brooklyn', state: 'NY', country: 'US' },
  ],
  qualify: {
    minLogoSize: 150,
    requireOwnerName: false,
    websiteMustExist: true,
    scoreThreshold: 60,
  },
  qualifyBoosts: [
    { pattern: 'founder', points: 10 },
    { pattern: 'instructor', points: 10 },
    { pattern: 'studio owner', points: 12 },
    { pattern: 'coach', points: 6 },
    { pattern: 'trainer', points: 6 },
  ],
  chainBlocklist: [
    'F45', 'Orangetheory', "Barry's", 'SoulCycle', 'CorePower', 'Pure Barre',
    'Club Pilates', 'YogaSix', 'Solidcore', 'Rumble', 'Equinox',
    '24 Hour Fitness', 'Planet Fitness', 'LA Fitness', 'Crunch Fitness',
    'Anytime Fitness', 'Gold\'s Gym', 'Lifetime Fitness', 'Y7', 'CorePower Yoga',
    'Title Boxing Club', 'UFC Gym', 'Xtend Barre', 'The Bar Method',
  ],
  templates: ['wall-02', 'wall-04', 'wall-05'],
  mockupPrompt: 'A photorealistic close-up of a boutique fitness studio entrance sign at night. The sign features the provided logo rendered as matte black or painted-metal letters with vibrant warm backlighting against a textured plaster or exposed brick wall. Energetic atmosphere, members-photographed brand wall, studio lighting, shallow depth of field. No other text or signage in frame.',
  mockupPromptRetry: 'Preserve the exact logo from the reference image without modification. Focus on clean centered composition, even backlight glow, dark matte background, and professional signage photography. The logo should appear as a physical illuminated sign mounted on a wall, not a digital rendering. No other text or signage in the frame.',
  copyAngle: 'community-energy',
  priceRange: [600, 1200],
  killSwitch: {
    minReplyRate: 0.02,
    maxSpamRate: 0.003,
  },
}

export default config
