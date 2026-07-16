---
status: implemented
version: 2.0
date_created: 2026-07-07
last-reviewed: 2026-07-16
next-review-date: 2027-01-16
owner: Domain Architecture
title: LLM Model Step Override System
type: proposal
implementation_date: 2026-07-16
tags: [llm-models, tool-steps, generation, backend, contracts]
goal: Enable per-step model override configuration to allow tools to specify default models for individual workflow steps
---

# LLM Model Step Override System

## Sommario Esecutivo

Questa proposal introduce un sistema di override del modello LLM a livello di singolo step di tool, permettendo di configurare modelli di default specifici per ogni `WorkflowStep` che sovrascrivono la selezione utente quando necessario.

### Benefici Principali
- **Qualità Ottimale**: Ogni step può utilizzare il modello più appropriato per il suo scopo specifico
- **Flessibilità Granulare**: Override configurabile a livello `(ToolKey, stepKey)` 
- **Backward Compatibility**: Sistema opt-in che preserva il comportamento esistente
- **Configurazione Statica**: Override gestiti come configurazione nel codespace, no CRUD runtime

## DDD Prerequisites ✅ **COMPLETED**

Le seguenti DDD decisions sono state **APPROVATE** e aggiunte al Decision Log:

- **DDD-150**: `StepLlmModelOverrideConfig` - Value Object per configurazione statica override modello per step specifici di tool ✅
- **DDD-151**: `StepLlmModelResolver` - Domain Service per risoluzione deterministca del modello effettivo basato su override config e user selection ✅ 
- **DDD-152**: `EffectiveModelResolution` - Value Object per risultato resolution con metadata su source e reasoning ✅

**Status**: Tutti i termini canonici sono stati aggiunti al Domain Ubiquitous Language Glossary. Implementation può procedere seguendo i termini approvati.

## Contesto e Motivazione

### Problema Attuale

Il sistema attuale utilizza un unico modello LLM selezionato dall'utente per tutti gli step di un tool. Questa limitazione impedisce l'ottimizzazione per step specifici che potrebbero beneficiare di modelli diversi:

- **Step di estrazione**: potrebbero necessitare di modelli più precisi per l'analisi strutturata
- **Step di generazione content**: potrebbero richiedere modelli più creativi  
- **Step di analisi**: potrebbero beneficiare di modelli specializzati in ragionamento

### Obiettivi

1. **Override Selettivo**: Permettere configurazione statica di modelli default per step specifici
2. **Precedenza Chiara**: Definire gerarchia deterministca di selezione modello
3. **Configurazione Codespace**: Override definiti come configurazione statica nel repository
4. **Trasparenza Utente**: Indicare chiaramente quando un override è attivo

## Architettura Proposta

### Nuovi Concetti DDD

#### `StepLlmModelOverrideConfig` (Value Object)
Configurazione statica di override modello per uno specifico step di un tool.

```typescript
type StepLlmModelOverrideConfig = {
  toolKey: ToolKey;             // Canonical ToolKey (DDD-029)  
  stepKey: string;              // Riferisce a WorkflowStep.stepKey (DDD-003)
  overrideModelId: LlmModelId;  // Must exist in LlmModelCatalog (DDD-055)
  reason?: string;              // Motivazione dell'override (opzionale)
}

// Registry statico nel codespace
type StepLlmModelOverrideRegistry = Record<`${ToolKey}:${string}`, StepLlmModelOverrideConfig>;
```

#### `StepLlmModelResolver` (Domain Service)
Servizio per la risoluzione del modello effettivo per un dato step, operando su `WorkflowStepType` (DDD-027).

```typescript
interface StepLlmModelResolver {
  resolveEffectiveModel(
    toolKey: ToolKey, 
    stepKey: string, 
    userSelectedModel: LlmModelId
  ): EffectiveModelResolution;
  
  hasOverride(toolKey: ToolKey, stepKey: string): boolean;
  
  getOverrideReason(toolKey: ToolKey, stepKey: string): string | null;
}
```

### Relationship to Existing Concepts

- `StepLlmModelOverrideConfig.stepKey` → Riferisce a `WorkflowStep.stepKey` (DDD-003)
- `StepLlmModelOverrideConfig.toolKey` → Usa canonical `ToolKey` (DDD-029)  
- Resolution opera per `WorkflowStepType` = 'generation' | 'extraction' (DDD-027)
- Integra con `LlmModelCatalog` esistente (DDD-055) per validation
- Usa `LlmModelId` canonical type (DDD-056) per all model references

#### `EffectiveModelResolution` (Value Object)
Risultato della risoluzione modello con metadata sulla decisione.

```typescript
type EffectiveModelResolution = {
  effectiveModel: LlmModelId;
  source: 'user-selection' | 'step-override';
  overrideReason?: string;
  originalUserModel?: LlmModelId; // Solo se source = 'step-override'
}
```

### Logica di Precedenza

La risoluzione del modello segue questa gerarchia:

1. **Step Override Configurato**: Se esiste configurazione statica per `(toolKey, stepKey)` 
2. **Selezione Utente**: Modello selezionato dall'utente tramite `LlmModelSelector`
3. **Default Sistema**: `openrouter/auto` (DDD-046 esistente)

### Configurazione Statica

Gli override sono definiti come configurazione statica nel repository:

```typescript
// apps/backend/src/lib/runtime/step-llm-model-overrides.config.ts
export const STEP_LLM_MODEL_OVERRIDES: StepLlmModelOverrideRegistry = {
  // YouTube LF Script - extraction step usa modello più preciso per structured data
  'youtube-lf-script:extraction': {
    toolKey: 'youtube-lf-script',  // Canonical ToolKey (DDD-040)
    stepKey: 'extraction',         // WorkflowStepType = 'extraction' (DDD-027) 
    overrideModelId: 'openrouter/anthropic/claude-3.5-sonnet',  // LlmModelId (DDD-056)
    reason: 'Modello ottimizzato per estrazione strutturata di contenuti lunghi'
  },
  
  // Funnel Pages - pre-script-analysis step usa modello con reasoning avanzato
  'funnel-pages:pre-script-analysis': {
    toolKey: 'funnel-pages',      // Canonical ToolKey (DDD-029)
    stepKey: 'pre-script-analysis', // Riferisce a ToolStep sequence (DDD-019)
    overrideModelId: 'openrouter/openai/gpt-4-turbo',
    reason: 'Modello con capacità di ragionamento avanzate per analisi'
  },
  
  // Geometric - serp-crawling step usa modello veloce per processing volumi
  'geometric:serp-crawling': {
    toolKey: 'geometric',         // Tool identity (DDD-117)
    stepKey: 'serp-crawling',     // WorkflowStepType = 'crawling' (DDD-116) 
    overrideModelId: 'openrouter/meta-llama/llama-3.1-8b-instruct',
    reason: 'Modello veloce per processing di grandi volumi di dati SERP'
  }
} as const;

// Validation helper
export const validateOverrideConfig = (config: StepLlmModelOverrideConfig): boolean => {
  // Must reference valid ToolKey from canonical set
  // Must reference valid WorkflowStep for that tool
  // Must reference enabled LlmModelId from catalog
  return true; // Implementation validates against canonical registries
};
```

## Implementazione

### Backend Changes

#### 1. Static Configuration Registry

```typescript
// apps/backend/src/lib/runtime/step-llm-model-overrides.config.ts
export const STEP_LLM_MODEL_OVERRIDES: StepLlmModelOverrideRegistry = {
  // Configuration examples shown above
} as const;

// Helper per creare chiavi deterministic
export const createOverrideKey = (toolKey: ToolKey, stepKey: string): string => {
  return `${toolKey}:${stepKey}`;
};
```

#### 2. Resolver Service Implementation  

```typescript
// apps/backend/src/lib/runtime/step-llm-model-resolver.ts
export class StepLlmModelResolverImpl implements StepLlmModelResolver {
  constructor(
    private readonly llmModelCatalog: LlmModelCatalog
  ) {}

  resolveEffectiveModel(
    toolKey: ToolKey, 
    stepKey: string, 
    userSelectedModel: LlmModelId
  ): EffectiveModelResolution {
    // 1. Check for static override configuration
    const overrideKey = createOverrideKey(toolKey, stepKey);
    const override = STEP_LLM_MODEL_OVERRIDES[overrideKey];
    
    if (override) {
      // Validate override model is still enabled
      const isOverrideModelEnabled = this.llmModelCatalog.isModelEnabled(override.overrideModelId);
      
      if (isOverrideModelEnabled) {
        return {
          effectiveModel: override.overrideModelId,
          source: 'step-override',
          overrideReason: override.reason,
          originalUserModel: userSelectedModel
        };
      }
      // Fall through to user selection if override model is disabled
    }
    
    // 2. Use user selection (with enabled validation)  
    const isUserModelEnabled = this.llmModelCatalog.isModelEnabled(userSelectedModel);
    
    return {
      effectiveModel: isUserModelEnabled ? userSelectedModel : 'openrouter/auto',
      source: 'user-selection'
    };
  }
  
  hasOverride(toolKey: ToolKey, stepKey: string): boolean {
    const overrideKey = createOverrideKey(toolKey, stepKey);
    return overrideKey in STEP_LLM_MODEL_OVERRIDES;
  }
  
  getOverrideReason(toolKey: ToolKey, stepKey: string): string | null {
    const overrideKey = createOverrideKey(toolKey, stepKey);
    const override = STEP_LLM_MODEL_OVERRIDES[overrideKey];
    return override?.reason || null;
  }
}
```

#### 3. Generation System Integration

Modifica del `GenerationSystem` per utilizzare il resolver:

```typescript
// apps/backend/src/lib/machines/generation-system.machine.ts

// Nel context, aggiungi:
interface GenerationSystemContext {
  // ... existing fields
  effectiveModelResolution?: EffectiveModelResolution;
}

// Nuovo action per risolvere il modello effettivo
const resolveEffectiveModel = assign({
  effectiveModelResolution: ({ context }) => {
    const { toolKey, requestInput } = context;
    
    // Estrai stepKey dal request (se disponibile)
    const stepKey = extractStepKeyFromRequest(requestInput);
    
    if (!stepKey) {
      // Per step senza override (es. extraction), usa selezione utente
      return {
        effectiveModel: requestInput.model,
        source: 'user-selection' as const
      };
    }
    
    return stepLlmModelResolver.resolveEffectiveModel(
      toolKey,
      stepKey, 
      requestInput.model
    );
  }
});

// Modifica della machine per includere la risoluzione
export const generationSystemMachine = setup({
  // ...
}).createMachine({
  // ...
  states: {
    // ...
    preGenerationGuards: {
      // ... existing states
      states: {
        // ... 
        modelResolution: {
          entry: 'resolveEffectiveModel',
          always: {
            target: 'usage',
            guard: 'hasEffectiveModel'
          }
        },
        usage: {
          // ... usa effectiveModelResolution.effectiveModel invece di requestInput.model
        }
      }
    }
  }
});
```

#### 4. Admin HTTP Endpoints

```typescript
// apps/backend/src/lib/runtime/auth-http/admin-step-override-handlers.ts
export const adminStepOverrideHandlers = {
  
  // GET /api/admin/step-overrides?toolKey={toolKey}
  listStepOverrides: authUserRole('admin')(async (req, res) => {
    const { toolKey } = req.query;
    
    if (toolKey && typeof toolKey === 'string') {
      const overrides = await stepOverrideAdapter.listOverridesByTool(toolKey as ToolKey);
      return res.json(overrides);
    }
    
    // Altrimenti lista tutti gli override  
    const allOverrides = await stepOverrideAdapter.listAll();
    return res.json(allOverrides);
  }),

  // POST /api/admin/step-overrides  
  createStepOverride: authUserRole('admin')(async (req, res) => {
    const override = await stepOverrideAdapter.createOverride(req.body);
    return res.status(201).json(override);
  }),

  // PUT /api/admin/step-overrides/:id
  updateStepOverride: authUserRole('admin')(async (req, res) => {
    const { id } = req.params;
    const updated = await stepOverrideAdapter.updateOverride(id, req.body);
    return res.json(updated);
  }),

  // DELETE /api/admin/step-overrides/:id  
  deleteStepOverride: authUserRole('admin')(async (req, res) => {
    const { id } = req.params;
    await stepOverrideAdapter.deleteOverride(id);
    return res.status(204).send();
  })

};
```

### Frontend Changes

#### 1. Contracts Extension

```typescript
// packages/contracts/src/step-llm-model-override.ts
export type StepLlmModelOverrideConfig = {
  toolKey: string;  // ToolKey
  stepKey: string;
  overrideModelId: string;  // LlmModelId  
  reason?: string;
}

export type EffectiveModelResolution = {
  effectiveModel: string;  // LlmModelId
  source: 'user-selection' | 'step-override';
  overrideReason?: string;
  originalUserModel?: string;  // LlmModelId
}

// Endpoint per query override info (read-only)
export type StepOverrideInfo = {
  hasOverride: boolean;
  reason?: string;
  overrideModel?: string;
}
```

#### 2. Override Information Endpoint

```typescript
// apps/backend/src/lib/runtime/auth-http/tools-step-override-handlers.ts
export const toolsStepOverrideHandlers = {
  
  // GET /api/tools/step-overrides/:toolKey/:stepKey
  getStepOverrideInfo: authUser(async (req, res) => {
    const { toolKey, stepKey } = req.params;
    
    const hasOverride = stepLlmModelResolver.hasOverride(toolKey as ToolKey, stepKey);
    const reason = stepLlmModelResolver.getOverrideReason(toolKey as ToolKey, stepKey);
    
    const info: StepOverrideInfo = {
      hasOverride,
      reason: hasOverride ? reason : undefined,
      overrideModel: hasOverride ? getOverrideModel(toolKey as ToolKey, stepKey) : undefined
    };
    
    return res.json(info);
  })

};
```

#### 3. Tool Workspace Integration

Modifica del `ToolPageTemplate` per mostrare override attivi:

```tsx
// apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx

const ModelOverrideIndicator: React.FC<{
  toolKey: ToolKey;
  stepKey?: string;
}> = ({ toolKey, stepKey }) => {
  const { data: overrideInfo } = useStepOverrideInfoQuery(
    { toolKey, stepKey },
    { enabled: !!stepKey }
  );
  
  if (!overrideInfo?.hasOverride) {
    return null;
  }
  
  return (
    <Alert severity="info" size="small">
      <Typography variant="caption">
        Questo step utilizza il modello {overrideInfo.overrideModel} 
        {overrideInfo.reason && ` (${overrideInfo.reason})`}
        invece del tuo modello selezionato.
      </Typography>
    </Alert>
  );
};

// Nel component principale durante step execution
const currentStepKey = getCurrentStepKey(toolPageState);

return (
  <ToolPageLayout>
    {/* Existing UI */}
    
    {currentStepKey && (
      <ModelOverrideIndicator 
        toolKey={toolKey}
        stepKey={currentStepKey}
      />
    )}
    
    {/* Rest of UI */}
  </ToolPageLayout>
);
```

## Integration Constraints

| Constraint | Contexts | Rule | Decision |
|------------|----------|------|----------|
| `StepLlmModelOverrideConfig` validation | Generation | Tutti gli `overrideModelId` devono esistere in `LlmModelCatalog` (DDD-055) al momento della configurazione. Runtime fallback automatico se override model diventa disabled. Invalid config blocks application startup. | DDD-150 |
| `EffectiveModelResolution` contract | Generation → Frontend/UI | Frontend consuma `StepOverrideInfo` projection via `/api/tools/step-overrides/:toolKey/:stepKey`. Contract authority: Generation context. Frontend non duplica resolution logic. | DDD-151 |
| Static config validation | Generation | Override config deve validare `ToolKey` esistenti in `TOOL_STEP_ORDER` (DDD-019) e `stepKey` validi per ciascun tool. Invalid entries bloccano startup con explicit error. | DDD-150 |
| Model availability constraint | Generation ↔ Usage/Quota | Override model selection è soggetta alle stesse `LlmModelStatus` rules (DDD-054) della user selection. Disabled override models trigger fallback to user selection senza blocking generation. | DDD-151 |
| Resolution precedence policy | Generation | Step override ha precedenza su user selection; user selection ha precedenza su system default (`openrouter/auto`, DDD-046). Precedence chain è deterministca e non configurabile. | DDD-152 |

## Cross-Context Translation Rules

| Shared Concept | Source Context | Target Context | Translation Rule |
|----------------|----------------|----------------|------------------|
| `StepOverrideInfo` | Generation | Frontend/UI | Generation espone read-model via `GET /api/tools/step-overrides/:toolKey/:stepKey`. Frontend consuma informazioni override senza duplicare resolution semantics. Response shape: `{ hasOverride: boolean, reason?: string, overrideModel?: LlmModelId }`. |
| `EffectiveModelResolution` | Generation | Generation (internal) | Used only within Generation context durante model resolution step. Frontend vede solo final effective model ID nei `BackendStreamEvent` ma non riceve resolution metadata. |
| Override configuration | Generation | Generation (startup) | Static config validated against `LlmModelCatalog`, `TOOL_STEP_ORDER`, e canonical `ToolKey` set at application startup. Validation failures prevent server start con explicit config error reporting. |
| Model precedence resolution | Generation | Frontend/UI | Frontend mostra effective model tramite `StepOverrideInfo` query. Quando override è attivo, UI indica override model e reason. Quando override non attivo o fallback, UI mostra user-selected model normalmente. |

## Bounded Context Impact

### Generation Context
- **Nuovi Value Objects**: `StepLlmModelOverrideConfig`, `EffectiveModelResolution`
- **Nuovi Services**: `StepLlmModelResolver`  
- **Modifica Existing**: `GenerationSystem` per model resolution
- **Nuova Configurazione**: Static override registry nel codespace

### Frontend/UI Context  
- **Nuovi Components**: Override indicator nel Tool Workspace
- **Nuovi Queries**: Per recupero informazioni override (read-only)
- **Modifica Existing**: `ToolPageTemplate` per mostrare override attivi

### Auth Context
- **Nessuna modifica**: Non richiede nuovi endpoint admin

## Migration Strategy

### Fase 1: DDD Governance & Backend Foundation
1. **DDD Decisions**: Creare entries nel Decision Log per i 3 nuovi canonical terms
2. **Glossary Updates**: Aggiornare Ubiquitous Language Glossary con definizioni approvate  
3. **Static Config**: Implementare configurazione override nel codespace con validation
4. **Resolver Service**: Implementare `StepLlmModelResolver` con integration ai catalog esistenti
5. **Information Endpoint**: Endpoint read-only per frontend query override info
6. **Test Coverage**: Test per resolution logic e validation rules

### Fase 2: Generation Integration  
1. **GenerationSystem**: Integrazione model resolution step nella machine
2. **Contract Extension**: Modifica contract per `EffectiveModelResolution`  
3. **Integration Tests**: Test end-to-end con override attivi e fallback scenarios
4. **Performance Validation**: Verifica resolution < 10ms target

### Fase 3: Frontend Integration
1. **Override Indicators**: Componenti UI per mostrare override attivi in Tool Workspace
2. **Query Hooks**: React hooks per `StepOverrideInfo` con caching appropriato
3. **UI Integration**: Integration negli existing `ToolPageTemplate` components
4. **User Testing**: Validation UX con override indicators

### Fase 4: Production Rollout & Governance
1. **Production Config**: Configurazione override per tool critici nel repository
2. **Monitoring**: Performance monitoring della resolution logic  
3. **Documentation**: Aggiornamento team documentation per governance override
4. **Training**: Developer training su governance process per future override additions

## Risks e Mitigation

### RISK-001: Model Override Sprawl
**Risk**: Configurazione eccessiva di override che complica il sistema
**Mitigation**: 
- Override configurati solo per casi d'uso giustificati nel codespace
- Code review process per nuovi override
- Documentazione chiara dei rationales

### RISK-002: Performance Impact  
**Risk**: Lookup aggiuntivi per resolution rallentano generation
**Mitigation**:
- Configurazione statica in-memory (no DB queries)
- Resolution sincrona senza async overhead
- Monitoring delle performance

### RISK-003: Model Availability Conflicts
**Risk**: Override model diventa disabled/unavailable  
**Mitigation**:
- Validation in `resolveEffectiveModel` con fallback
- Test coverage per fallback scenarios
- Alert in caso di override con model disabled

### RISK-004: User Confusion
**Risk**: Utenti confusi da modelli diversi dal selezionato
**Mitigation**:
- Indicatori chiari nell'UI quando override è attivo
- Reasoning chiaro per ogni override nel config
- Documentazione help per utenti

### RISK-005: Configuration Drift
**Risk**: Override configurazione diverge dalle intenzioni
**Mitigation**:
- Configurazione versionata nel repository
- Review obbligatorio per modifiche config
- Test integration per validation dei config

## Acceptance Criteria

### AC-001: Override Resolution
- [ ] Override configurato sovrascrive selezione utente
- [ ] Senza override, usa selezione utente  
- [ ] Override con model disabled fallback a user selection
- [ ] All override models disabled fallback a default system

### AC-002: Configuration Management
- [ ] Override configurati staticamente nel repository con canonical terms validation
- [ ] Validation dei ToolKey esistenti in `TOOL_STEP_ORDER` (DDD-019)
- [ ] Validation dei LlmModelId esistenti in `LlmModelCatalog` (DDD-055)
- [ ] Code review obbligatorio per modifiche configurazione
- [ ] Test coverage per tutti gli override configurati
- [ ] Startup validation blocks server start con invalid config

### AC-003: User Experience  
- [ ] Indicatore visibile quando override attivo
- [ ] Reason mostrato quando disponibile
- [ ] Nessun impatto su UX quando override non configurato

### AC-004: Performance
- [ ] Resolution < 10ms (sincrono, in-memory)
- [ ] Nessun impatto su latenza generation existing
- [ ] Nessun overhead database per resolution

## DDD Compliance  

### Nuovi Canonical Terms ✅ **APPROVED**
- `StepLlmModelOverrideConfig` (Value Object, Generation context) - DDD-150 ✅
- `StepLlmModelResolver` (Domain Service, Generation context) - DDD-151 ✅
- `EffectiveModelResolution` (Value Object, Generation context) - DDD-152 ✅

### Modified Concepts
- `GenerationRequest`: Mantiene `model` field per user selection (no breaking changes)
- `GenerationSystem`: Esteso con model resolution step utilizzando existing context extension pattern

### Cross-Context Translation
- Frontend → Generation: `StepOverrideInfo` query via HTTP API (read-only projection)
- Configuration → Runtime: Static config resolution in resolver service con validation at startup

### Compliance with Existing Decisions
- Rispetta `ToolKey` canonical definition (DDD-029)
- Usa `LlmModelId` type system (DDD-056) 
- Integra con `LlmModelCatalog` authority (DDD-055)
- Supporta `WorkflowStepType` classification (DDD-027)
- Preserva system default fallback policy (DDD-046)

### Terminology Consistency Check
- ✅ Usa solo canonical terms da Glossary esistente
- ✅ Non introduce synonyms o local abbreviations  
- ✅ Mantiene naming convention (kebab-case per ToolKey, etc)
- ✅ Referenzia existing DDD decisions per context

Tutti i nuovi termini seguono la naming convention esistente e saranno documentati nel domain glossary dopo approval delle DDD decisions.

## Timeline Estimation

- **Fase 1**: 1 settimana (DDD governance + static config + resolver)
- **Fase 2**: 1 settimana (Generation integration + contracts) 
- **Fase 3**: 0.5 settimane (Frontend indicators + queries)
- **Fase 4**: 0.5 settimane (Production config + monitoring)

**Total**: ~3 settimane per implementazione completa (including DDD governance time)

## Conclusioni

Il sistema di override LLM per step rappresenta un'evoluzione naturale del sistema esistente che mantiene la semplicità d'uso mentre abilitando ottimizzazioni avanzate. L'approccio basato su configurazione statica nel codespace garantisce controllo totale, performance ottimali e governance attraverso il processo di code review standard.

La proposta segue rigorosamente i principi DDD del progetto:
- **Canonical Terms**: Introduce 3 nuovi termini ben definiti pending DDD approval
- **Bounded Context Integrity**: Rispetta boundaries esistenti senza invasioni
- **Integration Constraints**: Definisce rules precise per boundary crossing  
- **Terminology Consistency**: Usa solo canonical terms da Glossary esistente
- **Translation Rules**: Specifica mappings deterministici cross-context

L'eliminazione della gestione CRUD admin semplifica significativamente l'implementazione mantenendo flessibilità e controllo deterministico attraverso configuration-as-code approach.