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
npm run build       # Production build
```

Deploy:
```bash
npx convex deploy   # Deploy Convex functions
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
Single-file SPA (~4500 lines). All views are functions defined **inside** the main `KorfbalApp` component, giving them closure access to shared state and Convex queries. This is intentional — avoid extracting views to separate files unless they need to escape re-definition on every render (like `SetupMatchView`, which is defined at the top level to prevent keyboard dismissal bugs).

**Routing** is split into two systems:
- **Unauthenticated**: pathname-based (`/` → LandingPage, `/login` → Clerk SignIn, `/sign-up` → Clerk SignUp)
- **Authenticated**: hash-based (`#home`, `#match`, etc.) via `window.history.pushState` through `navigateTo()`

**Key views** (all defined inside `KorfbalApp` unless noted):
- `HomeView` — dashboard, recent matches, AI advice card, season management
- `SetupMatchView` — configure opponent, date, starters, season *(top-level component)*
- `MatchView` — live tracking: goals by shot type, substitutions, timer, undo
- `MatchSummaryView` — review and save to Convex
- `StatisticsView` — W/D/L, shot%, form, season/competition filtering
- `ManagePlayersView` — player roster CRUD
- `OnboardingView` — create team (null → 'new') or claim legacy team (null → 'claim')
- `TeamPickerView` — team switcher for users with multiple teams
- `GodModeView` — admin: view all teams/matches, merge duplicates, reset passwords
- `SharedMatchView` — public match view (no auth)
- `LandingPage` (`src/components/marketing/LandingPage.jsx`) — public SaaS landing page

**Separate UI components** in `src/components/ui/`:
- `SettingsSheet.jsx` — bottom sheet for team settings, color picker, invite link, subscription
- `ConfirmDialog.jsx` — reusable confirm modal (showConfirm hook pattern)
- `KorfbalLogo.jsx` — SVG logo component

**Shot types** are defined in `src/constants/shotTypes.js` (7 types: `distance`, `close`, `penalty`, `freeball`, `runthrough`, `outstart`, `other`). The `short` property (e.g. `AS`, `KK`) is displayed in buttons. All stats calculations iterate over `SHOT_TYPES`.

### Critical: snake_case vs camelCase mismatch

Convex schema uses **snake_case** but the in-memory `currentMatch` object uses **camelCase**. This is a frequent source of bugs:

| Convex schema | Frontend `currentMatch` |
|---|---|
| `opponent_score` | `opponentScore` |
| `team_id` | *(not present)* |
| `with_attempts` | `withAttempts` |
| `season_id` | `seasonId` |

When saving a match via `createMatchMutation`, the frontend manually maps camelCase → snake_case. When reading from Convex queries, use the snake_case field names directly.

**Player position values**: `'aanval'` | `'verdediging'` (Dutch, not English). Used in `player.position` everywhere.

### Live match state recovery

`currentMatch` state is saved to `localStorage` as `korfbal_active_match` on every update. On `HomeView` load, if a saved match exists for the current team (< 7 days old), a recovery banner appears. The timer state (`timerSeconds`, `timerRunning`) is lifted to `KorfbalApp` level to survive `MatchView` re-renders.

### Convex Backend (`convex/`)

**Auth pattern**: Every mutation/query touching team data calls `requireMember(ctx, teamId)` — verifies Clerk identity + `team_members` table. God Mode bypasses this via `CONVEX_GOD_MODE_PASSWORD`.

| File | Purpose |
|------|---------|
| `schema.ts` | All table definitions |
| `memberships.ts` | User↔team relationships, invite links, `deleteSelfAndData` (GDPR) |
| `matches.ts` | Match CRUD; `createMatch` enforces free tier limit (20 matches) |
| `teams.ts` | Team CRUD, player management, God Mode ops (merge, rename, delete) |
| `seasons.ts` | Season management (one active per team) |
| `stats.ts` | Analytics queries (W/D/L, shot%, form, streaks, trendByMonth) |
| `subscriptions.ts` | Stripe state, checkout/portal session creation |
| `http.ts` | Stripe webhook handler via `httpRouter` |
| `ai.ts` | Claude API action: `generateTrainingAdvice` |
| `aiQueries.ts` | `getAdvice` query (reads cached AI advice) |
| `auth.ts` | God Mode login mutation only |

### SaaS / Billing

Free tier: max 20 matches per team. Enforced in `convex/matches.ts` `createMatch` — throws `"FREE_LIMIT_REACHED"` string when hit. Frontend catches this error string and shows the upgrade modal (`showUpgradeModal` state).

Stripe flow: `createCheckoutSession` → Stripe hosted checkout → webhook → `upsertSubscription` mutation.

Plans: Free (€0, 20 matches), Starter (€4,99/mo, unlimited + AI), Club (€12,99/mo, 3 teams).

### Design system

**Editorial Sport** tokens. All defined in `tailwind.config.js` and `src/index.css`.

Key Tailwind tokens:
- `bg-canvas` / `bg-[#FAFAF7]` — warm app background
- `bg-ink-900` (`#0A0D12`) — dark cards (live scoreboards, match heroes)
- `text-primary` / `bg-primary` — team color (dynamic via CSS var `--color-primary`)
- `font-display` — Archivo, used for headlines and score numbers
- `font-mono` / `.mono` — JetBrains Mono, used for timer and score lists
- `.stencil` — 10px Inter uppercase 700, used for section labels
- `.score-number` — Archivo 900, tabular-nums, tight tracking
- `.field-pattern` — diagonal stripe overlay for dark cards
- `.pulse-ring` — pulsing red ring for LIVE indicator

**Team color theming**: `data-theme` attribute on `<html>` (values: `red`/`orange`/`blue`/`green`/`purple`). CSS vars `--color-primary`, `--color-primary-dark`, etc. override per-theme. Stored in `colorTheme` state and Convex `teams.color_theme`.

**Dark mode**: `darkMode: 'class'` in Tailwind. Toggle adds/removes `dark` class on `<html>`.

## Skills
- `/app-review` — Voer een volledige app review uit als senior applicatieontwikkelaar
