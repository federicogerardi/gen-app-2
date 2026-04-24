## 19. Allegato: Contratto Tipi Artifact (Sintetico, Normativo)

Sorgente canonica implementativa:

- [src/lib/types/artifact.ts](../../src/lib/types/artifact.ts)

Tipi normativi minimi da preservare:

```ts
export type ArtifactType = 'content' | 'seo' | 'code' | 'extraction';
export type ArtifactStatus = 'generating' | 'completed' | 'failed';
export type ArtifactFailureReason = 'client_disconnect' | 'timeout' | 'error' | 'stale';

export type ToolWorkflow = 'meta_ads' | 'funnel_pages' | 'nextland' | 'extraction';
export type QuotaEventStatus = 'success' | 'error' | 'rate_limited';
export type OutputFormat = 'plain' | 'json' | 'markdown';
```

Validatori richiesti (firma minima):

```ts
export declare function isArtifactType(value: unknown): value is ArtifactType;
export declare function isArtifactStatus(value: unknown): value is ArtifactStatus;
export declare function isToolWorkflow(value: unknown): value is ToolWorkflow;
export declare function isQuotaEventStatus(value: unknown): value is QuotaEventStatus;
export declare function isOutputFormat(value: unknown): value is OutputFormat;
```

Nota contract-first:

- Le seed enum sopra sono baseline as-is.
- I valori registry-backed aperti nel tempo sono governati dal Tool Registry (sezione 4.4).

