-- Migration 0008: Add instantly_lead_id to track which prospects have been pushed to Instantly.
-- The push script sets this after a successful API call.
-- Webhook events match prospects by email, but this ID links back to Instantly's internal record.

do $$ begin
  alter table prospects add column instantly_lead_id text;
exception when duplicate_column then null;
end $$;
