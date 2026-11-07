# The Media Planner

Plan smarter. Allocate better. Grow faster.

A React + TypeScript media-planning workspace for growth marketers. Build platform-specific plans, model channel budgets, forecast objective-specific KPIs, inspect strategic signals, compare scenarios, and export an editable Excel workbook or CSV.

## Features
- Multi-step campaign planning wizard
- Platform-specific objectives, formats and KPI schemas
- Editable media plan with budget and KPI forecasts
- TOFU / MOFU / BOFU allocation
- Strategic recommendations and risk checks
- Conservative / base / aggressive scenario planning
- Multi-sheet XLSX, CSV and print-to-PDF exports
- Local browser persistence

## Run locally
Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Deploy
Static Vite app. Build command: `npm run build`; output: `dist`. Deploy to Vercel, Netlify, Cloudflare Pages, or GitHub Pages. A GitHub Pages workflow is included.

## Implementation notes
This MVP stores plans in the current browser's local storage. Google Sheets requires Google OAuth and API configuration; no fake connection is presented. KPI defaults are illustrative planning assumptions, not sourced industry benchmarks. Reach is not aggregated across platforms, and quick-commerce metric availability is conditional. Strategic recommendations are rule-based.

## License
Private project; add your preferred license before public distribution.