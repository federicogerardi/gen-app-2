import { assign, enqueueActions, fromPromise, setup } from 'xstate';

import type { GenerationAdapters } from '../adapters/generation.adapters';
import { idempotencyCoordinatorMachine } from './idempotency-coordinator.machine';
import { persistenceBatchMachine } from './persistence-batch.machine';
import { streamTransportMachine } from './stream-transport.machine';
import { toolWorkflowMachine } from './tool-workflow.machine';
import { usageMachine } from './usage.machine';

import type {
  GenerationSystemContext,
  GenerationSystemEvent,
  RequestReceivedEvent,
  RegistryBackedWorkflowType,
  WorkflowStepDescriptor,
} from '../types/xstate';
import type { OutputFormat } from '../types/artifact';
import { TOOL_WORKFLOW_REGISTRY, isSupportedToolWorkflow, type ToolWorkflowPlan } from '../runtime/tool-workflow-registry';

type GenerationSystemInput = {
  adapters: GenerationAdapters;
  initialContext?: Partial<GenerationSystemContext>;
  runtime?: {
    now?: () => Date;
    artifactIdFactory?: () => string;
    responseBuilder?: (request: RequestReceivedEvent) => string;
  };
};

type RouteType = 'generic' | 'tool' | 'extraction' | null;

type GenerationMachineContext = GenerationSystemContext & {
  adapters: GenerationAdapters;
  model: string;
  requestInput: Record<string, unknown>;
  idempotencyKey: string | null;
  outputFormat: OutputFormat;
  syntheticResponse: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  routeType: RouteType;
  runtimeNow: () => Date;
  artifactIdFactory: () => string;
  responseBuilder: (request: RequestReceivedEvent) => string;
};

type IdempotencyDoneOutput =
  | { type: 'IDEMPOTENCY_CLAIMED' }
  | { type: 'IDEMPOTENCY_REPLAY_READY'; artifactId: string; metadata: { content: string } }
  | { type: 'IDEMPOTENCY_CONFLICT'; reason: string };

type UsageDoneOutput =
  | { type: 'USAGE_GRANTED' }
  | { type: 'USAGE_REJECTED'; reason: string };

type StreamDoneOutput =
  | {
      type: 'STREAM_TERMINATED_SUCCESS';
      content?: string;
      metrics?: { inputTokens: number; outputTokens: number; costUsd: number };
    }
  | {
      type: 'STREAM_TERMINATED_FAILURE';
      reason: string;
      content?: string;
      metrics?: { inputTokens: number; outputTokens: number; costUsd: number };
    };

type ExtractionDoneOutput =
  | {
      type: 'EXTRACTION_ATTEMPT_ACCEPTED';
      artifactId: string;
      content: string;
      structuredPayload: Record<string, unknown>;
    }
  | { type: 'EXTRACTION_ATTEMPT_REJECTED'; reason: string }
  | { type: 'EXTRACTION_CHAIN_EXHAUSTED'; reason: string };

type ToolDoneOutput =
  | { type: 'WORKFLOW_STEP_UNLOCKED' }
  | { type: 'WORKFLOW_STEP_COMPLETED'; artifactId: string };

type CacheRequestMetaParams = {
  requestId: string;
  projectId: string;
  toolKey: string | null;
  artifactType: string;
  workflowType: RegistryBackedWorkflowType;
  model: string;
  input: Record<string, unknown>;
  idempotencyKey: string | null;
  outputFormat: OutputFormat;
  registryVersion: string | null;
  registrySnapshotRef: string | null;
  routeType: RouteType;
  syntheticResponse: string;
};

type SetValidationDataParams = {
  workflowType: RegistryBackedWorkflowType;
  registryVersion: string | null;
  registrySnapshotRef: string | null;
  routeType: RouteType;
};

type CacheReplayPayloadParams = {
  artifactId: string;
  content: string;
};

type CacheStreamResultParams = {
  content: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

type CacheExtractionResultParams = {
  content: string;
  structuredPayload: Record<string, unknown>;
};

const getIdempotencyDoneOutput = (event: unknown): IdempotencyDoneOutput =>
  (event as { output: IdempotencyDoneOutput }).output;

const getUsageDoneOutput = (event: unknown): UsageDoneOutput | undefined =>
  (event as { output?: UsageDoneOutput }).output;

const getStreamDoneOutput = (event: unknown): StreamDoneOutput | undefined =>
  (event as { output?: StreamDoneOutput }).output;

const getStreamResultParams = (event: unknown): CacheStreamResultParams => {
  const output = getStreamDoneOutput(event);

  return {
    content: output?.content ?? '',
    inputTokens: output?.metrics?.inputTokens ?? 0,
    outputTokens: output?.metrics?.outputTokens ?? 0,
    costUsd: output?.metrics?.costUsd ?? 0,
  };
};

const isEmptyStreamSuccess = (event: unknown): boolean => {
  const output = getStreamDoneOutput(event);
  if (!output || output.type !== 'STREAM_TERMINATED_SUCCESS') {
    return false;
  }

  const content = typeof output.content === 'string' ? output.content : '';
  const outputTokens = output.metrics?.outputTokens ?? 0;
  return content.trim().length === 0 && outputTokens === 0;
};

const getExtractionDoneOutput = (event: unknown): ExtractionDoneOutput | undefined =>
  (event as { output?: ExtractionDoneOutput }).output;

const getExtractionResultParams = (event: unknown): CacheExtractionResultParams => {
  const output = getExtractionDoneOutput(event);
  if (!output || output.type !== 'EXTRACTION_ATTEMPT_ACCEPTED') {
    return {
      content: '',
      structuredPayload: {},
    };
  }

  return {
    content: output.content,
    structuredPayload: output.structuredPayload,
  };
};

const getToolDoneOutput = (event: unknown): ToolDoneOutput | undefined =>
  (event as { output?: ToolDoneOutput }).output;

const getInvokeFailureReason = (event: unknown): string =>
  (event as { output?: { reason?: string } }).output?.reason ?? 'generation_failed';

const getReplayPayloadParams = (event: unknown): CacheReplayPayloadParams => {
  const output = getIdempotencyDoneOutput(event);
  if (output.type !== 'IDEMPOTENCY_REPLAY_READY') {
    return {
      artifactId: '',
      content: '',
    };
  }

  return {
    artifactId: output.artifactId,
    content: output.metadata.content,
  };
};

const defaultArtifactIdFactory = (): string =>
  `artifact-${Math.random().toString(36).slice(2, 10)}`;

const normalizeOutputFormat = (value: unknown): OutputFormat => {
  if (value === 'json' || value === 'markdown' || value === 'plain') {
    return value;
  }

  return 'plain';
};

const defaultResponseBuilder = (request: RequestReceivedEvent): string => {
  const prompt = request.input?.prompt;
  if (typeof prompt === 'string' && prompt.trim().length > 0) {
    return `Generated output for prompt: ${prompt.trim()}`;
  }

  return `Generated output for request ${request.requestId}`;
};

const toOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  if (value && typeof value === 'object') {
    return Object.values(value)
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
};

const toStringRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>((acc, [key, entry]) => {
    if (typeof entry !== 'string') {
      return acc;
    }

    const normalized = entry.trim();
    if (!normalized) {
      return acc;
    }

    acc[key] = normalized;
    return acc;
  }, {});
};

const countWords = (value: string): number => {
  return value.split(/\s+/).filter((token) => token.length > 0).length;
};

const buildExtractionStructuredPayload = (
  context: GenerationMachineContext,
): Record<string, unknown> => {
  const briefingId = toOptionalString(context.requestInput.briefingId);
  const extractionArtifactId =
    toOptionalString(context.requestInput.extractionArtifactId) ?? context.artifactId;
  const stepDependencyArtifactIds = [
    ...new Set(toStringArray(context.requestInput.stepDependencyArtifactIds)),
  ];
  const briefText =
    toOptionalString(context.requestInput.briefingText)
    ?? toOptionalString(context.requestInput.normalizedText)
    ?? toOptionalString(context.requestInput.prompt)
    ?? '';
  const summary = briefText
    ? briefText.split(/\s+/).slice(0, 60).join(' ')
    : null;

  const fields: Record<string, string | null> = {
    briefing_summary: summary,
    primary_tone: toOptionalString(context.requestInput.tone),
    target_tool: context.toolKey,
  };

  const missingFields = Object.entries(fields)
    .filter(([, value]) => value === null)
    .map(([key]) => key);

  return {
    schemaVersion: 'extraction.v1',
    requestId: context.requestId,
    projectId: context.projectId,
    toolKey: context.toolKey,
    artifactId: context.artifactId,
    briefingId,
    extractionArtifactId,
    stepDependencyArtifactIds,
    fields,
    missingFields,
    meta: {
      charCount: briefText.length,
      wordCount: countWords(briefText),
      generatedAt: context.runtimeNow().toISOString(),
    },
  };
};

const YOUTUBE_EXTRACTION_SECTION_BY_HEADING: Record<string, string> = {
  'knowledge content': 'knowledge_content',
  avatar: 'avatar',
  'pain point': 'pain_point',
  'purchase process type': 'purchase_process_type',
  offer: 'offer',
  proof: 'proof',
  tone: 'tone',
  'target duration minutes': 'target_duration_minutes',
  'proprietary methodology disclosure': 'proprietary_methodology_disclosure',
};

const MISSING_EXTRACTION_VALUE_MARKERS = new Set([
  'non emerso dal documento.',
  'non emerso dal documento',
]);

const normalizeYoutubeExtractionField = (value: string): string | null => {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (MISSING_EXTRACTION_VALUE_MARKERS.has(normalized.toLowerCase())) {
    return null;
  }

  return normalized;
};

/**
 * Parses youtube-lf-script extraction markdown into canonical ExtractionContext fields.
 * Deterministic normalization rule: each section resolves to a single value, taking the
 * first non-empty bullet and ignoring subsequent bullets in the same section.
 */
const parseYoutubeExtractionMarkdown = (content: string): Record<string, unknown> => {
  if (!content.trim()) {
    return {};
  }

  const rows = content.split(/\r?\n/);
  const extractedFields: Record<string, string | null> = {};
  let currentField: string | null = null;

  for (const row of rows) {
    const headingMatch = row.match(/^##\s+(.+?)\s*$/);
    if (headingMatch) {
      const headingLabel = headingMatch[1];
      if (!headingLabel) {
        currentField = null;
        continue;
      }
      const heading = headingLabel.trim().toLowerCase();
      currentField = YOUTUBE_EXTRACTION_SECTION_BY_HEADING[heading] ?? null;
      continue;
    }

    if (!currentField) {
      continue;
    }

    const bulletMatch = row.match(/^\s*-\s*(.+?)\s*$/);
    if (!bulletMatch) {
      continue;
    }
    const bulletValue = bulletMatch[1];
    if (!bulletValue) {
      continue;
    }

    const current = extractedFields[currentField];
    if (current !== undefined && current !== null) {
      // Deterministic normalization policy: keep only the first non-empty bullet
      // for each canonical section to avoid ambiguous multi-value merges.
      continue;
    }

    extractedFields[currentField] = normalizeYoutubeExtractionField(bulletValue);
  }

  const result: Record<string, unknown> = {};
  for (const field of Object.values(YOUTUBE_EXTRACTION_SECTION_BY_HEADING)) {
    result[field] = extractedFields[field] ?? null;
  }
  return result;
};

const parseExtractionContent = (
  content: string,
  extractionToolKey: string | null | undefined,
): Record<string, unknown> => {
  if (!content) {
    return {};
  }

  const normalizedExtractionToolKey = normalizeToolWorkflowKey(extractionToolKey);
  if (normalizedExtractionToolKey === 'youtube-lf-script') {
    return parseYoutubeExtractionMarkdown(content);
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
};

const toPersistenceArtifactType = (
  context: GenerationMachineContext,
): GenerationMachineContext['artifactType'] => {
  if (context.routeType === 'extraction') {
    return 'extraction';
  }

  return context.artifactType;
};

const toPersistenceWorkflowType = (
  context: GenerationMachineContext,
): RegistryBackedWorkflowType => {
  if (context.routeType === 'extraction') {
    return 'extraction';
  }

  return context.workflowType;
};

const toPersistenceInputJson = (
  context: GenerationMachineContext,
): Record<string, unknown> => {
  if (context.routeType !== 'extraction') {
    const toolWorkflow = buildToolWorkflowPersistenceMetadata(context);
    if (!toolWorkflow) {
      return context.requestInput;
    }

    return {
      ...context.requestInput,
      toolWorkflow,
    };
  }

  const extractionPayload = parseExtractionContent(context.contentBuffer, toOptionalString(context.requestInput.toolKey));
  return {
    ...context.requestInput,
    extraction: {
      briefingId: toOptionalString(context.requestInput.briefingId),
      extractionArtifactId:
        toOptionalString(context.requestInput.extractionArtifactId) ?? context.artifactId,
      stepDependencyArtifactIds: toStringArray(context.requestInput.stepDependencyArtifactIds),
      payload: extractionPayload,
    },
  };
};

const getRegistrySelector = (context: GenerationMachineContext) => {
  const registrySnapshotRef =
    (context.registrySnapshotRef ?? `snapshot:${context.requestId}`) as never;

  if (context.registryVersion) {
    return {
      registryVersion: context.registryVersion,
      registrySnapshotRef,
    };
  }

  return {
    registrySnapshotRef,
  };
};

const normalizeValue = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const normalizeToolWorkflowKey = (value: string | null | undefined): string | null => {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return null;
  }

  // @deprecated-compat: 'hl_funnel' normalizzato a 'funnel-pages' (DDD-030).
  // Rimuovere quando tutti i dati DB saranno migrati a 'funnel_pages'.
  if (normalized === 'funnel_pages' || normalized === 'hl_funnel' || normalized === 'funnelpages') {
    return 'funnel-pages';
  }

  if (normalized === 'youtube_lf_script') {
    return 'youtube-lf-script';
  }

  return normalized;
};

const normalizeStepKey = (value: unknown): string | null => {
  const normalized = normalizeValue(toOptionalString(value));
  if (!normalized) {
    return null;
  }

  if (normalized === 'thank-you' || normalized === 'thankyou') {
    return 'thank_you';
  }

  return normalized;
};

const resolveToolWorkflowPlan = (context: GenerationMachineContext): ToolWorkflowPlan | null => {
  const normalizedToolKey = normalizeToolWorkflowKey(context.toolKey);
  const normalizedWorkflowType = normalizeToolWorkflowKey(context.workflowType);
  const key = normalizedToolKey ?? normalizedWorkflowType;
  if (!key || !isSupportedToolWorkflow(key)) {
    return null;
  }

  return TOOL_WORKFLOW_REGISTRY[key] ?? null;
};

const resolveWorkflowRunMode = (context: GenerationMachineContext): 'new' | 'resume' | 'regenerate' => {
  const intent = normalizeValue(toOptionalString(context.requestInput.intent));
  if (intent === 'resume' || intent === 'regenerate') {
    return intent;
  }

  return 'new';
};

const resolveRequestScopedStepDescriptor = (
  context: GenerationMachineContext,
  plan: ToolWorkflowPlan | null,
): WorkflowStepDescriptor => {
  const requestedStep = normalizeStepKey(context.requestInput.step);
  if (plan && requestedStep) {
    const found = plan.steps.find((candidate) => candidate.key === requestedStep);
    if (found) {
      return found;
    }
  }

  if (plan) {
    return plan.steps[0] ?? { key: context.toolKey ?? 'workflow_step', dependencies: [] };
  }

  return {
    key: requestedStep ?? context.toolKey ?? 'workflow_step',
    dependencies: [],
  };
};

const isFinalStepForPlan = (plan: ToolWorkflowPlan | null, stepKey: string): boolean => {
  if (!plan || plan.steps.length === 0) {
    return true;
  }

  const last = plan.steps[plan.steps.length - 1];
  return last?.key === stepKey;
};

const buildToolWorkflowPersistenceMetadata = (
  context: GenerationMachineContext,
): Record<string, unknown> | null => {
  if (context.routeType !== 'tool') {
    return null;
  }

  const plan = resolveToolWorkflowPlan(context);
  const stepDescriptor = resolveRequestScopedStepDescriptor(context, plan);
  const dependsOnSteps = plan?.dependencyGraph[stepDescriptor.key] ?? stepDescriptor.dependencies;
  const dependencyArtifactIds = toStringArray(context.requestInput.stepDependencyArtifactIds);
  const dependencyArtifactIdsByStep = toStringRecord(context.requestInput.stepDependencyArtifactIdsByStep);

  if (Object.keys(dependencyArtifactIdsByStep).length === 0 && dependencyArtifactIds.length > 0) {
    dependsOnSteps.forEach((dependencyStepKey, index) => {
      const artifactId = dependencyArtifactIds[index];
      if (artifactId) {
        dependencyArtifactIdsByStep[dependencyStepKey] = artifactId;
      }
    });
  }

  return {
    toolKey: plan?.toolKey ?? context.toolKey,
    workflowType: context.workflowType,
    runMode: resolveWorkflowRunMode(context),
    artifactRole: isFinalStepForPlan(plan, stepDescriptor.key) ? 'final' : 'step',
    stepKey: stepDescriptor.key,
    dependsOnSteps,
    dependencyArtifactIds,
    dependencyArtifactIdsByStep,
  };
};

const getRouteType = (
  toolKey: string | null,
  workflowType: RegistryBackedWorkflowType,
  artifactType: string,
): RouteType => {
  const normalizedToolKey = normalizeValue(toolKey);
  const normalizedWorkflowType = normalizeValue(workflowType ?? null);
  const normalizedArtifactType = normalizeValue(artifactType);

  if (
    normalizedToolKey === 'extraction' ||
    normalizedWorkflowType === 'extraction' ||
    normalizedArtifactType === 'extraction'
  ) {
    return 'extraction';
  }

  if (normalizedToolKey !== null && normalizedToolKey !== 'extraction') {
    return 'tool';
  }

  if (normalizedToolKey === null && normalizedWorkflowType === null) {
    return 'generic';
  }

  return null;
};

export const generationSystemMachine = setup({
  types: {
    context: {} as GenerationMachineContext,
    input: {} as GenerationSystemInput,
    events: {} as GenerationSystemEvent,
  },
  actions: {
    cacheRequestMeta: assign({
      requestId: (_, params: CacheRequestMetaParams) => params.requestId,
      projectId: (_, params: CacheRequestMetaParams) => params.projectId,
      toolKey: (_, params: CacheRequestMetaParams) => params.toolKey,
      artifactType: (_, params: CacheRequestMetaParams) => params.artifactType,
      workflowType: (_, params: CacheRequestMetaParams) => params.workflowType,
      model: (_, params: CacheRequestMetaParams) => params.model,
      requestInput: (_, params: CacheRequestMetaParams) => params.input,
      idempotencyKey: (_, params: CacheRequestMetaParams) => params.idempotencyKey,
      outputFormat: (_, params: CacheRequestMetaParams) => params.outputFormat,
      registryVersion: (_, params: CacheRequestMetaParams) => params.registryVersion,
      registrySnapshotRef: (_, params: CacheRequestMetaParams) => params.registrySnapshotRef,
      routeType: (_, params: CacheRequestMetaParams) => params.routeType,
      failureReason: null,
      syntheticResponse: (_, params: CacheRequestMetaParams) => params.syntheticResponse,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      contentBuffer: '',
      artifactId: null,
    }),
    setUserId: assign({
      userId: (_, params: { userId: string }) => params.userId,
    }),
    setValidationData: assign({
      workflowType: (_, params: SetValidationDataParams) => params.workflowType,
      registryVersion: (_, params: SetValidationDataParams) => params.registryVersion,
      registrySnapshotRef: (_, params: SetValidationDataParams) => params.registrySnapshotRef,
      routeType: (_, params: SetValidationDataParams) => params.routeType,
    }),
    setFailureReason: assign({
      failureReason: (_, params: { reason: string }) => params.reason,
    }),
    setAmbiguousRoutingFailure: assign({
      failureReason: 'ambiguous_routing',
    }),
    setMissingRegistrySelectorFailure: assign({
      failureReason: 'missing_registry_selector',
    }),
    setExtractionFailedFailure: assign({
      failureReason: 'extraction_failed',
    }),
    setWorkflowFailedFailure: assign({
      failureReason: 'workflow_failed',
    }),
    setIdempotencyConflictFailure: assign({
      failureReason: 'idempotency_conflict',
    }),
    setUsageFailedFailure: assign({
      failureReason: 'usage_failed',
    }),
    setStreamFailureFailure: assign({
      failureReason: 'stream_failure',
    }),
    setPersistenceFinalizeFailedFailure: assign({
      failureReason: 'persistence_finalize_failed',
    }),
    cacheReplayPayload: assign({
      artifactId: (_, params: CacheReplayPayloadParams) => params.artifactId,
      contentBuffer: (_, params: CacheReplayPayloadParams) => params.content,
    }),
    cacheArtifactId: assign({
      artifactId: ({ event, context }) => {
        if (event.type === 'STREAM_SESSION_STARTED') {
          return event.artifactId;
        }
        return context.artifactId;
      },
    }),
    ensureArtifactId: assign({
      artifactId: ({ context }) => context.artifactId ?? context.artifactIdFactory(),
    }),
    cacheSyntheticChunk: assign({
      contentBuffer: ({ context }) => context.syntheticResponse,
    }),
    cacheStreamResult: assign({
      contentBuffer: ({ context }, params: CacheStreamResultParams) =>
        params.content.length > 0 ? params.content : context.contentBuffer,
      inputTokens: ({ context }, params: CacheStreamResultParams) =>
        params.inputTokens > 0 ? params.inputTokens : context.inputTokens,
      outputTokens: ({ context }, params: CacheStreamResultParams) =>
        params.outputTokens > 0 ? params.outputTokens : context.outputTokens,
      costUsd: ({ context }, params: CacheStreamResultParams) =>
        params.costUsd > 0 ? params.costUsd : context.costUsd,
    }),
    cacheExtractionResult: assign({
      contentBuffer: (_, params: CacheExtractionResultParams) => params.content,
      requestInput: ({ context }, params: CacheExtractionResultParams) => ({
        ...context.requestInput,
        extractionPayload: params.structuredPayload,
      }),
      inputTokens: ({ context }) =>
        Math.max(context.inputTokens, Math.max(1, Math.ceil(JSON.stringify(context.requestInput).length / 4))),
      outputTokens: (_, params: CacheExtractionResultParams) =>
        Math.max(1, Math.ceil(params.content.length / 4)),
      costUsd: ({ context }) =>
        context.costUsd > 0 ? context.costUsd : 0,
    }),
    drivePersistenceFinalizeSuccess: enqueueActions(({ enqueue, context }) => {
      enqueue.sendTo('persistenceActor', {
        type: 'STREAM_TERMINATED_SUCCESS',
        requestId: context.requestId,
        sourceActor: 'streamTransportMachine',
        timestamp: context.runtimeNow().toISOString(),
        artifactId: context.artifactId ?? context.artifactIdFactory(),
      });
    }),
    drivePersistenceFinalizeFailure: enqueueActions(({ enqueue, context }) => {
      enqueue.sendTo('persistenceActor', {
        type: 'STREAM_TERMINATED_FAILURE',
        requestId: context.requestId,
        sourceActor: 'streamTransportMachine',
        timestamp: context.runtimeNow().toISOString(),
        artifactId: context.artifactId ?? context.artifactIdFactory(),
        reason: context.failureReason ?? 'generation_failed',
      });
    }),
    setFailureFromInvokeOutput: assign({
      failureReason: (_, params: { reason: string }) => params.reason,
    }),
    cacheToolArtifactFromOutput: assign({
      artifactId: ({ context }, params: { artifactId: string | null }) =>
        params.artifactId ?? context.artifactId,
    }),
    appendStreamChunk: assign({
      contentBuffer: ({ context }, params: { chunk: string }) =>
        `${context.contentBuffer}${params.chunk}`,
    }),
    resetVolatileContext: assign({
      requestId: '',
      userId: null,
      projectId: null,
      toolKey: null,
      registryVersion: null,
      registrySnapshotRef: null,
      workflowType: null,
      artifactType: 'content',
      model: 'unknown',
      requestInput: {},
      idempotencyKey: null,
      outputFormat: 'plain',
      artifactId: null,
      contentBuffer: '',
      failureReason: null,
      syntheticResponse: '',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      routeType: null,
    }),
  },
  guards: {
    hasRegistrySelector: ({ event }) =>
      event.type !== 'REQUEST_RECEIVED'
        ? true
        : Boolean(event.registryVersion || event.registrySnapshotRef),
    hasAmbiguousRouting: ({ context }) => context.routeType === null,
    routeIsExtraction: ({ context }) => context.routeType === 'extraction',
    routeIsTool: ({ context }) => context.routeType === 'tool',
    routeIsGeneric: ({ context }) => context.routeType === 'generic',
    idempotencyOutputIsReplay: ({ event }) =>
      (getIdempotencyDoneOutput(event).type ?? '') === 'IDEMPOTENCY_REPLAY_READY',
    idempotencyOutputIsConflict: ({ event }) =>
      (getIdempotencyDoneOutput(event).type ?? '') === 'IDEMPOTENCY_CONFLICT',
    usageOutputIsRejected: ({ event }) =>
      getUsageDoneOutput(event)?.type === 'USAGE_REJECTED',
    streamOutputIsFailure: ({ event }) =>
      getStreamDoneOutput(event)?.type === 'STREAM_TERMINATED_FAILURE',
    streamOutputIsEmptySuccess: ({ context, event }) =>
      context.routeType !== 'extraction' && isEmptyStreamSuccess(event),
    extractionOutputIsAccepted: ({ event }) =>
      getExtractionDoneOutput(event)?.type === 'EXTRACTION_ATTEMPT_ACCEPTED',
    toolOutputIsCompleted: ({ event }) =>
      getToolDoneOutput(event)?.type === 'WORKFLOW_STEP_COMPLETED',
  },
  actors: {
    invokeIdempotency: idempotencyCoordinatorMachine,
    invokeUsage: usageMachine,
    invokeStream: streamTransportMachine,
    invokePersistence: persistenceBatchMachine,
    invokeExtraction: fromPromise(async ({ input }: { input: { context: GenerationMachineContext } }) => {
      const payload = buildExtractionStructuredPayload(input.context);
      return {
        type: 'EXTRACTION_ATTEMPT_ACCEPTED' as const,
        artifactId: input.context.artifactId ?? input.context.artifactIdFactory(),
        content: JSON.stringify(payload, null, 2),
        structuredPayload: payload,
      };
    }),
    invokeToolWorkflow: toolWorkflowMachine,
    markCompletedIdempotency: fromPromise(
      async ({ input }: { input: { context: GenerationMachineContext } }) => {
        const { context } = input;
        if (!context.userId || !context.projectId || !context.idempotencyKey || !context.artifactId) {
          return;
        }

        await context.adapters.idempotency.markCompleted(
          {
            requestId: context.requestId,
            userId: context.userId,
            projectId: context.projectId,
            workflowType: context.workflowType,
            idempotencyKey: context.idempotencyKey,
            ...getRegistrySelector(context),
          },
          context.artifactId,
          context.contentBuffer,
        );
      },
    ),
    markFailedIdempotency: fromPromise(async ({ input }: { input: { context: GenerationMachineContext } }) => {
      const { context } = input;
      if (!context.userId || !context.projectId || !context.idempotencyKey) {
        return;
      }

      await context.adapters.idempotency.markFailed({
        requestId: context.requestId,
        userId: context.userId,
        projectId: context.projectId,
        workflowType: context.workflowType,
        idempotencyKey: context.idempotencyKey,
        ...getRegistrySelector(context),
      });
    }),
  },
}).createMachine({
  id: 'generationSystemMachine',
  initial: 'idle',
  context: ({ input }) => ({
    requestId: '',
    userId: null,
    projectId: null,
    toolKey: null,
    registryVersion: null,
    registrySnapshotRef: null,
    workflowType: null,
    artifactType: 'content',
    model: 'unknown',
    requestInput: {},
    idempotencyKey: null,
    outputFormat: 'plain',
    artifactId: null,
    contentBuffer: '',
    failureReason: null,
    syntheticResponse: '',
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    routeType: null,
    adapters: input.adapters,
    runtimeNow: input.runtime?.now ?? (() => new Date()),
    artifactIdFactory: input.runtime?.artifactIdFactory ?? defaultArtifactIdFactory,
    responseBuilder: input.runtime?.responseBuilder ?? defaultResponseBuilder,
    ...input.initialContext,
  }),
  states: {
    idle: {
      on: {
        REQUEST_RECEIVED: [
          {
            guard: 'hasRegistrySelector',
            target: 'gateway',
            actions: {
              type: 'cacheRequestMeta',
              params: ({ event, context }) => ({
                requestId: event.requestId,
                projectId: event.projectId,
                toolKey: event.toolKey,
                artifactType: event.artifactType,
                workflowType: event.workflowType ?? null,
                model: event.model,
                input: event.input,
                idempotencyKey: event.idempotencyKey ?? null,
                outputFormat: normalizeOutputFormat(event.input?.outputFormat),
                registryVersion: event.registryVersion ?? null,
                registrySnapshotRef: event.registrySnapshotRef ?? null,
                routeType: getRouteType(
                  event.toolKey,
                  event.workflowType ?? null,
                  String(event.artifactType),
                ),
                syntheticResponse: context.responseBuilder(event),
              }),
            },
          },
          {
            target: 'failed',
            actions: 'setMissingRegistrySelectorFailure',
          },
        ],
      },
    },
    gateway: {
      on: {
        AUTH_OK: {
          actions: {
            type: 'setUserId',
            params: ({ event }) => ({ userId: event.userId }),
          },
        },
        VALIDATION_OK: {
          target: 'preGenerationGuards',
          actions: {
            type: 'setValidationData',
            params: ({ event, context }) => ({
              workflowType: event.workflowType,
              registryVersion: event.registryVersion,
              registrySnapshotRef: event.registrySnapshotRef,
              routeType: getRouteType(
                context.toolKey,
                event.workflowType,
                String(context.artifactType),
              ),
            }),
          },
        },
        AUTH_FAIL: {
          target: 'failed',
          actions: {
            type: 'setFailureReason',
            params: { reason: 'unauthorized' },
          },
        },
        VALIDATION_FAIL: {
          target: 'failed',
          actions: {
            type: 'setFailureReason',
            params: ({ event }) => ({ reason: event.reason }),
          },
        },
      },
    },
    preGenerationGuards: {
      initial: 'idempotency',
      states: {
        idempotency: {
          invoke: {
            src: 'invokeIdempotency',
            input: ({ context }) => ({
              requestId: context.requestId,
              userId: context.userId ?? 'anonymous',
              projectId: context.projectId ?? 'unknown-project',
              workflowType: context.workflowType,
              idempotencyKey: context.idempotencyKey ?? `${context.requestId}:auto`,
              ...getRegistrySelector(context),
              adapters: {
                idempotency: context.adapters.idempotency,
              },
            }),
            onDone: [
              {
                guard: 'idempotencyOutputIsReplay',
                target: '#generationSystemMachine.completed',
                actions: {
                  type: 'cacheReplayPayload',
                  params: ({ event }) => getReplayPayloadParams(event),
                },
              },
              {
                guard: 'idempotencyOutputIsConflict',
                target: '#generationSystemMachine.persistingFailure',
                actions: {
                  type: 'setFailureFromInvokeOutput',
                  params: ({ event }) => ({ reason: getInvokeFailureReason(event) }),
                },
              },
              {
                target: 'usage',
              },
            ],
            onError: {
              target: '#generationSystemMachine.persistingFailure',
              actions: 'setIdempotencyConflictFailure',
            },
          },
        },
        usage: {
          invoke: {
            src: 'invokeUsage',
            input: ({ context }) => ({
              requestId: context.requestId,
              userId: context.userId ?? 'anonymous',
              artifactType: context.artifactType,
              workflowType: context.workflowType,
              ...getRegistrySelector(context),
              adapters: {
                usage: context.adapters.usage,
              },
            }),
            onDone: [
              {
                guard: 'usageOutputIsRejected',
                target: '#generationSystemMachine.persistingFailure',
                actions: {
                  type: 'setFailureFromInvokeOutput',
                  params: ({ event }) => ({ reason: getInvokeFailureReason(event) }),
                },
              },
              {
                target: '#generationSystemMachine.routing',
              },
            ],
            onError: {
              target: '#generationSystemMachine.persistingFailure',
              actions: 'setUsageFailedFailure',
            },
          },
        },
      },
    },
    routing: {
      always: [
        {
          guard: 'routeIsExtraction',
          target: 'extractionFlow',
        },
        {
          guard: 'routeIsTool',
          target: 'toolGenerationFlow',
        },
        {
          guard: 'routeIsGeneric',
          target: 'genericGenerationFlow',
        },
        {
          guard: 'hasAmbiguousRouting',
          target: 'failed',
          actions: 'setAmbiguousRoutingFailure',
        },
      ],
    },
    extractionFlow: {
      entry: ['ensureArtifactId'],
      invoke: {
        id: 'extractionActor',
        src: 'invokeExtraction',
        input: ({ context }) => ({ context }),
        onDone: [
          {
            guard: 'extractionOutputIsAccepted',
            target: 'streaming',
            actions: {
              type: 'cacheExtractionResult',
              params: ({ event }) => getExtractionResultParams(event),
            },
          },
          {
            target: 'persistingFailure',
            actions: {
              type: 'setFailureFromInvokeOutput',
              params: ({ event }) => ({ reason: getInvokeFailureReason(event) }),
            },
          },
        ],
        onError: {
          target: 'persistingFailure',
          actions: 'setExtractionFailedFailure',
        },
      },
    },
    toolGenerationFlow: {
      entry: ['ensureArtifactId'],
      invoke: {
        id: 'toolActor',
        src: 'invokeToolWorkflow',
        input: ({ context }) => {
          const plan = resolveToolWorkflowPlan(context);
          const stepDescriptor = resolveRequestScopedStepDescriptor(context, plan);

          return {
            requestId: context.requestId,
            toolKey: plan?.toolKey ?? context.toolKey ?? 'workflow',
            workflowType: context.workflowType ?? 'generic',
            runMode: resolveWorkflowRunMode(context),
            steps: [stepDescriptor],
            dependencyGraph: {
              [stepDescriptor.key]: plan?.dependencyGraph[stepDescriptor.key] ?? stepDescriptor.dependencies,
            },
            bootstrap: {
              stepKey: stepDescriptor.key,
              output: context.syntheticResponse,
              artifactId: context.artifactId ?? context.artifactIdFactory(),
            },
            ...getRegistrySelector(context),
          };
        },
        onDone: [
          {
            guard: 'toolOutputIsCompleted',
            target: 'streaming',
            actions: {
              type: 'cacheToolArtifactFromOutput',
              params: ({ event }) => {
                const output = getToolDoneOutput(event);
                return {
                  artifactId: output?.type === 'WORKFLOW_STEP_COMPLETED' ? output.artifactId : null,
                };
              },
            },
          },
          {
            target: 'streaming',
          },
        ],
        onError: {
          target: 'persistingFailure',
          actions: 'setWorkflowFailedFailure',
        },
      },
    },
    genericGenerationFlow: {
      always: 'streaming',
    },
    streaming: {
      entry: ['ensureArtifactId'],
      invoke: {
        id: 'streamActor',
        src: 'invokeStream',
        input: ({ context }) => ({
          requestId: context.requestId,
          artifactId: context.artifactId ?? context.artifactIdFactory(),
          model: context.model,
          requestInput: context.requestInput,
          workflowType: context.workflowType,
          outputFormat: context.outputFormat,
          runtime: {
            now: context.runtimeNow,
          },
          ...getRegistrySelector(context),
          adapters: {
            stream: context.adapters.stream,
            llm: context.adapters.llm,
          },
        }),
        onDone: [
          {
            guard: 'streamOutputIsFailure',
            target: 'persistingFailure',
            actions: [
              {
                type: 'cacheStreamResult',
                params: ({ event }) => getStreamResultParams(event),
              },
              {
                type: 'setFailureFromInvokeOutput',
                params: ({ event }) => ({ reason: getInvokeFailureReason(event) }),
              },
            ],
          },
          {
            guard: 'streamOutputIsEmptySuccess',
            target: 'persistingFailure',
            actions: [
              {
                type: 'cacheStreamResult',
                params: ({ event }) => getStreamResultParams(event),
              },
              {
                type: 'setFailureFromInvokeOutput',
                params: () => ({ reason: 'stream_empty_output' }),
              },
            ],
          },
          {
            target: 'persistingSuccess',
            actions: {
              type: 'cacheStreamResult',
              params: ({ event }) => getStreamResultParams(event),
            },
          },
        ],
        onError: {
          target: 'persistingFailure',
          actions: 'setStreamFailureFailure',
        },
      },
    },
    persistingSuccess: {
      entry: 'drivePersistenceFinalizeSuccess',
      invoke: {
        id: 'persistenceActor',
        src: 'invokePersistence',
        input: ({ context }) => ({
          requestId: context.requestId,
          artifactId: context.artifactId ?? context.artifactIdFactory(),
          artifactType: toPersistenceArtifactType(context),
          workflowType: toPersistenceWorkflowType(context),
          contentBuffer: context.contentBuffer,
          ...(context.userId ? { userId: context.userId } : {}),
          ...(context.projectId ? { projectId: context.projectId } : {}),
          model: context.model,
          inputJson: toPersistenceInputJson(context),
          inputTokens: Math.max(
            context.inputTokens,
            Math.max(0, Math.ceil(JSON.stringify(context.requestInput).length / 4)),
          ),
          outputTokens: Math.max(
            context.outputTokens,
            Math.max(0, Math.ceil(context.contentBuffer.length / 4)),
          ),
          costUsd:
            context.costUsd > 0
              ? context.costUsd
              : Number((Math.max(1, context.contentBuffer.length) * 0.000001).toFixed(6)),
          ...getRegistrySelector(context),
          adapters: {
            persistence: context.adapters.persistence,
          },
        }),
        onDone: 'finalizeIdempotencySuccess',
        onError: {
          target: 'persistingFailure',
          actions: 'setPersistenceFinalizeFailedFailure',
        },
      },
    },
    persistingFailure: {
      entry: 'drivePersistenceFinalizeFailure',
      invoke: {
        id: 'persistenceActor',
        src: 'invokePersistence',
        input: ({ context }) => ({
          requestId: context.requestId,
          artifactId: context.artifactId ?? context.artifactIdFactory(),
          artifactType: toPersistenceArtifactType(context),
          workflowType: toPersistenceWorkflowType(context),
          contentBuffer: context.contentBuffer,
          ...(context.userId ? { userId: context.userId } : {}),
          ...(context.projectId ? { projectId: context.projectId } : {}),
          model: context.model,
          inputJson: toPersistenceInputJson(context),
          inputTokens: Math.max(
            context.inputTokens,
            Math.max(0, Math.ceil(JSON.stringify(context.requestInput).length / 4)),
          ),
          outputTokens: Math.max(
            context.outputTokens,
            Math.max(0, Math.ceil(context.contentBuffer.length / 4)),
          ),
          costUsd:
            context.costUsd > 0
              ? context.costUsd
              : Number((Math.max(1, context.contentBuffer.length) * 0.000001).toFixed(6)),
          ...getRegistrySelector(context),
          adapters: {
            persistence: context.adapters.persistence,
          },
        }),
        onDone: 'finalizeIdempotencyFailure',
        onError: 'finalizeIdempotencyFailure',
      },
    },
    finalizeIdempotencySuccess: {
      invoke: {
        src: 'markCompletedIdempotency',
        input: ({ context }) => ({ context }),
        onDone: 'completed',
        onError: 'completed',
      },
    },
    finalizeIdempotencyFailure: {
      invoke: {
        src: 'markFailedIdempotency',
        input: ({ context }) => ({ context }),
        onDone: 'failed',
        onError: 'failed',
      },
    },
    completed: {
      on: {
        RESET: {
          target: 'idle',
          reenter: true,
          actions: 'resetVolatileContext',
        },
      },
    },
    failed: {
      on: {
        RESET: {
          target: 'idle',
          reenter: true,
          actions: 'resetVolatileContext',
        },
      },
    },
  },
});
