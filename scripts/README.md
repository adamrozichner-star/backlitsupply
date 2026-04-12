# Backlit Supply — Lead Generation Pipeline

Config-driven, fully-resumable lead generation engine. Each niche is a config file — switching from "med spas in Austin" to "restaurants in Miami" is a config change, never a code change.

## Quick start

```bash
# Run with fixture data (offline, zero API calls)
npm run pipeline -- --niche=med-spa --source=fixture --limit=5

# Run both niches
npm run test:pipeline

# Run all niches in a loop
npm run loop -- --source=fixture --limit=3
```

## Running the 5-niche test

Live multi-niche batch. Requires these env vars in `.env.local`:

- `GOOGLE_PLACES_API_KEY` — discovery
- `ANTHROPIC_API_KEY` — enrichment + outreach drafting
- `REPLICATE_API_TOKEN` — mockup generation
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY` — state persistence

```bash
npm run batch -- \
  --niches=med-spa,dental-practices,boutique-fitness,tattoo-shops,coffee-shops \
  --limit-per-niche=50
```

Expected:
- **Runtime**: ~25 min (5 niches × ~3 min pipeline + 4 × 60s gaps)
- **Cost**: ~$15–20 (Places $0.03/query, Haiku $0.003/enrichment, Replicate $0.039/mockup)
- **Output**: ~250 prospects in Supabase, ~80–150 with mockups (only sendable ones pass the gate)
- **Logs**: `scripts/output/batch-{date}/{niche}.log` per niche
- **Summary**: `scripts/output/batch-{date}/summary.md` with per-niche enrichment hit rate —
  the single most valuable number, showing which niches are actually viable with current enrichment.

Dry-run (skips mockup gen but still hits Places + Haiku, ~$0.04/prospect):

```bash
npm run batch -- --niches=med-spa,dental-practices --limit-per-niche=2 --dry-run
```

## Add a new niche (10 minutes)

1. Create `niches/your-niche.ts`:

```ts
import type { NicheConfig } from './types'

const config: NicheConfig = {
  slug: 'your-niche',
  displayName: 'Your Niche',
  sources: ['comptroller-tx'],           // which source plugins to use
  geos: [{ city: 'Miami', state: 'FL' }], // which cities to target
  qualify: {
    minLogoSize: 150,
    requireOwnerName: true,
    websiteMustExist: true,
    scoreThreshold: 40,
  },
  templates: ['sign-01', 'sign-03'],     // which sign templates for mockups
  copyAngle: 'luxury-aesthetic',         // outreach tone (see scripts/lib/outreach.ts)
  priceRange: [600, 1400],
  killSwitch: { minReplyRate: 0.02, maxSpamRate: 0.003 },
}

export default config
```

2. Register it in `niches/index.ts`:

```ts
import yourNiche from './your-niche'
// add to NICHES:
'your-niche': yourNiche,
```

3. Test it:

```bash
npm run pipeline -- --niche=your-niche --source=fixture --limit=3
```

## Add a new source (30 minutes)

1. Create `scripts/lib/sources/your-source.ts`:

```ts
import type { RawListing } from '../types'
import type { GeoConfig } from '../../../niches/types'
import { registerSource, type BusinessSource } from './index'

const yourSource: BusinessSource = {
  slug: 'your-source',
  async fetchNew(geo: GeoConfig, nameRegex?: RegExp): Promise<RawListing[]> {
    // Fetch from your data source
    // Return array of RawListings
    return []
  },
}

registerSource(yourSource)
export default yourSource
```

2. Save a fixture in `scripts/fixtures/your-source-sample.json`

3. Import in `scripts/run-pipeline.ts`:
```ts
import './lib/sources/your-source'
```

4. Reference it in your niche config:
```ts
sources: ['your-source'],
```

## Pipeline stages

| Stage | Module | Description |
|-------|--------|-------------|
| 0 | `niches/*.ts` | Niche config |
| 1 | `scripts/lib/types.ts` | Shared types |
| 2 | `scripts/lib/sources/*.ts` | Business discovery |
| 3 | `scripts/lib/enrich.ts` | Logo + owner + email extraction |
| 4 | `scripts/lib/qualify.ts` | Scoring (gate before mockup) |
| 5 | `scripts/lib/composite.ts` | Sharp mockup compositing |
| 6 | `scripts/lib/storage.ts` | Local or R2 storage |
| 7 | `scripts/lib/outreach.ts` | LLM outreach copy |
| 8 | `scripts/lib/reply-classifier.ts` | Reply classification |
| 9 | Supabase migration | State machine |
| 10 | `scripts/lib/metrics.ts` | Event tracking |
| 11 | `scripts/run-pipeline.ts` | Orchestrator |
| 12 | `scripts/run-loop.ts` | Meta-runner |

## Env vars

| Variable | Required for |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY` | All stages (state persistence) |
| `GOOGLE_PLACES_API_KEY` | Primary discovery source (any niche, any geo) |
| `OUTSCRAPER_API_KEY` | Optional fallback discovery source |
| `REPLICATE_API_TOKEN` | AI mockup generation (google/gemini-2.5-flash-image) |
| `ANTHROPIC_API_KEY` | Stages 3, 7, 8 (LLM extraction, outreach, classification) |
| `R2_ACCOUNT_ID` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` + `R2_BUCKET_NAME` | Stage 6 R2 storage |
| `RESEND_API_KEY` + `LEAD_NOTIFICATION_EMAIL` | Email notifications |

Without any env vars, `--source=fixture` mode works fully offline.

### Source priority
- **google-places**: Primary. Generic, works for any niche/geo. $200/month free credit. Requires `GOOGLE_PLACES_API_KEY`.
- **comptroller-tx**: TX-only bonus. Franchise tax filings. Auto-skips for non-TX geos. No API key needed.
- **travis-dba**: Travis County DBA filings. Fixture-only until county clerk site is accessible.
- **outscraper**: Optional fallback. Requires `OUTSCRAPER_API_KEY`.
- **fixture**: Offline test data. Activated with `--source=fixture`.

When a niche lists multiple sources, the pipeline fetches from each, then merges + deduplicates by normalized name and domain.

## Directory structure

```
scripts/
  lib/
    sources/          # Discovery source plugins
    types.ts          # Shared types
    llm.ts            # LLM client interface
    enrich.ts         # Logo + contact enrichment
    qualify.ts        # Scoring
    composite.ts      # Sharp mockup compositing
    storage.ts        # Mockup storage
    outreach.ts       # Outreach copy generation
    reply-classifier.ts
    metrics.ts        # Event tracking
    slug.ts           # Slug generation
  fixtures/           # HTML/JSON fixtures for offline testing
  templates/          # 1600x1000 webp template images
  output/             # Pipeline outputs (mockups, CSVs, reports)
  run-pipeline.ts     # Single-niche orchestrator
  run-loop.ts         # Multi-niche meta-runner
  test-pipeline.ts    # Integration tests
niches/               # Niche config files
```
