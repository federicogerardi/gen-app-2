---
goal: Rimuovere la select `AssetType` dal dialog `PromoteAssetDialog` e applicare mappatura deterministica 1:1 da tool key ad asset type prodotto. Nascondere il pulsante "Promote" per tool senza producer.
version: 1.1.0
date_created: 2026-07-20
last-reviewed: 2026-07-20
next-review-date: 2026-08-03
owner: Frontend Team
status: approved
tags:
  - asset-domain
  - promote-dialog
  - deterministic-mapping
  - ui-composition
  - ddd-governance
---

# Piano: Promote-to-Asset Deterministico

## Obiettivo

Rimuovere la select manuale `AssetType` dal dialog `PromoteAssetDialog` e applicare una mappatura deterministica 1:1: il tool produce esattamente un AssetType (definito da `TOOL_ASSET_CONTRACTS.produces`). Per i tool senza tipo prodotto, il pulsante "Promote" non viene renderizzato.

## Prerequisiti DDD (COMPLETED)

| Prereq | DDD ID | Contenuto | Status |
|---|---|---|---|
| **P1** | DDD-228 | Principio: ogni tool produce al massimo 1 AssetType. Correzione `blog-article-generator` → solo `article`. `article-outline` dormant. | ✅ CLOSED |
| **P2** | DDD-229 | Promote-to-Asset deterministico: rimossa select, risoluzione da `getProducedAssetTypes(toolKey)`. Pulsante nascosto se nessun producer. | ✅ CLOSED |
| **P3** | DDD-230 | `funnel-pages` non produce più `landing-page` → `produces: []`. Unico producer di `landing-page` è `nextland`. | ✅ CLOSED |
| **P4** | DDD-231 | `meta-ads` produce solo `ad-copy`. `hook` diventa AssetType senza producer. | ✅ CLOSED |

---

## Contratto aggiornato (source of truth)

Da `packages/contracts/src/asset.ts`. Ogni tool produce 0 o 1 tipo:

| ToolKey | Produces | Promote? |
|---|---|---|
| `angle-generator` | `angle` | ✅ |
| `personas-generator` | `persona` | ✅ |
| `tov-generator` | `brand-voice` | ✅ |
| `meta-ads` | `ad-copy` | ✅ |
| `nextland` | `landing-page` | ✅ |
| `youtube-lf-script` | `script` | ✅ |
| `youtube-description` | `description` | ✅ |
| `geometric` | `competitor-analysis` | ✅ |
| `blog-article-generator` | `article` | ✅ |
| `brief-generator` | `brief` | ✅ |
| `funnel-pages` | — (empty) | ❌ |

**Tool con `produces: []` → pulsante nascosto**. I tool con `produces` singolo ricevono il dialog con tipo pre-risolto.

---

## Task

### T1: PromoteAssetDialog — aggiungere prop `toolKey`, rimuovere select

**File**: `apps/frontend/src/features/sessionsummary/ui/PromoteAssetDialog.tsx`

**Modifiche**:
1. Aggiungere `toolKey: ToolKey` alle props di `PromoteAssetDialogProps`
2. Importare `getProducedAssetTypes` da `@gen-app-2/contracts`
3. Rimuovere `useState(assetType)` e l'intero `<TextField select>` (r.38, r.91-105)
4. Risolvere `assetType` deterministicamente:
   ```ts
   const producedTypes = getProducedAssetTypes(toolKey);
   const assetType = producedTypes[0]; // sempre esattamente 1 (DDD-228)
   ```
5. Mostrare asset type risolto come label/chip read-only (es. `<Chip label={ASSET_TYPE_LABELS[assetType]} />`)
6. Il placeholder del label field usa `ASSET_TYPE_LABELS[assetType]` (invariato)
7. Il pulsante Promote rimane disabilitato finché label è vuoto (invariato)

### T2: SessionSummaryDetailPage — passare `toolKey` al dialog

**File**: `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx`

**Modifiche**:

1. **Pulsante (r.244-253)**: applicare gating:
   ```tsx
   {lastArtifact && projectId && group.toolKey
     && getProducedAssetTypes(group.toolKey as ToolKey).length === 1 && (
     <Button
       variant="outlined"
       size="small"
       startIcon={<Package size={14} />}
       onClick={() => setPromoteDialogOpen(true)}
     >
       Promote to Asset
     </Button>
   )}
   ```
2. **Dialog (r.284-293)**: aggiungere prop `toolKey`:
   ```tsx
   <PromoteAssetDialog
     open={promoteDialogOpen}
     artifactId={lastArtifact.artifactId}
     projectId={projectId}
     toolKey={group.toolKey as ToolKey}
     defaultLabel={`${formatToolName(group.toolKey)} - ${lastArtifact.stepKey ?? 'output'}`}
     onClose={() => setPromoteDialogOpen(false)}
     onPromoted={() => setPromoteDialogOpen(false)}
   />
   ```
3. Aggiungere import: `import { getProducedAssetTypes, type ToolKey } from '@gen-app-2/contracts';`

### T3: RecentArtifactsPanel — passare `toolKey` al dialog

**File**: `apps/frontend/src/features/workspace/ui/dashboard/RecentArtifactsPanel.tsx`

**Modifiche** (r.87-98):
1. Tenere traccia di `promoteDialogToolKey` oltre a `promoteDialogArtifactId` (oppure cercare `toolKey` dall'artifact quando il dialog si apre)
2. Passare `toolKey` al dialog
3. Applicare stesso gating: pulsante mostrato solo se `artifact.toolKey && getProducedAssetTypes(artifact.toolKey).length === 1`

### T4: Rimuovere copy inutilizzata

**File**: `apps/frontend/src/app/copy/system.ts`

**Modifica**: rimuovere key `assetTypeLabel: 'Asset Type'` da `promoteDialog` (r.889)

### T5: Aggiornare test

**File**: `apps/frontend/src/features/workspace/ui/dashboard/RecentArtifactsPanel.test.tsx`

**Modifiche**:
1. Aggiornare mock di `PromoteAssetDialog` per includere prop `toolKey`
2. Eventuali test che verificano la presenza della select vanno rimossi o aggiornati

---

## Gating lato caller (pseudocodice)

```ts
const canPromote = toolKey !== null
  && getProducedAssetTypes(toolKey).length === 1;

// JSX
{canPromote && (
  <Button onClick={() => setPromoteDialogOpen(true)}>
    Promote to Asset
  </Button>
)}
{canPromote && (
  <PromoteAssetDialog
    open={promoteDialogOpen}
    artifactId={artifactId}
    projectId={projectId}
    toolKey={toolKey!}
    defaultLabel={defaultLabel}
    onClose={...}
    onPromoted={...}
  />
)}
```

## Non modificato

- **Backend** `tools-asset-handlers.ts`: la validazione `assetType` rimane invariata
- **`PromoteArtifactInput`** in `asset-client.ts`: riceve ancora `assetType`, ma risolto dal FE
- **`getProducedAssetTypes`**: già esportato da contracts, usato direttamente

## Scenari QA

| # | Caller | ToolKey | Scenario | Risultato atteso |
|---|---|---|---|---|
| QA1 | SessionSummaryDetailPage | `funnel-pages` | Aprire session detail | Pulsante "Promote to Asset" **assente** (`produces: []`) |
| QA2 | SessionSummaryDetailPage | `angle-generator` | Aprire session detail, cliccare Promote | Dialog si apre, mostra chip read-only "Angle", label precompilato |
| QA3 | SessionSummaryDetailPage | `meta-ads` | Aprire session detail, cliccare Promote | Dialog si apre, mostra chip "Ad Copy", tipo risolto automaticamente |
| QA4 | SessionSummaryDetailPage | `blog-article-generator` | Aprire session detail, cliccare Promote | Dialog si apre, mostra chip "Article" |
| QA5 | SessionSummaryDetailPage | `nextland` | Aprire session detail, cliccare Promote | Dialog si apre, mostra chip "Landing Page" |
| QA6 | RecentArtifactsPanel | qualsiasi con `produces` | Aprire dashboard, cliccare Promote su artifact recente | Dialog si apre con tipo risolto |
| QA7 | RecentArtifactsPanel | artifact senza toolKey valido | Aprire dashboard, verificare artifact | Pulsante Promote **assente** |
| QA8 | PromoteAssetDialog | qualsiasi | Compilare label, cliccare Promote | Chiamata `promoteArtifactToAsset` con `assetType` risolto, success toast |
| QA9 | PromoteAssetDialog | qualsiasi | Lasciare label vuoto | Pulsante Promote disabilitato |

## Rollout

1. Applicare T1-T5 in ordine
2. `npm --workspace apps/backend run test` — confermare 396/396
3. `npm --workspace apps/frontend run test` — confermare test pass
4. `npm --workspace apps/frontend run typecheck`
5. Verifica manuale: aprire session detail per tool con/senza producer, verificare presenza/assenza pulsante, verificare dialog con tipo read-only