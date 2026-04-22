-- Rollback for migration 0008
alter table prospects drop column if exists instantly_lead_id;
