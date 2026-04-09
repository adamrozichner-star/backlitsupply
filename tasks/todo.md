# Backlit Supply — Phase 1 Plan

## Decisions needed from Adam before coding
1. **Stripe Payment Links** — Do you have placeholder URLs, or should I use `https://buy.stripe.com/PLACEHOLDER_compact` etc.?
2. **Calendly link** — What's the embed URL for the /contact page? (e.g. `https://calendly.com/adam-backlitsupply/15min`)
3. **Hero video** — Do you have a video file/URL, or should I build the hero with a dark static background + gradient that's easy to swap in a video later?
4. **Plausible** — Is the Plausible account set up for backlitsupply.com, or skip analytics script for now?
5. **Resend** — Is the API key in .env.local? Do you have the sending domain verified, or should I use Resend's test mode?
6. **Sign images** — Do you have 6-8 sign photos for the gallery/carousel, or should I use dark placeholder cards with "Photo coming soon" that look intentional (not broken)?

---

## Build order (7 commits)

### Commit 1: Layout + theme + fonts
- [ ] Update `layout.tsx`: dark mode by default (`className="dark"`), Inter font for body, lang="en"
- [ ] Update `globals.css`: override CSS vars for dark theme — background #0a0a0a, foreground white, accent amber #f59e0b
- [ ] Create `src/components/Header.tsx`: logo "Backlit Supply", nav links (Work, Process, Pricing, Contact), mobile hamburger
- [ ] Create `src/components/Footer.tsx`: logo, links, "Custom backlit signs for modern businesses", copyright
- [ ] Wire Header + Footer into layout.tsx
- [ ] Metadata: title "Backlit Supply — Custom Backlit Signs for Modern Businesses", description, OG basics

### Commit 2: Homepage
- [ ] Create `src/app/page.tsx` with sections:
  - Hero: dark bg, headline (tagline #1 default, easy to swap), subheadline, CTA button "Get a free mockup"
  - Process strip: 3 steps with icons — Send your logo → We mockup → Ship in 10 days
  - Mockup carousel: 6 placeholder cards (dark bg, amber border, "Coming soon" — swappable)
  - Reviews: 5 hardcoded Etsy reviews (Lauren, Natalie, Haley, Yarden, Ally — all 5-star)
  - Lead form: name, business name, email, logo upload (optional), submit button
  - Final CTA section
- [ ] Create `src/components/LeadForm.tsx`: form component with server action
- [ ] Create `src/app/actions.ts`: server action to save lead (console.log for now, Supabase in commit 5)
- [ ] Create `src/components/StickyMobileCTA.tsx`: fixed bottom bar on mobile only

### Commit 3: /work (gallery)
- [ ] Create `src/app/work/page.tsx`: grid of sign images (placeholders), hover effects, dark bg
- [ ] Metadata for gallery page

### Commit 4: /process + /pricing
- [ ] Create `src/app/process/page.tsx`: visual timeline — 3 steps expanded with detail
- [ ] Create `src/app/pricing/page.tsx`: 3 tier cards (Compact $385, Standard $600, Statement $1200+), Stripe link buttons, custom quote CTA
- [ ] Metadata for both pages

### Commit 5: /contact + Supabase + Resend
- [ ] Create `src/app/contact/page.tsx`: lead form (reuse LeadForm) + Calendly embed placeholder
- [ ] Create `src/lib/supabase.ts`: server client (uses service role key)
- [ ] Create Supabase `leads` table — give me the SQL to run:
  ```sql
  create table leads (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    business_name text,
    email text not null,
    logo_url text,
    source text default 'website',
    created_at timestamptz default now()
  );
  ```
- [ ] Update server action: insert lead to Supabase + send Resend email to adam@backlitsupply.com
- [ ] Wire LeadForm on homepage to the same action
- [ ] Metadata for contact page

### Commit 6: SEO + robots + sitemap
- [ ] Create `public/robots.txt`
- [ ] Create `src/app/sitemap.ts` (dynamic sitemap)
- [ ] Add JSON-LD LocalBusiness schema to homepage
- [ ] Verify all pages have unique meta title + description

### Commit 7: Polish + push
- [ ] Mobile responsive check on all pages (375px viewport)
- [ ] Lighthouse quick check (aim for 90+)
- [ ] Push to GitHub, trigger Vercel deploy
- [ ] Test live URL

---

## File tree (planned)
```
src/
  app/
    layout.tsx          ← dark theme, Inter font, Header+Footer
    page.tsx            ← Homepage
    actions.ts          ← Server actions (lead form)
    sitemap.ts          ← Dynamic sitemap
    work/page.tsx       ← Gallery
    process/page.tsx    ← How it works
    pricing/page.tsx    ← Pricing tiers
    contact/page.tsx    ← Lead form + Calendly
    for/[slug]/page.tsx ← Phase 2 (not yet)
  components/
    Header.tsx
    Footer.tsx
    LeadForm.tsx
    StickyMobileCTA.tsx
    ui/button.tsx       ← already exists (shadcn)
  lib/
    utils.ts            ← already exists
    supabase.ts         ← server Supabase client
public/
  robots.txt
```

## Design tokens
- Background: #0a0a0a (near-black)
- Foreground: #fafafa (near-white)
- Accent: #f59e0b (amber — warm LED glow)
- Accent hover: #d97706
- Muted: #737373
- Border: #262626
- Card: #141414
- Font body: Inter (or Geist — already in scaffold)
- Font display: Geist (already in scaffold) — no extra font needed
