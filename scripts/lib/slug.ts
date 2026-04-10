/**
 * Generate a prospect slug from business name and city.
 * Format: kebab-case(business-name)-{city-abbreviation}
 * e.g., "Glow MedSpa" + "Austin" → "glow-medspa-austin"
 */
export function makeSlug(businessName: string, city?: string): string {
  let slug = businessName
    .toLowerCase()
    .replace(/[&]/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  if (city) {
    const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    slug = `${slug}-${citySlug}`
  }

  return slug
}
