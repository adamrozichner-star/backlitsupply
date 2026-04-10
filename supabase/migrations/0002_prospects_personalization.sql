-- Migration 0002: Extend prospects for personalization engine + page view tracking
-- Run in Supabase SQL Editor MANUALLY before deploying code

-- Add missing columns to prospects (additive — won't break existing rows)
alter table prospects add column if not exists owner_first_name text;
alter table prospects add column if not exists owner_last_name text;
alter table prospects add column if not exists instagram text;
alter table prospects add column if not exists country text default 'US';
alter table prospects add column if not exists suggested_dimensions text;
alter table prospects add column if not exists suggested_price_usd numeric;

-- Make slug NOT NULL for new rows (existing nulls will remain until backfilled)
-- If slug is already NOT NULL this will error harmlessly
do $$ begin
  alter table prospects alter column slug set not null;
exception when others then null;
end $$;

-- Make business_name NOT NULL for new rows
do $$ begin
  alter table prospects alter column business_name set not null;
exception when others then null;
end $$;

-- Ensure unique index on slug
create unique index if not exists idx_prospects_slug on prospects(slug);

-- Broaden existing RLS policies to allow full CRUD for service_role
-- Drop narrow policies from 0001 if they exist, replace with full access
drop policy if exists "service can insert" on prospects;
drop policy if exists "service can read" on prospects;
drop policy if exists "service full access prospects" on prospects;

create policy "service full access prospects" on prospects
  for all to service_role using (true) with check (true);

-- Page view tracking
create table if not exists prospect_page_views (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id) on delete cascade,
  viewed_at timestamptz default now(),
  user_agent text,
  referrer text
);

create index if not exists idx_page_views_prospect on prospect_page_views(prospect_id);

alter table prospect_page_views enable row level security;

create policy "service full access page views" on prospect_page_views
  for all to service_role using (true) with check (true);
