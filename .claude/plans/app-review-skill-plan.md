# Plan: App Review Skill - Senior Applicatieontwikkelaar

## Doel
Een herbruikbare Claude Code skill (slash command `/app-review`) die elke app analyseert
vanuit het perspectief van een senior mobile-first applicatieontwikkelaar.

---

## Wat de Skill moet doen

Bij aanroep (`/app-review`) doorloopt de skill **7 review-assen**:

### 1. Mobile UX Audit
- Touch targets (min 48x48px)
- Thumb zone placement (belangrijke acties bereikbaar met duim)
- Bottom sheets vs modals
- Swipe/gesture ondersteuning
- Safe area padding (iPhone notch, etc.)
- Sticky navigatie patronen

### 2. Accessibility Scan
- ARIA labels op icon-only knoppen
- Kleurcontrast (WCAG AA 4.5:1 ratio)
- Focus management (trap in modals, visible focus ring)
- Semantic HTML (tables, forms, headings)
- Screen reader compatibiliteit
- Minimale fontgrootte (14px+)

### 3. Performance UX
- Loading/skeleton states
- Optimistic updates
- Offline/PWA ondersteuning
- Perceived performance (animaties, transitions)
- Query watervallen detecteren
- Bundle size check

### 4. Moderne App Patronen
- Onboarding flow
- Empty states
- Error states + boundaries
- Bevestigingspatronen (geen browser confirm/alert/prompt)
- Toast/feedback positionering
- Dark mode ondersteuning

### 5. Data & Analytics Kansen
- Trends en grafieken
- Vergelijkingsviews
- Filters en zoekfunctionaliteit
- Export mogelijkheden
- Doelen en badges

### 6. Navigatie & Informatiearchitectuur
- Navigatiestructuur mapping
- Breadcrumbs en terug-navigatie
- Bottom nav / tab bar patronen
- Deep linking
- Consistentie header/footer per scherm

### 7. Micro-interacties & Polish
- Haptic feedback
- Button animaties (scale, ripple)
- Overgangsanimaties tussen schermen
- Succes/fout animaties
- Sound design mogelijkheden

---

## Skill Structuur

```
.claude/skills/app-review.md    <- De hoofdskill (slash command)
```

### Hoe de skill werkt:

1. **Codebase scannen** - Automatisch alle frontend bestanden vinden en lezen
2. **Per review-as analyseren** - Elk van de 7 assen doorlopen
3. **Bevindingen rapporteren** - Gestructureerd rapport met:
   - Prioriteit (Kritiek / Hoog / Medium / Laag)
   - Impact (UX / Performance / Accessibility / Revenue)
   - Geschatte effort (Quick Win / Medium / High)
   - Concrete code-suggesties
4. **Actieplan genereren** - Gefaseerd implementatieplan (Sprint 1/2/3)

---

## Benodigde informatie voor de Skill

### Vastgelegd in de skill zelf:
- [ ] Review-assen met checklijsten per categorie
- [ ] Best practices database (WCAG, Apple HIG, Material Design)
- [ ] Minimale standaarden (touch targets, contrast ratios, font sizes)
- [ ] Output template (hoe het rapport eruit moet zien)
- [ ] Prioriteringsframework (hoe bugs/features te ordenen)

### Dynamisch bepaald per project:
- [ ] Framework detectie (React, Vue, Svelte, etc.)
- [ ] Bestanden structuur (components, pages, routes)
- [ ] Bestaande navigatie flow
- [ ] Huidige state management
- [ ] Styling aanpak (Tailwind, CSS modules, etc.)

---

## Output Format van de Skill

Het rapport moet de volgende secties bevatten:

```markdown
# App Review Rapport - [App Naam]

## Samenvatting
- Overall score: X/10
- Kritieke issues: N
- Verbeterkansen: N

## Per Review-As
### [As Naam] - Score X/10
| Issue | Prioriteit | Impact | Effort | Locatie |
|-------|-----------|--------|--------|---------|
| ...   | Kritiek   | UX     | 1u     | file:ln |

## Top 10 Quick Wins
1. ...

## Gefaseerd Actieplan
### Sprint 1 (Quick Wins - 1 week)
### Sprint 2 (High Value - 2 weken)
### Sprint 3 (Polish - 3 weken)

## Feature Suggesties
### Nieuwe Features (gesorteerd op waarde)
```

---

## Implementatiestappen

### Stap 1: Skill bestand aanmaken
- `.claude/skills/app-review.md` schrijven met volledige instructieset
- Review-assen als gedetailleerde checklijsten
- Output template defini ren

### Stap 2: Checklijsten uitwerken
- Per review-as 15-25 concrete checkpunten
- Met referentie naar standaarden (WCAG, Apple HIG 48px, etc.)
- Met code-patronen om naar te zoeken (grep patterns)

### Stap 3: Testen op huidige app
- Skill uitvoeren op de Korfbal app
- Rapport genereren
- Valideren dat alle bevindingen kloppen

### Stap 4: Itereren
- Missende patronen toevoegen
- False positives verwijderen
- Output format verfijnen
