# Tech Stack — Korfbal Score App

## Frontend

| Onderdeel | Technologie | Versie | Rol |
|-----------|-------------|--------|-----|
| Framework | React | 18.2 | UI-rendering |
| Build tool | Vite | 5.0 | Bundler, dev server |
| Styling | TailwindCSS | 3.4 | Utility-first CSS |
| Iconen | Lucide React | 0.263 | SVG-iconen |
| PWA | Service Worker | — | Offline cache (`public/sw.js`) |

## Backend

| Onderdeel | Technologie | Versie | Rol |
|-----------|-------------|--------|-----|
| Database + realtime | Convex | 1.31 | Queries, mutations, actions, real-time sync |
| AI | Anthropic SDK | 0.78 | Claude claude-3-5-haiku-20241022 voor trainingsadvies |

## Authenticatie

| Onderdeel | Technologie | Versie | Rol |
|-----------|-------------|--------|-----|
| Auth provider | Clerk | 5.61 | Email + Google login, JWT |
| Integratie | ConvexProviderWithClerk | — | Koppelt Clerk JWT aan Convex |

## Hosting & Deployment

| Onderdeel | Platform | Trigger |
|-----------|----------|---------|
| Frontend | Vercel | Automatisch bij push naar `main` |
| Backend (Convex) | Convex Cloud | Handmatig via `npx convex dev` |
| Auth | Clerk Cloud | — |
| AI API | Anthropic API | Via Convex action op aanvraag |

## Development

| Tool | Doel |
|------|------|
| TypeScript (Convex) | Types voor backend-functies |
| PostCSS + Autoprefixer | CSS-verwerking |
| Git worktrees | Feature branches geïsoleerd van main |

## Convex Deployment Info

- **Project**: `korfbal-app`
- **Team**: `renedeboer97`
- **Deployment**: `dev:first-monitor-823`
- **URL**: `https://first-monitor-823.convex.cloud`

## Omgevingsvariabelen

| Variabele | Locatie | Doel |
|-----------|---------|------|
| `VITE_CONVEX_URL` | `.env.local` + Vercel | Convex cloud URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | `.env.local` + Vercel | Clerk frontend key |
| `CLERK_SECRET_KEY` | Convex env | Clerk backend key |
| `ANTHROPIC_API_KEY` | Convex env | Anthropic API toegang |
| `CONVEX_GOD_MODE_PASSWORD` | Convex env | Admin toegang (bcrypt) |

## Architectuur-overzicht

```
Browser (React + Clerk)
    │
    ├── Clerk CDN          → Authenticatie (JWT)
    │
    ├── Convex Cloud       → Real-time database + functies
    │       ├── V8 runtime  → queries, mutations (schema-validatie)
    │       └── Node.js runtime ("use node;")
    │               └── ai.ts → Anthropic API aanroepen
    │
    └── Vercel             → Statische hosting (HTML/JS/CSS)
```

## Toekomstig (Fase 7)

| Onderdeel | Technologie | Doel |
|-----------|-------------|------|
| Betalingen | Stripe | Abonnementen (Gratis / Club / Pro) |
| Webhooks | Convex HTTP action | Stripe events verwerken |
