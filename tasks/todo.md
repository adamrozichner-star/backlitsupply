# Backlit Supply — Project Status

## Phase 1 + Path A: Foundation Pages + Lead Pipeline
✅ **COMPLETE** — 2026-04-10

Shipped: Homepage, /work, /process, /pricing, /contact, Resend email notifications, Supabase lead capture.
Live at: https://backlitsupply.com

---

## Known debt

- [ ] **Resend domain verification (backlitsupply.com)** — currently using sandbox sender (`onboarding@resend.dev`), emails landing in spam
- [ ] **Recrop gallery photos to remove visible brand names** — LEGAL, must do before outbound
- [ ] **Real Stripe Payment Links** — waiting on Adam's pricing decision
- [ ] **Migrate mockups to Cloudflare R2** — 3 webps committed to git as stopgap. Delete from git once R2 is live.
- [ ] **Real product photos** — eventually replacing AI-mockup-style supplier reference photos

---

## Session 3: Phase 2A — /for/[slug] personalization engine

### Build order
1. [ ] Migration SQL (`supabase/migrations/0002_prospects_personalization.sql`) — additive ALTER for prospects + new prospect_page_views table
2. [ ] TypeScript types (`src/lib/types/prospect.ts`) — Prospect + ProspectPageView
3. [ ] Data layer (`src/lib/data/prospects.ts`) — getProspectBySlug, recordPageView, seedProspect
4. [ ] Dynamic page (`src/app/for/[slug]/page.tsx`) — async Server Component, generateMetadata, view tracking
5. [ ] Page UI (`src/components/ProspectPageView.tsx`) — hero, mockup, specs, CTAs, reviews, FAQ, footer note
6. [ ] Shared data: extract FAQ to `src/lib/faq.ts` for reuse between /pricing and /for/[slug]
7. [ ] Admin seed script (`scripts/seed-prospect.ts`) + example JSON + npm script
8. [ ] Custom 404 (`src/app/not-found.tsx`)
9. [ ] Build verification + push

---

## Phase 2B+2C: Niche-Agnostic Lead Engine

Config-driven, fully-resumable pipeline. Med spas in Austin is the first config — switching niches is a config change, never a code change. Runs offline against fixtures until live API keys arrive.

### Stage 0 — Niche configs
- [ ] `niches/` directory with `NicheConfig` type
- [ ] `niches/med-spa.ts` — TX Comptroller + Travis DBA sources, Austin geo, luxury-aesthetic angle
- [ ] `niches/restaurants.ts` — stub config to prove the abstraction holds two niches

### Stage 1 — Shared types
- [ ] `scripts/lib/types.ts` — RawListing, EnrichedProspect, MockupResult, OutreachDraft, ProspectState enum, ProspectEvent

### Stage 2 — Discovery sources
- [ ] `scripts/lib/sources/index.ts` — `BusinessSource` interface + plugin registry
- [ ] `scripts/lib/sources/comptroller-tx.ts` — TX Comptroller taxable entity parser + `scripts/fixtures/comptroller-sample.html`
- [ ] `scripts/lib/sources/travis-dba.ts` — Travis County Clerk DBA parser + fixture
- [ ] `scripts/lib/sources/fixture.ts` — canned RawListings for offline testing

### Stage 3 — Enrichment
- [ ] `scripts/lib/enrich.ts` — cheerio HTML scraping: logo (og:image → twitter:image → apple-touch-icon → largest header img, ≥150px), owner + email via LlmClient tool-use

### Stage 4 — Qualification
- [ ] `scripts/lib/qualify.ts` — score 0–100 based on logo dims, HTML size, social presence, review count. Niche config sets threshold. Below threshold → no mockup spent.

### Stage 5 — Compositing (Sharp)
- [ ] `scripts/lib/composite.ts` — Sharp pipeline: auto-trim, dark-on-light detection + invert, resize preserving aspect, halo blur+amber tint, composite onto 1600x1000 webp templates
- [ ] 5 template configs (path, bbox, glow intensity); niche config picks subset
- [ ] Test: composite `scripts/fixtures/sample-logo.png` onto each template → `scripts/output/test-mockups/`

### Stage 6 — Storage
- [ ] `scripts/lib/storage.ts` — `MockupStorage` interface, `R2Storage` (stubbed, throws if no creds), `LocalStorage` (writes to `public/mockups/`, returns `/mockups/{slug}.webp`)

### Stage 7 — Outreach copy
- [ ] `scripts/lib/outreach.ts` — Claude Haiku via LlmClient. Subject <50 chars, body <75 words, references owner + business + /for/{slug} URL. `copyAngle` from niche config selects prompt variant.

### Stage 8 — Reply classifier
- [ ] `scripts/lib/reply-classifier.ts` — `ReplyClassifier` interface, classify → interested | objection | unsubscribe | ooo | other
- [ ] `src/app/api/reply/route.ts` — placeholder webhook (shape only, no Instantly wiring yet)

### Stage 9 — State machine
- [ ] Supabase migration: `prospect.state` ENUM (discovered → enriched → qualified → mockup_ready → sent → opened → replied → positive → booked → won → lost → dead)
- [ ] Every pipeline stage updates state. Re-running picks up where each row left off. Idempotent + resumable.

### Stage 10 — Metrics
- [ ] `scripts/lib/metrics.ts` — writes to `prospect_events` table (prospect_id, event, payload, ts)
- [ ] SQL view `metrics_by_niche_batch` aggregates sent/opened/replied/positive/booked/won per niche per batch

### Stage 11 — Pipeline orchestrator
- [ ] `scripts/run-pipeline.ts` — runs ONE niche end-to-end. Flags: --niche, --geo, --source, --dry-run, --limit. Idempotent on slug, resumable. Logs timing + cost. Writes `scripts/output/outreach-{niche}-{date}.csv`.

### Stage 12 — Meta-runner
- [ ] `scripts/run-loop.ts` — reads all enabled niches, runs pipeline per niche, checks killSwitches (auto-pause if reply rate < threshold or spam > threshold), writes batch report to `scripts/output/loop-{date}.md`

### Stage 13 — Integration test
- [ ] `scripts/test-pipeline.ts` — full pipeline with --source=fixture for BOTH med-spa and restaurants. Asserts: mockups generated, CSVs populated, zero network, kill+restart resumes without duplication.

### Stage 14 — Documentation
- [ ] `scripts/README.md` — "Add a new niche in 10 minutes" + "Add a new source in 30 minutes"

### Verification gates (ALL must pass before marking complete)
- [ ] `npm run test:pipeline` passes offline, zero network calls
- [ ] 5 fixture mockups in `scripts/output/test-mockups/` for eyeball review
- [ ] Local `/for/{fixture-slug}` pages render composited mockup correctly
- [ ] `npm run pipeline -- --niche=med-spa --source=fixture` succeeds
- [ ] `npm run pipeline -- --niche=restaurants --source=fixture` succeeds
- [ ] Resumability: kill mid-run, restart, no duplication
- [ ] This file documents which env vars unlock which stage

### Env var → stage mapping
| Env var | Stage unlocked |
|---------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY` | All (state persistence) |
| `ANTHROPIC_API_KEY` | Stage 3 enrichment (LLM extraction), Stage 7 outreach copy, Stage 8 reply classification |
| `R2_*` credentials | Stage 6 R2 storage (LocalStorage works without) |
| `RESEND_API_KEY` + `LEAD_NOTIFICATION_EMAIL` | Email notifications (existing) |

### Future (not this build)
- [ ] Instantly.ai integration for cold email delivery
- [ ] Google Workspace + SPF/DKIM/DMARC on backlitsupply.com
- [ ] AI reply agent (Phase 4)
- [ ] R2 live storage
- [ ] Kill switch auto-tune based on metrics

---

## Phase 5: Admin Dashboard

Read-only, password-protected `/admin` route. Live Supabase reads, no caching.
Mobile-first. Single user (Adam). Same dark/amber theme as marketing site.

### Step 1 — Auth + middleware
- [ ] Add `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` to `.env.example`
- [ ] Install `jose` for JWT signing (edge-compatible)
- [ ] `src/lib/admin/auth.ts` — signSession, verifySession, getSessionFromCookies
- [ ] `src/middleware.ts` — protect `/admin/*`, redirect to `/admin/login` if no session (exclude `/admin/login`)
- [ ] Update `public/robots.txt` — Disallow `/admin`

### Step 2 — Login page
- [ ] `src/app/admin/login/page.tsx` — centered single-password form
- [ ] Server action — timing-safe compare, set cookie on success, generic error on fail
- [ ] In-memory rate limit: 5 fails / 15 min / IP, Map-based, resets on restart

### Step 3 — Data layer
- [ ] `src/lib/admin/queries.ts` with typed functions:
  - [ ] `getFunnelCounts()`
  - [ ] `getProspects(filters)` with computed `days_in_state`
  - [ ] `getProspectDetail(id)` with joined events
  - [ ] `getMetricsTotals()` — total_prospects, total_cost, reply_rate, conversion_rate
  - [ ] `getCostBreakdown(weeks)` — derives from `cost:*` events
  - [ ] `getRecentEvents(limit=20)` — joined with business_name

### Step 4 — Admin layout
- [ ] `src/app/admin/layout.tsx` — sticky header, title, logout button, dark theme

### Step 5 — Dashboard home (`src/app/admin/page.tsx`)
- [ ] Metrics row (4 cards): Total Prospects | Total Spent | Reply Rate | Conversion Rate
- [ ] Funnel chart — horizontal bars per pipeline_state, counts + % of discovered
- [ ] Prospect table — sortable, filterable (search / state / niche), click row → detail
- [ ] Cost breakdown — stacked bar chart (Places / Haiku / Replicate) by week
- [ ] Recent activity feed — last 20 events, relative time, colored event pills

### Step 6 — Prospect detail (`src/app/admin/prospects/[id]/page.tsx`)
- [ ] Header: business name, owner, niche · geo, state badge, days in state
- [ ] Left col: mockup image, website, email, source page, qualify score + breakdown
- [ ] Right col: event timeline, collapsible JSON per event
- [ ] Bottom: "Preview personalized page" link to `/for/{slug}`

### Step 7 — API routes
- [ ] `POST /api/admin/login` — validate password, set cookie
- [ ] `POST /api/admin/logout` — clear cookie

### Step 8 — Cost emission audit
- [ ] Grep pipeline for API calls missing cost events
- [ ] Add `writeProspectEvent({ event: 'cost:places'|'cost:haiku'|'cost:replicate', payload: { usd, model } })` after each call
- [ ] Document on dashboard: "Cost data starts from {first_event_date}"

### Step 9 — Mobile testing
- [ ] Test at 375px width (iPhone 14)
- [ ] Tables scroll horizontally with sticky first column
- [ ] Charts readable at small width
- [ ] Interactive targets ≥ 44px

### Step 10 — Verification
- [ ] `npm run build` passes
- [ ] `/admin` without session → redirects to `/admin/login`
- [ ] Wrong password → generic error
- [ ] Correct password → cookie set, dashboard loads with live data
- [ ] `/admin/prospects/{id}` renders detail view
- [ ] Logout clears cookie
- [ ] All pages render at 375px width

---

## Phase 6: Dashboard Actions + Tracking

Make the admin dashboard actionable. Two small additions:
1. Manual state transitions (Adam tracks outreach by hand this week)
2. Tracking pixel on /for/{slug} — auto-records visits, auto-transitions sent→opened

### Part 1 — Manual state actions
- [ ] `src/lib/admin/actions.ts` — server actions:
  - `updateProspectState(id, newState, reason?)` — session-checked, validates state enum, writes `state_change` event with `{from, to, reason, actor: 'admin_manual'}`, revalidatePath
  - `addProspectNote(id, note)` — writes `note` event
- [ ] `src/components/admin/StateActions.tsx` — client component with state-aware action buttons:
  - `mockup_ready → [Mark as Sent] [Mark as Lost]`
  - `sent → [Mark as Opened] [Mark as Replied] [Mark as Lost]`
  - `opened → [Mark as Replied] [Mark as Lost]`
  - `replied → [Mark as Positive] [Mark as Lost]`
  - `positive → [Mark as Booked] [Mark as Lost]`
  - `booked → [Mark as Won] [Mark as Lost]`
  - `won → (terminal)`
  - `lost/dead → [Reactivate to Discovered]`
  - Toasts via `sonner`
- [ ] `src/components/admin/NoteForm.tsx` — textarea + submit, calls `addProspectNote`
- [ ] Update `src/app/admin/prospects/[id]/page.tsx` — StateActions above timeline, NoteForm below

### Part 2 — Tracking pixel
- [ ] `src/app/api/track/visit/route.ts` — GET endpoint:
  - reads `?slug=xxx`, checks `visited` cookie for 1h dedupe
  - looks up prospect, writes `page_visited` event with `{user_agent, referer, ip_truncated, actor: 'tracking_pixel'}`
  - if current state is `sent`, auto-transitions to `opened` + writes state_change event
  - appends slug to `visited` cookie (1h TTL)
  - always returns 1x1 transparent gif with `cache-control: no-store`
- [ ] Update `src/app/for/[slug]/page.tsx` — add server-rendered `<img src="/api/track/visit?slug=..." width="1" height="1" style={{position:'absolute',left:'-9999px'}} />`
- [ ] IP truncation: first 3 octets IPv4 / first 4 segments IPv6
- [ ] Update `public/robots.txt` — Disallow `/api/track`

### Part 3 — Verification
- [ ] Local: sign in, mark mockup_ready → sent → opened; add note; incognito visit /for/{slug} → event appears, auto-transitions sent→opened; second visit within 1h → no duplicate; different browser → new event
- [ ] Production: same flow on backlitsupply.com

---

## Phase 7A: Multi-Niche Expansion

Add 4 new niches, gate mockups behind sendability, build per-niche
dashboard, ship batch runner. No Instantly yet (Phase 7C).

### Part 1 — 4 new niche configs (genuinely differentiated)
- [ ] `niches/dental-practices.ts` — Austin TX, DDS/DMD role boost, chainBlocklist (Aspen, Heartland, Pacific Dental, etc.), clinical-premium angle
- [ ] `niches/boutique-fitness.ts` — Miami FL, founder/instructor role boost, chainBlocklist (F45, OTF, Barry's, SoulCycle, etc.), community-energy angle
- [ ] `niches/tattoo-shops.ts` — Nashville TN, threshold 50 (owner info often IG-only), owner/artist role boost, no chainBlocklist, craft-aesthetic angle
- [ ] `niches/coffee-shops.ts` — Portland OR, threshold 65 (hardest to enrich), roaster/founder boost, chainBlocklist (Starbucks, Dunkin, Blue Bottle, etc.), warm-independent angle

### Part 2 — Mockup gate (cost saver)
- [ ] `NicheConfig.mockupGate: boolean` (default true)
- [ ] Pipeline gate: qualified → mockup_ready only if owner_first_name AND email both present
- [ ] Otherwise stays at qualified, logs `gate:mockup_skipped` event with reason
- [ ] Batch summary logs skipped counts

### Part 3 — Per-niche dashboard
- [ ] `src/app/admin/niches/page.tsx` — comparative table with all niches side by side
- [ ] Above table: 5 mini-funnels with shared y-axis scale
- [ ] Per-niche "View prospects" link → `/admin?niche={slug}`
- [ ] Verify/fix existing prospect table niche filtering
- [ ] Admin header nav link to `/admin/niches`
- [ ] `getMetricsByNiche()` query — single GROUP BY, no N+1

### Part 4 — Batch runner
- [ ] `scripts/run-batch.ts` — args: --niches, --limit-per-niche, --dry-run
- [ ] Invokes run-pipeline.ts per niche as subprocess, 60s gap between niches
- [ ] Captures logs to `scripts/output/batch-{date}/{niche}.log`
- [ ] Writes `scripts/output/batch-{date}/summary.md` with cost + time totals
- [ ] `npm run batch` script added

### Part 5 — Docs
- [ ] Update `scripts/README.md` with 5-niche batch instructions
- [ ] Add Phase 7B (Adam manual signups) + 7C (Instantly in 2 weeks) stubs here
