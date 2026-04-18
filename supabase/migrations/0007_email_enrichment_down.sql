-- Rollback for migration 0007
drop table if exists email_enrichment_cache;
alter table prospects drop column if exists email_source;
alter table prospects drop column if exists email_confidence;
alter table prospects drop column if exists email_is_role_based;
