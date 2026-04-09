export const HOMEPAGE_GALLERY = [
  { src: '/work/sign-06.webp', category: 'Hospitality', alt: 'Halo-lit storefront sign mounted on architectural facade at night' },
  { src: '/work/sign-07.avif', category: 'Luxury Retail', alt: 'Gold halo-lit metal letters on white marble wall' },
  { src: '/work/sign-01.avif', category: 'Wellness & Medical', alt: 'Halo-lit logo and wordmark on grey wellness studio wall' },
  { src: '/work/sign-02.avif', category: 'Restaurants & Bars', alt: 'Warm halo-lit metal letters on outdoor restaurant wall at dusk' },
  { src: '/work/sign-08.avif', category: 'Hotels & Lobbies', alt: 'Gold halo-lit signature lettering on veined marble lobby wall' },
  { src: '/work/sign-04.avif', category: 'Studios & Concept Spaces', alt: 'Black halo-lit metal letters on raw concrete studio wall' },
] as const

export const REAL_REVIEWS = [
  {
    name: 'Lauren',
    quote: 'Always our go to for signs!',
    rating: 5,
  },
  {
    name: 'Natalie',
    quote: "Sofia's communication was excellent from start to finish, and she was incredibly patient and helpful throughout the design process. She provided plenty of options and was happy to do re-edits on the proofs until everything was just right.",
    rating: 5,
  },
  {
    name: 'Haley',
    quote: 'Sophia was so helpful and answered all my questions about getting a custom sign. Her team delivered and the sign looks amazing with our business name and logo. I love the raised lettering and the different LED light options.',
    rating: 5,
  },
  {
    name: 'Yarden',
    quote: 'Great quality work! Item arrived as described and fast. Highly recommended.',
    rating: 5,
  },
  {
    name: 'Ally',
    quote: 'Great product and great customer service! Highly recommend!',
    rating: 5,
  },
  {
    name: 'Viral',
    quote: 'The sign came as described. Great Customer Service.',
    rating: 5,
  },
] as const

// Display these 4 on homepage (longer quotes from Natalie + Haley add credibility)
export const HOMEPAGE_REVIEWS = REAL_REVIEWS.filter(r =>
  ['Lauren', 'Natalie', 'Haley', 'Yarden'].includes(r.name)
)
