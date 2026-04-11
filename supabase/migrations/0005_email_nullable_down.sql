-- Rollback for migration 0005
-- WARNING: will fail if any rows have null email

alter table prospects alter column email set not null;
