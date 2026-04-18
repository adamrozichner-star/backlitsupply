-- Rollback for migration 0006
-- WARNING: will fail if any rows have pipeline_state = 'mockup_review_pending'.
-- Before rollback, manually transition those to either 'qualified' or 'mockup_ready'.

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
    'discovered','enriched','qualified','mockup_ready',
    'sent','opened','replied','positive','booked','won','lost','dead'
  )
);
