---
goal: Implementazione evoluzione formato output tool meta-ads da sistema 4 varianti per lunghezza a sistema cluster → angolo → awareness con controllo utente lunghezza copy
version: 1.1
date_created: 2026-06-28
last_updated: 2026-06-28
last-reviewed: 2026-06-28
next-review-date: 2026-07-28
owner: Product Team + Backend Runtime + Frontend Platform
status: in-progress
tags: [plan, meta-ads-evolution, cluster-system, copy-length-control, tool-workspace, backend, frontend, ddd, validation]
---

# Introduction

Questo piano di implementazione definisce il rollout deterministico per l'evoluzione del tool Meta Ads da sistema di 4 varianti per lunghezza a sistema **cluster → angolo → awareness** con controllo utente della lunghezza del copy (Short Form 400-600, Medium Form 800-1000, Long Form 1200+ caratteri).

Target verification criteria for the Meta Ads evolution:

- **Scalability**: Il nuovo sistema cluster-based può essere implementato senza broad architectural changes
- **Unification**: BE e FE seguono un flusso canonico e un linguaggio canonico per il nuovo formato
- **Modularity**: I cambiamenti comportamentali rimangono localizzati alla superficie più piccola possibile
- **Traceability**: Ogni nuova caratteristica è ancorata a una decisione DDD canonica

## 0. Phase 0 - Initial DDD Analysis for Meta Ads Evolution

Objective:
- Identificare le nuove caratteristiche del tool prima di qualsiasi lavoro di implementazione
- Decidere se il nuovo comportamento è un'estensione canonica, una variazione dello strumento esistente, o un nuovo concetto DDD che richiede governance

### Canonical Terms Analysis

**Nuovi termini introdotti:**
- `CopyLengthFormat`: Formato lunghezza copy selezionabile dall'utente
- `ClusterSystem`: Sistema di segmentazione basato su cluster di target
- `AngleApproach`: Approccio di messaging specifico per cluster
- `AwarenessLevel`: Livello di consapevolezza del problema (Problem Aware, Solution Aware, Product Aware)

**Bounded Context**: `Meta-Ads Tool Workspace` (esistente, esteso)

**XState Impact Boundary**:
- `tool-page.machine.ts`: Gestione nuovo input `copyLengthFormat`
- `generation-system.machine.ts`: Processing nuovo formato output
- `tool-workflow.machine.ts`: Nessun impatto (workflow rimane 2-step)

**Runtime Gate Event Map**:
- Copy length validation: `COPY_LENGTH_SELECTED` → `validation.completed` | `validation.failed`
- Cluster generation gate: `CLUSTER_GENERATION_STARTED` → `generation.completed` | `generation.failed`

## 1. Scope

### In scope:
- Estensione del tool `meta-ads` esistente con nuovo sistema di output
- Implementazione controllo utente lunghezza copy nel form
- Aggiornamento prompt backend per sistema cluster → angolo → awareness
- Modifica UI per navigazione gerarchica output
- Backward compatibility con sistema esistente tramite feature flag
- Validation automatica aderenza caratteri per formato selezionato

### Out of scope:
- Creazione nuovi domini terminologici senza approvazione DDD
- Refactor non correlati fuori dalla superficie del tool meta-ads
- Rimozione completa del sistema legacy (mantenuto per transition period)

## 2. Session Entry Gate

Before implementation work:

1. Re-read canonical DDD sources:
   - `docs/01-requirements/domain-ubiquitous-language-glossary.md`
   - `docs/02-design/domain-bounded-context-map.md` 
   - `docs/07-governance/domain-naming-decision-log.md`
2. Re-read canonical UI governance source:
   - `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
3. Confermare che la proposal di evoluzione sia approvata e allineata con DDD requirements

Pass criteria:
- No ambiguity sui canonical terms per questo cambiamento
- No unresolved terminology conflict
- No unresolved architecture constraint che invaliderebbero il piano

## 2b. Deterministic Inputs (Mandatory)

```bash
export TOOL_KEY='meta-ads'                    # Existing, unchanged
export TOOL_WORKFLOW='meta_ads_generator'     # Existing, unchanged  
export TOOL_DISPLAY_LABEL='MetaAds Generator' # Existing, unchanged
export NEW_SYSTEM_FF='USE_CLUSTER_SYSTEM'     # New feature flag
export COPY_LENGTH_PARAM='copyLengthFormat'   # New input parameter
```

## 3. End-to-End Flow Under Plan

### Phase A - Requirements to Enhanced Tool Definition

Objective: Convertire i nuovi requirements in una definizione canonica del tool evoluto

Checklist:
- Confermare che `ToolKey` e workflow rimangono immutati (`meta-ads`, `meta_ads_generator`)
- Estendere input contract con `copyLengthFormat: 'short-form' | 'medium-form' | 'long-form'`
- Aggiornare output contract per sistema cluster → angolo → awareness
- Confermare readiness rules per nuovo input copy length
- Implementare nuovo sistema prompt con controllo dinamico lunghezza

Primary evidence anchors:
- `packages/contracts/src/tool-workflows.ts` (esteso)
- `apps/backend/src/lib/runtime/tool-prompts/meta-ads/` (aggiornati)
- Proposal approvata in `docs/02-design/meta-ads-output-format-evolution-proposal.md`

### Phase B - Backend Runtime Path Enhancement  

Objective: Validare l'orchestrazione backend, validazione richieste e invarianti runtime per il nuovo sistema

Checklist:
- Estendere payload validation con `copyLengthFormat` field
- Aggiornare prompt assembly per controllo dinamico lunghezza
- Implementare feature flag `USE_CLUSTER_SYSTEM` per gradual rollout
- Aggiornare parsing logic per nuovo formato output cluster-based
- Mantenere backward compatibility con sistema esistente

Primary evidence anchors:
- `apps/backend/src/lib/runtime/request-contract.ts` (validazione estesa)
- `apps/backend/src/lib/runtime/tool-prompts/meta-ads/prompt_ads_generation.md` (sostituito)
- `apps/backend/src/lib/machines/generation/extraction-parsers.ts` (parser estesi)

### Phase C - Frontend Tool Workspace Path Enhancement

Objective: Validare i cambiamenti Tool Workspace necessari per la nuova capability

Checklist:
- Aggiungere componente `CopyLengthSelector` al form meta-ads
- Implementare navigazione gerarchica per output cluster → angolo → awareness  
- Mantenere compatibilità con rendering esistente quando feature flag è off
- Aggiornare session artifact tabs per nuova struttura output
- Implementare preview real-time caratteri per formato selezionato

Primary evidence anchors:
- `apps/frontend/src/features/tools/meta-ads/pages/MetaAdsToolPage.tsx`
- `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx`
- Nuovo componente: `apps/frontend/src/features/tools/meta-ads/ui/CopyLengthSelector.tsx`

## 4. Implementation Steps

### Phase 1: Foundation + User Control (Sprint 1-2)

**GOAL-001**: Stabilire baseline e controllo utente lunghezza copy

| Task | Description | Status | Assignee | Due Date |
|------|-------------|--------|----------|----------|
| TASK-001 | Estendere `TOOL_WORKFLOW_DEFINITIONS['meta-ads']` in `packages/contracts/src/tool-workflows.ts` con nuovo campo `copyLengthFormat` nel workflow configuration | ✅ Completed | Backend Team | Sprint 1 |
| TASK-002 | Creare directory `apps/frontend/src/features/tools/meta-ads/ui/` e implementare `CopyLengthSelector.tsx` component con 3 opzioni radio (Short/Medium/Long Form) | ✅ Completed | Frontend Team | Sprint 1 |
| TASK-003 | Aggiungere validation schema per `copyLengthFormat: 'short-form' | 'medium-form' | 'long-form'` in `apps/backend/src/lib/runtime/request-contract.ts` | ✅ Completed | Backend Team | Sprint 1 |
| TASK-004 | Implementare feature flag `USE_CLUSTER_SYSTEM` in backend env config con default `false` e frontend `VITE_FF_USE_CLUSTER_SYSTEM` | ✅ Completed | DevOps Team | Sprint 1 |
| TASK-005 | Setup A/B testing infrastructure con tracking metriche CTR/CPC per formato copy attraverso analytics dashboard | ✅ Completed | QA Team | Sprint 2 |

**QA Scenarios per Phase 1:**

**TASK-001 QA:**
- **Tool**: `npm run typecheck --workspace packages/contracts`
- **Steps**: 1) Modificare `TOOL_WORKFLOW_DEFINITIONS['meta-ads']` aggiungendo `copyLengthOptions` e `defaultCopyLength`, 2) Eseguire typecheck
- **Expected Result**: Exit code 0, nessun errore TypeScript, nuovi campi accessibili in `resolveToolWorkflowType('meta-ads')`

**TASK-002 QA:**  
- **Tool**: `npm --workspace apps/frontend run test -- CopyLengthSelector`
- **Steps**: 1) Creare directory `apps/frontend/src/features/tools/meta-ads/ui/`, 2) Implementare `CopyLengthSelector.tsx` con 3 radio options, 3) Eseguire test component
- **Expected Result**: Component renderizza 3 opzioni, onChange callback triggered correttamente, default "medium-form" selezionato

**TASK-003 QA:**
- **Tool**: `npm --workspace apps/backend run test -- request-contract`  
- **Steps**: 1) Aggiungere `copyLengthFormat` validation in request schema, 2) Testare con payload valido e invalido
- **Expected Result**: Validation accetta 'short-form'|'medium-form'|'long-form', rejects altri valori con validation error

**TASK-004 QA:**
- **Tool**: `grep -r "USE_CLUSTER_SYSTEM" apps/` + `npm run typecheck`
- **Steps**: 1) Aggiungere feature flag backend/frontend, 2) Verificare default false, 3) Test toggle behavior
- **Expected Result**: Flag presente in env config, default false, toggle correttamente cambia rendering UI

**TASK-005 QA:**
- **Tool**: Analytics dashboard + `curl` test API endpoints
- **Steps**: 1) Setup tracking events per copy format, 2) Test event emission, 3) Verificare data collection
- **Expected Result**: Eventi CTR/CPC registrati per formato, dashboard mostra metriche split per short/medium/long

### Phase 2: Core Prompt System (Sprint 3-5)

**GOAL-002**: Implementare nuovo sistema prompt cluster → angolo → awareness

| Task | Description | Status | Assignee | Due Date |
|------|-------------|--------|----------|----------|
| TASK-006 | Sostituire `prompt_extraction.md` con versione cluster-aware | ✅ Completed | Backend Team | Sprint 3 |
| TASK-007 | Sostituire `prompt_context_generation.md` con sistema cluster identification | ✅ Completed | Backend Team | Sprint 3 |
| TASK-008 | Implementare nuovo `prompt_ads_generation.md` con controllo dinamico lunghezza | ✅ Completed | Backend Team | Sprint 4 |
| TASK-009 | Aggiornare extraction parsers per nuova struttura cluster output | ✅ Completed | Backend Team | Sprint 4 |
| TASK-010 | Implementare validation automatica aderenza caratteri per formato | ✅ Completed | Backend Team | Sprint 5 |
| TASK-011 | Aggiungere unit tests per ogni componente prompt system | ✅ Completed | Backend Team | Sprint 5 |

**QA Scenarios per Phase 2:**

**TASK-006 QA:**
- **Tool**: `diff -u apps/backend/src/lib/runtime/tool-prompts/meta-ads/prompt_extraction.md apps/backend/src/lib/runtime/tool-prompts/meta-ads/prompt_extraction_legacy.md`
- **Steps**: 1) Backup prompt esistente, 2) Sostituire con versione cluster-aware dalla proposal, 3) Test extraction con briefing sample
- **Expected Result**: Nuovo prompt genera sezione "Cluster Opportunities", extraction parser legge correttamente nuovi campi

**TASK-007 QA:**
- **Tool**: `npm --workspace apps/backend run test -- context-generation`
- **Steps**: 1) Sostituire prompt_context_generation.md, 2) Test con extraction output, 3) Verificare output cluster structure
- **Expected Result**: Output contiene 2-3 cluster identificati, ogni cluster ha angoli definiti, structure parseable da frontend

**TASK-008 QA:**
- **Tool**: `rg "{{copy_length_format}}" apps/backend/src/lib/runtime/tool-prompts/meta-ads/`
- **Steps**: 1) Implementare nuovo prompt_ads_generation.md, 2) Test template variable substitution, 3) Verificare output per ogni formato
- **Expected Result**: Template variables sostituiti correttamente, Short Form 400-600 char, Medium 800-1000, Long 1200+

**TASK-009 QA:**
- **Tool**: `npm --workspace apps/backend run test -- extraction-parsers`
- **Steps**: 1) Estendere parseMetaAdsExtractionMarkdown, 2) Test parsing cluster output, 3) Verificare type safety
- **Expected Result**: Parser estrae cluster/angles correttamente, TypeScript types aligned, validation errors per malformed input

**TASK-010 QA:**
- **Tool**: `echo "test copy 400 chars..." | wc -c` + validation function test
- **Steps**: 1) Implementare character count validation, 2) Test per ogni formato, 3) Verificare error handling
- **Expected Result**: Validation accetta copy entro range, rejects copy fuori range, error messages actionable

**TASK-011 QA:**
- **Tool**: `npm --workspace apps/backend run test -- src/lib/tests/runtime.prompt-system.test.ts`
- **Steps**: 1) Creare test file, 2) Unit tests per ogni prompt component, 3) Verificare coverage >80%
- **Expected Result**: Tutti i test passano, coverage >80%, ogni prompt component testato isolatamente

### Phase 3: Frontend Navigation & UI (Sprint 6-7)

**GOAL-003**: Implementare navigazione gerarchica e UI per nuovo sistema

| Task | Description | Status | Assignee | Due Date |  
|------|-------------|--------|----------|----------|
| TASK-012 | Implementare navigazione cluster → angolo in `SessionArtifactTabs` | Pending | Frontend Team | Sprint 6 |
| TASK-013 | Aggiungere indicatori lunghezza copy nei titoli output | Pending | Frontend Team | Sprint 6 |
| TASK-014 | Implementare export selettivo per cluster/angolo/awareness | Pending | Frontend Team | Sprint 7 |
| TASK-015 | Aggiornare session summary per supporto nuovo formato | Pending | Frontend Team | Sprint 7 |
| TASK-016 | Implementare backward compatibility UI con feature flag | Pending | Frontend Team | Sprint 7 |

**QA Scenarios per Phase 3:**

**TASK-012 QA:**
- **Tool**: `npm --workspace apps/frontend run test -- SessionArtifactTabs`
- **Steps**: 1) Modificare SessionArtifactTabs per navigazione cluster→angolo, 2) Test rendering con cluster data, 3) Verificare navigation behavior
- **Expected Result**: UI mostra gerarchia cluster→angolo→awareness, click navigation funziona, breadcrumbs corretti

**TASK-013 QA:**
- **Tool**: Browser DevTools + `npm --workspace apps/frontend run test -- copy-length-indicators`
- **Steps**: 1) Aggiungere indicatori lunghezza nei titoli, 2) Test visual rendering, 3) Verificare accessibility
- **Expected Result**: Indicatori visibili "[Short Form]", "[Medium Form]", "[Long Form]", screen reader compatible

**TASK-014 QA:**
- **Tool**: Browser download verification + `npm --workspace apps/frontend run test -- export-functionality`
- **Steps**: 1) Implementare export selettivo, 2) Test export cluster/angolo singolo, 3) Verificare file content
- **Expected Result**: Export scarica file corretto, content include solo cluster/angolo selezionato, formato utilizzabile

**TASK-015 QA:**
- **Tool**: `npm --workspace apps/frontend run test -- session-summary`
- **Steps**: 1) Aggiornare session summary pages, 2) Test con nuovo formato cluster, 3) Verificare backward compatibility
- **Expected Result**: Session summary mostra nuovo formato correttamente, legacy sessions ancora funzionali

**TASK-016 QA:**
- **Tool**: Browser + feature flag toggle test
- **Steps**: 1) Implementare feature flag UI switch, 2) Test toggle legacy/cluster mode, 3) Verificare no data loss
- **Expected Result**: Toggle switch funziona, legacy mode mostra vecchio formato, cluster mode nuovo formato, no errori JS

### Phase 4: Quality Assurance & Launch (Sprint 8)

**GOAL-004**: Validazione finale e rollout graduale

| Task | Description | Status | Assignee | Due Date |
|------|-------------|--------|----------|----------|
| TASK-017 | End-to-end testing su tutti i formati copy (Short/Medium/Long) | Pending | QA Team | Sprint 8 |
| TASK-018 | Performance testing su generazione cluster multipli | Pending | QA Team | Sprint 8 |
| TASK-019 | User acceptance testing con beta users | Pending | Product Team | Sprint 8 |
| TASK-020 | Documentazione utente per nuovo sistema cluster | Pending | Product Team | Sprint 8 |
| TASK-021 | Gradual rollout con monitoring metriche performance | Pending | DevOps Team | Sprint 8 |

**QA Scenarios per Phase 4:**

**TASK-017 QA:**
- **Tool**: `npm --workspace apps/frontend run test:e2e` + Cypress/Playwright
- **Steps**: 1) E2E test per Short/Medium/Long Form generation, 2) Test character count accuracy, 3) Verificare user journey completo
- **Expected Result**: E2E test passa per tutti i formati, character counts accurate ±5%, user può completare workflow senza blockers

**TASK-018 QA:**
- **Tool**: `npm --workspace apps/backend run bench:generation` + memory profiling
- **Steps**: 1) Load test con 10+ cluster simultanei, 2) Monitor memory usage, 3) Verificare response time <45s
- **Expected Result**: Performance entro limiti, memory usage stable, response time <45s per tutti i formati

**TASK-019 QA:**
- **Tool**: User feedback survey + usability testing session
- **Steps**: 1) Setup beta user group, 2) Guided testing session, 3) Collect satisfaction scores
- **Expected Result**: User satisfaction ≥4.5/5, task completion rate >90%, no major usability blockers

**TASK-020 QA:**
- **Tool**: Documentation review + `grep -r "cluster.*angolo" docs/`
- **Steps**: 1) Creare user documentation, 2) Review tecnico accuracy, 3) Verificare completeness
- **Expected Result**: Documentation completa e accurata, copre tutti i formati, esempi funzionali

**TASK-021 QA:**
- **Tool**: Monitoring dashboard + gradual rollout metrics
- **Steps**: 1) Deploy con feature flag al 10%, 2) Monitor error rates, 3) Gradual increase a 100%
- **Expected Result**: Error rate <2% durante rollout, performance metrics stable, user adoption tracking funzionale

## 5. Technical Implementation Details

### 5.1 Contract Extensions

```typescript
// packages/contracts/src/tool-workflows.ts - Estensione configurazione esistente
export const TOOL_WORKFLOW_DEFINITIONS = {
  // ... existing workflows
  'meta-ads': {
    toolKey: 'meta-ads',
    workflowType: 'meta_ads_generator',
    creditCost: 1,
    steps: [
      { key: 'context-generation', dependencies: [] },
      { key: 'ads-generation', dependencies: ['context-generation'] },
    ],
    // NEW: Configurazione formati copy supportati
    copyLengthOptions: ['short-form', 'medium-form', 'long-form'],
    defaultCopyLength: 'medium-form'
  }
}

// Nuova interface per input validation backend
interface MetaAdsGenerationRequest {
  briefingFile: File;
  angleFile?: File; 
  tone: string;
  model: LlmModelId;
  copyLengthFormat: 'short-form' | 'medium-form' | 'long-form'; // NEW
}

// Output structure per nuovo sistema cluster
interface ClusterSystemOutput {
  clusters: ClusterOutput[];
  format: CopyLengthFormat;
  generatedAt: Date;
  totalVariants: number;
}
```

### 5.2 Frontend Component Architecture - Percorsi Corretti

```typescript
// apps/frontend/src/features/tools/meta-ads/ui/CopyLengthSelector.tsx (NEW FILE)
interface CopyLengthSelectorProps {
  value: CopyLengthFormat;
  onChange: (format: CopyLengthFormat) => void;
  disabled?: boolean;
}

// apps/frontend/src/features/tools/meta-ads/pages/MetaAdsToolPage.tsx (MODIFIED)
// Estendere createToolPage wrapper con custom form sections
export const MetaAdsToolPage = () => {
  const baseToolPage = createToolPage('meta-ads');
  
  return (
    <ToolPageTemplate toolKey="meta-ads">
      {/* Existing form sections */}
      <BriefingUploadSection />
      <AngleFileSection />
      
      {/* NEW: Copy length selector */}
      <CopyLengthSelector 
        value={copyLengthFormat}
        onChange={setCopyLengthFormat}
      />
      
      {/* Existing generation controls */}
      <GenerationControlsSection />
    </ToolPageTemplate>
  );
};
```

### 5.3 Prompt Template Variables

```markdown
# Backend template variables per dynamic prompt assembly
{{copy_length_format}}     # 'short-form' | 'medium-form' | 'long-form'
{{character_range_min}}    # 400 | 800 | 1200  
{{character_range_max}}    # 600 | 1000 | 2000+
{{hook_char_limit}}        # 80 | 100 | 125
{{narrative_complexity}}   # 'minimal' | 'moderate' | 'full'
```

## 6. Backward Compatibility Strategy

### 6.1 Feature Flag Implementation

```typescript
// Environment-based feature flag
const USE_CLUSTER_SYSTEM = process.env.VITE_FF_USE_CLUSTER_SYSTEM === 'true';

// Conditional rendering
{USE_CLUSTER_SYSTEM ? (
  <ClusterSystemOutput clusters={clusters} />
) : (
  <LegacyVariantOutput variants={variants} />
)}
```

### 6.2 Migration Path

1. **Phase 1**: Dual-mode support (legacy + cluster system)
2. **Phase 2**: Gradual user migration con opt-in
3. **Phase 3**: Default switch to cluster system
4. **Phase 4**: Legacy system deprecation (6 months post-launch)

## 7. Testing Strategy

### 7.1 Unit Tests
- [ ] Copy length validation per ogni formato
- [ ] Cluster identification logic
- [ ] Prompt template assembly con variabili dinamiche
- [ ] UI component rendering per ogni stato

### 7.2 Integration Tests
- [ ] End-to-end workflow extraction → context → ads generation
- [ ] Feature flag behavior switch
- [ ] Session artifact navigation cluster → angolo → awareness
- [ ] Export functionality per formato

### 7.3 Performance Tests  
- [ ] Generation time per formato copy (target <45s per output completo)
- [ ] Memory usage con cluster multipli
- [ ] UI responsiveness con navigazione gerarchica

### 7.4 User Acceptance Tests
- [ ] A/B testing cluster system vs legacy system
- [ ] Copy length selection UX
- [ ] Format adoption distribution
- [ ] User satisfaction scoring (target ≥4.5/5)

## 8. Success Metrics

### 8.1 Performance KPIs
- **Generation Time**: <45s per output completo (tutti cluster/angoli/formati)
- **Error Rate**: <2% per parsing e validation  
- **Format Validation Accuracy**: 99% aderenza caratteri target
- **Feature Adoption**: 80% users switch to cluster system in 30 days

### 8.2 Business KPIs
- **CTR Improvement**: Short Form +10%, Medium Form +15%, Long Form +25%
- **CPC Reduction**: -15-25% tramite maggiore relevance
- **User Satisfaction**: Score ≥4.5/5 per usabilità tool
- **Time-to-Market**: -40% per campagne multi-formato

### 8.3 Technical KPIs
- **API Compatibility**: 100% backward compatibility per 6 mesi
- **Build Success Rate**: 100% per tutti i build durante rollout
- **Feature Flag Reliability**: Zero downtime durante switch

## 9. Risk Assessment & Mitigation

### 9.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Breaking changes durante migration | High | Medium | Feature flag + dual-mode support |
| Performance degradation con cluster multipli | Medium | Low | Performance testing + optimization |
| UI complexity increase | Medium | Medium | User testing + iterative design |

### 9.2 Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| User resistance al nuovo sistema | High | Low | Training + gradual rollout |
| Copy performance regression | High | Low | A/B testing + rollback capability |
| Development timeline slip | Medium | Medium | Agile sprints + regular checkpoints |

## 10. Dependencies

- **DEP-001**: Approval proposal in `docs/02-design/meta-ads-output-format-evolution-proposal.md`
- **DEP-002**: Feature flag infrastructure ready
- **DEP-003**: A/B testing platform configured per copy performance measurement
- **DEP-004**: User training materials e documentation
- **DEP-005**: Monitoring dashboard per performance metrics

## 11. Files Modified/Created

### Backend Files
- `apps/backend/src/lib/runtime/tool-prompts/meta-ads/prompt_extraction.md` (modified)
- `apps/backend/src/lib/runtime/tool-prompts/meta-ads/prompt_context_generation.md` (modified)
- `apps/backend/src/lib/runtime/tool-prompts/meta-ads/prompt_ads_generation.md` (replaced)
- `apps/backend/src/lib/runtime/request-contract.ts` (extended)
- `apps/backend/src/lib/machines/generation/extraction-parsers.ts` (extended)

### Frontend Files  
- `packages/contracts/src/tool-workflows.ts` (extended)
- `apps/frontend/src/features/tools/meta-ads/pages/MetaAdsToolPage.tsx` (modified)
- `apps/frontend/src/features/tools/meta-ads/ui/CopyLengthSelector.tsx` (new)
- `apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx` (modified)
- `apps/frontend/src/features/generation/ui/ClusterSystemOutput.tsx` (new)

### Documentation Files
- `docs/02-design/meta-ads-output-format-evolution-proposal.md` (existing)
- `docs/99-reference/meta-ads-cluster-system-user-guide.md` (new)

## 12. Post-Launch Monitoring

### 12.1 Week 1-2: Launch Monitoring
- Real-time error tracking
- Performance metrics monitoring
- User adoption rate tracking
- Feature flag switch success rate

### 12.2 Month 1: Performance Analysis  
- Copy performance comparison (CTR, CPC, conversion rates)
- User satisfaction survey
- Format adoption distribution analysis
- Technical performance optimization

### 12.3 Month 3: Optimization & Iteration
- A/B test results analysis
- User feedback incorporation
- Performance tuning based on usage patterns
- Legacy system deprecation planning

## 13. Related Specifications

- [Meta Ads Output Format Evolution Proposal](../docs/02-design/meta-ads-output-format-evolution-proposal.md)
- [DDD Naming Decisions](../docs/07-governance/domain-naming-decision-log.md)
- [Tool Development Plan Template](../docs/99-reference/templates/tool-development-plan-template.md)
- [Frontend UI Ubiquitous Language Spec](../docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md)