# Supabase naar Convex Migratie Guide

Deze guide leidt je door de volledige migratie van Supabase naar Convex.

## Stap 1: Installeer Node.js en npm

Als je npm nog niet hebt geïnstalleerd:

### Via Homebrew (aanbevolen voor Mac):
```bash
# Installeer Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Installeer Node.js (inclusief npm)
brew install node

# Verifieer installatie
node --version
npm --version
```

### Via officiële installer:
1. Ga naar https://nodejs.org/
2. Download de LTS versie
3. Installeer het .pkg bestand
4. Open een nieuwe terminal en check: `npm --version`

## Stap 2: Installeer Convex

```bash
cd /Users/renedeboer/korfbal
npm install convex
```

## Stap 3: Initialiseer Convex Project

```bash
npx convex dev
```

Dit opent je browser en vraagt je om:
1. In te loggen bij Convex (maak account als je dat nog niet hebt)
2. Een nieuw project aan te maken
3. Je krijgt automatisch een CONVEX_URL

**Belangrijk:** Kopieer de CONVEX_URL die je krijgt!

## Stap 4: Update Environment Variables

Voeg toe aan je `.env` bestand:

```env
# Nieuwe Convex URL (krijg je van npx convex dev)
VITE_CONVEX_URL=https://jouw-deployment.convex.cloud

# Behoud Supabase credentials (voor data export)
VITE_SUPABASE_URL=https://krsowwiwyburmsenwxwk.supabase.co
VITE_SUPABASE_ANON_KEY=jouw_anon_key_hier
```

## Stap 5: Data Migratie

### 5a. Export data van Supabase

```bash
node scripts/export-supabase.js
```

Dit maakt:
- `export/teams.json`
- `export/matches.json`

### 5b. Transform data

```bash
node scripts/transform-data.js
```

Dit maakt:
- `export/teams-transformed.json`
- `export/matches-transformed.json`

### 5c. Import data naar Convex

Zorg dat `npx convex dev` nog steeds draait, en run dan in een nieuwe terminal:

```bash
node scripts/import-convex.js
```

Dit importeert alle teams en wedstrijden naar Convex!

## Stap 6: Verificatie

Check in de Convex dashboard (http://dashboard.convex.dev):
- Ga naar je project
- Klik op "Data"
- Verificeer dat teams en matches correct zijn geïmporteerd
- Check aantal records klopt met Supabase

## Stap 7: Code Refactoring

Nu komt het grootste werk: App.jsx refactoren naar Convex.

De belangrijkste bestanden die ik nog moet aanpassen zijn:
- `src/App.jsx` - Volledige refactor (alle Supabase calls vervangen)
- `src/main.jsx` - ConvexProvider toevoegen
- `src/convexClient.js` - Nieuwe Convex client

Deze stap kan ik voor je doen zodra de data migratie succesvol is!

## Stap 8: Testing

Test alle functionaliteit:
- [ ] Login werkt
- [ ] Registratie werkt
- [ ] Spelers toevoegen/bewerken
- [ ] Wedstrijd opstarten
- [ ] Doelpunten registreren
- [ ] Wedstrijd afronden
- [ ] Wedstrijdgeschiedenis bekijken
- [ ] Statistieken kloppen
- [ ] God mode werkt

## Rollback Plan

Als er iets mis gaat:

```bash
# Ga terug naar Supabase versie
git checkout legacy/supabase

# Update .env naar Supabase
# Verwijder of comment VITE_CONVEX_URL
# Behoud VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY

npm run dev
```

## Troubleshooting

### "npm: command not found"
- Node.js is niet geïnstalleerd
- Volg Stap 1 opnieuw

### "Cannot find module 'convex'"
- Run: `npm install convex`

### "VITE_CONVEX_URL is not defined"
- Check je `.env` bestand
- Zorg dat VITE_CONVEX_URL correct is ingevuld

### Import script faalt
- Check of `npx convex dev` nog draait
- Verificeer VITE_CONVEX_URL in .env
- Check of transform script succesvol was

## Hulp Nodig?

Laat me weten bij welke stap je vastzit en ik help je verder!
