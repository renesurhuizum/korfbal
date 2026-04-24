# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Korfbal Score App

## Stack
- **Frontend**: React 18 + Vite, TailwindCSS
- **Backend**: Convex (real-time serverless DB + functions)
- **Auth**: Clerk (email/OAuth) — JWT validated by Convex
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`)
- **Payments**: Stripe (checkout, webhooks, billing portal)
- **Taal**: Nederlands (UI tekst), Engels (code, variabelen, comments)

## Commands

Both servers must run simultaneously during development:
```bash
npx convex dev      # Convex backend (regenerates _generated/ types)
npm run dev         # Vite frontend on localhost:5173
npx vite build      # Production build
```

Required env vars in `.env.local`:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_CONVEX_URL=https://...convex.cloud
```

Required Convex env vars (set via `npx convex env set KEY value`):
```
CLERK_JWT_ISSUER_DOMAIN
CONVEX_GOD_MODE_PASSWORD
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_STARTER
STRIPE_PRICE_CLUB
```

## Architecture

### Frontend (`src/App.jsx`)
Single-file SPA (~4300 lines). All views are functions defined inside the main `KorfbalApp` component, giving them closure access to shared state and Convex queries.

**Routing** is split into two systems:
- **Unauthenticated**: pathname-based (`/` → LandingPage, `/login` → Clerk SignIn, `/sign-up` → Clerk SignUp). Without a Clerk key, only LandingPage renders.
- **Authenticated**: hash-based (`#home`, `#match`, `#statistics`, etc.) via `window.history.pushState`.

**Key views** (all defined inside `KorfbalApp`):
- `HomeView` — dashboard, recent matches, AI advice card, season management
- `SetupMatchView` — configure opponent, date, starters, season
- `MatchView` — live tracking: goals by shot type, substitutions, timer, undo
- `MatchSummaryView` — review and save to Convex
- `StatisticsView` — W/D/L, shot%, form, season filtering
- `ManagePlayersView` — player roster CRUD
- `OnboardingView` — create team or claim legacy team (password migration)
- `GodModeView` — admin: view all teams/matches, merge duplicates, reset passwords
- `SharedMatchView` — public match view (no auth)
- `LandingPage` (`src/components/marketing/LandingPage.jsx`) — public SaaS landing page

**Shot types** are defined in `src/constants/shotTypes.js` (7 types: distance, close, penalty, freeball, runthrough, outstart, other). These drive all stats calculations.

### Convex Backend (`convex/`)

**Auth pattern**: Every mutation/query that touches team data calls `requireMember(ctx, teamId)` which verifies Clerk identity + `team_members` table membership. God Mode uses a separate password check via `CONVEX_GOD_MODE_PASSWORD`.

| File | Purpose |
|------|---------|
| `schema.ts` | All table definitions |
| `memberships.ts` | User↔team relationships, invite links, `deleteSelfAndData` (GDPR) |
| `matches.ts` | Match CRUD; `createMatch` enforces free tier limit (20 matches) |
| `teams.ts` | Team CRUD, player management, God Mode ops (merge, rename, delete) |
| `seasons.ts` | Season management (one active per team) |
| `stats.ts` | Analytics queries (W/D/L, shot%, form, streaks) |
| `subscriptions.ts` | Stripe subscription state, `getSubscription`, `getMatchCount`, `createCheckoutSession`, `createPortalSession` |
| `http.ts` | Stripe webhook handler via `httpRouter` |
| `ai.ts` | Claude API action: `generateTrainingAdvice` |
| `aiQueries.ts` | `getAdvice` query (reads cached advice from `ai_advice` table) |
| `auth.ts` | God Mode login mutation only |

### Data Model (key tables)

- **teams**: `team_name`, `players[]`, `color_theme`, `migrated`
- **matches**: `team_id`, `score`, `opponent`, `players[]` (per-shot-type stats), `goals[]` (chronological), `substitutions[]`, `finished`, `shareable`, `season_id`, `competition` (veld|zaal)
- **team_members**: `teamId`, `userId` (Clerk subject), `role` (admin|member)
- **team_invites**: `token`, `expiresAt` (7 days), `usedCount`
- **seasons**: `teamId`, `name`, `isActive`
- **subscriptions**: `teamId`, `stripeCustomerId`, `status` (free|starter|club), `currentPeriodEnd`
- **ai_advice**: `teamId`, `advice`, `generatedAt` (cached, regenerable on demand)

### SaaS / Billing

Free tier: max 20 matches per team. Enforced in `convex/matches.ts` `createMatch` — throws `"FREE_LIMIT_REACHED"` when limit hit. Frontend catches this and shows upgrade modal (`showUpgradeModal` state in `KorfbalApp`).

Stripe flow: `createCheckoutSession` action → Stripe hosted checkout → webhook to `/stripe/webhook` HTTP route → `upsertSubscription` mutation updates status.

Plans: Free (€0, 20 matches), Starter (€4,99/mo, unlimited + AI), Club (€12,99/mo, 3 teams).

## Skills
- `/app-review` — Voer een volledige app review uit als senior applicatieontwikkelaar
