import type { RawListing } from '../types'
import type { GeoConfig } from '../../../niches/types'

export interface BusinessSource {
  slug: string
  fetchNew(geo: GeoConfig, nameRegex?: RegExp): Promise<RawListing[]>
}

// Plugin registry — import and register each source here
const registry = new Map<string, BusinessSource>()

export function registerSource(source: BusinessSource) {
  registry.set(source.slug, source)
}

export function getSource(slug: string): BusinessSource {
  const source = registry.get(slug)
  if (!source) {
    throw new Error(`Unknown source: "${slug}". Registered: ${[...registry.keys()].join(', ')}`)
  }
  return source
}

export function getAllSources(): BusinessSource[] {
  return [...registry.values()]
}
