-- Migration 0006: Add mockup_review_pending state + mockup_retry_count column
-- Human-in-the-loop review gate between mockup generation and sendability.
-- Gemini hallucinates logos ~30% of the time on text-heavy wordmarks.

-- 1. Drop any existing CHECK constraint on pipeline_state
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'prospects'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%pipeline_state%'
  loop
    execute 'alter table prospects drop constraint ' || quote_ident(r.conname);
  end loop;
end $$;

-- 2. Re-add CHECK with mockup_review_pending included
alter table prospects add constraint prospects_pipeline_state_check check (
  pipeline_state in (
    'discovered','enriched','qualified',
    'mockup_review_pending',
    'mockup_ready',
    'sent','opened','replied','positive','booked','won','lost','dead'
  )
);

-- 3. Add mockup_retry_count — tracks how many times a mockup was rejected
-- with a retryable reason (wrong_composition, other). Pipeline checks this:
-- if retry_count >= 2 at next rejection → terminal lost.
do $$ begin
  alter table prospects add column mockup_retry_count int not null default 0;
exception when duplicate_column then null;
end $$;
