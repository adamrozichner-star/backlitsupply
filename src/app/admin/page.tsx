import {
  getFunnelCounts, getProspects, getMetricsTotals,
  getCostBreakdown, getRecentEvents, getNiches, getBrokenMockups,
} from '@/lib/admin/queries'
import { MetricCard } from '@/components/admin/MetricCard'
import { FunnelChart } from '@/components/admin/FunnelChart'
import { ProspectTable } from '@/components/admin/ProspectTable'
import { CostChart } from '@/components/admin/CostChart'
import { ActivityFeed } from '@/components/admin/ActivityFeed'
import { HealthBanner } from '@/components/admin/HealthBanner'

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ niche?: string }>
}) {
  const sp = await searchParams
  const nicheFilter = sp.niche

  const [metrics, funnel, prospects, costs, events, niches, broken] = await Promise.all([
    getMetricsTotals(),
    getFunnelCounts(),
    getProspects(nicheFilter ? { niche: nicheFilter } : {}),
    getCostBreakdown(8),
    getRecentEvents(20),
    getNiches(),
    getBrokenMockups(),
  ])

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`

  return (
    <div className="space-y-6">
      {/* Health banner (only renders if broken mockups exist) */}
      <HealthBanner broken={broken} />

      {/* Metrics row */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <MetricCard
          label="Total Prospects"
          value={metrics.total_prospects.toString()}
        />
        <MetricCard
          label="Total Spent"
          value={`$${metrics.total_cost_usd.toFixed(2)}`}
          sublabel={metrics.total_prospects > 0 ? `$${metrics.avg_cost_per_qualified_usd.toFixed(3)}/qualified` : undefined}
        />
        <MetricCard
          label="Reply Rate"
          value={pct(metrics.reply_rate)}
          sublabel={`positive: ${pct(metrics.positive_reply_rate)}`}
        />
        <MetricCard
          label="Conversion"
          value={pct(metrics.conversion_rate)}
          sublabel="sent → won"
        />
      </section>

      {/* Funnel + Cost */}
      <section className="grid gap-4 lg:grid-cols-2">
        <FunnelChart funnel={funnel} />
        <CostChart weeks={costs} firstCostDate={metrics.first_cost_event_date} />
      </section>

      {/* Prospect table */}
      <section>
        <ProspectTable prospects={prospects} niches={niches} initialNiche={nicheFilter} />
      </section>

      {/* Recent activity */}
      <section>
        <ActivityFeed events={events} />
      </section>
    </div>
  )
}
