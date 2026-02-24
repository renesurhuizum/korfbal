# Korfbal Professionalisering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** De korfbal score-app veilig, professioneel en uitbreidbaar maken conform de ROADMAP.md

**Architecture:** Iteratieve aanpak: eerst security (Fase 0), dan UX/thema's (Fase 3), dan server-side statistieken (Fase 4), dan architectuur-split (Fase 5). Fase 1/2 (email auth) en 6/7 (AI/Stripe) vereisen externe API-keys die handmatig geconfigureerd moeten worden.

**Tech Stack:** React 18, Vite, TailwindCSS, Convex, bcryptjs

---

## Scope van deze sessie

| Fase | Status | Reden |
|------|--------|-------|
| Fase 0: Security | ✅ Implementeren | Volledig lokaal |
| Fase 1: Email auth | ⚠️ Voorbereiding | Vereist Resend API key + @convex-dev/auth setup |
| Fase 2: Multi-user | ⚠️ Voorbereiding | Vereist Fase 1 |
| Fase 3: Kleurthema's | ✅ Implementeren | Volledig lokaal |
| Fase 4: Statistieken | ✅ Implementeren | Volledig lokaal |
| Fase 5: Architectuur | ✅ Implementeren | Volledig lokaal |
| Fase 6: AI advies | ⚠️ Voorbereiding | Vereist Anthropic/OpenAI key |
| Fase 7: Commercieel | ⚠️ Voorbereiding | Vereist Stripe setup |

---

## Iteratie 1: Fase 0 — Security Cleanup

### Task 1.1: bcryptjs installeren

**Files:**
- Modify: `package.json`
- Modify: `convex/auth.ts`

**Stap 1:** Installeer bcryptjs

```bash
cd /Users/renedeboer/korfbal/.claude/worktrees/angry-meninsky
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

**Stap 2:** Update `convex/auth.ts` — hash wachtwoorden bij registratie en verify bij login

**Stap 3:** Voeg migratiemutatie toe (`migratePasswords`) — zet bestaande plaintext wachtwoorden om naar bcrypt hashes

**Stap 4:** Commit

```bash
git add package.json package-lock.json convex/auth.ts
git commit -m "feat: hash passwords with bcryptjs, add migration mutation"
```

---

### Task 1.2: Admin credentials naar env var

**Files:**
- Modify: `convex/auth.ts`

**Stap 1:** Vervang hardcoded `"korfbal2026"` door `process.env.CONVEX_GOD_MODE_PASSWORD ?? "korfbal2026"` als fallback

**Stap 2:** Voeg `.env.local.example` toe met instructie

**Stap 3:** Commit

```bash
git add convex/auth.ts .env.local.example
git commit -m "feat: move admin password to CONVEX_GOD_MODE_PASSWORD env var"
```

---

### Task 1.3: Supabase verwijderen

**Files:**
- Modify: `package.json`
- Delete: `src/supabaseClient.js`

**Stap 1:** Verwijder `@supabase/supabase-js` uit package.json en run `npm uninstall @supabase/supabase-js`

**Stap 2:** Verwijder `src/supabaseClient.js`

**Stap 3:** Commit

```bash
git add package.json package-lock.json
git rm src/supabaseClient.js
git commit -m "chore: remove unused supabase dependency"
```

---

## Iteratie 2: Fase 3 — Kleurthema's

### Task 2.1: CSS Custom Properties voor thema's

**Files:**
- Modify: `src/index.css`
- Modify: `tailwind.config.js`

**Stap 1:** Voeg CSS variabelen toe aan `src/index.css`:

```css
:root { --color-primary: 220 38 38; --color-primary-dark: 185 28 28; }
[data-theme="orange"] { --color-primary: 234 88 12; --color-primary-dark: 194 65 12; }
[data-theme="blue"]   { --color-primary: 37 99 235; --color-primary-dark: 29 78 216; }
[data-theme="green"]  { --color-primary: 22 163 74; --color-primary-dark: 21 128 61; }
[data-theme="purple"] { --color-primary: 124 58 237; --color-primary-dark: 109 40 217; }
```

**Stap 2:** Update `tailwind.config.js` — voeg `primary` kleur toe:

```js
theme: {
  extend: {
    colors: {
      primary: {
        DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
        dark: 'rgb(var(--color-primary-dark) / <alpha-value>)',
      }
    }
  }
}
```

**Stap 3:** Vervang alle `bg-red-600`, `bg-red-700`, `text-red-600`, `border-red-` in App.jsx door `bg-primary`, `bg-primary-dark`, `text-primary`, `border-primary`

**Stap 4:** Commit

```bash
git add src/index.css tailwind.config.js src/App.jsx
git commit -m "feat: add CSS custom property theme system"
```

---

### Task 2.2: Thema-selector UI + persistentie

**Files:**
- Modify: `src/App.jsx`
- Modify: `convex/schema.ts` (optioneel: preferences veld aan teams)

**Stap 1:** Voeg `theme` state toe in App.jsx (geladen uit localStorage)

**Stap 2:** Implementeer `useEffect` die `document.documentElement.setAttribute('data-theme', theme)` aanroept bij thema-wissel

**Stap 3:** Voeg thema-selector toe aan instellingen/profiel view (5 kleuren: rood, oranje, blauw, groen, paars)

**Stap 4:** Sla thema op in localStorage bij wissel

**Stap 5:** Commit

```bash
git add src/App.jsx
git commit -m "feat: add theme selector with localStorage persistence"
```

---

## Iteratie 3: Fase 4 — Server-side Statistieken

### Task 3.1: convex/stats.ts aanmaken

**Files:**
- Create: `convex/stats.ts`

**Stap 1:** Maak `convex/stats.ts` met de volgende queries:

- `getTeamStats(teamId)` — totalen voor heel seizoen
- `getFormLastN(teamId, n)` — laatste N wedstrijden als W/D/V
- `getTrendByMonth(teamId)` — doelpunten per maand
- `getTopPlayers(teamId, limit)` — spelers gesorteerd op doelpunten
- `getOpponentStats(teamId)` — win% per tegenstander

**Stap 2:** Exporteer alle queries als Convex `query` met correcte validators

**Stap 3:** Commit

```bash
git add convex/stats.ts
git commit -m "feat: add server-side statistics queries in convex/stats.ts"
```

---

### Task 3.2: Statistieken UI uitbreiden

**Files:**
- Modify: `src/App.jsx` (StatisticsView sectie)

**Stap 1:** Voeg **Vorm-strip** toe: laatste 5 wedstrijden als gekleurde W/D/V stippen

**Stap 2:** Voeg **Tegenstander-tabel** toe: win% per tegenstander, gesorteerd

**Stap 3:** Voeg **Speler van de maand** toe: meeste doelpunten afgelopen 30 dagen

**Stap 4:** Voeg **SVG doelpunten timeline** toe: eenvoudige lijn-grafiek zonder externe library

**Stap 5:** Commit

```bash
git add src/App.jsx
git commit -m "feat: enhance StatisticsView with form strip, opponent table, player of month, timeline"
```

---

## Iteratie 4: Fase 5 — Architectuur Split (gedeeltelijk)

### Task 4.1: Utility functies en constants extraheren

**Files:**
- Create: `src/utils/exportCSV.js`
- Create: `src/utils/generatePlayerId.js`
- Create: `src/constants/shotTypes.js`
- Modify: `src/App.jsx`

**Stap 1:** Extraheer `SHOT_TYPES` constant naar `src/constants/shotTypes.js`

**Stap 2:** Extraheer `generatePlayerId()` naar `src/utils/generatePlayerId.js`

**Stap 3:** Extraheer CSV export logica naar `src/utils/exportCSV.js`

**Stap 4:** Update imports in App.jsx

**Stap 5:** Commit

```bash
git add src/constants/ src/utils/ src/App.jsx
git commit -m "refactor: extract constants and utilities from App.jsx"
```

---

### Task 4.2: Shared UI components extraheren

**Files:**
- Create: `src/components/ui/ConfirmDialog.jsx`
- Create: `src/components/ui/FeedbackToast.jsx`
- Create: `src/components/ui/BottomNav.jsx`
- Modify: `src/App.jsx`

**Stap 1:** Extraheer `ConfirmDialog` component naar `src/components/ui/ConfirmDialog.jsx`

**Stap 2:** Extraheer feedback toast naar `src/components/ui/FeedbackToast.jsx`

**Stap 3:** Extraheer `BottomNav` naar `src/components/ui/BottomNav.jsx`

**Stap 4:** Update imports in App.jsx

**Stap 5:** Commit

```bash
git add src/components/ src/App.jsx
git commit -m "refactor: extract shared UI components (ConfirmDialog, FeedbackToast, BottomNav)"
```

---

### Task 4.3: Auth views extraheren

**Files:**
- Create: `src/components/auth/LoginView.jsx`
- Create: `src/components/auth/RegisterView.jsx`
- Modify: `src/App.jsx`

**Stap 1:** Extraheer LoginView component

**Stap 2:** Extraheer RegisterView component

**Stap 3:** Update App.jsx routing

**Stap 4:** Commit

```bash
git add src/components/auth/ src/App.jsx
git commit -m "refactor: extract auth views to separate components"
```

---

## Iteratie 5: Verificatie & Build

### Task 5.1: Build verificatie

```bash
cd /Users/renedeboer/korfbal/.claude/worktrees/angry-meninsky
npx vite build
```

Verwacht: `✓ built in X.XXs` zonder errors.

### Task 5.2: Schema verificatie Convex

```bash
npx convex dev --run --until-success
```

### Task 5.3: Fase 1 voorbereiding (schema)

Voeg alvast de schema-uitbreidingen toe voor Fase 1 (users tabel, passwordResetTokens) zodat de database klaar is.

**Files:**
- Modify: `convex/schema.ts`

### Task 5.4: Final commit

```bash
git add .
git commit -m "feat: korfbal professionalisering fase 0, 3, 4, 5 geimplementeerd"
```

---

## Externe afhankelijkheden (handmatig te configureren)

Voor Fase 1 (email auth):
1. `npm install @convex-dev/auth resend`
2. Resend API key instellen: `npx convex env set AUTH_RESEND_KEY <key>`
3. `convex/auth.config.ts` aanmaken met provider config

Voor Fase 6 (AI advies):
1. Anthropic API key: `npx convex env set ANTHROPIC_API_KEY <key>`

Voor Fase 7 (Stripe):
1. `npm install stripe`
2. Stripe keys instellen in Convex env vars
