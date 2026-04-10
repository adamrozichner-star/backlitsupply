# Session 2 Recap

**Date completed:** 2026-04-10

## What shipped
- `/process` — 4-step how-it-works page with comparison table and mid-page CTA
- `/pricing` — 3 tiers (Compact $385, Standard $600, Statement $1,200+) with placeholder Stripe links, 6-item FAQ accordion
- `/work` — 7-photo gallery page
- `/contact` — two-column layout with lead form + contact info sidebar
- Resend integration — end-to-end lead notification pipeline (form → Supabase → email to inbox)

## Live URL
https://backlitsupply.com

## First successful test lead notification
2026-04-10 — test lead submitted from live site, email landed in Gmail (spam folder, expected with sandbox sender).

## Known debt
- Resend domain verification (backlitsupply.com) — currently using sandbox sender, emails landing in spam
- Recrop gallery photos to remove visible brand names — LEGAL, must do before outbound
- Real Stripe Payment Links — waiting on Adam's pricing decision
- Real product photos — eventually replacing AI-mockup-style supplier reference photos

## What's needed before next session
- Real Stripe pricing from Adam's team
- Decision on photo recrop priority (legal blocker for outbound)
