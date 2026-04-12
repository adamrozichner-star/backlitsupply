import type { NicheConfig } from './types'

/**
 * Tattoo shops — Nashville, TN.
 *
 * Prospect signal: small, independent shops (2-8 artists) where the
 * owner-artist runs the brand. Almost zero chain presence in this vertical
 * — so chainBlocklist is minimal. Owner info is often on Instagram rather
 * than the shop website, so the role-evidence gate is softer: we accept
 * any "owner" / "artist" / "tattooer" signal.
 *
 * Threshold 50 (lower than med-spa/dental) because tattoo shops
 * intentionally have sparse websites — the work lives on Instagram. A
 * working website + discoverable owner is itself above-average signal.
 */
const config: NicheConfig = {
  slug: 'tattoo-shops',
  displayName: 'Tattoo Shops',
  sources: ['google-places'],
  placesQueries: ['tattoo shop', 'tattoo studio', 'tattoo parlor'],
  geos: [{ city: 'Nashville', state: 'TN', country: 'US' }],
  qualify: {
    minLogoSize: 120,   // tattoo shops often have smaller, hand-drawn logos
    requireOwnerName: true,
    websiteMustExist: true,
    scoreThreshold: 50,
  },
  qualifyBoosts: [
    { pattern: 'owner', points: 15 },
    { pattern: 'artist', points: 12 },
    { pattern: 'tattooer', points: 15 },
    { pattern: 'founder', points: 12 },
    { pattern: 'resident', points: 8 },
  ],
  chainBlocklist: [],   // Tattoo is virtually all indie
  templates: ['wall-03', 'wall-04', 'wall-05'],
  mockupPrompt: 'A photorealistic close-up of a tattoo studio entrance sign at night. The sign features the provided logo rendered as matte black or brushed-steel letters with moody warm backlighting against a raw concrete or dark industrial brick wall. Gritty, artist-driven aesthetic, studio-craft feel, low-key lighting, shallow depth of field. No other text or signage in frame.',
  copyAngle: 'craft-aesthetic',
  priceRange: [500, 1100],
  killSwitch: {
    minReplyRate: 0.02,
    maxSpamRate: 0.003,
  },
}

export default config
