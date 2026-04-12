import type { NicheConfig } from './types'

/**
 * Coffee shops — Portland, OR.
 *
 * Prospect signal: independent third-wave roasters and specialty shops.
 * Coffee shop owners are notoriously hard to enrich — the roaster's name
 * is often on packaging but not the site. Big chains dominate the category,
 * so chainBlocklist is long and aggressive.
 *
 * Threshold 65 — highest of any niche — because we need very strong signal
 * to justify mockup spend in a space where 80% of returns will be chain
 * locations or thin single-page sites with no discoverable owner.
 */
const config: NicheConfig = {
  slug: 'coffee-shops',
  displayName: 'Coffee Shops',
  sources: ['google-places'],
  placesQueries: [
    'independent coffee shop',
    'specialty coffee roaster',
    'third wave coffee',
  ],
  geos: [{ city: 'Portland', state: 'OR', country: 'US' }],
  qualify: {
    minLogoSize: 150,
    requireOwnerName: true,
    websiteMustExist: true,
    scoreThreshold: 65,
  },
  qualifyBoosts: [
    { pattern: 'roaster', points: 15 },
    { pattern: 'founder', points: 15 },
    { pattern: 'owner', points: 12 },
    { pattern: 'head barista', points: 8 },
    { pattern: 'co-founder', points: 15 },
  ],
  chainBlocklist: [
    'Starbucks', 'Dunkin', "Dunkin'", "Peet's", 'Peets', 'Philz', 'Philz Coffee',
    'Blue Bottle', 'Stumptown', 'Caribou', 'Tim Hortons', "Tim Horton's",
    'Coffee Bean', 'The Coffee Bean', 'Tully', "Tully's", 'Costa Coffee',
    'Pret A Manger', 'Pret', 'Joe & The Juice', 'Gregorys Coffee', 'La Colombe',
    'Einstein Bagels', 'Panera', 'Au Bon Pain', 'Bruegger\'s',
  ],
  templates: ['wall-03', 'wall-04', 'wall-05'],
  mockupPrompt: 'A photorealistic close-up of an independent coffee shop entrance sign at morning light. The sign features the provided logo rendered as warm-toned metal or painted wood letters with gentle halo backlighting against a warm wood-panel or weathered concrete wall. Craft coffee aesthetic, neighborhood ritual feel, natural warm lighting, shallow depth of field. No other text or signage in frame.',
  copyAngle: 'warm-independent',
  priceRange: [500, 1000],
  killSwitch: {
    minReplyRate: 0.02,
    maxSpamRate: 0.003,
  },
}

export default config
