export const PRICING_TIERS = [
  {
    id: 'compact',
    name: 'Compact',
    price: 385,
    priceDisplay: 'From $385',
    tagline: 'For small storefronts and indoor spaces',
    dimensions: 'Up to 18" wide',
    bestFor: 'Boutiques, cafes, small offices',
    features: [
      'Premium acrylic face',
      'Brushed steel returns',
      'Warm-white LED',
      'Indoor rated',
      'Free international shipping',
      '2-year electronics warranty',
    ],
    stripeUrl: 'https://buy.stripe.com/PLACEHOLDER_compact',
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 600,
    priceDisplay: 'From $600',
    tagline: 'Our most popular tier',
    dimensions: 'Up to 28" wide',
    bestFor: 'Restaurants, salons, medspas, gyms',
    features: [
      'Premium acrylic face',
      'Brushed steel returns',
      'Warm-white LED',
      'Indoor or outdoor rated',
      'Free international shipping',
      '2-year electronics warranty',
      'Priority production',
    ],
    stripeUrl: 'https://buy.stripe.com/PLACEHOLDER_standard',
    popular: true,
  },
  {
    id: 'statement',
    name: 'Statement',
    price: 1200,
    priceDisplay: 'From $1,200',
    tagline: 'Statement pieces for premium spaces',
    dimensions: '36" and larger, custom shapes',
    bestFor: 'Hotels, lobbies, flagship locations',
    features: [
      'Premium acrylic or stainless steel face',
      'Custom finishes available',
      'RGB LED options',
      'Indoor or outdoor rated',
      'Free international shipping',
      '2-year electronics warranty',
      'Priority production',
      'Dedicated project manager',
    ],
    stripeUrl: 'https://buy.stripe.com/PLACEHOLDER_statement',
  },
] satisfies Array<{
  id: string
  name: string
  price: number
  priceDisplay: string
  tagline: string
  dimensions: string
  bestFor: string
  features: string[]
  stripeUrl: string
  popular?: boolean
}>
