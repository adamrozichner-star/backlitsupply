# Backlit Supply — Task List

## Phase 0: Setup (MUST COMPLETE BEFORE CODING)
- [x] Create ~/backlitsupply directory
- [x] git init (fresh repo, no DPO connection)
- [ ] Install Node.js (run: `nvm install 20` or `brew install node`)
- [ ] Run: `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
- [ ] Run: `npx shadcn@latest init` (dark mode, slate palette)
- [ ] Create GitHub repo: `gh repo create backlitsupply --public --source=.`
- [ ] Create NEW Supabase project at supabase.com (name: backlitsupply)
- [ ] Create `.env.local` with NEW keys (Supabase URL + anon key + service role)
- [ ] Create NEW Vercel project: `vercel link` → create new → name: backlitsupply
- [ ] Verify: `pwd` shows ~/backlitsupply, NOT dpo-saas
- [ ] Verify: git remote does NOT point to dpo-saas repo
- [ ] Verify: .env.local has DIFFERENT keys from DPO
- [x] Create tasks/todo.md (this file)
- [x] Create tasks/lessons.md
- [x] Create error_log.md

## Phase 1: Public Site
### Routes
- [ ] `/` — Homepage (hero, process strip, carousel, reviews, lead form, sticky CTA)
- [ ] `/work` — Gallery page (grid of sign photos with lightbox)
- [ ] `/process` — How it works (3-step visual + timeline)
- [ ] `/pricing` — Three tiers (Compact $385, Standard $600, Statement $1200+)
- [ ] `/contact` — Lead form + Calendly embed

### Components
- [ ] Layout: Header (nav + logo), Footer (links + social)
- [ ] Hero section (video bg, rotating taglines, CTA)
- [ ] ProcessStrip (3-step: Send logo → Mockup → Ship)
- [ ] MockupCarousel (6-8 sample signs)
- [ ] ReviewCards (5 Etsy reviews, hardcoded)
- [ ] LeadForm (name, business, email, logo upload → Supabase + Resend)
- [ ] StickyMobileCTA (bottom bar on mobile)
- [ ] PricingCard (tier name, price, features, Stripe link)

### SEO
- [ ] Meta tags per page (title, description, OG image)
- [ ] robots.txt + sitemap.xml
- [ ] JSON-LD LocalBusiness schema on homepage
- [ ] OG image generation (or static)

### Integrations
- [ ] Supabase: leads table (name, business_name, email, logo_url, created_at)
- [ ] Resend: notification email on lead submit → adam@backlitsupply.com
- [ ] Stripe Payment Links: placeholder URLs in pricing cards
- [ ] Plausible analytics script in layout

### Deployment
- [ ] Push to GitHub
- [ ] Deploy to Vercel (verify live at vercel URL)
- [ ] Connect backlitsupply.com domain
- [ ] Lighthouse audit: target 90+ mobile

## Phase 2: Personalization Engine
- [ ] Supabase schema: prospects + page_views tables
- [ ] `/for/[slug]` dynamic SSR route
- [ ] Personalized hero with composited mockup image
- [ ] Stripe link prefilled with business name
- [ ] View tracking (page_views insert on load)
- [ ] Graceful 404 for unknown slugs
- [ ] Hand-craft 1 test page: `/for/test-business`

## Phase 3: Scraper + AI Pipeline (DO NOT START until Phase 1+2 live)
- [ ] scripts/scrape.ts — Google Places API
- [ ] scripts/mockup.ts — Logo → sign mockup compositing
- [ ] scripts/seed.ts — Insert prospects to Supabase
- [ ] scripts/outreach.ts — Claude API for email/DM copy

## Phase 4: AI Reply Agent (DO NOT START until Phase 3 generating leads)
- [ ] Instantly.ai webhook → Claude → draft
- [ ] Telegram bot for approval
- [ ] Auto-reply on approval
