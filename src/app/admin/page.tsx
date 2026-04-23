import {
  getFunnelCounts, getProspects, getMetricsTotals,
  getCostBreakdown, getRecentEvents, getNiches, getBrokenMockups, getPollerStatus,
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

  const [metrics, funnel, prospects, costs, events, niches, broken, poller] = await Promise.all([
    getMetricsTotals(),
    getFunnelCounts(),
    getProspects(nicheFilter ? { niche: nicheFilter } : {}),
    getCostBreakdown(8),
    getRecentEvents(20),
    getNiches(),
    getBrokenMockups(),
    getPollerStatus(),
  ])

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`

  return (
    <div className="space-y-6">
      {/* Health banner (only renders if broken mockups exist) */}
      <HealthBanner broken={broken} />

      {/* Poller status */}
      {poller.is_stale && poller.last_run_at && (
        <div className="border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-300">
          ⚠ Instantly poller is stale — last run {new Date(poller.last_run_at).toLocaleString()}. Check cron or run <code className="text-yellow-200">npm run poll-instantly</code> manually.
        </div>
      )}
      {!poller.last_run_at && (
        <div className="border border-white/[0.06] bg-white/5 px-4 py-3 text-xs text-white/40">
          Instantly poller has not run yet. First poll will trigger after campaign sends begin.
        </div>
      )}

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
