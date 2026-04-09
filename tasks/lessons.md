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
