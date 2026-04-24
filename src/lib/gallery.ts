// Full gallery — /work page uses all, homepage uses first 6
export const WORK_GALLERY = [
  { src: '/mockups/brickell-yoga-miami.webp', category: 'Yoga Studio, Miami', alt: 'Backlit infinity logo and wordmark on exposed brick wall' },
  { src: '/mockups/rejuvenate-austin-austin.webp', category: 'Wellness Spa, Austin', alt: 'Halo-lit ornamental logo and wordmark on dark concrete wall' },
  { src: '/work/sign-01.avif', category: 'Wellness & Medical', alt: 'Halo-lit logo and wordmark on grey wellness studio wall' },
  { src: '/mockups/agni-miami-miami.webp', category: 'Fitness Studio, Miami', alt: 'Warm halo-lit logo and letters on exposed brick wall' },
  { src: '/work/sign-02.avif', category: 'Restaurants & Bars', alt: 'Warm halo-lit metal letters on outdoor restaurant wall at dusk' },
  { src: '/mockups/silver-garden-pole-and-yoga-studio-miami.webp', category: 'Yoga Studio, Miami', alt: 'Backlit sculptural logo on exposed brick wall' },
  { src: '/work/sign-08.avif', category: 'Hotels & Lobbies', alt: 'Gold halo-lit signature lettering on veined marble lobby wall' },
  { src: '/mockups/aesthetica-med-spa-austin.webp', category: 'Med Spa, Austin', alt: 'Halo-lit monogram logo on dark concrete storefront' },
  { src: '/work/sign-04.avif', category: 'Studios & Concept Spaces', alt: 'Black halo-lit metal letters on raw concrete studio wall' },
  { src: '/mockups/maison-yoga-miami-miami.webp', category: 'Yoga Studio, Miami', alt: 'Warm backlit wordmark with flower on brick wall' },
  { src: '/work/sign-03.avif', category: "Restaurants & Caf\u00e9s", alt: 'Warm halo-lit metal letters on veranda restaurant exterior at night' },
] as const

export const HOMEPAGE_GALLERY = WORK_GALLERY.slice(0, 6)

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

export const HOMEPAGE_REVIEWS = REAL_REVIEWS.filter(r =>
  ['Lauren', 'Natalie', 'Haley', 'Yarden'].includes(r.name)
)
