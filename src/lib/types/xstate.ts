import type { ArtifactType, OutputFormat, ToolWorkflow } from './artifact';

export type IsoTimestamp = string;

export type RegistryBackedArtifactType = ArtifactType | (string & {});
export type RegistryBackedWorkflowType = ToolWorkflow | (string & {}) | null;
export type RegistryBackedToolKey = ToolWorkflow | (string & {});
export type ToolRegistryVersion = string & {};
export type ToolRegistrySnapshotRef = string & {};

export type RequestRegistrySelector =
  | {
    registryVersion: ToolRegistryVersion;
    registrySnapshotRef?: ToolRegistrySnapshotRef;
  }
  | {
    registryVersion?: ToolRegistryVersion;
    registrySnapshotRef: ToolRegistrySnapshotRef;
  };

export type WorkflowRunMode = 'new' | 'resume' | 'regenerate';
export type WorkflowStepStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped';
export type ExtractionResponseMode = 'structured' | 'text';

export const GENERATION_ACTOR_SOURCES = [
  'generationSystemMachine',
  'requestGatewayMachine',
  'usageMachine',
  'idempotencyCoordinatorMachine',
  'streamTransportMachine',
  'persistenceBatchMachine',
  'toolWorkflowMachine',
  'extractionChainMachine',
] as const;

export type GenerationActorSource = (typeof GENERATION_ACTOR_SOURCES)[number];

export interface GenerationActorEventEnvelope<
  TType extends string,
  TSource extends GenerationActorSource,
> {
  type: TType;
  requestId: string;
  sourceActor: TSource;
  timestamp: IsoTimestamp;
}

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

export interface WorkflowStepDescriptor {
  key: string;
  dependencies: string[];
  optional?: boolean;
}

export interface WorkflowStepState {
  key: string;
  status: WorkflowStepStatus;
  retryCount: number;
  errorMessage: string | null;
}

export interface EstimatedTokenUsage {
  input: number;
  output: number;
}

export interface StreamChunkMetadata {
  chunk: string;
  sequence: number;
}

export interface StreamHeartbeatMetadata {
  estimatedTokens: EstimatedTokenUsage;
  costEstimate: number;
}

export interface IdempotencyReplayMetadata {
  content: string;
}

export interface ExtractionAttemptPlanEntry {
  attemptIndex: number;
  model: string;
  responseMode?: ExtractionResponseMode;
}

export type UsageActorInput = RequestRegistrySelector & {
  requestId: string;
  userId: string;
  artifactType: RegistryBackedArtifactType;
  workflowType: RegistryBackedWorkflowType;
  runtime?: {
    now?: () => Date;
  };
};

export type IdempotencyCoordinatorInput = RequestRegistrySelector & {
  requestId: string;
  userId: string;
  projectId: string;
  workflowType: RegistryBackedWorkflowType;
  idempotencyKey: string;
  runtime?: {
    now?: () => Date;
  };
};

export type StreamTransportInput = RequestRegistrySelector & {
  requestId: string;
  artifactId: string;
  model: string;
  workflowType: RegistryBackedWorkflowType;
  outputFormat: OutputFormat;
  bootstrap?: {
    autoComplete?: boolean;
    initialChunk?: string;
    failureReason?: string;
  };
  runtime?: {
    now?: () => Date;
  };
};

export type PersistenceBatchInput = RequestRegistrySelector & {
  requestId: string;
  artifactId: string;
  artifactType: RegistryBackedArtifactType;
  workflowType: RegistryBackedWorkflowType;
  contentBuffer: string;
  userId?: string;
  projectId?: string;
  model?: string;
  inputJson?: Record<string, unknown>;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
};

export type ToolWorkflowInput = RequestRegistrySelector & {
  requestId: string;
  toolKey: RegistryBackedToolKey;
  workflowType: Exclude<RegistryBackedWorkflowType, null>;
  runMode: WorkflowRunMode;
  steps: WorkflowStepDescriptor[];
  dependencyGraph: Record<string, string[]>;
  bootstrap?: {
    stepKey: string;
    output: string;
    artifactId: string;
  };
};

export type ExtractionChainInput = RequestRegistrySelector & {
  requestId: string;
  artifactId: string;
  workflowType: Exclude<RegistryBackedWorkflowType, null>;
  attemptPlan: ExtractionAttemptPlanEntry[];
  bootstrap?: {
    autoAccept?: boolean;
  };
};

export type RequestReceivedEvent = RequestRegistrySelector & {
  type: 'REQUEST_RECEIVED';
  requestId: string;
  projectId: string;
  toolKey: RegistryBackedToolKey | null;
  artifactType: RegistryBackedArtifactType;
  model: string;
  input: Record<string, unknown>;
  workflowType?: RegistryBackedWorkflowType;
  idempotencyKey?: string;
};

export interface AuthOkEvent {
  type: 'AUTH_OK';
  userId: string;
}

export interface AuthFailEvent {
  type: 'AUTH_FAIL';
}

export interface ValidationOkEvent {
  type: 'VALIDATION_OK';
  workflowType: RegistryBackedWorkflowType;
  registryVersion: ToolRegistryVersion | null;
  registrySnapshotRef: ToolRegistrySnapshotRef | null;
}

export interface ValidationFailEvent {
  type: 'VALIDATION_FAIL';
  reason: string;
}

export type UsageGrantedEvent = GenerationActorEventEnvelope<
  'USAGE_GRANTED',
  'usageMachine'
>;

export type UsageRejectedEvent = GenerationActorEventEnvelope<
  'USAGE_REJECTED',
  'usageMachine'
> & {
  reason: string;
};

export type IdempotencyClaimedEvent = GenerationActorEventEnvelope<
  'IDEMPOTENCY_CLAIMED',
  'idempotencyCoordinatorMachine'
>;

export type IdempotencyReplayReadyEvent = GenerationActorEventEnvelope<
  'IDEMPOTENCY_REPLAY_READY',
  'idempotencyCoordinatorMachine'
> & {
  artifactId: string;
  metadata: IdempotencyReplayMetadata;
};

export type IdempotencyConflictEvent = GenerationActorEventEnvelope<
  'IDEMPOTENCY_CONFLICT',
  'idempotencyCoordinatorMachine'
> & {
  reason: string;
};

export type StreamSessionStartedEvent = GenerationActorEventEnvelope<
  'STREAM_SESSION_STARTED',
  'streamTransportMachine'
> & {
  artifactId: string;
};

export type StreamChunkReceivedEvent = GenerationActorEventEnvelope<
  'STREAM_CHUNK_RECEIVED',
  'streamTransportMachine'
> & {
  artifactId: string;
  metadata: StreamChunkMetadata;
};

export type StreamHeartbeatDueEvent = GenerationActorEventEnvelope<
  'STREAM_HEARTBEAT_DUE',
  'streamTransportMachine'
> & {
  artifactId: string;
  metadata: StreamHeartbeatMetadata;
};

export type StreamTerminatedSuccessEvent = GenerationActorEventEnvelope<
  'STREAM_TERMINATED_SUCCESS',
  'streamTransportMachine'
> & {
  artifactId: string;
};

export type StreamTerminatedFailureEvent = GenerationActorEventEnvelope<
  'STREAM_TERMINATED_FAILURE',
  'streamTransportMachine'
> & {
  artifactId: string;
  reason: string;
};

export type PersistenceFlushCommittedEvent = GenerationActorEventEnvelope<
  'PERSISTENCE_FLUSH_COMMITTED',
  'persistenceBatchMachine'
> & {
  artifactId: string;
};

export type PersistenceFinalizeSucceededEvent = GenerationActorEventEnvelope<
  'PERSISTENCE_FINALIZE_SUCCEEDED',
  'persistenceBatchMachine'
> & {
  artifactId: string;
};

export type PersistenceFinalizeFailedEvent = GenerationActorEventEnvelope<
  'PERSISTENCE_FINALIZE_FAILED',
  'persistenceBatchMachine'
> & {
  artifactId: string;
  reason: string;
};

export type WorkflowStepUnlockedEvent = GenerationActorEventEnvelope<
  'WORKFLOW_STEP_UNLOCKED',
  'toolWorkflowMachine'
> & {
  stepKey: string;
};

export type WorkflowStepCompletedEvent = GenerationActorEventEnvelope<
  'WORKFLOW_STEP_COMPLETED',
  'toolWorkflowMachine'
> & {
  stepKey: string;
  artifactId: string;
};

export type ExtractionAttemptAcceptedEvent = GenerationActorEventEnvelope<
  'EXTRACTION_ATTEMPT_ACCEPTED',
  'extractionChainMachine'
> & {
  artifactId: string;
  attemptIndex: number;
};

export type ExtractionAttemptRejectedEvent = GenerationActorEventEnvelope<
  'EXTRACTION_ATTEMPT_REJECTED',
  'extractionChainMachine'
> & {
  artifactId: string;
  attemptIndex: number;
  reason: string;
};

export type ExtractionChainExhaustedEvent = GenerationActorEventEnvelope<
  'EXTRACTION_CHAIN_EXHAUSTED',
  'extractionChainMachine'
> & {
  artifactId: string;
  reason: string;
};

export interface ResetEvent {
  type: 'RESET';
}

export type UsageActorEvent = UsageGrantedEvent | UsageRejectedEvent;

export type IdempotencyCoordinatorEvent =
  | IdempotencyClaimedEvent
  | IdempotencyReplayReadyEvent
  | IdempotencyConflictEvent;

export type StreamTransportEvent =
  | StreamSessionStartedEvent
  | StreamChunkReceivedEvent
  | StreamHeartbeatDueEvent
  | StreamTerminatedSuccessEvent
  | StreamTerminatedFailureEvent;

export type PersistenceBatchEvent =
  | PersistenceFlushCommittedEvent
  | PersistenceFinalizeSucceededEvent
  | PersistenceFinalizeFailedEvent;

export type ToolWorkflowEvent =
  | WorkflowStepUnlockedEvent
  | WorkflowStepCompletedEvent;

export type ExtractionChainEvent =
  | ExtractionAttemptAcceptedEvent
  | ExtractionAttemptRejectedEvent
  | ExtractionChainExhaustedEvent;

export type GenerationChildActorEvent =
  | UsageActorEvent
  | IdempotencyCoordinatorEvent
  | StreamTransportEvent
  | PersistenceBatchEvent
  | ToolWorkflowEvent
  | ExtractionChainEvent;

export type GenerationSystemEvent =
  | RequestReceivedEvent
  | AuthOkEvent
  | AuthFailEvent
  | ValidationOkEvent
  | ValidationFailEvent
  | GenerationChildActorEvent
  | ResetEvent;