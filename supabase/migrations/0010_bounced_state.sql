-- Migration 0010: Add 'bounced' to pipeline_state CHECK constraint.
-- Bounced preserves the prospect record (unlike 'dead').
-- Soft bounces (mailbox full) are retryable; hard bounces are not.

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

alter table prospects add constraint prospects_pipeline_state_check check (
  pipeline_state in (
    'discovered','enriched','qualified',
    'mockup_review_pending',
    'mockup_ready',
    'sent','opened','replied','positive','booked','won',
    'bounced','lost','dead'
  )
);
