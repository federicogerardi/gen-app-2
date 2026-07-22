---
status: draft
version: 1.0
last-reviewed: 2026-07-23
next-review-date: 2026-10-23
owner: Backend Runtime + Admin Platform
date_created: 2026-06-12
title: Geometric Admin Debug & Monitoring Proposal
type: proposal
tags: [geometric, admin, monitoring, debugging, crawling, validation, ai-overview, error-tracking]
---

# Geometric Admin Debug & Monitoring Proposal

## Obiettivo

Definire strategie di debug e monitoraggio admin per verificare che gli output di Geometric siano reali e corretti, con focus su:
- Verifica del risultato crawling per sessione
- Conferma che il componente estratto da Google sia effettivamente l'AI Overview
- Tracking strutturato di errori e anomalie

---

## 1. Verifica Crawling per Sessione

| Strategia | Implementazione |
|-----------|----------------|
| **Raw SERP storage** | Salvare `crawlArtifacts[]` completi in DB/Redis per sessione admin-review |
| **Artifact diffing** | Confrontare `sources.length`, `paaQueries.length` tra sessioni per anomalie |
| **Session audit trail** | Log strutturato: `crawling.start` → `crawling.completed` → `scoring.completed` con `requestId` |

**File da modificare**: `generation-system.actions.ts` → aggiungere `cacheCrawlingArtifactsForAdmin` action

---

## 2. Validazione AI Overview Estratto

| Strategia | Implementazione |
|-----------|----------------|
| **Selector confidence score** | Tracciare quale selettore ha matchato (`[data-snf]` vs `.AIHVYe` vs `[data-attrid]`) |
| **Content heuristics** | Verificare che il testo contenga pattern tipici AI Overview (frasi complete, struttura riassuntiva, non solo snippet) |
| **Length validation** | AI Overview tipicamente 50-300 caratteri. Se < 20 o > 500 → flag sospetto |
| **HTML structure check** | Verificare che l'elemento estratto abbia attributi tipici (`data-snf`, `data-attrid`) |
| **Cross-query consistency** | Se stessa query → stesso AI Overview in sessioni diverse → conferma validità |

**Implementazione suggerita**:
```typescript
// crawling.adapter.ts
const aiOverviewConfidence = (element: Element): number => {
  if (element.hasAttribute('data-snf')) return 0.95;
  if (element.classList.contains('AIHVYe')) return 0.90;
  if (element.hasAttribute('data-attrid')) return 0.85;
  return 0.50; // fallback
}
```

---

## 3. Error Tracking & Alerting

| Tipo Errore | Strategia | Azione Admin |
|-------------|-----------|--------------|
| **Crawling timeout** | Log `crawling.failed` con `durationMs > 30000` | Retry manuale o modifica timeout |
| **0 sources estratte** | Log `merge.crawling.empty` | Verificare query e configurazione SerpApi |
| **SerpApi API error** | Log `crawling.failed` con status code HTTP | Verificare API key e quota SerpApi |
| **PAA discovery fallita** | Log `crawling.paa.single_failed` per query | Accettabile, ma monitorare frequenza |
| **Scoring insufficiente** | Log `scoring.failed.no_sources` | Verificare crawling precedente |
| **LLM output non-markdown** | Log `generateOutputIsFailure` | Retry con prompt refinement |

**Struttura log consigliata**:
```json
{
  "level": "error",
  "tool": "geometric",
  "operation": "crawling.failed",
  "requestId": "req-abc-123",
  "sessionId": "session-xyz",
  "durationMs": 31200,
  "error": "timeout",
  "baseQuery": "protein supplements",
  "country": "google.it",
  "timestamp": "2026-06-12T14:30:00Z"
}
```

---

## 4. Admin Dashboard — Metriche Chiave

| Metrica | Soglia Alert | Azione |
|---------|-------------|--------|
| **Crawling success rate** | < 80% su 100 sessioni | Verificare selettori/stealth |
| **AI Overview extraction rate** | < 70% | Aggiornare selettori |
| **PAA discovery rate** | < 30% | Accettabile, ma monitorare trend |
| **Average crawling duration** | > 25s | Verificare tempo di risposta SerpApi o ridurre timeout |
| **Scoring completion rate** | < 90% | Verificare crawling sources |
| **LLM generation success rate** | < 85% | Verificare prompt e context |

---

## 5. Implementazione Pratica — Admin Verification Endpoint

```typescript
// GET /api/admin/geometric/sessions/:sessionId/verification
{
  "sessionId": "session-xyz",
  "crawling": {
    "status": "completed",
    "baseQuery": "protein supplements",
    "language": "it",
    "country": "google.it",
    "aiOverviewExtracted": true,
    "aiOverviewLength": 142,
    "sourcesCount": 8,
    "paaQueriesCount": 3,
    "durationMs": 12400,
    "errors": []
  },
  "scoring": {
    "status": "completed",
    "competitorsCount": 5,
    "tierDistribution": { "S": 1, "A": 2, "B": 2 },
    "durationMs": 45
  },
  "generation": {
    "strategicReport": { "status": "completed", "length": 2400 },
    "unifiedReport": { "status": "completed", "length": 4800 }
  }
}
```

---

## 6. Strategia di Validazione AI Overview — Dettagliata

```
Validazione AI Overview
  │
  ├─ 1. Selector match:
  │  ├─ [data-snf] → confidence 0.95 (più affidabile)
  │  ├─ .AIHVYe → confidence 0.90
  │  └─ [data-attrid="wa:/description"] → confidence 0.85
  │
  ├─ 2. Content checks:
  │  ├─ Length: 50-300 chars → OK, < 20 o > 500 → flag
  │  ├─ Contains complete sentences → OK
  │  ├─ No HTML tags残留 → OK
  │  └─ Not identical to any source snippet → OK (AI Overview è riassunto)
  │
  ├─ 3. Cross-validation:
  │  ├─ Same query, different session → similar AI Overview → OK
  │  └─ Same query, same session → identical AI Overview → OK
  │
  └─ 4. Admin flag:
      ├─ confidence < 0.70 → "Low confidence AI Overview"
      ├─ length < 20 → "Possible extraction error"
      └─ length > 500 → "Possible full page extraction"
```

---

## 7. File da Modificare per Implementare

| File | Modifica |
|------|----------|
| `crawling.adapter.ts` | Aggiungere `aiOverviewConfidence`, `aiOverviewLength`, `selectorUsed` al risultato |
| `generation-system.actors.ts` | Loggare `aiOverviewConfidence` e `selectorUsed` in `crawling.completed` |
| `generation-system.types.ts` | Aggiungere campi opzionali a `CrawlingDoneOutput` per admin verification |
| `auth-http/admin-geometric-handlers.ts` | **Nuovo file**: endpoint admin per verifica sessione |
| `geometric-logger.ts` | Aggiungere `logGeometricAdmin` per log strutturati admin |

---

## 8. Priorità di Implementazione

| Priorità | Strategia | Complessità | Valore |
|----------|-----------|-------------|--------|
| **🔴 Alta** | Error tracking strutturato | Bassa | Alto |
| **🟡 Media** | AI Overview confidence score | Media | Medio |
| **🟡 Media** | Admin verification endpoint | Media | Alto |
| **🟢 Bassa** | Cross-query consistency check | Alta | Medio |
| **🟢 Bassa** | Dashboard metriche in tempo reale | Alta | Medio |

---

## 9. Raccomandazione

Iniziare con **error tracking strutturato** (bassa complessità, alto valore), poi aggiungere **AI Overview confidence score** e **admin verification endpoint**.

Questa proposta è indipendente dall'MVP di Geometric e può essere implementata in una fase successiva senza impattare il flusso esistente.
