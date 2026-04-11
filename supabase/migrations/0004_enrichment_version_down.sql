-- Rollback for migration 0004: Remove enrichment_version

drop index if exists idx_prospects_enrichment_version;
alter table prospects drop column if exists enrichment_version;
