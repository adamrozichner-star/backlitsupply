-- Migration 0005: Make email column nullable
-- Email is discovered during enrichment and may not be available for all prospects.
-- Prospects without email stay at mockup_ready pending manual email discovery.

alter table prospects alter column email drop not null;
