---
status: archived
version: 1.0
last-reviewed: 2026-07-08
next-review-date: 2027-01-08
owner: Frontend Platform
date_created: 2026-06-28
title: Form Lock on Click Implementation
type: feature-plan
tags: [frontend, form-lock, ux, tool-page, archived]
goal: Implement immediate form locking on primary CTA click to prevent UI delay during extraction phase
---

# Form Lock on Click — isFormLocked

## Problem
Il form (CTA primario, campi input, upload) va in `disabled` solo quando la macchina XState conferma lo stato `generating`. C'è un ritardo visibile tra il click su "Avvia generazione" e la disabilitazione, specialmente durante l'estrazione (dove la macchina è ancora in `configuring`).

## Target Behavior

| Fase | CTA Primario | Form fields | Upload files | Annulla |
|------|:---:|:---:|:---:|:---:|
| **Draft** | "Avvia generazione" ✅ | ✅ | ✅ proj-dip | ❌ nascosto |
| **Al click** | 🔒 disabilitato | 🔒 | 🔒 | ✅ visibile |
| **Estrazione** | 🔒 | 🔒 | 🔒 | ✅ visibile |
| **Generazione** | 🔒 | 🔒 | 🔒 | ✅ visibile |
| **Completato** | "Apri sessione" ✅ | ✅ | ✅ | ❌ nascosto |

## Solution

### 1. Stato locale `isFormLocked`
`apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`

Aggiungere `useState<boolean>(false)` con nome `isFormLocked`.

### 2. Chain logica

```
click → isFormLocked = true (optimistic lock)
     → executePrimaryActionFromForm() → extraction parte o dispatch diretto
     → React re-render: isFormBusy = true
     → useEffect: isFormLocked = false (sostituito da isFormBusy)
     → isFormBusy = false (completamento/cancel) → form sbloccato
```

### 3. Variabili chiave

```typescript
const isFormBusy = isExtractionInProgress || isGenerating || generationStream.isStreamActive;
const isGenerationLocked = isFormLocked || isFormBusy;  // ← renamed semantic
```

### 4. Annulla visibile durante extraction

Cambiare condizione da `isGenerating` a `isFormLocked || isFormBusy`.

### 5. Cancel handler

- Resetta `isFormLocked = false`
- Se in extraction: cancella `briefingUploadMachine`
- Se in generazione: già funzionante via `CANCEL_GENERATION`

## Files
- `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` — lock + annulla + click handler
- `apps/frontend/src/features/tools/ui/ToolPageTemplate.test.tsx` — test nuovi
- `apps/frontend/src/features/tools/runtime/useToolPage.ts` — cancel durante extraction
