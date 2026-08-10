# Court Speed

Static rebuild of [courtspeed.com](https://courtspeed.com): the Court Pace Index database for the
Grand Slams, Masters 1000s and ATP Finals, 2012 to 2026.

## How it works

The Google Sheet ("The Racquet ATP Court Speed Data") is the CMS. At build time `scripts/sync.mjs`
pulls the sheet, normalises it to `src/data/court_speed.json`, and mirrors the CPI source-chart
images into `public/sources/` so tooltips load fast and survive link-rot. Astro then renders fully
static pages: no client framework, one small vanilla JS file for tooltips, modals, trends and theme.

Reading the sheet takes two passes, because no single endpoint gives both values and links:

* **Values** come from the `xlsx` export, falling back to per-tab gviz CSV. Google refuses the xlsx
  export from datacenter IPs, so in CI the CSV path is the one that actually runs. The `401` in the
  build log is expected and harmless.
* **Source-image links** are cell hyperlinks, which CSV strips. They come from the Sheets API
  (`spreadsheets.get` with a `hyperlink` field mask), which works from any IP given an API key.
  Set `SHEETS_API_KEY` in GitHub Actions secrets and in Cloudflare Pages variables. Without it the
  build keeps whatever links were last committed, so images go stale silently but nothing breaks.

The sheet must stay readable by anyone with the link, or both paths fail.

```
npm install
npm run build          # sync sheet + build -> dist/
npm run build:offline  # build from the committed JSON without fetching
npm run dev            # local dev server
```

Env vars for `sync`: `SYNC_XLSX=path.xlsx` parses a local file, `SKIP_IMAGES=1` skips the mirror,
`SHEETS_API_KEY` enables hyperlink reads.

## Deploying (Cloudflare Pages)

Build command `npm run build`, output directory `dist`, production branch `main`.

`.github/workflows/rebuild.yml` polls the sheet and commits `src/data/court_speed.json` and
`public/sources` only when something changed, and Cloudflare deploys on commit, so quiet weeks cost
zero builds. The cron asks for every 15 minutes but GitHub throttles scheduled runs on free repos to
roughly every two hours. For an immediate publish, fire the Cloudflare deploy hook.

Note the workflow runs on schedule or manual dispatch only. Pushing does not trigger it, so after
changing `sync.mjs` use Actions, sheet-sync, Run workflow to test it.

## Where things live

* `src/lib/data.mjs`: data model, scoring, OSR calibration, bands. CPI bands are
  `<30 / 30-34 / 35-39 / 40-44 / >44`, and 44.1 counts as **Fast** because the boundary is `<=44`,
  not `<45`.
* `src/lib/render.mjs`: server-side HTML builders (matrix tables, legends, sidebar, logo)
* `src/layouts/Base.astro`: header, nav, sidebar, footer, modals, embedded JSON payload
* `public/app.js`: theme, filters, hover tooltips, tap modals, year summaries, trend charts
* `src/styles/global.css`: the design system (light and dark via CSS vars on `[data-theme]`)
* `src/data/source_overrides.json`: manual override for a source-image link, keyed by year and
  canonical tournament name. It beats the Sheets API, so keep it empty (`{}`) unless the API is
  broken and something needs forcing.

## Data quirks

* Toronto and Montreal are canonicalised to "Canadian Open". Per-year display names are kept for the
  season-summary modal.
* COVID-cancelled cells (nine of them) are labelled distinctly from ordinary missing data.
* Venue changes (Miami 2019, ATP Finals 2021, Paris 2025) and ball changes get marker bars and
  tooltips.
* Mirrored image filenames include a hash of the source URL. Re-pointing a link therefore downloads
  a fresh file rather than serving the previously cached one.
