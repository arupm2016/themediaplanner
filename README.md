# THE MEDIA PLANNER
**Plan smarter. Allocate better. Grow faster.**

A responsive media strategy workspace for growth marketers. Turn a campaign brief into a channel plan, model budget and KPI outcomes, inspect strategic signals, compare scenarios, and export a multi-sheet Excel workbook.

## Technology stack
React 18 · TypeScript · Vite · Recharts · Lucide React · SheetJS (XLSX) · GitHub Actions · GitHub Pages. Supabase schema starter included for future auth and cloud persistence.

## Run locally
Requires Node.js 20+.
```bash
npm install
npm run dev
```
Production build:
```bash
npm run build
npm run preview
```

## Features
- Campaign brief wizard and objective selector
- Social, search, video, marketplace and retail media platform library
- Editable channel budgets and assumptions
- CPM, CPC, CTR, CVR, impressions, clicks, conversions and CPA forecasts
- TOFU / MOFU / BOFU budget planning view
- Rules-based strategic intelligence and readiness checklist
- Conservative, base and aggressive scenario comparison
- Browser-saved plans
- Multi-sheet Excel, CSV and print-to-PDF exports
- Responsive premium dashboard and Google Fonts typography

## Deployment
GitHub Actions workflow is configured in `.github/workflows/deploy.yml`. Enable **Settings → Pages → Build and deployment → GitHub Actions**. Expected URL: https://arupm2016.github.io/themediaplanner/

## Important implementation notes
- The current MVP uses browser localStorage; plans are local to the browser/device.
- Excel/CSV export works without connecting an account.
- Direct Google Sheets OAuth publishing is not yet implemented; see `docs/ARCHITECTURE.md`.
- Supabase SQL starter and environment template are included. Auth/cloud persistence still need wiring.
- KPI defaults are illustrative editable assumptions, not official industry benchmarks.
- Platform metric availability varies. Reach is not additive across channels.

See [production stack and deployment notes](docs/ARCHITECTURE.md).
