# Korfbal Score App — Professionalisering Roadmap

## Context
De app is een volledig functionele korfbal score-tracker (React 18 + Vite + Convex, ~2862 regels in één App.jsx). Doel: de app commercieel klaar maken met email-authenticatie, meerdere gebruikers per team, kleurthema's, betere statistieken en uiteindelijk AI-trainingsadvies.

Huidige tekortkomingen die eerst opgelost moeten worden:
- Wachtwoorden opgeslagen als **plain text** (veld heet `password_hash` maar is niet gehashed)
- Admin-credentials hardcoded in code (`ADMIN / korfbal2026`)
- Geen individuele gebruikers — auth werkt op teamniveau
- `@supabase/supabase-js` geïnstalleerd maar nergens gebruikt
- Geen autorisatiechecks op Convex mutations (iedereen met een `teamId` kan data wijzigen)

---

## Fase 0: Opruimen & Beveiliging (1–2 dagen)
**Doel:** Veilige basis voordat auth wordt herbouwd.

**Wijzigingen:**
- `convex/auth.ts` — wachtwoorden hashen met `bcryptjs`; eenmalige migratiemutatie voor bestaande teams
- `convex/auth.ts` — admin-credentials naar Convex environment variable (`CONVEX_GOD_MODE_PASSWORD`)
- `package.json` — `@supabase/supabase-js` verwijderen
- `src/supabaseClient.js` — bestand verwijderen

**Bestanden:** `convex/auth.ts`, `convex/schema.ts`, `package.json`, `src/supabaseClient.js`

---

## Fase 1: Email-authenticatie (3–5 dagen)
**Doel:** Persoonlijke logins met email + wachtwoord, inclusief wachtwoord vergeten flow.

**Nieuwe dependencies:**
- `@convex-dev/auth` — Convex Auth framework (JWT, sessies, providers)
- `resend` — email service (gratis: 3000 emails/maand, officieel Convex-partner)

**Schema wijzigingen (`convex/schema.ts`):**
```typescript
users: defineTable({
  email: v.string(),
  emailVerified: v.optional(v.boolean()),
  name: v.optional(v.string()),
}).index("by_email", ["email"]),

passwordResetTokens: defineTable({
  userId: v.id("users"),
  token: v.string(),
  expiresAt: v.number(),
  used: v.boolean(),
}).index("by_token", ["token"]),
```
Ook `migrated: v.optional(v.boolean())` toevoegen aan `teams`.

**Nieuwe bestanden:**
- `convex/auth.config.ts` — provider configuratie
- `convex/http.ts` — email verificatie callbacks
- `convex/resend.ts` — email verzending (wachtwoord reset, welkomstmail)

**Migratie bestaande teams:**
Nieuwe `claimTeam` mutatie: gebruiker logt in met nieuw account, voert oud teamnaam + oud wachtwoord in → team wordt gekoppeld aan hun account. Bestaande wedstrijden blijven intact (match verwijst naar `team._id`, stabiele Convex ID).

**Wijzigingen `src/App.jsx`:**
- `ConvexProvider` → `ConvexAuthProvider` in `main.jsx`
- Handmatige localStorage sessie-logica vervangen door `useConvexAuth()` en `useAuthActions()`
- LoginView vervangen: email + wachtwoord formulier, "wachtwoord vergeten" link, optionele "claim bestaand team" stap

**Bestanden:** `src/main.jsx`, `src/App.jsx`, `convex/schema.ts`, `convex/auth.ts`, `convex/auth.config.ts`, `convex/http.ts`, `convex/resend.ts`

---

## Fase 2: Multi-user Teams (2–3 dagen)
**Doel:** Meerdere personen (eigen email) kunnen inloggen op hetzelfde team.

**Schema wijzigingen:**
```typescript
team_members: defineTable({
  teamId: v.id("teams"),
  userId: v.id("users"),
  role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
  joinedAt: v.number(),
}).index("by_team", ["teamId"])
  .index("by_user", ["userId"])
  .index("by_team_and_user", ["teamId", "userId"]),

team_invites: defineTable({
  teamId: v.id("teams"),
  token: v.string(),
  createdBy: v.id("users"),
  expiresAt: v.number(),
  usedCount: v.number(),
}).index("by_token", ["token"]),
```

**Rollen:**
- `admin` — uitnodigen, teamnaam wijzigen, wedstrijden verwijderen
- `member` — wedstrijden bijhouden, spelers beheren
- `viewer` — alleen lezen (bijv. ouder, coach)

**Uitnodiging via deelbare link** (eenvoudiger dan email-invites): admin genereert token → link → nieuwe gebruiker klikt en wordt lid.

**Auth guards toevoegen** aan alle Convex mutations in `teams.ts` en `matches.ts` (nu compleet onbeveiligd).

**Bestanden:** `convex/schema.ts`, `convex/teams.ts`, `convex/matches.ts`, `src/App.jsx`

---

## Fase 3: Persoonlijke Instellingen & Kleurthema's (1–2 dagen)
**Doel:** Gebruikers kiezen hun kleurschema, opgeslagen per account.

**Aanpak (CSS custom properties + Tailwind):**
```css
/* src/index.css */
:root { --color-primary: 220 38 38; }         /* Rood (standaard) */
[data-theme="orange"] { --color-primary: 234 88 12; }
[data-theme="blue"]   { --color-primary: 37 99 235; }
[data-theme="green"]  { --color-primary: 22 163 74; }
```
```js
// tailwind.config.js
colors: { primary: 'rgb(var(--color-primary) / <alpha-value>)' }
```
Alle `bg-red-600` → `bg-primary` in App.jsx (mechanische vervanging).

**Schema toevoeging aan `users`:**
```typescript
preferences: v.optional(v.object({
  theme: v.optional(v.string()),    // "red" | "orange" | "blue" | "green"
  language: v.optional(v.string()), // toekomst: "nl" | "en"
})),
```

**Nieuwe Convex mutatie:** `updateUserPreferences` in nieuwe `convex/users.ts`.

**Bestanden:** `src/index.css`, `tailwind.config.js`, `convex/schema.ts`, `convex/users.ts`, `src/App.jsx`

---

## Fase 4: Statistieken Verbeteringen (3–4 dagen)
**Doel:** Rijkere analytics, meer inzicht in prestaties.

**Server-side aggregatie** in nieuwe `convex/stats.ts` (nu alles client-side in `useMemo`):
- `getTeamStats` — samenvatting voor hele seizoen
- `getFormLastN` — resultaten laatste N wedstrijden
- `getTrendByMonth` — doelpunten/percentage per maand
- `getPlayerCareerStats` — carrière per speler

**Nieuwe UI-secties in StatisticsView:**
- **Vorm-strip**: laatste 5 wedstrijden als W/D/V gekleurde stippen
- **Tegenstander-tabel**: win% per tegenstander gesorteerd
- **Schot-type trend**: verbetering vergeleken met 10 wedstrijden geleden
- **Speler van de maand**: meeste doelpunten afgelopen 30 dagen
- **Doelpunten timeline**: simpele SVG grafiek zonder externe library

**Bestanden:** `convex/stats.ts` (nieuw), `src/App.jsx`

---

## Fase 5: Code-architectuur Opsplitsen (4–7 dagen)
**Doel:** App.jsx (2862 regels) opsplitsen in beheerbare componenten voor verdere ontwikkeling.

**Doelstructuur:**
```
src/
  components/auth/    LoginView, RegisterView, ForgotPasswordView, ClaimTeamView
  components/team/    HomeView, ManagePlayersView, TeamSettingsView
  components/match/   SetupMatchView, MatchView, MatchSummaryView, SharedMatchView
  components/stats/   StatisticsView, FormStrip, TrendChart, PlayerComparison
  components/ui/      ConfirmDialog, FeedbackToast, BottomNav, ShotTypeModal
  components/admin/   GodModeView
  hooks/              useAuth.js, useTeam.js, useMatch.js
  contexts/           AppContext.jsx (currentUser, darkMode, showFeedback)
  utils/              exportCSV.js, generatePlayerId.js
  constants/          shotTypes.js
  App.jsx             (~100 regels, alleen router/shell)
```

> **Let op:** Dit pas doen nadat Fase 3–4 stabiel zijn. De closure-gebaseerde state-sharing in de huidige monoliet is fragiel om te refactoren terwijl er nog features worden toegevoegd.

---

## Fase 6: AI Trainingsadvies (5–10 dagen)
**Doel:** Gepersonaliseerde trainingsaanbevelingen op basis van wedstrijddata.

**Convex action** (`convex/ai.ts`) — roept externe AI API aan (Anthropic Claude of OpenAI):
1. Haalt laatste 10+ wedstrijden op via `ctx.runQuery`
2. Bouwt gestructureerde prompt met statistieken (schot%, verbeterpunten, spelersvorm)
3. Genereert advies in het Nederlands
4. Slaat op in `ai_advice` tabel met 7-daags TTL

**Schema:**
```typescript
ai_advice: defineTable({
  teamId: v.id("teams"),
  advice: v.string(),
  generatedAt: v.number(),
  basedOnMatchCount: v.number(),
}).index("by_team", ["teamId"]),
```

**Vereiste:** Minimaal ~5 wedstrijden voor zinvol advies.

**Bestanden:** `convex/schema.ts`, `convex/ai.ts` (nieuw), `src/components/stats/TrainingAdvice.jsx` (nieuw)

---

## Fase 7: Commercialisering (doorlopend)
**Doel:** App verkopen via abonnementen.

**Voorgestelde tiers:**

| Tier | Prijs | Limieten |
|------|-------|----------|
| Gratis | €0 | 1 team, 1 gebruiker, 20 wedstrijden |
| Club | €4,99/mnd | 3 teams, 10 gebruikers/team, onbeperkt |
| Pro | €12,99/mnd | Onbeperkt + AI-advies + prioriteit |

**Technisch:** Stripe Checkout via Convex HTTP action, webhook handler, feature-gating in mutations.

---

## Volgorde & Afhankelijkheden

```
Fase 0 → Fase 1 → Fase 2 → Fase 3   (strikte keten)
                            Fase 4    (kan parallel aan Fase 3)
                  Fase 5              (na Fase 4)
                  Fase 6              (na Fase 4, vereist goede stats)
         Fase 7                       (na Fase 1, vereist gebruikersaccounts)
```

**Kritieke bestanden die elke fase raakt:**
- `convex/schema.ts` — uitbreidingen in elke fase
- `src/App.jsx` — tot Fase 5 de centrale plek voor alle UI
- `convex/auth.ts` — volledig herschrijven in Fase 1
- `convex/teams.ts` + `convex/matches.ts` — auth guards in Fase 2

---

## Verificatie per Fase

- **Fase 0:** Bestaande login werkt nog; wachtwoorden in DB zijn nu bcrypt hashes
- **Fase 1:** Nieuw account aanmaken met email; wachtwoord reset email ontvangen; bestaand team claimen
- **Fase 2:** Twee accounts inloggen op hetzelfde team, beide zien dezelfde data
- **Fase 3:** Thema wisselen in instellingen → kleur verandert direct en blijft na herstart
- **Fase 4:** StatisticsView toont nieuwe secties; data klopt met wedstrijdhistorie
- **Fase 5:** Alle views werken, geen regressies (handmatige check per view)
- **Fase 6:** AI-advies verschijnt na 5+ wedstrijden; regenereert na 7 dagen
