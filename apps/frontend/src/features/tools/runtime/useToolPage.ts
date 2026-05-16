/**
 * useToolPage: Orchestration hook for all tool pages.
 * Extracted from ToolPageTemplate to separate concerns:
 * - state machines (toolPageMachine, briefingUploadMachine)
 * - side-effect orchestration (hydration, progress sync, auto-chain)
 * - generation request building and dispatch
 * ToolPageTemplate is the pure presentation component that delegates here.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMachine, useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import { useNavigate } from 'react-router-dom';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { generateRequestId, readInputField } from '../../../app/runtime/shared-utils';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import type { GenerationRequest } from '../../generation/contracts/backend-stream';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import { briefingUploadMachine } from '../machines/briefing-upload.machine';
import { isExtractionContextValidForTool } from '../machines/extraction-context-validity';
import { toolPageMachine } from '../machines/tool-page.machine';
import { getToolFormConfig } from '../runtime/tool-form-architecture';
import { createStepRequest } from '../runtime/tool-generation-engine';
import { orchestrateToolStep } from '../runtime/tools-client';
import { useProjectsLoader, useToolFormInit, useAvailableSteps } from '../runtime/useToolForm';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { extractArtifactStep, readExtractionPayloadFromArtifact } from '../../generation/runtime/step-hydration';
import { getArtifactById } from '../../artifacts/runtime/artifacts-client';

export interface UseToolPageProps {
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

const isEmptyPayload = (payload: Record<string, unknown>): boolean =>
  Object.keys(payload).length === 0;

const TONE_PROFILE_DEFAULT = 'Professional';
const TONE_PROFILE_ALLOWED = ['Professional', 'Casual', 'Formal', 'Technical'] as const;

const normalizeModelForPayload = (model: string, fallbackModel: string): string => {
  const normalized = model.trim();
  if (normalized.length === 0) {
    return fallbackModel;
  }

  if (normalized.includes('/')) {
    return normalized;
  }

  if (normalized.includes(':')) {
    const [provider, ...rest] = normalized.split(':');
    if (provider && rest.length > 0) {
      return `${provider}/${rest.join(':')}`;
    }
  }

  return normalized;
};

const normalizeToneProfile = (tone: string, fallbackTone: string = TONE_PROFILE_DEFAULT): string => {
  const normalized = tone.trim().toLowerCase();
  if (normalized.length === 0) {
    return fallbackTone;
  }

  const match = TONE_PROFILE_ALLOWED.find((candidate) => candidate.toLowerCase() === normalized);
  return match ?? fallbackTone;
};

const mapInlineDispatchError = (reason: string | null | undefined): string | null => {
  if (!reason) {
    return null;
  }

  const normalized = reason.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized === 'extraction_context_insufficient' || normalized === 'stream_empty_output') {
    return 'Il briefing non contiene dati sufficienti per la generazione. Carica un nuovo brief più dettagliato.';
  }

  if (normalized.startsWith('terminal_failed')) {
    return 'La generazione non è andata a buon fine. Riprova tra pochi istanti.';
  }

  return normalized;
};

const createSessionId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

export const useToolPage = ({
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
}: UseToolPageProps) => {
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const navigate = useNavigate();
  const toolConfig = getToolFormConfig(toolKey);

  const [isAutoChainEnabled, setIsAutoChainEnabled] = useState(false);
  const [pausedCheckpointStep, setPausedCheckpointStep] = useState<ToolStep | null>(null);
  const [sourceArtifact, setSourceArtifact] = useState<GenerationArtifact | null>(null);
  // DispatchError is local inline-action feedback (Setup Panel). It is intentionally
  // not published to the global feedback channel to preserve action-local recovery context.
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const initialPrefillDoneRef = useRef(false);
  const sessionIdRef = useRef<string>(createSessionId());
  const currentRunPrefixRef = useRef<string | null>(null);
  const lastRequestedStepRef = useRef<ToolStep | null>(null);
  const wasStreamActiveRef = useRef(false);
  const previousProjectIdRef = useRef<string>(
    (generation.focusedProjectId ?? initialProjectId ?? '').trim(),
  );
  const tonePrefillDoneRef = useRef(false);

  const [toolPageSnapshot, toolPageSend] = useMachine(toolPageMachine, {
    input: {
      toolKey,
      sessionId: sessionIdRef.current,
      projectId: generation.focusedProjectId ?? initialProjectId ?? '',
      model: toolConfig.defaultModel,
      registrySnapshotRef: toolConfig.defaults.registrySnapshotRef,
      apiBaseUrl: auth.apiBaseUrl,
      capabilities: auth.capabilities,
      userId: auth.session?.user.id ?? null,
    },
  });

  const { formState, setFormState } = useToolFormInit(
    toolKey,
    generation.focusedProjectId ?? initialProjectId ?? undefined,
  );

  const { projects, loading: projectsLoading } = useProjectsLoader();

  const briefingSnapshot = useSelector(
    toolPageSnapshot.context.briefingActorRef as ActorRefFrom<typeof briefingUploadMachine>,
    (state) => state,
  );

  const briefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready' = briefingSnapshot.matches(
    'uploading',
  )
    ? 'uploading'
    : briefingSnapshot.matches('extracting')
      ? 'extracting'
      : briefingSnapshot.matches('ready')
        ? 'ready'
        : 'idle';
  const briefingError = mapInlineDispatchError(briefingSnapshot.context.error);
  const briefingFileNameFromActor = briefingSnapshot.context.fileName;
  const normalizedProjectId = formState.projectId.trim();
  const workspaceExtractionContext = normalizedProjectId
    ? generation.getExtractionContext(normalizedProjectId)
    : null;

  // 1. One-shot prefill from route params
  useEffect(() => {
    if (initialPrefillDoneRef.current) return;
    const nextProjectId = initialProjectId?.trim() ?? '';
    if (!nextProjectId) {
      initialPrefillDoneRef.current = true;
      return;
    }
    setFormState((prev) => ({ ...prev, projectId: nextProjectId }));
    generation.setFocusedProjectId(nextProjectId);
    initialPrefillDoneRef.current = true;
  }, [generation, initialProjectId, setFormState]);

  useEffect(() => {
    if (!briefingSnapshot.matches('ready')) return;
    if (!normalizedProjectId) return;

    const briefingIdFromActor = briefingSnapshot.context.briefingId?.trim() ?? '';
    const extractionArtifactIdFromActor = briefingSnapshot.context.extractionArtifactId?.trim() ?? '';
    const normalizedTextFromActor = briefingSnapshot.context.normalizedText?.trim() ?? '';
    const extractionPayloadFromActor = briefingSnapshot.context.extractionPayload ?? {};
    const parsedFormatFromActor = briefingSnapshot.context.parsedFormat;

    if (
      briefingIdFromActor.length === 0 ||
      extractionArtifactIdFromActor.length === 0 ||
      normalizedTextFromActor.length === 0 ||
      parsedFormatFromActor === null
    ) {
      return;
    }

    if (!isExtractionContextValidForTool(toolKey, extractionPayloadFromActor, normalizedTextFromActor)) {
      return;
    }

    const isWorkspaceContextCurrent =
      workspaceExtractionContext !== null
      && workspaceExtractionContext.projectId === normalizedProjectId
      && workspaceExtractionContext.briefingId === briefingIdFromActor
      && workspaceExtractionContext.extractionArtifactId === extractionArtifactIdFromActor
      && workspaceExtractionContext.normalizedText === normalizedTextFromActor
      && workspaceExtractionContext.parsedFormat === parsedFormatFromActor
      && JSON.stringify(workspaceExtractionContext.extractionPayload) === JSON.stringify(extractionPayloadFromActor);

    if (isWorkspaceContextCurrent) {
      return;
    }

    generation.upsertExtractionContext({
      projectId: normalizedProjectId,
      briefingId: briefingIdFromActor,
      extractionArtifactId: extractionArtifactIdFromActor,
      extractionPayload: extractionPayloadFromActor,
      normalizedText: normalizedTextFromActor,
      parsedFormat: parsedFormatFromActor,
      updatedAt: new Date().toISOString(),
    });
  }, [briefingSnapshot, generation, normalizedProjectId, workspaceExtractionContext]);

  // 2. Resolve source artifact for relaunch intent
  useEffect(() => {
    const normalizedSourceArtifactId = sourceArtifactId?.trim() ?? '';
    if (!normalizedSourceArtifactId) {
      setSourceArtifact(null);
      return;
    }
    const localSource =
      generation.artifacts.find((a) => a.artifactId === normalizedSourceArtifactId) ?? null;
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
        if (!cancelled) setSourceArtifact(detail);
      } catch {
        if (!cancelled) setSourceArtifact(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [generation.artifacts, auth.apiBaseUrl, auth.capabilities, sourceArtifactId]);

  // 3. Hydrate extraction context from source artifact
  useEffect(() => {
    if (!sourceArtifact || !normalizedProjectId) return;

    const routeBriefingId = briefingId?.trim() ?? '';
    const sourceBriefingId = readInputField(sourceArtifact, 'briefingId');
    const resolvedHydrationBriefingId =
      routeBriefingId.length > 0 ? routeBriefingId : sourceBriefingId;
    const resolvedSourceExtractionArtifactId =
      readInputField(sourceArtifact, 'extractionArtifactId') ?? extractionArtifactId ?? null;

    if (import.meta.env.DEV) {
      console.debug('[useToolPage] sending HYDRATE_REQUESTED', {
        intent,
        sourceArtifactId: sourceArtifact.artifactId,
        projectId: normalizedProjectId,
        resolvedHydrationBriefingId,
        resolvedSourceExtractionArtifactId,
      });
    }

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

  const resolvedBriefingId = briefingId ?? readInputField(sourceArtifact, 'briefingId') ?? null;

  // 4. Sync project selection to machine
  useEffect(() => {
    if (previousProjectIdRef.current === normalizedProjectId) return;
    toolPageSend({ type: 'PROJECT_SELECTED', projectId: normalizedProjectId });
    previousProjectIdRef.current = normalizedProjectId;
  }, [normalizedProjectId, toolPageSend]);

  const machineHydrationResult = toolPageSnapshot.context.hydrationResult;

  const effectiveBriefingFileName =
    briefingFileNameFromActor ?? briefingFileName ?? readInputField(sourceArtifact, 'briefingFileName');

  const effectiveBriefingStatus = (
    briefingStatus === 'ready' || machineHydrationResult !== null ? 'ready' : briefingStatus
  ) as 'idle' | 'uploading' | 'extracting' | 'ready';

  const resolvedNotes = relaunchNotes ?? readInputField(sourceArtifact, 'notes') ?? '';
  const resolvedRelaunchSource =
    relaunchFromArtifactId ?? sourceArtifactId ?? sourceArtifact?.artifactId ?? null;

  useEffect(() => {
    if (tonePrefillDoneRef.current) {
      return;
    }

    if (relaunchTone !== null && relaunchTone !== undefined) {
      setFormState((prev) => ({
        ...prev,
        tone: normalizeToneProfile(relaunchTone),
      }));
      tonePrefillDoneRef.current = true;
      return;
    }

    const hasArtifactDrivenEntry = (sourceArtifactId?.trim().length ?? 0) > 0;
    if (hasArtifactDrivenEntry && sourceArtifact === null) {
      return;
    }

    const sourceTone = readInputField(sourceArtifact, 'tone');
    if (sourceTone) {
      setFormState((prev) => ({
        ...prev,
        tone: normalizeToneProfile(sourceTone),
      }));
    }

    tonePrefillDoneRef.current = true;
  }, [relaunchTone, setFormState, sourceArtifact, sourceArtifactId]);

  const progressState = toolPageSnapshot.context.progress;
  const readinessSnapshot = toolPageSnapshot.context.readiness;
  const machineViewModel = toolPageSnapshot.context.viewModel;
  const isGenerating = toolPageSnapshot.matches('generating');
  const effectiveCanonicalState = (
    isGenerating || generation.isStreamActive ? 'running' : machineViewModel.canonicalState
  );

  const completedStepsForFlow = progressState.completedSteps;
  const latestArtifactByStep = progressState.latestArtifactByStep;

  const completedArtifactsByStep = useMemo(() => {
    return Object.entries(latestArtifactByStep).reduce<Partial<Record<ToolStep, string>>>(
      (acc, [step, artifact]) => {
        if (artifact?.artifactId) acc[step as ToolStep] = artifact.artifactId;
        return acc;
      },
      {},
    );
  }, [latestArtifactByStep]);

  const nextAvailableStep = useAvailableSteps(toolKey, completedStepsForFlow)[0] ?? null;

  const sourceStep = useMemo(() => {
    const candidate = extractArtifactStep(sourceArtifact);
    if (!candidate) return null;
    return toolConfig.steps.includes(candidate) ? candidate : null;
  }, [sourceArtifact, toolConfig.steps]);

  const streamingStep = useMemo(() => {
    if (!generation.isStreamActive) return null;
    const candidate = (
      generation.snapshot.context.lastRequest?.input as Record<string, unknown> | undefined
    )?.step;
    if (typeof candidate !== 'string') return null;
    return toolConfig.steps.includes(candidate as ToolStep) ? (candidate as ToolStep) : null;
  }, [generation.isStreamActive, generation.snapshot.context.lastRequest, toolConfig.steps]);

  const currentRunningStep = streamingStep;

  useEffect(() => {
    if (!pausedCheckpointStep) return;
    if (completedStepsForFlow.has(pausedCheckpointStep)) setPausedCheckpointStep(null);
  }, [completedStepsForFlow, pausedCheckpointStep]);

  const primaryTargetStep = useMemo(() => {
    if (machineViewModel.primaryActionPolicy === 'resume-checkpoint' && pausedCheckpointStep) {
      return pausedCheckpointStep;
    }
    if (machineViewModel.primaryActionPolicy === 'regenerate-current-step') {
      return sourceStep ?? nextAvailableStep;
    }
    if (
      machineViewModel.primaryActionPolicy === 'start-generation' ||
      machineViewModel.primaryActionPolicy === 'resume-checkpoint'
    ) {
      return nextAvailableStep;
    }
    return null;
  }, [machineViewModel.primaryActionPolicy, nextAvailableStep, pausedCheckpointStep, sourceStep]);

  // 5. Sync progress to machine
  useEffect(() => {
    toolPageSend({
      type: 'PROGRESS_SYNCED',
      artifacts: generation.artifacts,
      intent,
      sourceArtifact,
      runRequestPrefix: currentRunPrefixRef.current,
    });
  }, [generation.artifacts, briefingSnapshot, intent, sourceArtifact, toolPageSend]);

  const currentProject = projects.find((p) => p.id === formState.projectId);

  const resolveRuntimeIntent = useCallback((): 'new' | 'resume' | 'regenerate' => {
    if (machineViewModel.primaryActionPolicy === 'resume-checkpoint' || intent === 'resume') {
      return 'resume';
    }
    if (
      machineViewModel.primaryActionPolicy === 'regenerate-current-step' ||
      intent === 'regenerate'
    ) {
      return 'regenerate';
    }
    const hasArtifactDrivenEntry =
      (sourceArtifactId?.trim().length ?? 0) > 0 ||
      sourceArtifact !== null ||
      machineHydrationResult !== null;
    return hasArtifactDrivenEntry ? 'regenerate' : 'new';
  }, [
    machineViewModel.primaryActionPolicy,
    intent,
    sourceArtifactId,
    sourceArtifact,
    machineHydrationResult,
  ]);

  // 6. Generation dispatch
  const startGenerationStep = useCallback(
    async (step: ToolStep): Promise<boolean> => {
      if (import.meta.env.DEV) {
        console.info('[useToolPage] generation start', {
          step,
          toolKey,
          routeIntent: intent,
          runtimeIntent: resolveRuntimeIntent(),
          primaryActionPolicy: machineViewModel.primaryActionPolicy,
          readiness: readinessSnapshot,
          sourceArtifactId,
          resolvedBriefingId,
          hydrationResult: machineHydrationResult,
          pausedCheckpointStep,
          nextAvailableStep,
          sourceStep,
          primaryTargetStep,
          hasSession: !!auth.session,
          normalizedProjectId,
          briefingTextLength: (briefingSnapshot.context.normalizedText ?? '').length,
          extractionPayloadKeys: Object.keys(briefingSnapshot.context.extractionPayload ?? {})
            .length,
        });
      }

      if (!auth.session || !normalizedProjectId) return false;

      const hasSourceArtifact = sourceArtifact !== null;
      const extractionInfo = (() => {
        const briefingContextText = briefingSnapshot.context.normalizedText ?? '';
        if (machineHydrationResult !== null) {
          return {
            extractionArtifactId: machineHydrationResult.extractionArtifactId,
            extractionPayload: machineHydrationResult.extractionPayload,
            briefingId: machineHydrationResult.briefingId,
            briefingText:
              machineHydrationResult.normalizedText.trim().length > 0
                ? machineHydrationResult.normalizedText
                : briefingContextText,
          };
        }
        if (
          workspaceExtractionContext !== null
          && briefingSnapshot.context.error !== 'extraction_context_insufficient'
          && isExtractionContextValidForTool(
            toolKey,
            workspaceExtractionContext.extractionPayload,
            workspaceExtractionContext.normalizedText,
          )
        ) {
          return {
            extractionArtifactId: workspaceExtractionContext.extractionArtifactId,
            extractionPayload: workspaceExtractionContext.extractionPayload,
            briefingId: workspaceExtractionContext.briefingId,
            briefingText: workspaceExtractionContext.normalizedText,
          };
        }
        if (hasSourceArtifact) return null;
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

      if (!extractionInfo) return false;

      let effectiveExtractionInfo = extractionInfo;
      const hasExtArtifactId = effectiveExtractionInfo.extractionArtifactId.trim().length > 0;
      const needsPayload = isEmptyPayload(effectiveExtractionInfo.extractionPayload);
      const needsBriefingText = effectiveExtractionInfo.briefingText.trim().length === 0;
      const needsBriefingId = effectiveExtractionInfo.briefingId.trim().length === 0;

      if (hasExtArtifactId && (needsPayload || needsBriefingText || needsBriefingId)) {
        const extArtifact = await getArtifactById(effectiveExtractionInfo.extractionArtifactId, {
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: auth.capabilities,
          localArtifacts: generation.artifacts,
        }).catch(() => null);

        if (extArtifact) {
          effectiveExtractionInfo = {
            extractionArtifactId: effectiveExtractionInfo.extractionArtifactId,
            extractionPayload: needsPayload
              ? readExtractionPayloadFromArtifact(extArtifact)
              : effectiveExtractionInfo.extractionPayload,
            briefingText:
              effectiveExtractionInfo.briefingText.trim().length > 0
                ? effectiveExtractionInfo.briefingText
                : typeof extArtifact.sourceRequest.input?.briefingText === 'string'
                  ? extArtifact.sourceRequest.input.briefingText
                  : '',
            briefingId:
              effectiveExtractionInfo.briefingId ||
              (typeof extArtifact.sourceRequest.input?.briefingId === 'string'
                ? extArtifact.sourceRequest.input.briefingId
                : ''),
          };
        }
      }

      const runPrefix = currentRunPrefixRef.current ?? generateRequestId();
      currentRunPrefixRef.current = runPrefix;
      const runtimeIntent = resolveRuntimeIntent();
      const normalizedModel = normalizeModelForPayload(formState.model, toolConfig.defaultModel);
      const normalizedTone = normalizeToneProfile(formState.tone);
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
        sessionId: sessionIdRef.current,
        artifactType: 'content',
        model: normalizedModel,
        outputFormat: 'markdown',
        toolKey,
        workflowType: toolKey,
        registrySnapshotRef: formState.registrySnapshotRef,
        input: {
          intent: runtimeIntent,
          tone: normalizedTone,
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

      lastRequestedStepRef.current = step;
      let orchestrationResult;
      try {
        orchestrationResult = await orchestrateToolStep(
          normalizedProjectId,
          toolKey,
          step,
          { apiBaseUrl: auth.apiBaseUrl, capabilities: auth.capabilities },
        );
      } catch (err) {
        console.error('[useToolPage] orchestrateToolStep failed', { toolKey, step, err });
        return false;
      }

      const dependencies = orchestrationResult.dependencyArtifactIdsByStep;
      const dependencyArtifactContentsByStep = Object.fromEntries(
        Object.entries(dependencies)
          .map(([stepKey, artifactId]): [string, string] => {
            const dep = generation.artifacts.find((a) => a.artifactId === artifactId);
            return [stepKey, dep?.content ?? ''];
          })
          .filter(([, content]) => content.trim().length > 0),
      );

      const request = createStepRequest(
        baseRequest,
        toolKey,
        step,
        dependencies,
        dependencyArtifactContentsByStep,
      );

      if (import.meta.env.DEV) {
        console.info('[useToolPage] generation request dispatched', {
          step,
          runtimeIntent: request.input.intent,
          requestId: request.requestId,
          briefingTextLength:
            typeof request.input.briefingText === 'string' ? request.input.briefingText.length : 0,
          extractionArtifactId: request.input.extractionArtifactId,
          extractionPayloadKeys:
            request.input.extractionPayload !== null &&
            typeof request.input.extractionPayload === 'object'
              ? Object.keys(request.input.extractionPayload as Record<string, unknown>).length
              : 0,
        });
      }

      generation.start(request);
      return true;
    },
    [
      auth,
      briefingSnapshot.context,
      effectiveBriefingFileName,
      formState.model,
      formState.tone,
      formState.registrySnapshotRef,
      generation,
      intent,
      machineHydrationResult,
      machineViewModel.primaryActionPolicy,
      normalizedProjectId,
      workspaceExtractionContext,
      nextAvailableStep,
      pausedCheckpointStep,
      primaryTargetStep,
      readinessSnapshot,
      resolvedBriefingId,
      resolvedNotes,
      resolvedRelaunchSource,
      resolveRuntimeIntent,
      sourceArtifact,
      sourceArtifactId,
      sourceStep,
      toolKey,
      toolPageSend,
    ],
  );

  // 7. Dispatch pending step start (triggered by machine via REQUEST_STEP_START)
  useEffect(() => {
    const pending = toolPageSnapshot.context.pendingStepStart;
    if (!pending) return;
    const capturedStep = pending.step;
    currentRunPrefixRef.current = pending.runRequestPrefix;
    // Clear pendingStepStart before the async call to prevent re-entry
    toolPageSend({ type: 'STEP_REQUEST_DISPATCHED' });
    void (async () => {
      const success = await startGenerationStep(capturedStep);
      if (!success) {
        // Reset machine to configuring and surface error inline near the primary action.
        // Do not duplicate this message in global feedback.
        setDispatchError('Impossibile avviare la generazione. Controlla la connessione e riprova.');
        toolPageSend({ type: 'CANCEL_GENERATION' });
      }
    })();
  }, [startGenerationStep, toolPageSend, toolPageSnapshot.context.pendingStepStart]);

  // 8. Bridge: stream terminal → machine STEP_DONE/STEP_FAILED
  useEffect(() => {
    if (generation.isStreamActive) {
      wasStreamActiveRef.current = true;
      return;
    }
    if (!wasStreamActiveRef.current) return;
    wasStreamActiveRef.current = false;

    const completedStep = generation.terminalCompletedStep;
    const failedStep = generation.terminalFailedStep;
    const inferredStepFromLastRequest = (
      generation.snapshot.context.lastRequest?.input as Record<string, unknown> | undefined
    )?.step;
    const normalizedFailedStep =
      typeof failedStep === 'string' && toolConfig.steps.includes(failedStep as ToolStep)
        ? (failedStep as ToolStep)
        : typeof inferredStepFromLastRequest === 'string' && toolConfig.steps.includes(inferredStepFromLastRequest as ToolStep)
          ? (inferredStepFromLastRequest as ToolStep)
          : null;

    if (completedStep && toolConfig.steps.includes(completedStep as ToolStep)) {
      toolPageSend({ type: 'STEP_DONE', step: completedStep as ToolStep });
    } else if (generation.streamStatus === 'failed') {
      const streamErrorMessage = generation.snapshot.context.errorMessage?.trim() || 'generation_failed';
      const readableStreamError = mapInlineDispatchError(streamErrorMessage) ?? 'Generazione fallita';

      if (normalizedFailedStep) {
        toolPageSend({
          type: 'STEP_FAILED',
          step: normalizedFailedStep,
          message: readableStreamError,
        });
      }

      // Force exit from generating state so the UI does not remain stuck in pending.
      // Keep terminal failure feedback inline-action only.
      setDispatchError(readableStreamError);
      setIsAutoChainEnabled(false);
      currentRunPrefixRef.current = null;
      toolPageSend({ type: 'CANCEL_GENERATION' });
    } else if (!completedStep && !failedStep && generation.streamStatus === 'completed') {
      const inferredStep = (
        generation.snapshot.context.lastRequest?.input as Record<string, unknown> | undefined
      )?.step;
      if (typeof inferredStep === 'string' && toolConfig.steps.includes(inferredStep as ToolStep)) {
        toolPageSend({ type: 'STEP_DONE', step: inferredStep as ToolStep });
      }
    }
  }, [
    generation.isStreamActive,
    generation.terminalCompletedStep,
    generation.terminalFailedStep,
    generation.streamStatus,
    generation.snapshot,
    toolConfig.steps,
    toolPageSend,
  ]);

  // 9. Auto-chain: start next step after current completes
  useEffect(() => {
    if (!isAutoChainEnabled) return;

    if (generation.streamStatus === 'failed') {
      const interruptedStep = currentRunningStep ?? lastRequestedStepRef.current;
      if (interruptedStep) setPausedCheckpointStep(interruptedStep);
      setIsAutoChainEnabled(false);
      currentRunPrefixRef.current = null;
      return;
    }

    if (generation.isStreamActive) return;
    if (!nextAvailableStep) {
      setIsAutoChainEnabled(false);
      currentRunPrefixRef.current = null;
      return;
    }

    const lastRequestedStep = lastRequestedStepRef.current;
    if (!lastRequestedStep) return;
    if (!completedStepsForFlow.has(lastRequestedStep)) return;
    if (lastRequestedStep === nextAvailableStep) return;

    void startGenerationStep(nextAvailableStep);
  }, [
    completedStepsForFlow,
    currentRunningStep,
    generation.isStreamActive,
    generation.streamStatus,
    isAutoChainEnabled,
    nextAvailableStep,
    startGenerationStep,
  ]);

  const handlePrimaryAction = useCallback((): void => {
    if (machineViewModel.primaryActionPolicy === 'open-last-artifact') {
      void navigate(`/sessionsummary/${sessionIdRef.current}`);
      return;
    }
    if (!readinessSnapshot.canStartFlow) return;
    if (generation.isStreamActive) return;
    const targetStep = primaryTargetStep;
    if (!targetStep) return;

    const runPrefix = currentRunPrefixRef.current ?? generateRequestId();
    currentRunPrefixRef.current = runPrefix;
    // Clear inline DispatchError before a new dispatch attempt.
    setDispatchError(null);
    setPausedCheckpointStep(null);
    setIsAutoChainEnabled(true);
    toolPageSend({ type: 'REQUEST_STEP_START', step: targetStep, runRequestPrefix: runPrefix });
  }, [
    generation.isStreamActive,
    machineViewModel.primaryActionPolicy,
    navigate,
    primaryTargetStep,
    readinessSnapshot.canStartFlow,
    toolPageSend,
  ]);

  const handleCancelGeneration = useCallback((): void => {
    setIsAutoChainEnabled(false);
    const interruptedStep = currentRunningStep ?? lastRequestedStepRef.current;
    if (interruptedStep) setPausedCheckpointStep(interruptedStep);
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
  }, [currentRunningStep, generation, intent, sourceArtifact, toolPageSend]);

  const handleBriefingFileSelected = useCallback((file: File): void => {
    toolPageSend({ type: 'BRIEFING_FILE_SELECTED', file });
  }, [toolPageSend]);

  const handleBriefingReset = useCallback((): void => {
    toolPageSend({ type: 'BRIEFING_RESET' });
  }, [toolPageSend]);

  return {
    // Config
    toolConfig,
    // Form
    formState,
    setFormState,
    // Projects
    projects,
    projectsLoading,
    // Briefing
    briefingError,
    dispatchError,
    effectiveBriefingStatus,
    effectiveBriefingFileName,
    // Machine
    machineViewModel,
    isGenerating,
    // Readiness & progress
    readinessSnapshot,
    completedStepsForFlow,
    latestArtifactByStep,
    completedArtifactsByStep,
    // Steps
    currentRunningStep,
    streamingStep,
    nextAvailableStep,
    // Presentation
    effectiveCanonicalState,
    currentProject,
    // Generation workspace passthrough (for JSX derived values)
    isStreamActive: generation.isStreamActive,
    // Handlers
    handlePrimaryAction,
    handleCancelGeneration,
    handleBriefingFileSelected,
    handleBriefingReset,
    // Navigation
    navigate,
  };
};
