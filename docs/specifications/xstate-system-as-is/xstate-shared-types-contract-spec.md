## 20. Allegato: Contratto Tipi XState Shared (Sintetico, Normativo)

Sorgente canonica implementativa:

- [src/lib/types/xstate.ts](../../src/lib/types/xstate.ts)

Alias e selector per-request (obbligatori):

```ts
import type { ArtifactType, OutputFormat, ToolWorkflow } from '@/lib/types/artifact';

export type IsoTimestamp = string;

export type RegistryBackedArtifactType = ArtifactType | (string & {});
export type RegistryBackedWorkflowType = ToolWorkflow | (string & {}) | null;
export type RegistryBackedToolKey = ToolWorkflow | (string & {});

export type ToolRegistryVersion = string & {};
export type ToolRegistrySnapshotRef = string & {};

export type RequestRegistrySelector =
  | { registryVersion: ToolRegistryVersion; registrySnapshotRef?: ToolRegistrySnapshotRef }
  | { registryVersion?: ToolRegistryVersion; registrySnapshotRef: ToolRegistrySnapshotRef };
```

Envelope eventi actor-to-actor (obbligatorio):

```ts
export type GenerationActorSource =
  | 'generationSystemMachine'
  | 'requestGatewayMachine'
  | 'usageMachine'
  | 'idempotencyCoordinatorMachine'
  | 'streamTransportMachine'
  | 'persistenceBatchMachine'
  | 'toolWorkflowMachine'
  | 'extractionChainMachine';

export interface GenerationActorEventEnvelope<TType extends string, TSource extends GenerationActorSource> {
  type: TType;
  requestId: string;
  sourceActor: TSource;
  timestamp: IsoTimestamp;
}
```

Contesto root (minimo richiesto):

```ts
export interface GenerationSystemContext {
  requestId: string;
  userId: string | null;
  projectId: string | null;
  toolKey: RegistryBackedToolKey | null;
  registryVersion: ToolRegistryVersion | null;
  registrySnapshotRef: ToolRegistrySnapshotRef | null;
  workflowType: RegistryBackedWorkflowType;
  artifactType: RegistryBackedArtifactType;
  artifactId: string | null;
  contentBuffer: string;
  failureReason: string | null;
}
```

Input actor (shape normativa):

```ts
export type WorkflowRunMode = 'new' | 'resume' | 'regenerate';
export type WorkflowStepStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped';
export type ExtractionResponseMode = 'structured' | 'text';

export type UsageActorInput = RequestRegistrySelector & {
  requestId: string;
  userId: string;
  artifactType: RegistryBackedArtifactType;
  workflowType: RegistryBackedWorkflowType;
};

export type IdempotencyCoordinatorInput = RequestRegistrySelector & {
  requestId: string;
  userId: string;
  projectId: string;
  workflowType: RegistryBackedWorkflowType;
  idempotencyKey: string;
};

export type StreamTransportInput = RequestRegistrySelector & {
  requestId: string;
  artifactId: string;
  model: string;
  workflowType: RegistryBackedWorkflowType;
  outputFormat: OutputFormat;
};

export type PersistenceBatchInput = RequestRegistrySelector & {
  requestId: string;
  artifactId: string;
  artifactType: RegistryBackedArtifactType;
  workflowType: RegistryBackedWorkflowType;
  contentBuffer: string;
};
```

Famiglie evento normative (unioni da mantenere):

```ts
export type GenerationSystemEvent =
  | RequestReceivedEvent
  | AuthOkEvent
  | AuthFailEvent
  | ValidationOkEvent
  | ValidationFailEvent
  | GenerationChildActorEvent
  | ResetEvent;
```

Nota contract-first:

- Questo allegato definisce il minimo normativo.
- I dettagli completi (tutte le interfacce ed eventi specifici) restano nei sorgenti canonici linkati sopra.
