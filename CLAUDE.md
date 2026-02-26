# Korfbal Score App

## Project Info
- **Framework**: React 18 + Vite
- **Styling**: TailwindCSS
- **Backend**: Convex (real-time) — deployment: `dev:first-monitor-823` (team: renedeboer97)
- **Auth**: Clerk (email + Google) — nog in Development mode
- **Taal**: Nederlands (UI), Engels (code)

## Commands
- `npm run dev` - Start development server
- `npx vite build` - Production build
- `npx convex dev` - Start Convex backend én deploy functies naar cloud (NIET via Vercel)
- `npm run deploy:convex` - Eenmalig deployen zonder watch-modus

## Project Structure
- `src/App.jsx` - Volledige frontend (~3500 regels, single-file SPA)
- `convex/schema.ts` - Database schema
- `convex/auth.ts` - Login/register mutations
- `convex/teams.ts` - Team queries/mutations
- `convex/matches.ts` - Match queries/mutations
- `convex/memberships.ts` - Multi-user team logica
- `convex/stats.ts` - Server-side statistieken
- `convex/ai.ts` - AI trainingsadvies (Anthropic, `"use node;"`)
- `convex/aiQueries.ts` - getAdvice query (aparte file, GEEN `"use node;"`)
- `convex/_generated/api.d.ts` - Gecheckt in git; handmatig bijwerken of via `npx convex dev`

## Convex Gotchas
- `"use node;"` bestanden kunnen GEEN queries bevatten — queries in aparte V8-runtime file zetten
- Convex wordt NIET automatisch deployed via Vercel — altijd `npx convex dev` draaien na schema/functie wijzigingen
- `useQuery` throws bij server error → crasht hele app; altijd eigen ErrorBoundary om Convex queries wikkelen
- `_generated/api.d.ts` bijwerken als nieuwe modules worden toegevoegd (voeg imports + types toe aan fullApi)

## Service Worker
- `public/sw.js` gebruikt cache-first strategie; `CACHE_NAME` (nu `korfbal-v3`) bumpen na elke deploy met JS-wijzigingen
- Anders zien browsers de nieuwe build niet

## Deployment
- **Vercel**: automatisch bij push naar `main` — bouwt alleen frontend
- **Convex**: handmatig via `npx convex dev` (of `npm run deploy:convex`)
- **Clerk**: staat in Development mode; switch via dashboard.clerk.com → Production voor live gebruik

## Skills
- `/app-review` - Voer een volledige app review uit als senior applicatieontwikkelaar
