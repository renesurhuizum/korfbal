# Korfbal Score App — Professionalisering Roadmap

## Context
De app is een volledig functionele korfbal score-tracker (React 18 + Vite + Convex). Doel: de app commercieel klaar maken met email-authenticatie, meerdere gebruikers per team, kleurthema's, betere statistieken en uiteindelijk AI-trainingsadvies.

---

## Fase 0: Opruimen & Beveiliging ✅ GEDAAN

**Wijzigingen:**
- Wachtwoorden gehashed met native Web Crypto API (PBKDF2) — bcryptjs werkt niet in Convex V8
- Admin-credentials naar Convex environment variable (`CONVEX_GOD_MODE_PASSWORD`)
- `@supabase/supabase-js` verwijderd
- Service worker cache-versie verhoogd (v2) om stale builds te voorkomen

---

## Fase 1: Email-authenticatie ✅ GEDAAN

> **Implementatie afwijkend van origineel plan:** Convex Auth + Resend vervangen door **Clerk** (eenvoudiger, productieklaar, gratis tier).

**Wat gedaan:**
- Clerk account + Application aangemaakt (Email + Password)
- JWT template "convex" geconfigureerd
- `@clerk/clerk-react` geïnstalleerd
- `ClerkProvider` + `ConvexProviderWithClerk` in `src/main.jsx`
- `convex/auth.config.ts` aangemaakt met Clerk JWT issuer
- LoginView vervangen door `<SignIn />` en `<SignUp />` Clerk-componenten
- `vercel.json` met catch-all rewrite voor SPA-routing (`/sign-up` werkt)

---

## Fase 2: Multi-user Teams ✅ GEDAAN

> **Gecombineerd met Fase 1 in één implementatie.**

**Wat gedaan:**
- `team_members` tabel: userId (Clerk subject), role (admin/member), joinedAt
- `team_invites` tabel: token, expiresAt (7 dagen), usedCount
- `convex/memberships.ts`: getUserTeams, createTeam, claimTeam, generateInvite, acceptInvite, getTeamMembers, removeMember
- Auth guards op alle mutations in `teams.ts` en `matches.ts` via `requireMember()`
- `OnboardingView`: nieuw team aanmaken of bestaand claimen (PBKDF2-verificatie)
- `TeamPickerView`: teamkiezer bij 2+ teams per account
- SettingsSheet → Teamleden sectie: ledenlijst, uitnodigingslink genereren, leden verwijderen
- Migratie-flow: bestaande teams (U19, DTS1, etc.) claimbaar via "Bestaand team" tab

---

## Fase 3: Kleurthema's ✅ GEDAAN

> **Aanpak afwijkend van origineel plan:** Thema per **team** opgeslagen in Convex (niet per gebruiker — er is geen aparte `users` tabel).

**Wat gedaan:**
- CSS custom properties in `src/index.css`: `--color-primary`, `--color-primary-dark`, etc.
- 5 thema's: Rood (standaard), Oranje, Blauw, Groen, Paars
- `[data-theme="..."]` selectors in CSS voor alle varianten
- Tailwind config: `primary: 'rgb(var(--color-primary) / <alpha-value>)'`
- `color_theme` veld in `teams` tabel (optional string)
- `updateTeamTheme` mutation in `convex/teams.ts`
- `useEffect` in App.jsx synct teamkleur bij teamwisseling
- SettingsSheet: kleurkiezer slaat op in Convex (gedeeld met alle teamleden)

---

## Fase 4: Statistieken Verbeteringen ✅ GEDAAN

**Wat gedaan:**
- `convex/stats.ts`: 6 server-side queries (getTeamStats, getFormLastN, getTrendByMonth, getTopPlayers, getShotTypeTrend, getPlayerCareerStats)
- StatisticsView nieuwe secties:
  - Vormstrip: laatste 5 resultaten als gekleurde W/D/V bollen
  - Tegenstander-tabel: win% per tegenstander gesorteerd
  - Speler van de maand: meeste doelpunten afgelopen 30 dagen
  - Top 5 scorers
  - Spelersvergelijking (2 spelers naast elkaar)
  - SVG maandgrafiek (doelpunten voor/tegen per maand)
  - Schottype-trend tabel (seizoen% vs laatste 10 wedstrijden)
  - Per-schottype uitklap op spelerkaarten

---

## Fase 5: Code-architectuur Opsplitsen 🔄 GEDEELTELIJK

**Al gedaan:**
- `src/components/ui/ConfirmDialog.jsx` uitgesplitst
- `src/components/ui/SettingsSheet.jsx` uitgesplitst
- `src/constants/shotTypes.js` uitgesplitst
- `src/utils/` aangemaakt

**Nog te doen:**
App.jsx is nog steeds ~3500 regels. Volledige opsplitsing is zinvol zodra Fase 6 (AI) gestart wordt.

**Doelstructuur:**
```
src/
  components/team/    HomeView, ManagePlayersView
  components/match/   SetupMatchView, MatchView, MatchSummaryView, SharedMatchView
  components/stats/   StatisticsView, FormStrip, TrendChart, PlayerComparison
  components/ui/      ConfirmDialog, FeedbackToast, BottomNav, ShotTypeModal
  components/admin/   GodModeView
  hooks/              useTeam.js, useMatch.js
  App.jsx             (~100 regels, alleen router/shell)
```

---

## Fase 6: AI Trainingsadvies ✅ GEDAAN

**Wat gedaan:**
- `convex/ai.ts` (`"use node;"`) — Convex action die Anthropic Claude claude-3-5-haiku-20241022 aanroept
- `convex/aiQueries.ts` — aparte V8-runtime query voor `getAdvice` (queries kunnen niet in Node.js runtime)
- `convex/schema.ts` — `ai_advice` tabel toegevoegd met `by_team` index
- `AIAdviceCard` component in `src/App.jsx` — geïsoleerd met eigen `AIAdviceErrorBoundary`
- Zichtbaar bij ≥ 5 wedstrijden in de Statistieken-pagina
- Advies gecached in Convex; knop om te vernieuwen

**Vereiste (eenmalig):** `npx convex dev` draaien om `ai.ts`, `aiQueries.ts` en schema te deployen naar Convex cloud.

---

## Fase 7: Commercialisering ⏳ TODO

**Doel:** App verkopen via abonnementen.

**Voorgestelde tiers:**

| Tier | Prijs | Limieten |
|------|-------|----------|
| Gratis | €0 | 1 team, 1 gebruiker, 20 wedstrijden |
| Club | €4,99/mnd | 3 teams, 10 gebruikers/team, onbeperkt |
| Pro | €12,99/mnd | Onbeperkt + AI-advies + prioriteit |

**Technisch:** Stripe Checkout via Convex HTTP action, webhook handler, feature-gating in mutations.

---

## Huidige Status & Volgende Stap

```
✅ Fase 0 — Beveiliging
✅ Fase 1 — Clerk authenticatie
✅ Fase 2 — Multi-user teams
✅ Fase 3 — Kleurthema's per team
✅ Fase 4 — Statistieken
🔄 Fase 5 — Code-architectuur (gedeeltelijk)
✅ Fase 6 — AI Trainingsadvies
⏳ Fase 7 — Commercialisering  ← VOLGENDE
```

**Openstaande acties voor productie:**
- `npx convex dev` draaien (eenmalig) om AI-functies naar Convex cloud te deployen
- Clerk naar Production modus schakelen (verwijdert "Development mode" badge)
- PR #19 mergen

**Volgende stap:** Fase 7 — Commercialisering via Stripe
