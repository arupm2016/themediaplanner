# TMP · Media Planner
**Media intelligence. Investment science. Growth control.**

An agency-grade media planning workspace for CMOs, growth leaders, performance marketers and media agencies. TMP models channel economics from transparent assumptions and supports multi-tenant workspaces, secure authentication, plan persistence, credit entitlements and Razorpay checkout.

## Technology
- React 18, TypeScript, Vite
- Supabase Auth + PostgreSQL + Row Level Security
- Supabase Edge Functions for privileged server-side operations
- Razorpay Orders API + Standard Checkout + signed webhooks
- Recharts, Lucide React, SheetJS
- GitHub Actions production build and static publishing

## Local development
Requires Node.js 20+.
```bash
npm install
cp .env.example .env.local
npm run dev
```
Production build and smoke test:
```bash
npm run build
npm run test:smoke
```

## Supabase setup
1. Create a Supabase project.
2. Apply the migration:
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```
3. Configure Authentication > URL Configuration. Set the Site URL to your production origin and add the production origin plus local development URL to Redirect URLs.
4. Set browser environment variables in Vercel (or your hosting provider):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (or legacy `VITE_SUPABASE_ANON_KEY`)
5. Deploy Edge Functions:
   ```bash
   npx supabase functions deploy create-checkout-order
   npx supabase functions deploy verify-checkout
   npx supabase functions deploy razorpay-webhook
   npx supabase functions deploy invite-member
   ```
6. Set server-only secrets (never add these to VITE_ variables or commit them):
   ```bash
   npx supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   npx supabase secrets set SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
   npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_SECRET
   npx supabase secrets set APP_ORIGIN=https://YOUR_PRODUCTION_DOMAIN
   npx supabase secrets set RAZORPAY_KEY_ID=YOUR_RAZORPAY_KEY_ID
   npx supabase secrets set RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_KEY_SECRET
   npx supabase secrets set RAZORPAY_WEBHOOK_SECRET=YOUR_RAZORPAY_WEBHOOK_SECRET
   ```
7. In Razorpay Dashboard, create a webhook pointing to:
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/razorpay-webhook`
   Subscribe to `payment.captured`. Use the same webhook secret configured in Supabase Edge Function secrets.
8. Configure test-mode Razorpay credentials first. Run successful, failed, abandoned, duplicate webhook, wrong-signature and amount-mismatch tests before switching to live keys.

## Billing and credits
The server-side plan catalogue is authoritative. Prices, credit amounts, period length and seat limits are read from PostgreSQL, never trusted from browser input. Razorpay checkout creates an order server-side. The callback signature is verified server-side and the payment is fetched from Razorpay to confirm captured status, order, amount and currency. A signed webhook is also verified against the raw request body. Fulfilment is idempotent and updates subscription credits transactionally.

Current billing mode: 30-day plan entitlement activated after a captured one-time payment. Renewal is manual. Automatic recurring billing is not enabled until Razorpay Subscriptions is activated for the merchant account and the matching Razorpay Plan IDs are provisioned and configured. Do not advertise auto-renew until that work is completed and tested.

CSV exports consume one workspace credit using an atomic PostgreSQL function. More billable actions can be assigned explicit credit costs in the same way.

## Workspace security
- Supabase Auth handles password signup, login, email confirmation and password reset.
- Each signup receives a workspace and Starter entitlement.
- Workspace membership roles: owner, admin, strategist, analyst, viewer.
- RLS scopes plans, benchmarks, workspace metadata and subscription reads.
- Membership writes, payment orders, payment fulfilment and credit ledger writes are server-side only.
- Service-role and Razorpay secrets must only exist in Supabase Edge Function secrets.
- Invitations are sent through a server-side Edge Function and constrained by plan seat limits.

## Deployment
Vercel should deploy the `main` branch using:
- Framework: Vite
- Build: `npm run build`
- Output: `dist`
- Environment variables: Supabase URL and publishable key

GitHub Actions also builds, smoke-tests and publishes static assets to `gh-pages`. Do not deploy the `gh-pages` branch to Vercel; it contains compiled output only.

## Forecast methodology and limitations
The forecast engine uses CPM-led calculations for impression-based channels and CPC-led calculations for click-priced channels. It calculates delivery, traffic, video views, leads/conversions, attributed revenue and contribution using explicit editable assumptions. Reach is gross channel-level reach and is not cross-platform deduplicated. Attributed ROAS is not the same as incrementality or MER. CAC depends on an editable new-customer share. Benchmarks are directional references, not guaranteed market standards; use first-party account history and record source, date, sample and attribution window.

## Production launch checklist
- [ ] Create and link the actual Supabase project.
- [ ] Apply migrations and inspect RLS policies in the Supabase dashboard.
- [ ] Configure Auth email provider, SMTP sender, Site URL and redirect URLs.
- [ ] Add Vercel environment variables and redeploy.
- [ ] Set Supabase Edge Function secrets and deploy functions.
- [ ] Configure Razorpay test keys and webhook.
- [ ] Test test-mode payments and verify credit activation / webhook idempotency.
- [ ] Confirm subscription expiry, refunds, cancellations and manual renewal process.
- [ ] Complete team invitation tests for new and existing accounts.
- [ ] Switch to Razorpay live credentials only after merchant KYC and gateway activation.

**No fake payment or authentication mode is included.** Without production credentials and a connected Supabase project, private workspace routes remain locked rather than silently falling back to demo login.
