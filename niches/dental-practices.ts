import type { NicheConfig } from './types'

/**
 * Dental practices — Austin, TX.
 *
 * Prospect signal: solo/2-doctor practices where the DDS/DMD is the owner
 * and decision-maker. Chain DSOs (Aspen, Heartland, etc.) have corporate
 * procurement and are hard "no" for a $600-$1400 sign purchase.
 *
 * Threshold 60 (higher than med-spa's 40) because dental sites are typically
 * thin single-location pages; we want strong signal (website + owner name +
 * email or phone) before spending mockup $.
 */
const config: NicheConfig = {
  slug: 'dental-practices',
  displayName: 'Dental Practices',
  sources: ['google-places'],
  placesQueries: ['dental practice', 'dentist office'],
  geos: [
    { city: 'Austin', state: 'TX', country: 'US' },
    { city: 'Houston', state: 'TX', country: 'US' },
    { city: 'Denver', state: 'CO', country: 'US' },
  ],
  qualify: {
    minLogoSize: 150,
    requireOwnerName: false,
    websiteMustExist: true,
    scoreThreshold: 60,
  },
  qualifyBoosts: [
    { pattern: 'dds', points: 10 },
    { pattern: 'dmd', points: 10 },
    { pattern: 'dentist', points: 8 },
    { pattern: 'prosthodontist', points: 10 },
    { pattern: 'orthodontist', points: 10 },
  ],
  chainBlocklist: [
    'Aspen Dental', 'Smile Direct', 'SmileDirectClub', 'Heartland Dental',
    'Pacific Dental', 'Dental Works', 'Bright Now', 'Western Dental',
    'Sage Dental', 'Great Expressions', 'Monarch Dental', 'Castle Dental',
    'Jefferson Dental', 'Comfort Dental', 'Gentle Dental', 'MyDentist',
    'Walden Dental',
  ],
  templates: ['wall-01', 'wall-02', 'wall-05'],
  mockupPrompt: 'A photorealistic close-up of a modern dental clinic reception sign at night. The sign features the provided logo rendered as polished brushed-steel letters with soft warm halo backlighting against a clean white or light-grey clinical wall. Reception area lighting, professional medical aesthetic, calm and trustworthy atmosphere, shallow depth of field. No other text or signage in frame.',
  mockupPromptRetry: 'Preserve the exact logo from the reference image without modification. Focus on clean centered composition, even backlight glow, dark matte background, and professional signage photography. The logo should appear as a physical illuminated sign mounted on a wall, not a digital rendering. No other text or signage in the frame.',
  copyAngle: 'clinical-premium',
  priceRange: [600, 1400],
  killSwitch: {
    minReplyRate: 0.02,
    maxSpamRate: 0.003,
  },
}

export default config
