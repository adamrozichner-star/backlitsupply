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

### Remaining Phase 2 (future sessions)
- [ ] Google Places scraper for new businesses
- [ ] AI mockup pipeline (Claude vision + image generation)
- [ ] `outreach.ts` (Claude API generates personalized email + DM copy)
- [ ] Instantly.ai integration for cold email
- [ ] Google Workspace + SPF/DKIM/DMARC setup on backlitsupply.com
- [ ] AI reply agent (Phase 4)
