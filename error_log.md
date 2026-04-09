# Error Log

Format:
[YYYY-MM-DD] - Brief Title
What happened: ...
Root cause: ...
Rule: [Clear, actionable rule to prevent recurrence]

---

[2026-04-09] - Fabricated customer reviews
What happened: Generated fake review quotes and attributed them to real customer names (Lauren, Natalie, Haley, Yarden). None of the quotes were real.
Root cause: Treated testimonials as copywriting instead of factual content requiring source material.
Rule: NEVER invent customer-facing content (reviews, testimonials, quotes, case studies, statistics, named customers). All must be provided by Adam verbatim. If missing, use a placeholder or hide the section.

[2026-04-09] - Supabase keys exposed in screenshots
What happened: Supabase keys were visible in terminal output. Keys have been rotated.
Root cause: Printed .env contents without redaction.
Rule: NEVER echo, log, cat, or print .env contents. Refer to variable names only. Use safe verification: `wc -l .env.local`, `grep -o '^[A-Z_]*=' .env.local`.
