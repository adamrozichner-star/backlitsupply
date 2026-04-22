-- Migration 0009: Add logo_extraction_trace to prospects for debugging logo selection decisions.

do $$ begin
  alter table prospects add column logo_extraction_trace jsonb;
exception when duplicate_column then null;
end $$;
