-- Migration 0004: Add enrichment_version to prospects
-- Prevents grandfathered prospects from bypassing newer enrichment guardrails.
-- When enrichment logic improves, bump CURRENT_ENRICHMENT_VERSION in enrich.ts.
-- Pipeline re-enriches any prospect with version < current on resume.

do $$ begin
  alter table prospects add column enrichment_version int not null default 1;
exception when duplicate_column then
  raise notice 'column "enrichment_version" already exists on prospects, skipping';
end $$;

create index if not exists idx_prospects_enrichment_version on prospects(enrichment_version);
