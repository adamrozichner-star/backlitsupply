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
