-- Rollback for migration 0003: Remove pipeline state machine + event tracking

-- Drop prospect_events table (cascades indexes, policies, RLS)
drop table if exists prospect_events;

-- Drop the pipeline_state index on prospects
drop index if exists idx_prospects_pipeline_state;

-- Remove pipeline_state column from prospects
alter table prospects drop column if exists pipeline_state;
