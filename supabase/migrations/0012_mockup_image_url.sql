-- Migration 0012: Add mockup_image_url for direct image URLs in email templates.
-- Stores the full absolute URL (https://backlitsupply.com/mockups/{slug}.webp)
-- while mockup_url keeps the relative path (/mockups/{slug}.webp).

alter table prospects add column if not exists mockup_image_url text;

-- Backfill from existing mockup_url values
update prospects
  set mockup_image_url = 'https://backlitsupply.com' || mockup_url
  where mockup_url is not null
    and mockup_image_url is null;
