# Factory Photos

Place real factory/workshop photos here to replace mockup placeholders on `/factory`.

## Required files

| Filename | Usage | Min dimensions |
|---|---|---|
| `hero.webp` | Factory page hero image (full-bleed) | 2560 x 1280 px |
| `step-01-design.webp` | Step 1: Design & engineering | 1280 x 960 px |
| `step-02-cnc.webp` | Step 2: CNC cutting & shaping | 1280 x 960 px |
| `step-03-led.webp` | Step 3: LED assembly & wiring | 1280 x 960 px |
| `step-04-testing.webp` | Step 4: Testing & shipping | 1280 x 960 px |

## Notes

- Format: WebP preferred (JPEG acceptable, will need conversion)
- Aspect ratio: hero is 2:1, step images are 4:3
- All images should show real production — no stock photos
- Keep file size under 500 KB each (use `cwebp -q 80`)
- Once photos are added, update image paths in `src/app/factory/page.tsx`
