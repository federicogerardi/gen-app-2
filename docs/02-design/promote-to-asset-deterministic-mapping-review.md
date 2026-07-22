---
status: draft
version: 1.0
date_created: 2026-07-20
last-reviewed: 2026-07-20
next-review-date: 2026-08-03
owner: frontend
type: design-review
tags: [asset, promote, ux, deterministic-mapping]
goal: Valutare la rimozione della select Asset Type nel dialog "Promote to Asset" in favore di una mappatura deterministica 1:1 da tool key ad asset type prodotto.
---

# Promote-to-Asset: rimozione select e mappatura deterministica

## Contesto

Il dialog "Promote to Asset" (`PromoteAssetDialog.tsx`) consente di convertire un artifact generato in un Asset riutilizzabile. Attualmente l'utente seleziona manualmente l'Asset Type da un dropdown con tutti i 13 valori di `ASSET_TYPES`.

Esiste già una mappatura canonica `ToolAssetContract.produces` (`packages/contracts/src/asset.ts`) che dichiara quali AssetType un tool produce.

## Decisioni

### D1: Ogni tool produce al massimo un AssetType

Il contratto `ToolAssetContract.produces` deve contenere **esattamente 0 o 1 entry**. La produzione multi-tipo (`blog-article-generator` → `article-outline` + `article`) è un errore ed è stata corretta: `blog-article-generator` produce solo `article`. `article-outline` resta dichiarato in `ASSET_TYPES` ma senza producer.

**Regola**: se in futuro un tool deve produrre due tipi distinti, si valuta l'estensione del contratto con `producesByStep` (granularità step-level), non un array piatto con più valori.

### D2: Mappatura 1:1 deterministica

Il dialog non espone più la select. L'AssetType è risolto dal FE chiamando `getProducedAssetTypes(toolKey)` e passato direttamente a `promoteArtifactToAsset`. L'utente inserisce solo il label.

### D3: Pulsante "Promote" nascosto quando il tool non produce asset

Se `getProducedAssetTypes(toolKey)` restituisce array vuoto, il pulsante non appare. Non serve reachability del dialog senza candidato valido.

### D4: toolKey null → pulsante nascosto

Se `toolKey` è `null` (possibile in `SessionArtifactGroup`), il pulsante non appare. L'app non deve rompersi — il gating è a monte del dialog, nessun errore runtime.

## Matrice aggiornata

| Asset Type | Consumatori | Produttori |
|---|---|---|
| `angle` | funnel-pages, meta-ads | angle-generator |
| `persona` | funnel-pages, nextland, youtube-lf-script, angle-generator (opt), meta-ads | personas-generator |
| `brand-voice` | funnel-pages, nextland, youtube-lf-script, meta-ads, youtube-description | tov-generator |
| `hook` | meta-ads | — |
| `competitor-analysis` | nextland, youtube-lf-script, angle-generator (opt), personas-generator (opt) | geometric |
| `creative-brief` | — | — |
| `ad-copy` | — | meta-ads |
| `landing-page` | — | nextland |
| `article-outline` | — | — |
| `article` | — | blog-article-generator |
| `script` | — | youtube-lf-script |
| `description` | — | youtube-description |
| `brief` | funnel-pages, nextland, youtube-lf-script, angle-generator, meta-ads, personas-generator | brief-generator |

## Touchpoint di implementazione

| # | File | Modifica |
|---|------|----------|
| 1 | `PromoteAssetDialog.tsx` | Aggiungere prop `toolKey`, rimuovere `<TextField select>`, risolvere `assetType` via `getProducedAssetTypes(toolKey)`, mostrare tipo risolto come label/chip read-only |
| 2 | `SessionSummaryDetailPage.tsx` | Passare `group.toolKey` al dialog |
| 3 | `RecentArtifactsPanel.tsx` | Passare `artifact.toolKey` al dialog |
| 4 | `system.ts` | Rimuovere key `assetTypeLabel` |
| 5 | `RecentArtifactsPanel.test.tsx` | Aggiornare mock con nuova prop `toolKey` |

## Gating lato caller

Prima di mostrare il pulsante, il caller verifica:

```ts
const producedTypes = toolKey ? getProducedAssetTypes(toolKey) : [];
const canPromote = producedTypes.length === 1;
```

- `canPromote === true` → pulsante visibile, dialog riceve `toolKey`
- `canPromote === false` → pulsante nascosto, dialog mai aperto

## Non modificato

- **Backend** `tools-asset-handlers.ts`: la validazione `assetType` rimane invariata (il FE invia il tipo risolto)
- **`PromoteArtifactInput`** in `asset-client.ts`: l'interfaccia continua a richiedere `assetType`, ma il valore è calcolato dal FE

## Rischio accettato

L'utente perde la flessibilità di promuovere un artifact a un AssetType diverso da quello dichiarato dal contratto. Questo è coerente con l'intent del dominio: un tool produce semanticamente un solo tipo di contenuto.