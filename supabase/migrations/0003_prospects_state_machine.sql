-- Migration 0003: Add pipeline state machine + event tracking to prospects
-- NOTE: Column is named "pipeline_state" (not "state") to avoid collision with
-- the geographic "state" column (TX, FL, etc.) already on the prospects table.

-- Add pipeline_state column with CHECK constraint (using DO block for idempotency)
do $$ begin
  alter table prospects add column pipeline_state text not null default 'discovered'
    check (pipeline_state in (
      'discovered','enriched','qualified','mockup_ready',
      'sent','opened','replied','positive','booked','won','lost','dead'
    ));
exception when duplicate_column then
  raise notice 'column "pipeline_state" already exists on prospects, skipping';
end $$;

-- prospect_events table for metrics tracking
create table if not exists prospect_events (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id) on delete cascade,
  event text not null,
  payload jsonb default '{}',
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_prospects_pipeline_state on prospects(pipeline_state);
create index if not exists idx_prospect_events_prospect on prospect_events(prospect_id);
create index if not exists idx_prospect_events_event on prospect_events(event);

-- RLS
alter table prospect_events enable row level security;

create policy "service full access prospect events" on prospect_events
  for all to service_role using (true) with check (true);
