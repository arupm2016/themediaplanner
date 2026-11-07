# Production stack and deployment notes

## Current application stack
- React 18 + TypeScript + Vite
- Tailwind-free custom CSS design system (Space Grotesk + DM Sans)
- Recharts for data visualisation
- Lucide React icons
- SheetJS (xlsx) for multi-sheet Excel export
- Browser localStorage for MVP persistence
- GitHub Actions + GitHub Pages deployment workflow

## Current MVP capabilities
Campaign brief wizard, platform mix, objective selection, editable spend/CPM/CPC/CTR/CVR assumptions, impressions/clicks/conversion forecasts, budget split visualisation, funnel split, rules-based strategic checks, saved plans, scenario comparison, XLSX/CSV export, print-to-PDF, responsive UI.

## Deploy to GitHub Pages
1. Open repository Settings → Pages.
2. Under Build and deployment, select **GitHub Actions** as the source.
3. Ensure Actions are enabled for the repository.
4. Push to `main` or run the **Build and deploy The Media Planner** workflow manually.
5. The expected URL is https://arupm2016.github.io/themediaplanner/

The workflow installs dependencies, runs the Vite production build, uploads `dist`, and deploys Pages.

## Supabase production persistence
1. Create a Supabase project.
2. Run `supabase/schema.sql` in SQL Editor.
3. Configure the app's auth client and plan repository using the public project URL and anon/publishable key.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the deployment environment.
5. Keep RLS enabled. Never put a service-role key in frontend code.

The current MVP stores saved plans in the current browser only. The schema is a production starting point; cloud persistence/auth wiring is a separate integration step.

## Google Sheets
The app currently provides XLSX/CSV exports. Direct Google Sheets publishing is not enabled yet. It requires Google Cloud OAuth consent configuration, Sheets API enablement, authorized redirect URI, token handling, and secure backend storage. Do not put client secrets or refresh tokens in Vite environment variables exposed to browser code.

## Forecast methodology and caveats
Forecasts are directional calculations based on editable inputs, not promises or official platform benchmarks. Impressions = spend / CPM × 1,000; clicks use CPC when supplied, otherwise CTR × impressions; conversions = clicks × CVR. Reach is a directional estimate based on impressions / frequency and must not be summed across platforms. Quick-commerce and marketplace reporting varies by retailer, market, ad product and account access.

## Before broad public launch
- Add Supabase auth and cloud plan persistence.
- Complete Google Sheets OAuth integration.
- Add CSV import mapping for historical performance.
- Add server-side benchmark provenance and freshness.
- Add unit tests for the calculation engine and export workbook.
- Run accessibility, security and browser/device QA.
