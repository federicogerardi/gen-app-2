---
date_created: 2026-04-25
date_updated: 2026-04-25
status: Draft
title: Tool Frontend Unification & Scalability Plan
version: 1.0
tags: [refactoring, tool-architecture, scalability, ux-flow]
---

# Tool Frontend Unification & Scalability Plan

## Executive Summary

Attualmente il codice frontend dei tool di generazione (HotLeadFunnel e NextLand) contiene **~95% duplicazione**. Questo documento propone una refactorizzazione strutturata per unificare la gestione del flusso UX, ridurre l'effort per aggiungere nuovi tool, e allineare l'implementazione alle specifiche di `tool-generation-structural-ux-flow-spec.md`.

**Outcome atteso**: Aggiungere un nuovo tool sarà possibile con sola configurazione (registry) + una pagina wrapper minimalista, senza duplicare logica di form, stato, o UI.

---

## 1. Current State

### 1.1 Architettura Attuale

```
frontend/src/features/tools/
├── funnel-pages/pages/
│   ├── FunnelPagesToolPage.tsx          (~350 righe, state management inline)
│   └── FunnelPagesToolPage.refactored.example.tsx
├── nextland/pages/
│   └── NextlandToolPage.tsx             (~350 righe, identico a FunnelPages)
├── machines/
│   └── tool-flow.machine.ts             (XState machine per step order)
└── runtime/
    ├── tool-form-architecture.ts        (toolFormRegistry, ToolFormConfig)
    ├── tool-generation-engine.ts        (createStepRequest, stepDependencies)
    ├── tools-client.ts                  (uploadBrief, runExtraction)
    └── useToolForm.ts                   (hook estratti: useProjectsLoader, useBriefingUpload)
```

### 1.2 Duplicazione Rilevata

| Aspetto | FunnelPages | NextLand | Status |
|---------|-------------|----------|--------|
| State management | 12 useState | 12 useState | 100% duplicato |
| useEffect projects | Identico | Identico | 100% duplicato |
| processBriefing | Identico | Identico | 100% duplicato |
| runNextStep | Identico | Identico | 100% duplicato |
| Render form | Identico | Identico | 100% duplicato |
| Tool-specific config | `toolKey='funnel-pages'` | `toolKey='nextland'` | Parameterizable |
| Step list | `['optin','quiz','vsl']` | `['landing','thank_you']` | In registry ✅ |

### 1.3 Infrastruttura Già Disponibile

1. **tool-ux-state.ts** (già completato!)
   - `CanonicalToolUiState` type: 'draft-empty' | 'processing-briefing' | 'draft-ready' | 'prefilled-regenerate' | 'paused-with-checkpoint' | 'resume-needs-briefing' | 'running' | 'completed'
   - `deriveCanonicalToolUiState()` - Deriva stato canonico da input
   - `derivePrimaryActionPolicy()` - Mappa stato → CTA primaria
   - **NON USATO NELLE TOOL PAGE** ❌

2. **tool-form-architecture.ts** (parzialmente utilizzato)
   - `toolFormRegistry` con config dichiarativa
   - `ToolFormConfig` type
   - `getToolFormConfig(toolKey)` - Recupera config per tool
   - **NON USATO NELLE TOOL PAGE** ❌

3. **useToolForm.ts** (parzialmente estratto)
   - `useProjectsLoader()` - Hook riusabile ✅
   - `useBriefingUpload()` - Hook riusabile ✅
   - **NON IMPORTATO NELLE TOOL PAGE** ❌

### 1.4 Gap vs Spec

Lo spec `tool-generation-structural-ux-flow-spec.md` richiede:
- ✅ Stato canonico (richiede mapping tool-specific) → **tool-ux-state.ts esiste**
- ❌ Card di feedback globale univoca (FunnelStatusQuick, NextLandStatusQuick duplicate)
- ❌ Card per singolo step generica
- ❌ Pulsanti dinamici (CTA primaria + secondarie reattive)
- ❌ Retry notice, resume notice, error handling contestuale

---

## 2. Target State

### 2.1 Architettura Proposta

```
frontend/src/features/tools/
├── funnel-pages/pages/
│   └── FunnelPagesToolPage.tsx          (~50 righe, wrapper solo)
├── nextland/pages/
│   └── NextlandToolPage.tsx             (~50 righe, wrapper solo)
├── [new-tool]/pages/
│   └── NewToolPage.tsx                  (~50 righe, same pattern)
├── machines/
│   └── tool-flow.machine.ts             (unchanged)
├── ui/
│   ├── ToolPageTemplate.tsx             (NEW: orchestration + layout ~150 righe)
│   ├── ToolStatusCard.tsx               (NEW: feedback globale ~80 righe)
│   ├── ToolStepCard.tsx                 (NEW: singolo step + preview ~120 righe)
│   └── ToolActionButtons.tsx            (NEW: CTA dinamici ~100 righe)
└── runtime/
    ├── tool-form-architecture.ts        (enhanced + mapping UI state)
    ├── tool-generation-engine.ts        (unchanged)
    ├── tools-client.ts                  (unchanged)
    └── useToolForm.ts                   (completed: 3 hook estratti)
```

### 2.2 Workflow Unificato

```
ToolPageTemplate {
  useToolForm(toolKey) 
    → useProjectsLoader(), useBriefingUpload(), useAvailableSteps()
  
  deriveCanonicalToolUiState(input)
    → one of: draft-empty | processing-briefing | draft-ready | ...
  
  derivePrimaryActionPolicy(state)
    → start-generation | resume-checkpoint | open-last-artifact | disabled
  
  Render:
    - ToolStatusCard(state) → mostra readiness + messaggi
    - form fields (project, model, tone, notes, file upload)
    - ToolStepCard[] per ogni step (preview + progress)
    - ToolActionButtons(state, intent) → CTA adattive
}
```

### 2.3 Aggiungere Tool Nuovo: Effort

**Prima (stato attuale)**:
1. Duplicare FunnelPagesToolPage.tsx → copX
2. Cercare tutti i riferimenti 'funnel-pages' e sostituire
3. Personalizzare step list, prompts, labels
4. ~5-10 ore di lavoro

**Dopo (target state)**:
1. Aggiungere entry in `toolFormRegistry` in tool-form-architecture.ts:
   ```typescript
   'my-tool': {
     toolKey: 'my-tool',
     displayName: 'My Tool',
     defaultPrompt: 'Generated via ...',
     defaultModel: 'openrouter/auto',
     steps: ['step1', 'step2'] as const,
     stepDependencies: { step1: [], step2: ['step1'] },
     defaults: { registrySnapshotRef: 'snapshot:default' },
   }
   ```
2. Creare pagina wrapper `MyToolPage.tsx`:
   ```typescript
   export const MyToolPage = () => <ToolPageTemplate toolKey="my-tool" />
   ```
3. Aggiungere route in app-router.tsx
4. Aggiungere copy entries in appCopy.editorial.tools.myTool
5. ~30 minuti di lavoro ✅

---

## 3. Affected Files

### 3.1 Matrice Dipendenze

| File | Change Type | Dependencies | Blocks |
|------|-------------|--------------|--------|
| `tool-form-architecture.ts` | modify | — | ToolPageTemplate, tool pages |
| `tool-ux-state.ts` | modify | getToolFormConfig | ToolPageTemplate |
| `useToolForm.ts` | complete | useAuthSession, useGeneration | ToolPageTemplate |
| `ToolPageTemplate.tsx` | create | useToolForm, tool-ux-state | all tool pages |
| `ToolStatusCard.tsx` | create | appCopy, uiPrimitives | ToolPageTemplate |
| `ToolStepCard.tsx` | create | appCopy, uiPrimitives | ToolPageTemplate |
| `ToolActionButtons.tsx` | create | ToolPageTemplate | ToolPageTemplate |
| `FunnelPagesToolPage.tsx` | modify | ToolPageTemplate | — |
| `NextlandToolPage.tsx` | modify | ToolPageTemplate | — |
| `app-router.tsx` | modify | page imports | — |
| `appCopy` (system.ts) | enhance | — | all components |

---

## 4. Execution Plan

### Phase 1: Types & Architecture (30 min)

- [ ] 1.1 Estendere `ToolFormState` e `ToolFormSubmitData` in tool-form-architecture.ts
  - Aggiungere field `canonicalUiState` e `primaryActionPolicy`
  - Aggiungere mapping `toolStepConfig` (labels, descriptions per step)
  - Verify: tsc --noEmit, no errors

- [ ] 1.2 Estendere `ToolUiDerivationInput` in tool-ux-state.ts
  - Aggiungere `toolConfig: ToolFormConfig` per derivare labels step
  - Aggiungere `secondaryActionFlags` per mapping CTA secondarie
  - Verify: tsc --noEmit, no errors

- [ ] 1.3 Aggiungere type `ToolStepCardProps`, `ToolStatusCardProps`, `ToolPageTemplateProps` in primitives
  - Verify: tsc --noEmit

### Phase 2: Runtime Hooks (45 min)

- [ ] 2.1 Completare `useToolForm` hook in runtime/useToolForm.ts
  - Aggiungere `useBriefingUpload` completo
  - Aggiungere `useAvailableSteps` (memoized steps filtrati)
  - Aggiungere `useToolUiState` (derivazione canonico + policy)
  - Verify: tsc --noEmit, review logica

- [ ] 2.2 Creare utility `mapToolStepToCardConfig` in tool-form-architecture.ts
  - Estrae description, expectedOutputFormat per step
  - Usata da ToolStepCard per render
  - Verify: tsc --noEmit

- [ ] 2.3 Aggiungere fallback text in appCopy per state generico
  - appCopy.ui.states.processingBriefing
  - appCopy.ui.states.draftEmpty
  - appCopy.ui.states.running
  - appCopy.ui.states.completed
  - Verify: grepped in all components

### Phase 3: UI Components (2-3 ore)

#### 3.1 ToolStatusCard.tsx (~80 righe)
- [ ] Visualizza checklist globale (4 item)
- [ ] Badge stato per ciascun item (todo | active | done | error)
- [ ] Slot per retryNotice e resumeNotice
- [ ] Condizionale su CanonicalToolUiState input
- Verify: npm run build, no CSS errors

#### 3.2 ToolStepCard.tsx (~120 righe)
- [ ] Title step da toolConfig
- [ ] Badge stato (idle | running | done | error)
- [ ] Descrizione step (tooltip o collapsible)
- [ ] Preview area (scroll, dinamico su streaming)
- [ ] CTA "Apri artefatto" quando artifactId presente
- [ ] Map step status to color/icon
- Verify: build, visual review

#### 3.3 ToolActionButtons.tsx (~100 righe)
- [ ] CTA primaria derivata da primaryActionPolicy + state
  - disabled → bottone disabilitato
  - start-generation → onclick runNextStep
  - resume-checkpoint → onclick resumeCheckpoint
  - open-last-artifact → navigate to artifact
- [ ] Array CTA secondarie basate su intent + state
  - map secondaryActionEligibility() per decidere visibilità
  - onClick handlers per ciascuno
- [ ] Tooltips e disabled states
- Verify: build, props interface complete

#### 3.4 ToolPageTemplate.tsx (~150 righe)
- [ ] Props: toolKey, sourceArtifactId (optional), intent (optional)
- [ ] useToolForm hook con toolKey
- [ ] useToolUiState derivation
- [ ] Layout:
  ```jsx
  <Surface>
    <ToolStatusCard state={state} />
    <form>
      <ProjectSelector />
      <ModelSelector />
      <ToneSelector optional />
      <NotesInput optional />
      <BriefingUpload />
    </form>
    <ToolStepCard[] />
    <ToolActionButtons />
  </Surface>
  ```
- [ ] Query params resolution (sourceArtifactId + intent → recovery)
- [ ] Stream status sync
- Verify: build, basic interaction test

### Phase 4: Page Wrapper Refactor (45 min)

- [ ] 4.1 Semplificare FunnelPagesToolPage.tsx
  ```typescript
  export const FunnelPagesToolPage = () => (
    <ToolPageTemplate toolKey="funnel-pages" />
  )
  ```
  - Rimuovere tutta la logica duplicata
  - Import solo ToolPageTemplate
  - Verify: build

- [ ] 4.2 Semplificare NextlandToolPage.tsx (identico)
  - Verify: build

- [ ] 4.3 Aggiornare router imports se necessario
  - Verify: npm run build

### Phase 5: Copy System & Editorial (30 min)

- [ ] 5.1 Verificare appCopy coperto
  - appCopy.editorial.tools.funnelPages → usato da template
  - appCopy.editorial.tools.nextland → usato da template
  - Aggiungere labels per step descriptions (optin, quiz, vsl, landing, thank_you, ecc.)
  - Verify: grep "appCopy.editorial.tools" in ToolPageTemplate

- [ ] 5.2 Aggiungere UI state labels in appCopy.ui.states
  - processingBriefing, draftReady, draftEmpty, running, completed
  - Verify: ToolStatusCard uses them

### Phase 6: Testing & Validation (1 ora)

- [ ] 6.1 Build validation
  - `npm --prefix frontend run build`
  - Expect: SUCCESS

- [ ] 6.2 Test derivation logic
  - Unit test per `deriveCanonicalToolUiState` + new cases
  - Unit test per `derivePrimaryActionPolicy` + secondary action flags
  - Verify: `npm --prefix frontend run test -- --run`

- [ ] 6.3 Visual regression check
  - FunnelPagesToolPage: stessa behavior, nuovo visual
  - NextlandToolPage: stessa behavior, nuovo visual
  - ToolStepCard preview rendering
  - ToolStatusCard checklist visibility

- [ ] 6.4 Integration: Simulate new tool
  - Aggiungi 'test-tool' to registry
  - Renderizza ToolPageTemplate(toolKey='test-tool')
  - Verify: renders without error, all UI visible

### Phase 7: Documentation & Scaling (30 min)

- [ ] 7.1 Aggiornare README in tools/
  - Describe toolFormRegistry pattern
  - Step-by-step "Add New Tool"

- [ ] 7.2 Creare jsdoc su ToolPageTemplate props

- [ ] 7.3 Aggiornare appCopy schema if needed

---

## 5. Implementation Sequence

**Recommended order** (respects dependencies):

1. **Week 1, Mon**: Phase 1 (Types & Architecture)
   - Small, safe changes
   - Blocks nothing, enables everything

2. **Week 1, Tue**: Phase 2 (Runtime Hooks)
   - Complete useToolForm extraction
   - Verify hook composition

3. **Week 1, Wed-Fri**: Phase 3 (UI Components)
   - Build ToolStatusCard, ToolStepCard, ToolActionButtons in parallel
   - Daily build validation
   - Merge ToolPageTemplate once components ready

4. **Week 2, Mon**: Phase 4 (Page Wrapper Refactor)
   - Replace FunnelPages + Nextland pages
   - Single-file change per page
   - Verify router integration

5. **Week 2, Tue**: Phase 5 (Copy System)
   - Editorial alignment
   - UI labels audit

6. **Week 2, Wed**: Phase 6 (Testing & Validation)
   - Full test suite
   - Visual regression

7. **Week 2, Thu**: Phase 7 (Documentation)
   - README + jsdoc

---

## 6. Rollback Plan

If something breaks:

### Scenario A: Types broke downstream
1. Revert `tool-form-architecture.ts`, `tool-ux-state.ts` changes
2. Skip Phase 2-3
3. Mark task as blocked pending type refactor

### Scenario B: UI component crashes at build
1. Revert the component file (`Tool{StatusCard,StepCard,ActionButtons,PageTemplate}.tsx`)
2. Fix locally, re-integrate
3. Build again

### Scenario C: Page refactor broke navigation
1. Revert `FunnelPagesToolPage.tsx`, `NextlandToolPage.tsx` back to originals
2. Keep new components in runtime/ui/ (non-breaking)
3. Fix template → page wrapper interface
4. Re-refactor pages

---

## 7. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Type system mismatch between new types + old code | High | Medium | Phase 1 has dedicated type review step, full tsc pass required |
| ToolFormState/ToolPageTemplate props too generic, hard to extend | Medium | High | Keep registry pattern explicit; add per-tool override points early |
| UI component styles conflict with global CSS | Medium | Low | Use scoped .ui-tool-* class hierarchy; test in isolation |
| Performance regression on form re-renders | Low | Medium | Memoize useToolForm result; validate derivation logic perf |
| Copy system missing per-step labels | High | Low | Audit appCopy early (Phase 5); use fallback if needed |
| New tool can't override CTA labels via registry | Medium | High | Add optional `customization: { ctaLabels?: { ... } }` to ToolFormConfig |

---

## 8. Success Criteria

- [x] **Scopo (questo doc)**: Riduci duplicazione code da 95% → 0% tra tool page
- [ ] **Phase 1**: Nessun errore TypeScript, types coerenti
- [ ] **Phase 2-3**: All 4 components build without errors
- [ ] **Phase 4**: FunnelPages + Nextland pages < 60 lines each
- [ ] **Phase 5**: All appCopy labels covered
- [ ] **Phase 6**: All tests pass, visual parity maintained
- [ ] **Phase 7**: README updated with "Add New Tool" procedure
- [ ] **Scalability**: Create & deploy new tool in < 1 hour

---

## 9. Appendix: Esempio Tool Nuovo

Dopo completamento plan, aggiungere tool nuovo sarà:

**1. Configurazione (tool-form-architecture.ts)**:
```typescript
'campaign-studio': {
  toolKey: 'campaign-studio',
  displayName: 'Campaign Studio',
  defaultPrompt: 'Genera step di campagna con coerenza...',
  defaultModel: 'openrouter/auto',
  steps: ['brief', 'landing', 'email', 'social'] as const,
  stepDependencies: {
    brief: [],
    landing: ['brief'],
    email: ['brief'],
    social: ['email'],
  },
  defaults: { registrySnapshotRef: 'snapshot:default' },
},
```

**2. Pagina (CampaignStudioToolPage.tsx)**:
```typescript
export const CampaignStudioToolPage = () => (
  <ToolPageTemplate toolKey="campaign-studio" />
)
```

**3. Copy (appCopy system.ts)**:
```typescript
campaignStudio: {
  title: 'Campaign Studio',
  orderRule: 'Genera step di campagna in sequenza...',
}
```

**4. Route (app-router.tsx)**:
```typescript
{
  path: '/tools/campaign-studio',
  element: <CampaignStudioToolPage />,
},
```

**5. Navigation (appNavigation in copy/system.ts)**:
```typescript
{ to: '/tools/campaign-studio', label: 'Campaign', end: true },
```

**Total effort: 30 minutes** ✅

