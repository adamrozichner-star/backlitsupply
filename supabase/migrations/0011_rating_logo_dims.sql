-- Migration 0011: Add rating, review_count, logo_width, logo_height to prospects.
-- These fields flow from Google Places through enrichment and are used
-- in qualification scoring. Without DB columns, resumed prospects lose them.

alter table prospects add column if not exists rating numeric(3,1);
alter table prospects add column if not exists review_count integer;
alter table prospects add column if not exists logo_width integer;
alter table prospects add column if not exists logo_height integer;
