---
date_created: 2026-04-29
date_updated: 2026-05-04
status: historical-reference
version: 1.0
title: Tool Pages - Unified Flow Migration
tags: [architecture, tool-pages, unification, flow, ui-components]
type: architecture-change-rationale
owner: Frontend Platform Team
---

# Tool Pages: Unified Flow Migration

> 📖 **Background**: This document provides the architectural rationale and before/after comparison for the unified ToolGenerationFlow component. For the current implementation, see:
> - [ToolGenerationFlow: Unified Flow Component](../tool-generation-flow.md)
> - [Tool Generation Flow Source Of Truth (Frontend)](./tool-generation-flow-source-of-truth-spec.md) — UX state routing and form behavior
> - [Domain Ubiquitous Language Glossary](../../01-requirements/domain-ubiquitous-language-glossary.md) — canonical domain terms

## Executive Summary

Questo documento descrive la migrazione dalla **architettura frammentata** (ToolStatusCard + ToolStepCard[]) a una **architettura unificata** (ToolGenerationFlow) per la colonna destra delle pagine dei tool.

### Cambio Architetturale

| Aspetto | Prima (Frammentato) | Dopo (Unificato) |
|---------|-------------------|------------------|
| Componenti colonna destra | 2 (ToolStatusCard + ToolStepCard[]) | 1 (ToolGenerationFlow) |
| Rappresentazione flow | Frammentata in card separate | Unica, coerente, progressiva |
| Fasi visibili | Implicite, non chiare | Esplicite, con indicatori |
| Gerarchia informativa | Piatta, confusa | Strutturata, progressiva |
| Coerenza UX | Incoerente tra tool | Consistente per tutti i tool |
| Manutenibilità | Duplicazione logica | Logica centralizzata |

---

## 1. Problema: Architettura Frammentata

### 1.1 Struttura Precedente

```
┌─────────────────────────────────────────────────────┐
│  Colonna Destra (Frammentata)                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ ToolStatusCard                              │   │
│  │ (Checklist globale separata)                │   │
│  │ - Project: ○                                │   │
│  │ - Briefing: ✓                              │   │
│  │ - Steps: ◐                                  │   │
│  │ - Status: ⏳                                │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Generation Steps (Heading)                  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ ToolStepCard[0]                             │   │
│  │ [1] Opt-in Page          ✓ DONE             │   │
│  │ Generate high-converting opt-in...          │   │
│  │ Preview: [content...]                       │   │
│  │ [View Artifact]                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ ToolStepCard[1]                             │   │
│  │ [2] Quiz                 ⟳ GENERATING       │   │
│  │ Generate interactive quiz                   │   │
│  │ Preview: [streaming...]                     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ ToolStepCard[2]                             │   │
│  │ [3] VSL Script           ○ PENDING          │   │
│  │ Generate video sales letter script          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 1.2 Problemi Identificati

1. **Frammentazione**: Checklist globale separata dalle card step
2. **Incoerenza**: Nessuna chiara progressione tra fasi
3. **Confusione**: Utente non capisce il flow completo
4. **Ridondanza**: Informazioni ripetute tra card
5. **Manutenibilità**: Logica duplicata tra componenti
6. **Scalabilità**: Difficile aggiungere nuove fasi o informazioni

---

## 2. Soluzione: Architettura Unificata

### 2.1 Struttura Nuova

```
┌─────────────────────────────────────────────────────┐
│  Colonna Destra (Unificata)                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ ToolGenerationFlow (Componente Unico)       │   │
│  │                                             │   │
│  │ Generation Flow                             │   │
│  │ 📋 Input Requirements → ⚙️ Generation → ✓  │   │
│  │                                             │   │
│  ├─────────────────────────────────────────────┤   │
│  │ PHASE 1: Input Requirements                 │   │
│  │ Prerequisites                               │   │
│  │ Provide the required information...         │   │
│  │                                             │   │
│  │ ○ Project          Select a project         │   │
│  │ ✓ Briefing         brief.docx              │   │
│  │ ✓ Ready to Generate All prerequisites met   │   │
│  │                                             │   │
│  │ Ready to generate                           │   │
│  ├─────────────────────────────────────────────┤   │
│  │ PHASE 2: Generation Progress                │   │
│  │ 1 of 3 steps completed                      │   │
│  │ [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] │   │
│  │                                             │   │
│  │ ✓ Opt-in Page                    [Done]    │   │
│  │   Generate high-converting opt-in...        │   │
│  │   Preview: [content...]                     │   │
│  │   [View Artifact]                           │   │
│  │                                             │   │
│  │ ⟳ Quiz                        [Generating]  │   │
│  │   Generate interactive quiz                 │   │
│  │   Preview: [streaming...]                   │   │
│  │   [Streaming...]                            │   │
│  │                                             │   │
│  │ ○ VSL Script                     [Pending]  │   │
│  │   Generate video sales letter script        │   │
│  │                                             │   │
│  │ Generating quiz...                          │   │
│  ├─────────────────────────────────────────────┤   │
│  │ PHASE 3: Completed                          │   │
│  │ Generation Complete                         │   │
│  │ All 3 steps have been completed...          │   │
│  │                                             │   │
│  │ ┌─────────────────────────────────────────┐ │   │
│  │ │ 3                                       │ │   │
│  │ │ ARTIFACTS GENERATED                     │ │   │
│  │ └─────────────────────────────────────────┘ │   │
│  │                                             │   │
│  │ ✓ Opt-in Page        [View Artifact]       │   │
│  │ ✓ Quiz               [View Artifact]       │   │
│  │ ✓ VSL Script         [View Artifact]       │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2.2 Vantaggi della Soluzione

1. **Unificazione**: Unico componente rappresenta il flow completo
2. **Coerenza**: Chiara progressione tra fasi
3. **Chiarezza**: Utente capisce il flow completo
4. **Efficienza**: Nessuna ridondanza informativa
5. **Manutenibilità**: Logica centralizzata in un componente
6. **Scalabilità**: Facile aggiungere nuove fasi o informazioni

---

## 3. Tre Fasi del Flow

### 3.1 Phase 1: Input Requirements

**Quando**: Stato iniziale, prima che la generazione inizi

**Mostra**:
- Checklist dei prerequisiti (Project, Briefing, Readiness)
- Stato di ogni prerequisito (todo, active, done, error)
- Messaggi di feedback su cosa è necessario per procedere

**Semantica**:
- `todo`: Non completato, azione richiesta
- `active`: In corso (es. upload in progress)
- `done`: Completato, pronto
- `error`: Errore, azione correttiva richiesta

**Transizione**: Quando tutti i prerequisiti sono `done`, il flow passa a Phase 2

### 3.2 Phase 2: Generation Monitoring

**Quando**: Generazione in corso o in pausa

**Mostra**:
- Progress bar (completed steps / total steps)
- Step corrente in generazione
- Artifact preview per ogni step
- Status streaming in tempo reale

**Semantica**:
- `idle`: Step non ancora iniziato
- `running`: Step in generazione
- `completed`: Step completato
- `error`: Step fallito

**Transizione**: Quando tutti gli step sono `completed`, il flow passa a Phase 3

### 3.3 Phase 3: Completion

**Quando**: Tutti gli step completati

**Mostra**:
- Summary stats (total artifacts generated)
- Lista di tutti gli step completati
- Link per visualizzare ogni artifact

**Semantica**:
- Celebrazione del completamento
- Accesso rapido agli artifact generati

---

## 4. Implementazione

### 4.1 Nuovo Componente: ToolGenerationFlow

**File**: `frontend/src/features/tools/ui/ToolGenerationFlow.tsx`

**Responsabilità**:
- Renderizzare il flow unificato
- Gestire la transizione tra fasi
- Mostrare informazioni contestuali per ogni fase
- Fornire azioni (View Artifact, etc.)

**Props**:
```typescript
interface ToolGenerationFlowProps {
  toolKey: SupportedTool;
  canonicalState: CanonicalToolUiState;
  
  // Input phase data
  projectName: string | null;
  briefingFileName: string | null;
  briefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready';
  briefingError: string | null;
  
  // Generation phase data
  steps: StepProgress[];
  currentRunningStep: ToolStep | null;
  completedStepsCount: number;
  totalStepsCount: number;
  
  // Status messages
  statusMessage: string | null;
  errorMessage: string | null;
  
  // Actions
  onViewArtifact?: (artifactId: string) => void;
}
```

### 4.2 Aggiornamento: ToolPageTemplate

**Cambio**: Sostituire ToolStatusCard + ToolStepCard[] con ToolGenerationFlow

**Prima**:
```typescript
<ToolStatusCard {...props} />
<div className="ui-tool-steps-container">
  <h3>Generation Steps</h3>
  {toolConfig.steps.map((step) => (
    <ToolStepCard key={step} {...props} />
  ))}
</div>
```

**Dopo**:
```typescript
<ToolGenerationFlow
  toolKey={toolKey}
  canonicalState={uiState.canonicalState}
  projectName={currentProject?.name ?? null}
  briefingFileName={effectiveBriefingFileName ?? null}
  briefingStatus={effectiveBriefingStatus}
  briefingError={briefingUpload.error}
  steps={toolConfig.steps.map((step) => ({
    step,
    displayName: step.charAt(0).toUpperCase() + step.slice(1),
    description: `Generate ${step} content`,
    status: uiState.stepStatuses[step] ?? 'idle',
    previewContent: latestArtifactByStep[step]?.content ?? null,
    artifactId: latestArtifactByStep[step]?.artifactId ?? null,
    isStreaming: generation.isStreamActive && currentRunningStep === step,
  }))}
  currentRunningStep={currentRunningStep}
  completedStepsCount={completedStepsForFlow.size}
  totalStepsCount={toolConfig.steps.length}
  statusMessage={uiState.statusMessage}
  errorMessage={uiState.errorMessage}
  onViewArtifact={(artifactId) => {
    // Navigate to artifact detail page
  }}
/>
```

### 4.3 Stili CSS

**File**: `frontend/src/styles.css`

**Classi principali**:
- `.ui-tool-generation-flow` - Main wrapper
- `.ui-flow-header` - Header con phase indicators
- `.ui-flow-phases` - Phase indicators container
- `.ui-flow-phase-content` - Content per fase
- `.ui-flow-requirements-list` - Requirements checklist
- `.ui-flow-steps-list` - Steps list
- `.ui-flow-step-preview` - Preview area
- `.ui-flow-completion-summary` - Completion stats

---

## 5. Benefici della Migrazione

### 5.1 UX Improvements

✅ **Chiarezza**: Utente capisce il flow completo
✅ **Progressione**: Chiara transizione tra fasi
✅ **Riduzione Cognitive Load**: Informazioni organizzate logicamente
✅ **Consistenza**: Stesso flow per tutti i tool

### 5.2 Technical Improvements

✅ **Unificazione**: Unico componente per il flow
✅ **Manutenibilità**: Logica centralizzata
✅ **Scalabilità**: Facile aggiungere nuove fasi
✅ **Testabilità**: Componente isolato e testabile

### 5.3 Code Quality

✅ **Riduzione Duplicazione**: Nessuna logica duplicata
✅ **Coerenza**: Stessi pattern per tutti i tool
✅ **Documentazione**: Componente ben documentato
✅ **Type Safety**: Props ben tipizzate

---

## 6. Migrazione Checklist

- [x] Creare nuovo componente `ToolGenerationFlow.tsx`
- [x] Implementare tre fasi (Input, Generation, Completion)
- [x] Aggiungere stili CSS per il nuovo componente
- [x] Aggiornare `ToolPageTemplate` per usare il nuovo componente
- [x] Documentare il nuovo componente
- [ ] Testare il nuovo componente con FunnelPages
- [ ] Testare il nuovo componente con NextLand
- [ ] Verificare responsive design
- [ ] Verificare accessibility (ARIA labels, keyboard navigation)
- [ ] Rimuovere componenti vecchi (ToolStatusCard, ToolStepCard) se non usati altrove
- [ ] Aggiornare documentazione architetturale

---

## 7. Backward Compatibility

**ToolStatusCard** e **ToolStepCard** rimangono disponibili per:
- Usi legacy in altre parti dell'applicazione
- Transizione graduale se necessaria

**Raccomandazione**: Rimuovere dopo verificare che nessun altro componente le usa.

---

## 8. Future Enhancements

- [ ] Collapsible phases per compact view
- [ ] Keyboard navigation tra fasi
- [ ] Accessibility improvements (ARIA labels, focus management)
- [ ] Animation transitions tra fasi
- [ ] Customizable phase labels per tool
- [ ] Export/share generation progress
- [ ] Undo/redo per step
- [x] Checkpoint recovery UI (stabilizzazione readiness + compatibilità artifact legacy)

---

**Last Updated**: 2026-05-02
**Status**: Active
**Next Review**: 2026-06-02
