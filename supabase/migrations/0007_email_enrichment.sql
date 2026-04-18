-- Migration 0007: Email enrichment support (Hunter.io integration)
-- Adds email metadata columns to prospects + cache table for domain search results.

-- Email source tracking: where did we find this email?
do $$ begin
  alter table prospects add column email_source text;
exception when duplicate_column then null;
end $$;

-- Hunter.io confidence score (0-100). Null for scraped emails.
do $$ begin
  alter table prospects add column email_confidence int;
exception when duplicate_column then null;
end $$;

-- Flag for role-based emails (info@, hello@, contact@). Track reply rate separately.
do $$ begin
  alter table prospects add column email_is_role_based boolean not null default false;
exception when duplicate_column then null;
end $$;

-- Backfill existing prospects with scraped emails
update prospects set email_source = 'scraped' where email is not null and email_source is null;

-- Cache table for Hunter domain search results (one row per domain, TTL 90 days)
create table if not exists email_enrichment_cache (
  domain text primary key,
  emails jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table email_enrichment_cache enable row level security;

create policy "service full access email cache" on email_enrichment_cache
  for all to service_role using (true) with check (true);
