# Court Speed

Static rebuild of [courtspeed.com](https://courtspeed.com) — Court Pace Index database for the
Grand Slams, Masters 1000s and ATP Finals, 2012–2026.

## How it works

The Google Sheet ("The Racquet ATP Court Speed Data") stays the CMS. At build time,
`scripts/sync.mjs` downloads the sheet's **xlsx export** (one request, every tab, and crucially the
cell **hyperlinks** to CPI source charts, which CSV export strips), normalises it to
`src/data/court_speed.json`, and mirrors source-chart images into `public/sources/` so tooltips load
instantly and survive link-rot. Astro then renders fully static pages — no client framework, one
small vanilla JS file for tooltips/modals/trends/theme.

```
npm install
npm run build        # sync sheet + build  -> dist/
npm run build:offline  # build from the committed JSON without fetching
npm run dev          # local dev server
```

Useful env vars for `sync`: `SYNC_XLSX=path.xlsx` (parse a local file), `SKIP_IMAGES=1`.

## Deploying (Cloudflare Pages)

1. Cloudflare Pages → Create project → connect this repo.
   - Build command: `npm run build`
   - Output directory: `dist`
2. Nothing else: `.github/workflows/rebuild.yml` checks the sheet every 15 minutes and commits
   the data **only when it changed** — Cloudflare auto-deploys on commit. No secrets, no tokens,
   and quiet weeks consume zero builds.
3. Point the `courtspeed.com` DNS at Pages, keep Replit alive until cut-over, then retire it.

## Where things live

- `src/lib/data.mjs` — data model, scoring, OSR calibration, bands (CPI bands: <30/30–34/35–39/40–44/>44;
  44.1 is **Fast** — boundary is `<=44`, not `<45`)
- `src/lib/render.mjs` — server-side HTML builders (matrix tables, legends, sidebar, logo)
- `src/layouts/Base.astro` — chrome: header/nav/sidebar/footer/modals + embedded JSON payload
- `public/app.js` — client interactions (theme, filters, hover tooltips, tap modals, year summaries, trend charts)
- `src/styles/global.css` — the whole design system (light/dark via CSS vars on `[data-theme]`)

## Conventions that matter

- Toronto/Montreal are canonicalised to "Canadian Open"; per-year display names are preserved for
  the season-summary modal.
- COVID-cancelled cells (9 of them) are labelled distinctly from ordinary missing data.
- Venue changes (Miami '19, ATP Finals '21, Paris '25) and ball changes get marker bars + tooltips.
- Never abbreviate Sinner & Alcaraz as "S/A".
