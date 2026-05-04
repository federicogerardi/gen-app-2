/**
 * ToolPageTemplate: Unified orchestration template for all tool pages
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMachine, useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import { useNavigate } from 'react-router-dom';
import { uiPrimitives } from '../../../app/ui/primitives';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { generateRequestId, readInputField } from '../../../app/runtime/shared-utils';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import type { GenerationRequest } from '../../generation/contracts/backend-stream';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import { briefingUploadMachine } from '../machines/briefing-upload.machine';
import { toolPageMachine } from '../machines/tool-page.machine';
import { getToolFormConfig, mapToolStepToCardConfig } from '../runtime/tool-form-architecture';
import { createStepRequest } from '../runtime/tool-generation-engine';
import { orchestrateToolStep } from '../runtime/tools-client';
import {
  useProjectsLoader,
  useToolFormInit,
  useAvailableSteps,
} from '../runtime/useToolForm';
import { ToolGenerationFlowVertical } from './ToolGenerationFlowVertical';
import { ToolActionButtons } from './ToolActionButtons';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { extractArtifactStep } from '../../generation/runtime/step-hydration';
import { getArtifactById } from '../../artifacts/runtime/artifacts-client';

interface ToolPageTemplateProps {
  toolKey: SupportedTool;
  sourceArtifactId?: string | null;
  intent?: 'new' | 'regenerate' | 'resume';
  initialProjectId?: string | null;
  relaunchTone?: string | null;
  relaunchNotes?: string | null;
  relaunchFromArtifactId?: string | null;
  briefingId?: string | null;
  extractionArtifactId?: string | null;
  briefingFileName?: string | null;
}

const parseExtractionPayloadFromContent = (content: string): Record<string, unknown> => {
  const parseCandidate = (candidate: string): Record<string, unknown> => {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object') {
        const record = parsed as Record<string, unknown>;
        const payload = record['payload'];
        if (payload && typeof payload === 'object') {
          return payload as Record<string, unknown>;
        }

        const extractionPayload = record['extractionPayload'];
        if (extractionPayload && typeof extractionPayload === 'object') {
          return extractionPayload as Record<string, unknown>;
        }

        return record;
      }
    } catch {
      // Keep runtime resilient: invalid JSON means no structured payload.
    }

    return {};
  };

  const direct = parseCandidate(content);
  if (Object.keys(direct).length > 0) {
    return direct;
  }

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const fromFence = parseCandidate(fenced[1]);
    if (Object.keys(fromFence).length > 0) {
      return fromFence;
    }
  }

  const objectSlice = content.match(/\{[\s\S]*\}/);
  if (objectSlice?.[0]) {
    const fromSlice = parseCandidate(objectSlice[0]);
    if (Object.keys(fromSlice).length > 0) {
      return fromSlice;
    }
  }

  return {};
};

const readExtractionPayloadFromArtifactInput = (artifact: GenerationArtifact): Record<string, unknown> => {
  const inputPayload = artifact.sourceRequest.input?.extractionPayload;
  if (inputPayload && typeof inputPayload === 'object') {
    return inputPayload as Record<string, unknown>;
  }

  return {};
};

const isEmptyPayload = (payload: Record<string, unknown>): boolean => {
  return Object.keys(payload).length === 0;
};

export const ToolPageTemplate = ({
  toolKey,
  sourceArtifactId,
  intent = 'new',
  initialProjectId,
  relaunchTone,
  relaunchNotes,
  relaunchFromArtifactId,
  briefingId,
  extractionArtifactId,
  briefingFileName,
}: ToolPageTemplateProps) => {
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const navigate = useNavigate();
  const toolConfig = getToolFormConfig(toolKey);
  const [isAutoChainEnabled, setIsAutoChainEnabled] = useState(false);
  const [pausedCheckpointStep, setPausedCheckpointStep] = useState<ToolStep | null>(null);
  const [sourceArtifact, setSourceArtifact] = useState<GenerationArtifact | null>(null);
  const initialPrefillDoneRef = useRef(false);
  const currentRunPrefixRef = useRef<string | null>(null);
  const lastRequestedStepRef = useRef<ToolStep | null>(null);
  const wasStreamActiveRef = useRef(false);
  const previousProjectIdRef = useRef<string>((generation.focusedProjectId ?? initialProjectId ?? '').trim());

  const [toolPageSnapshot, toolPageSend] = useMachine(toolPageMachine, {
    input: {
      toolKey,
      projectId: generation.focusedProjectId ?? initialProjectId ?? '',
      model: toolConfig.defaultModel,
      registrySnapshotRef: toolConfig.defaults.registrySnapshotRef,
      apiBaseUrl: auth.apiBaseUrl,
      capabilities: auth.capabilities,
      userId: auth.session?.user.id ?? null,
    },
  });

  // 1. Initialize form state
  const { formState, setFormState } = useToolFormInit(
    toolKey,
    generation.focusedProjectId ?? initialProjectId ?? undefined,
  );

  // 2. Load projects
  const { projects, loading: projectsLoading } = useProjectsLoader();

  // 3. Read briefing upload state from toolPageMachine child actor.
  const briefingSnapshot = useSelector(
    toolPageSnapshot.context.briefingActorRef as ActorRefFrom<typeof briefingUploadMachine>,
    (state) => state,
  );

  const briefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready' = briefingSnapshot.matches('uploading')
    ? 'uploading'
    : briefingSnapshot.matches('extracting')
      ? 'extracting'
      : briefingSnapshot.matches('ready')
        ? 'ready'
        : 'idle';
  const briefingError = briefingSnapshot.context.error;
  const briefingFileNameFromActor = briefingSnapshot.context.fileName;

  // 4. Apply one-shot prefill from query params
  useEffect(() => {
    if (initialPrefillDoneRef.current) {
      return;
    }

    const nextProjectId = initialProjectId?.trim() ?? '';
    if (!nextProjectId) {
      initialPrefillDoneRef.current = true;
      return;
    }

    setFormState((prev) => ({
      ...prev,
      projectId: nextProjectId,
    }));
    generation.setFocusedProjectId(nextProjectId);
    initialPrefillDoneRef.current = true;
  }, [generation, initialProjectId, setFormState]);

  // 6. Resolve source artifact for relaunch intent
  useEffect(() => {
    const normalizedSourceArtifactId = sourceArtifactId?.trim() ?? '';
    if (!normalizedSourceArtifactId) {
      setSourceArtifact(null);
      return;
    }

    const localSource = generation.artifacts.find((artifact) => artifact.artifactId === normalizedSourceArtifactId) ?? null;
    if (localSource) {
      setSourceArtifact(localSource);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const detail = await getArtifactById(normalizedSourceArtifactId, {
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: auth.capabilities,
          localArtifacts: generation.artifacts,
        });

        if (!cancelled) {
          setSourceArtifact(detail);
        }
      } catch {
        if (!cancelled) {
          setSourceArtifact(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [generation.artifacts, auth.apiBaseUrl, auth.capabilities, sourceArtifactId]);

  const normalizedProjectId = formState.projectId.trim();

  // 7. Hydrate extraction context from source artifact: send HYDRATE_REQUESTED to machine.
  useEffect(() => {
    if (!sourceArtifact || !normalizedProjectId) {
      return;
    }

    const routeBriefingId = briefingId?.trim() ?? '';
    const sourceBriefingId = readInputField(sourceArtifact, 'briefingId');
    const resolvedHydrationBriefingId = routeBriefingId.length > 0
      ? routeBriefingId
      : sourceBriefingId;

    const resolvedSourceExtractionArtifactId =
      readInputField(sourceArtifact, 'extractionArtifactId')
      ?? extractionArtifactId
      ?? null;

    console.debug('[ToolPageTemplate] sending HYDRATE_REQUESTED', {
      intent,
      sourceArtifactId: sourceArtifact.artifactId,
      sourceArtifactType: sourceArtifact.artifactType,
      projectId: normalizedProjectId,
      resolvedHydrationBriefingId,
      resolvedSourceExtractionArtifactId,
      localArtifactsCount: generation.artifacts.length,
      sourceArtifactBriefingId: sourceBriefingId,
    });

    toolPageSend({
      type: 'HYDRATE_REQUESTED',
      intent,
      sourceArtifactId: sourceArtifact.artifactId,
      resolvedBriefingId: resolvedHydrationBriefingId,
      sourceExtractionArtifactId: resolvedSourceExtractionArtifactId,
      localArtifacts: generation.artifacts,
    });
  }, [
    generation.artifacts,
    briefingId,
    extractionArtifactId,
    intent,
    normalizedProjectId,
    sourceArtifact,
    toolPageSend,
  ]);

  const resolvedBriefingId = briefingId
    ?? readInputField(sourceArtifact, 'briefingId')
    ?? null;

  useEffect(() => {
    if (previousProjectIdRef.current === normalizedProjectId) {
      return;
    }

    toolPageSend({ type: 'PROJECT_SELECTED', projectId: normalizedProjectId });
    previousProjectIdRef.current = normalizedProjectId;
  }, [normalizedProjectId, toolPageSend]);

  // Phase 4: extraction context letto dallo snapshot della macchina, non dalla workspace.
  const machineHydrationResult = toolPageSnapshot.context.hydrationResult;

  const effectiveBriefingFileName = briefingFileNameFromActor
    ?? briefingFileName
    ?? readInputField(sourceArtifact, 'briefingFileName');

  const effectiveBriefingStatus = (
    briefingStatus === 'ready' || machineHydrationResult !== null
      ? 'ready'
      : briefingStatus
  );

  const resolvedTone = relaunchTone ?? readInputField(sourceArtifact, 'tone') ?? '';
  const resolvedNotes = relaunchNotes ?? readInputField(sourceArtifact, 'notes') ?? '';
  const resolvedRelaunchSource = relaunchFromArtifactId
    ?? sourceArtifactId
    ?? sourceArtifact?.artifactId
    ?? null;

  const progressState = toolPageSnapshot.context.progress;
  const readinessSnapshot = toolPageSnapshot.context.readiness;
  const machineViewModel = toolPageSnapshot.context.viewModel;
  const effectiveCanonicalState = (
    toolPageSnapshot.matches('generating') || generation.isStreamActive
      ? 'running'
      : machineViewModel.canonicalState
  );

  const completedStepsForFlow = progressState.completedSteps;
  const latestArtifactByStep = progressState.latestArtifactByStep;

  const completedArtifactsByStep = useMemo(() => {
    return Object.entries(latestArtifactByStep).reduce<Partial<Record<ToolStep, string>>>((acc, entry) => {
      const [step, artifact] = entry;
      if (artifact?.artifactId) {
        acc[step as ToolStep] = artifact.artifactId;
      }

      return acc;
    }, {});
  }, [latestArtifactByStep]);

  const nextAvailableStep = useAvailableSteps(toolKey, completedStepsForFlow)[0] ?? null;

  const sourceStep = useMemo(() => {
    const candidate = extractArtifactStep(sourceArtifact);
    if (!candidate) {
      return null;
    }

    return toolConfig.steps.includes(candidate) ? candidate : null;
  }, [sourceArtifact, toolConfig.steps]);

  const currentRunningStep = useMemo(() => {
    if (!generation.isStreamActive) {
      return null;
    }

    const candidate = (generation.snapshot.context.lastRequest?.input as Record<string, unknown> | undefined)?.step;
    if (typeof candidate !== 'string') {
      return null;
    }

    return toolConfig.steps.includes(candidate as ToolStep) ? candidate as ToolStep : null;
  }, [generation.isStreamActive, generation.snapshot.context.lastRequest, toolConfig.steps]);

  useEffect(() => {
    if (!pausedCheckpointStep) {
      return;
    }

    if (completedStepsForFlow.has(pausedCheckpointStep)) {
      setPausedCheckpointStep(null);
    }
  }, [completedStepsForFlow, pausedCheckpointStep]);

  const primaryTargetStep = useMemo(() => {
    if (machineViewModel.primaryActionPolicy === 'resume-checkpoint' && pausedCheckpointStep) {
      return pausedCheckpointStep;
    }

    if (machineViewModel.primaryActionPolicy === 'regenerate-current-step') {
      return sourceStep ?? nextAvailableStep;
    }

    if (
      machineViewModel.primaryActionPolicy === 'start-generation'
      || machineViewModel.primaryActionPolicy === 'resume-checkpoint'
    ) {
      return nextAvailableStep;
    }

    return null;
  }, [machineViewModel.primaryActionPolicy, nextAvailableStep, pausedCheckpointStep, sourceStep]);

  // 8. Sync progress into toolPageMachine context.
  // Phase 4: boolean readiness derivati dalla macchina, non passati dall'UI.
  // briefingSnapshot nelle dep: quando l'actor diventa ready, PROGRESS_SYNCED ri-triggera
  // e syncProgress ricalcola deriveHasExtractionContext correttamente.
  useEffect(() => {
    toolPageSend({
      type: 'PROGRESS_SYNCED',
      artifacts: generation.artifacts,
      intent,
      sourceArtifact,
      runRequestPrefix: currentRunPrefixRef.current,
    });
  }, [generation.artifacts, briefingSnapshot, intent, sourceArtifact, toolPageSend]);

  // 10. Build project and step lists
  const currentProject = projects.find((p) => p.id === formState.projectId);

  const resolveRuntimeIntent = (): 'new' | 'resume' | 'regenerate' => {
    // Deterministic DDD rule: artifact-driven relaunch defaults to regenerate.
    if (machineViewModel.primaryActionPolicy === 'resume-checkpoint' || intent === 'resume') {
      return 'resume';
    }

    if (machineViewModel.primaryActionPolicy === 'regenerate-current-step' || intent === 'regenerate') {
      return 'regenerate';
    }

    const hasArtifactDrivenEntry =
      (sourceArtifactId?.trim().length ?? 0) > 0
      || sourceArtifact !== null
      || machineHydrationResult !== null;

    if (hasArtifactDrivenEntry) {
      return 'regenerate';
    }

    return 'new';
  };

  const logPrimaryCtaDiagnostic = (runtimeIntent: 'new' | 'resume' | 'regenerate'): void => {
    if (!import.meta.env.DEV) {
      return;
    }

    console.info('[ToolPageTemplate] primary CTA diagnostic', {
      toolKey,
      routeIntent: intent,
      runtimeIntent,
      primaryActionPolicy: machineViewModel.primaryActionPolicy,
      readiness: readinessSnapshot,
      sourceArtifactId,
      resolvedBriefingId,
      extractionArtifactId: machineHydrationResult?.extractionArtifactId
        ?? briefingSnapshot.context.extractionArtifactId
        ?? extractionArtifactId
        ?? null,
      hydrationResult: machineHydrationResult,
      pausedCheckpointStep,
      nextAvailableStep,
      sourceStep,
      primaryTargetStep,
    });
  };

  // 11. Handle generation start and chaining
  const startGenerationStep = async (step: ToolStep): Promise<boolean> => {
    if (import.meta.env.DEV) {
      const runtimeIntent = resolveRuntimeIntent();
      console.info('[ToolPageTemplate] primary CTA diagnostic', {
        step,
        toolKey,
        routeIntent: intent,
        runtimeIntent,
        primaryActionPolicy: machineViewModel.primaryActionPolicy,
        readiness: readinessSnapshot,
        sourceArtifactId,
        resolvedBriefingId,
        extractionArtifactIdFromMachine: machineHydrationResult?.extractionArtifactId ?? null,
        extractionArtifactIdFromBriefing: briefingSnapshot.context.extractionArtifactId ?? null,
        extractionArtifactIdFromRoute: extractionArtifactId ?? null,
        hydrationResult: machineHydrationResult,
        pausedCheckpointStep,
        nextAvailableStep,
        sourceStep,
        primaryTargetStep,
        hasSession: !!auth.session,
        normalizedProjectId,
        briefingTextLengthFromBriefing: (briefingSnapshot.context.normalizedText ?? '').length,
        extractionPayloadKeysFromBriefing: Object.keys(briefingSnapshot.context.extractionPayload ?? {}).length,
      });
    }

    if (!auth.session || !normalizedProjectId) {
      return false;
    }

    const hasSourceArtifact = sourceArtifact !== null;
    // Contesto estrazione: in recovery da artifact deve essere deterministico e
    // provenire dalla hydration machine; in upload manuale usa briefingSnapshot.
    const extractionInfo = (() => {
      const briefingContextText = briefingSnapshot.context.normalizedText ?? '';

      if (machineHydrationResult !== null) {
        return {
          extractionArtifactId: machineHydrationResult.extractionArtifactId,
          extractionPayload: machineHydrationResult.extractionPayload,
          briefingId: machineHydrationResult.briefingId,
          briefingText: machineHydrationResult.normalizedText.trim().length > 0
            ? machineHydrationResult.normalizedText
            : briefingContextText,
        };
      }

      if (hasSourceArtifact) {
        return null;
      }

      const bc = briefingSnapshot.context;
      if (bc.extractionArtifactId && bc.briefingId) {
        return {
          extractionArtifactId: bc.extractionArtifactId,
          extractionPayload: bc.extractionPayload ?? {},
          briefingId: bc.briefingId,
          briefingText: bc.normalizedText ?? '',
        };
      }
      return null;
    })();

    if (!extractionInfo) {
      return false;
    }

    let effectiveExtractionInfo = extractionInfo;
    const hasExtractionArtifactId = effectiveExtractionInfo.extractionArtifactId.trim().length > 0;
    const needsPayloadEnrichment = isEmptyPayload(effectiveExtractionInfo.extractionPayload);
    const needsBriefingTextEnrichment = effectiveExtractionInfo.briefingText.trim().length === 0;
    const needsBriefingIdEnrichment = effectiveExtractionInfo.briefingId.trim().length === 0;
    const shouldEnrichFromExtractionArtifact =
      hasExtractionArtifactId
      && (needsPayloadEnrichment || needsBriefingTextEnrichment || needsBriefingIdEnrichment);

    if (shouldEnrichFromExtractionArtifact) {
      const extractionArtifact = await getArtifactById(effectiveExtractionInfo.extractionArtifactId, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
        localArtifacts: generation.artifacts,
      }).catch(() => null);

      if (extractionArtifact) {
        const enrichedPayload = needsPayloadEnrichment
          ? (() => {
              const fromContent = parseExtractionPayloadFromContent(extractionArtifact.content);
              if (Object.keys(fromContent).length > 0) {
                return fromContent;
              }

              return readExtractionPayloadFromArtifactInput(extractionArtifact);
            })()
          : effectiveExtractionInfo.extractionPayload;

        const enrichedBriefingText =
          effectiveExtractionInfo.briefingText.trim().length > 0
            ? effectiveExtractionInfo.briefingText
            : (typeof extractionArtifact.sourceRequest.input?.briefingText === 'string'
              ? extractionArtifact.sourceRequest.input.briefingText
              : '');

        const enrichedBriefingId =
          effectiveExtractionInfo.briefingId
          || (typeof extractionArtifact.sourceRequest.input?.briefingId === 'string'
            ? extractionArtifact.sourceRequest.input.briefingId
            : '');

        effectiveExtractionInfo = {
          extractionArtifactId: effectiveExtractionInfo.extractionArtifactId,
          extractionPayload: enrichedPayload,
          briefingId: enrichedBriefingId,
          briefingText: enrichedBriefingText,
        };
      }
    }

    const runPrefix = currentRunPrefixRef.current ?? generateRequestId();
    currentRunPrefixRef.current = runPrefix;
    const runtimeIntent = resolveRuntimeIntent();
    toolPageSend({
      type: 'PROGRESS_SYNCED',
      artifacts: generation.artifacts,
      intent,
      sourceArtifact,
      runRequestPrefix: runPrefix,
    });

    const baseRequest: GenerationRequest = {
      requestId: runPrefix,
      userId: auth.session.user.id,
      projectId: normalizedProjectId,
      artifactType: 'content',
      model: formState.model,
      outputFormat: 'markdown',
      toolKey,
      workflowType: toolKey,
      registrySnapshotRef: formState.registrySnapshotRef,
      input: {
        intent: runtimeIntent,
        tone: resolvedTone,
        notes: resolvedNotes,
        relaunchFromArtifactId: resolvedRelaunchSource,
        sourceArtifactId: sourceArtifactId ?? null,
        briefingId: resolvedBriefingId ?? effectiveExtractionInfo.briefingId,
        briefingText: effectiveExtractionInfo.briefingText,
        briefingFileName: effectiveBriefingFileName ?? null,
        extractionArtifactId: effectiveExtractionInfo.extractionArtifactId,
        extractionPayload: effectiveExtractionInfo.extractionPayload,
      },
    };

    let orchestrationResult;
    lastRequestedStepRef.current = step;
    try {
      orchestrationResult = await orchestrateToolStep(
        normalizedProjectId,
        toolKey,
        step,
        { apiBaseUrl: auth.apiBaseUrl, capabilities: auth.capabilities },
      );
    } catch (err) {
      console.error('[ToolPageTemplate] orchestrateToolStep failed — generation blocked', { toolKey, step, err });
      return false;
    }
    const dependencies = orchestrationResult.dependencyArtifactIdsByStep;
    const dependencyArtifactContentsByStep = Object.fromEntries(
      Object.entries(dependencies)
        .map(([stepKey, artifactId]): [string, string] => {
          const dependencyArtifact = generation.artifacts.find((artifact) => artifact.artifactId === artifactId);
          return [stepKey, dependencyArtifact?.content ?? ''];
        })
        .filter((entry) => entry[1].trim().length > 0),
    );

    const request = createStepRequest(
      baseRequest,
      toolKey,
      step,
      dependencies,
      dependencyArtifactContentsByStep,
    );

    if (import.meta.env.DEV) {
      const briefingTextInRequest = typeof request.input.briefingText === 'string'
        ? request.input.briefingText
        : '';
      const extractionPayloadInRequest = request.input.extractionPayload;
      const extractionPayloadKeysInRequest = (
        extractionPayloadInRequest !== null
        && typeof extractionPayloadInRequest === 'object'
      )
        ? Object.keys(extractionPayloadInRequest as Record<string, unknown>).length
        : 0;
      const stepDependencyArtifactIdsCount = Array.isArray(request.input.stepDependencyArtifactIds)
        ? request.input.stepDependencyArtifactIds.length
        : 0;

      console.info('[ToolPageTemplate] generation request context', {
        step,
        routeIntent: intent,
        runtimeIntent: request.input.intent,
        requestId: request.requestId,
        sourceArtifactId: request.input.sourceArtifactId,
        briefingId: request.input.briefingId,
        briefingTextLengthInRequest: briefingTextInRequest.length,
        extractionArtifactIdInRequest: request.input.extractionArtifactId,
        extractionPayloadKeysInRequest,
        stepDependencyArtifactIdsCount,
        // Bug 1 diagnostics: track payload origin
        extractionPayloadFromBriefing: Object.keys(briefingSnapshot.context.extractionPayload ?? {}).length,
        extractionPayloadFromMachine: machineHydrationResult ? Object.keys(machineHydrationResult.extractionPayload ?? {}).length : 0,
        extractionPayloadSource: machineHydrationResult !== null ? 'hydration' : 'briefing',
      });
    }

    generation.start(request);
    return true;
  };

  const openResultsArchive = (): void => {
    void navigate('/artifacts');
  };

  const handlePrimaryAction = (): void => {
    if (machineViewModel.primaryActionPolicy === 'open-last-artifact') {
      openResultsArchive();
      return;
    }

    if (!readinessSnapshot.canStartFlow) {
      return;
    }

    // Prevent starting a new generation if another tool is already streaming.
    if (generation.isStreamActive) {
      return;
    }

    const targetStep = primaryTargetStep;

    if (!targetStep) {
      return;
    }

    const runPrefix = currentRunPrefixRef.current ?? generateRequestId();
    currentRunPrefixRef.current = runPrefix;

    setPausedCheckpointStep(null);
    setIsAutoChainEnabled(true);
    toolPageSend({ type: 'REQUEST_STEP_START', step: targetStep, runRequestPrefix: runPrefix });
  };

  const handleCancelGeneration = (): void => {
    setIsAutoChainEnabled(false);
    const interruptedStep = currentRunningStep ?? lastRequestedStepRef.current;
    if (interruptedStep) {
      setPausedCheckpointStep(interruptedStep);
    }
    currentRunPrefixRef.current = null;
    toolPageSend({
      type: 'PROGRESS_SYNCED',
      artifacts: generation.artifacts,
      intent,
      sourceArtifact,
      runRequestPrefix: null,
    });
    toolPageSend({ type: 'CANCEL_GENERATION' });
    generation.cancel();
  };

  useEffect(() => {
    const pending = toolPageSnapshot.context.pendingStepStart;
    if (!pending) {
      return;
    }

    currentRunPrefixRef.current = pending.runRequestPrefix;
    void startGenerationStep(pending.step);
    toolPageSend({ type: 'STEP_REQUEST_DISPATCHED' });
  }, [startGenerationStep, toolPageSend, toolPageSnapshot.context.pendingStepStart]);

  // Bridge: quando generation stream termina, invia STEP_DONE/STEP_FAILED alla macchina.
  // Legge completedStep/failedStep dal payload terminal BE (BackendStreamEvent.terminal.data) —
  // non inferisce più dall'isStreamActive/streamStatus lato UI (TASK-026).
  useEffect(() => {
    if (generation.isStreamActive) {
      wasStreamActiveRef.current = true;
      return;
    }

    // isStreamActive è ora false
    if (!wasStreamActiveRef.current) {
      // Era già inattivo (mount iniziale o stato precedente): skip
      return;
    }

    wasStreamActiveRef.current = false;

    const completedStep = generation.terminalCompletedStep;
    const failedStep = generation.terminalFailedStep;

    if (completedStep && toolConfig.steps.includes(completedStep as ToolStep)) {
      toolPageSend({ type: 'STEP_DONE', step: completedStep as ToolStep });
    } else if (failedStep && toolConfig.steps.includes(failedStep as ToolStep)) {
      toolPageSend({ type: 'STEP_FAILED', step: failedStep as ToolStep, message: 'Generazione fallita' });
    } else if (!completedStep && !failedStep && generation.streamStatus === 'completed') {
      // Interim fallback: TASK-026 incomplete — backend didn't send completedStep in SSE_TERMINAL
      // Infer step from lastRequest.input.step to unblock readiness/CTA after generation completes
      const inferredStep = (generation.snapshot.context.lastRequest?.input as Record<string, unknown> | undefined)?.step;
      if (typeof inferredStep === 'string' && toolConfig.steps.includes(inferredStep as ToolStep)) {
        if (import.meta.env.DEV) {
          console.warn('[ToolPageTemplate] inferring step completion from lastRequest (backend TASK-026 incomplete)', {
            inferredStep,
            terminalCompletedStep: completedStep,
            terminalFailedStep: failedStep,
          });
        }
        toolPageSend({ type: 'STEP_DONE', step: inferredStep as ToolStep });
      }
    }
  }, [generation.isStreamActive, generation.terminalCompletedStep, generation.terminalFailedStep, generation.streamStatus, generation.snapshot, toolConfig.steps, toolPageSend]);

  useEffect(() => {
    if (!isAutoChainEnabled) {
      return;
    }

    if (generation.streamStatus === 'failed') {
      const interruptedStep = currentRunningStep ?? lastRequestedStepRef.current;
      if (interruptedStep) {
        setPausedCheckpointStep(interruptedStep);
      }
      setIsAutoChainEnabled(false);
      currentRunPrefixRef.current = null;
      return;
    }

    if (generation.isStreamActive) {
      return;
    }

    if (!nextAvailableStep) {
      setIsAutoChainEnabled(false);
      currentRunPrefixRef.current = null;
      return;
    }

    const lastRequestedStep = lastRequestedStepRef.current;
    if (!lastRequestedStep) {
      return;
    }

    if (!completedStepsForFlow.has(lastRequestedStep)) {
      return;
    }

    if (lastRequestedStep === nextAvailableStep) {
      return;
    }

    void startGenerationStep(nextAvailableStep);
  }, [
    completedStepsForFlow,
    currentRunningStep,
    generation.isStreamActive,
    generation.streamStatus,
    isAutoChainEnabled,
    nextAvailableStep,
  ]);

  return (
    <section className="ui-tool-page-template">
      <div className={uiPrimitives.stack}>
        <div className="ui-tool-layout-grid">
          <section className="ui-tool-column ui-tool-column-inputs">
            <header>
              <h2>{toolConfig.displayName}</h2>
              <p className={uiPrimitives.metaLine}>{toolConfig.displayName} configuration and generation</p>
            </header>

            <form className="ui-tool-form">
              <div className="ui-tool-form-row">
                <label>
                  <span>Project</span>
                  <select
                    value={formState.projectId}
                    onChange={(e) => setFormState({ ...formState, projectId: e.target.value })}
                    disabled={projectsLoading || generation.isStreamActive}
                  >
                    <option value="">{projectsLoading ? 'Caricamento progetti...' : 'Seleziona un progetto'}</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Model</span>
                  <input
                    type="text"
                    value={formState.model}
                    onChange={(e) => setFormState({ ...formState, model: e.target.value })}
                    placeholder="e.g., openrouter/auto"
                  />
                </label>
              </div>

              <label>
                <span>Briefing File</span>
                <input
                  type="file"
                  accept=".docx,.txt,.md"
                  disabled={!formState.projectId.trim() || generation.isStreamActive}
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0] ?? null;
                    if (selectedFile) {
                      toolPageSend({ type: 'BRIEFING_FILE_SELECTED', file: selectedFile });
                    } else {
                      toolPageSend({ type: 'BRIEFING_RESET' });
                    }
                  }}
                />
              </label>

              {briefingError ? <p className={uiPrimitives.error}>{briefingError}</p> : null}

              <p className={uiPrimitives.metaLine}>
                Briefing status: {effectiveBriefingStatus}
                {effectiveBriefingFileName ? ` - ${effectiveBriefingFileName}` : ''}
              </p>

              <ToolActionButtons
                primaryPolicy={machineViewModel.primaryActionPolicy}
                secondaryFlags={{
                  ...machineViewModel.secondaryActionFlags,
                  // canCancelGeneration è sempre false in buildDefaultViewModel perché la macchina
                  // non conosce il proprio stato corrente dentro buildToolPageViewModel.
                  // Lo deriviamo direttamente dallo stato macchina.
                  canCancelGeneration: toolPageSnapshot.matches('generating'),
                }}
                onPrimaryAction={handlePrimaryAction}
                onCancelGeneration={handleCancelGeneration}
                isLoading={toolPageSnapshot.matches('generating')}
              />
            </form>
          </section>

          <section className="ui-tool-column ui-tool-column-status">
            <ToolGenerationFlowVertical
              canonicalState={effectiveCanonicalState}
              projectName={currentProject?.name ?? null}
              briefingFileName={effectiveBriefingFileName ?? null}
              briefingStatus={effectiveBriefingStatus}
              readinessReasonCodes={readinessSnapshot.reasonCodes}
              briefingError={briefingError}
              steps={toolConfig.steps.map((step) => ({
                step,
                displayName: mapToolStepToCardConfig(toolKey, step).displayName,
                status: generation.isStreamActive && currentRunningStep === step
                  ? 'running'
                  : machineViewModel.stepStatuses[step] ?? 'idle',
                artifactId: latestArtifactByStep[step]?.artifactId ?? null,
                isStreaming:
                  generation.isStreamActive
                  && (generation.snapshot.context.lastRequest?.input as Record<string, unknown>)?.step === step,
              }))}
              completedStepsCount={completedStepsForFlow.size}
              totalStepsCount={toolConfig.steps.length}
              errorMessage={machineViewModel.messages.error}
              onViewArtifact={(artifactId) => {
                void navigate(`/artifacts/${artifactId}`);
              }}
            />
          </section>
        </div>
      </div>
    </section>
  );
};