# Backlit Supply

Custom backlit signs for modern businesses.

## Stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Vercel (hosting)
- Supabase (database)
- Stripe Payment Links
- Resend (email)
- Cloudflare R2 (images)
- Plausible (analytics)

## Setup

```bash
# 1. Clone
git clone git@github.com:adamrozichner-star/backlitsupply.git
cd backlitsupply

# 2. Install
npm install

# 3. Environment
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY

# 4. Run
npm run dev
```

## Domain Setup
1. In Vercel project settings → Domains → Add `backlitsupply.com`
2. In Cloudflare DNS, add:
   - CNAME: `@` → `cname.vercel-dns.com`
   - CNAME: `www` → `cname.vercel-dns.com`
3. Disable Cloudflare proxy (orange cloud → gray) for Vercel SSL to work

## Project Structure
```
src/
  app/
    page.tsx          # Homepage
    work/page.tsx     # Gallery
    process/page.tsx  # How it works
    pricing/page.tsx  # Pricing tiers
    contact/page.tsx  # Lead form + Calendly
    for/[slug]/page.tsx  # Personalized landing pages (Phase 2)
  components/         # Shared UI components
  lib/                # Utilities, Supabase client, etc.
```
