# Lessons Learned

Corrections and patterns to avoid. Updated after every mistake.

---

## Never invent customer-facing content
- Reviews, testimonials, quotes, case studies, statistics, named customers — all must be provided by Adam verbatim
- If real content is missing, render a clearly-marked placeholder OR hide the section entirely until real content arrives
- Never attribute invented quotes to real names. Ever.

## Never expose secrets
- Never echo, log, cat, or print .env contents in any form
- When discussing env files, refer to variable names only (NEXT_PUBLIC_SUPABASE_URL exists, etc)
- Use safe verification: `wc -l .env.local`, `grep -o '^[A-Z_]*=' .env.local`, `git check-ignore .env.local`

## Supabase variable names migrated
- Old: NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- New: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY
- All Supabase client code must use the new names

## Verify the last step of any pipeline
- When testing form→DB→email chains, the only test that matters is whether the human at the end gets the notification
- "Form submitted successfully" means nothing if no one is alerted
- Always test end-to-end to the actual inbox

## Resend sandbox sender lands in spam
- `onboarding@resend.dev` reliably lands in Gmail spam
- Always verify a custom domain before depending on email notifications for production lead flow
- Until then, check spam folder and click "Report not spam" to train Gmail

## Email reply link text must match the href
- Email reply link text and link href must both use the customer email field, not the customer name field
- Easy mistake — name comes first in the form schema, so it's the first variable you reach for

## Travis DBA fixture is synthetic
- Travis DBA fixture is synthetic — refetch real sample when travis county clerk site returns. TODO date: 2026-04-17.

## Zip-code geo filter is Texas-specific
- Zip-code geo filter is Texas-specific. Every new niche outside TX needs its own source + geo strategy. Document per-niche in niches/{slug}.ts comments.
