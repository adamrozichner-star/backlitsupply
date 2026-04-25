import type { MetadataRoute } from 'next'
import { getSupabaseServer } from '@/lib/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://backlitsupply.com'

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/work`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/process`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/pricing`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/factory`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/contact`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/guides/med-spa-signage`, changeFrequency: 'monthly', priority: 0.7 },
  ]

  let prospectPages: MetadataRoute.Sitemap = []
  const sb = getSupabaseServer()
  if (sb) {
    const { data } = await sb
      .from('prospects')
      .select('slug, created_at')
      .not('pipeline_state', 'in', '("lost","dead")')
      .not('mockup_url', 'is', null)

    if (data) {
      prospectPages = data
        .filter(p => p.slug)
        .map(p => ({
          url: `${base}/for/${p.slug}`,
          lastModified: new Date(p.created_at),
          changeFrequency: 'monthly' as const,
          priority: 0.5,
        }))
    }
  }

  return [...staticPages, ...prospectPages]
}
