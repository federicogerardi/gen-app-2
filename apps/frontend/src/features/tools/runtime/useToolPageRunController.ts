import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveToolWorkflowType } from '@gen-app-2/contracts';
import { generateRequestId } from '../../../app/runtime/shared-utils';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import type {
  GenerationArtifactsWorkspaceValue,
  GenerationProjectWorkspaceValue,
  GenerationStreamWorkspaceValue,
} from '../../generation/runtime/GenerationWorkspaceProvider';
import type { GenerationRequest } from '../../generation/contracts/backend-stream';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { readExtractionPayloadFromArtifact } from '../../generation/runtime/step-hydration';
import { getArtifactById } from '../../artifacts/runtime/artifacts-client';
import type { ToolPageViewModel, ReadinessSnapshot, HydrationResult } from '../machines/tool-page.machine';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import type { ToolFormConfig, ToolFormState } from './tool-form-architecture';
import { createStepRequest } from './tool-generation-engine';
import { orchestrateToolStep } from './tools-client';
import {
  isEmptyPayload,
  mapInlineDispatchError,
  normalizeModelForPayload,
  normalizeToneProfile,
} from './tool-page-runtime-utils';
import { isExtractionContextValidForTool } from '../machines/extraction-context-validity';

type UseToolPageRunControllerArgs = {
  auth: ReturnType<typeof useAuthSession>;
  toolKey: SupportedTool;
  toolConfig: ToolFormConfig;
  formState: ToolFormState;
  intent: 'new' | 'resume' | 'regenerate';
  generationStream: GenerationStreamWorkspaceValue;
  generationArtifacts: GenerationArtifactsWorkspaceValue;
  sourceArtifact: GenerationArtifact | null;
  sourceArtifactId?: string | null;
  machineHydrationResult: HydrationResult | null;
  workspaceExtractionContext: GenerationProjectWorkspaceValue['extractionByProject'][string] | null;
  briefingSnapshot: {
    context: {
      error: string | null;
      extractionArtifactId: string | null;
      extractionPayload: Record<string, unknown> | null;
      briefingId: string | null;
      normalizedText: string | null;
    };
  };
  effectiveBriefingFileName: string | null | undefined;
  resolvedBriefingId: string | null;
  resolvedNotes: string;
  resolvedRelaunchSource: string | null;
  nextAvailableStep: ToolStep | null;
  sourceStep: ToolStep | null;
  machineViewModel: ToolPageViewModel;
  readinessSnapshot: ReadinessSnapshot;
  completedStepsForFlow: Set<ToolStep>;
  pendingStepStart: { step: ToolStep; runRequestPrefix: string } | null;
  toolPageSend: (event: any) => void;
  sessionId: string;
};

export const useToolPageRunController = ({
  auth,
  toolKey,
  toolConfig,
  formState,
  intent,
  generationStream,
  generationArtifacts,
  sourceArtifact,
  sourceArtifactId,
  machineHydrationResult,
  workspaceExtractionContext,
  briefingSnapshot,
  effectiveBriefingFileName,
  resolvedBriefingId,
  resolvedNotes,
  resolvedRelaunchSource,
  nextAvailableStep,
  sourceStep,
  machineViewModel,
  readinessSnapshot,
  completedStepsForFlow,
  pendingStepStart,
  toolPageSend,
  sessionId,
}: UseToolPageRunControllerArgs) => {
  const [isAutoChainEnabled, setIsAutoChainEnabled] = useState(false);
  const [pausedCheckpointStep, setPausedCheckpointStep] = useState<ToolStep | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const currentRunPrefixRef = useRef<string | null>(null);
  const lastRequestedStepRef = useRef<ToolStep | null>(null);
  const wasStreamActiveRef = useRef(false);
  const toolStepSet = useMemo(() => new Set(toolConfig.steps), [toolConfig.steps]);
  const validateToolStep = useCallback(
    (candidate: unknown): ToolStep | null => {
      if (typeof candidate !== 'string') {
        return null;
      }

      return toolStepSet.has(candidate as ToolStep) ? (candidate as ToolStep) : null;
    },
    [toolStepSet],
  );

  const streamingStep = useMemo(() => {
    if (!generationStream.isStreamActive) {
      return null;
    }

    return validateToolStep(
      (generationStream.snapshot.context.lastRequest?.input as Record<string, unknown> | undefined)
        ?.step,
    );
  }, [
    generationStream.isStreamActive,
    generationStream.snapshot.context.lastRequest,
    validateToolStep,
  ]);

  const currentRunningStep = streamingStep;

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
  }, [
    machineViewModel.primaryActionPolicy,
    nextAvailableStep,
    pausedCheckpointStep,
    sourceStep,
  ]);

  const resolveRuntimeIntent = useCallback((): 'new' | 'resume' | 'regenerate' => {
    if (machineViewModel.primaryActionPolicy === 'resume-checkpoint' || intent === 'resume') {
      return 'resume';
    }

    if (
      machineViewModel.primaryActionPolicy === 'regenerate-current-step'
      || intent === 'regenerate'
    ) {
      return 'regenerate';
    }

    const hasArtifactDrivenEntry =
      (sourceArtifactId?.trim().length ?? 0) > 0
      || sourceArtifact !== null
      || machineHydrationResult !== null;
    return hasArtifactDrivenEntry ? 'regenerate' : 'new';
  }, [intent, machineHydrationResult, machineViewModel.primaryActionPolicy, sourceArtifact, sourceArtifactId]);

  const startGenerationStep = useCallback(
    async (step: ToolStep): Promise<boolean> => {
      const normalizedProjectId = formState.projectId.trim();
      if (!auth.session || !normalizedProjectId) {
        return false;
      }

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
          extractionPayloadKeys: Object.keys(briefingSnapshot.context.extractionPayload ?? {}).length,
        });
      }

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

        if (hasSourceArtifact) {
          return null;
        }

        const briefingContext = briefingSnapshot.context;
        if (briefingContext.extractionArtifactId && briefingContext.briefingId) {
          return {
            extractionArtifactId: briefingContext.extractionArtifactId,
            extractionPayload: briefingContext.extractionPayload ?? {},
            briefingId: briefingContext.briefingId,
            briefingText: briefingContext.normalizedText ?? '',
          };
        }

        return null;
      })();

      if (!extractionInfo) {
        return false;
      }

      let effectiveExtractionInfo = extractionInfo;
      const hasExtArtifactId = effectiveExtractionInfo.extractionArtifactId.trim().length > 0;
      const needsPayload = isEmptyPayload(effectiveExtractionInfo.extractionPayload);
      const needsBriefingText = effectiveExtractionInfo.briefingText.trim().length === 0;
      const needsBriefingId = effectiveExtractionInfo.briefingId.trim().length === 0;

      if (hasExtArtifactId && (needsPayload || needsBriefingText || needsBriefingId)) {
        const extArtifact = await getArtifactById(effectiveExtractionInfo.extractionArtifactId, {
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: auth.capabilities,
          localArtifacts: generationArtifacts.artifacts,
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
              effectiveExtractionInfo.briefingId
              || (typeof extArtifact.sourceRequest.input?.briefingId === 'string'
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
        artifacts: generationArtifacts.artifacts,
        intent,
        sourceArtifact,
        runRequestPrefix: runPrefix,
      });

      const baseRequest: GenerationRequest = {
        requestId: runPrefix,
        userId: auth.session.user.id,
        projectId: normalizedProjectId,
        sessionId,
        artifactType: 'content',
        model: normalizedModel,
        outputFormat: 'markdown',
        toolKey,
        workflowType: resolveToolWorkflowType(toolKey),
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
            const dependencyArtifact = generationArtifacts.artifacts.find(
              (artifact) => artifact.artifactId === artifactId,
            );
            return [stepKey, dependencyArtifact?.content ?? ''];
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
            request.input.extractionPayload !== null
            && typeof request.input.extractionPayload === 'object'
              ? Object.keys(request.input.extractionPayload as Record<string, unknown>).length
              : 0,
        });
      }

      generationStream.start(request);
      return true;
    },
    [
      auth,
      briefingSnapshot.context,
      effectiveBriefingFileName,
      formState.model,
      formState.projectId,
      formState.registrySnapshotRef,
      formState.tone,
      generationArtifacts.artifacts,
      generationStream,
      intent,
      machineHydrationResult,
      machineViewModel.primaryActionPolicy,
      nextAvailableStep,
      pausedCheckpointStep,
      primaryTargetStep,
      readinessSnapshot,
      resolveRuntimeIntent,
      resolvedBriefingId,
      resolvedNotes,
      resolvedRelaunchSource,
      sessionId,
      sourceArtifact,
      sourceArtifactId,
      sourceStep,
      toolConfig.defaultModel,
      toolKey,
      toolPageSend,
      workspaceExtractionContext,
    ],
  );

  useEffect(() => {
    if (!pendingStepStart) {
      return;
    }

    const capturedStep = pendingStepStart.step;
    currentRunPrefixRef.current = pendingStepStart.runRequestPrefix;
    toolPageSend({ type: 'STEP_REQUEST_DISPATCHED' });

    void (async () => {
      const success = await startGenerationStep(capturedStep);
      if (!success) {
        setDispatchError('Impossibile avviare la generazione. Controlla la connessione e riprova.');
        toolPageSend({ type: 'CANCEL_GENERATION' });
      }
    })();
  }, [pendingStepStart, startGenerationStep, toolPageSend]);

  useEffect(() => {
    if (generationStream.isStreamActive) {
      wasStreamActiveRef.current = true;
      return;
    }

    if (!wasStreamActiveRef.current) {
      return;
    }

    wasStreamActiveRef.current = false;

    const completedStep = generationStream.terminalCompletedStep;
    const failedStep = generationStream.terminalFailedStep;
    const inferredStepFromLastRequest = (generationStream.snapshot.context.lastRequest?.input as
      | Record<string, unknown>
      | undefined)?.step;
    const normalizedFailedStep =
      validateToolStep(failedStep) ?? validateToolStep(inferredStepFromLastRequest);

    const normalizedCompletedStep = validateToolStep(completedStep);
    if (normalizedCompletedStep) {
      toolPageSend({ type: 'STEP_DONE', step: normalizedCompletedStep });
      return;
    }

    if (generationStream.streamStatus === 'failed') {
      const streamErrorMessage =
        generationStream.snapshot.context.errorMessage?.trim() || 'generation_failed';
      const readableStreamError =
        mapInlineDispatchError(streamErrorMessage) ?? 'Generazione fallita';

      if (normalizedFailedStep) {
        toolPageSend({
          type: 'STEP_FAILED',
          step: normalizedFailedStep,
          message: readableStreamError,
        });
      }

      setDispatchError(readableStreamError);
      setIsAutoChainEnabled(false);
      currentRunPrefixRef.current = null;
      toolPageSend({ type: 'CANCEL_GENERATION' });
      return;
    }

    if (!completedStep && !failedStep && generationStream.streamStatus === 'completed') {
      const inferredStep = validateToolStep((generationStream.snapshot.context.lastRequest?.input as
        | Record<string, unknown>
        | undefined)?.step);
      if (inferredStep) {
        toolPageSend({ type: 'STEP_DONE', step: inferredStep });
      }
    }
  }, [
    generationStream.isStreamActive,
    generationStream.snapshot.context.errorMessage,
    generationStream.snapshot.context.lastRequest,
    generationStream.streamStatus,
    generationStream.terminalCompletedStep,
    generationStream.terminalFailedStep,
    toolPageSend,
    validateToolStep,
  ]);

  useEffect(() => {
    if (!isAutoChainEnabled) {
      return;
    }

    if (generationStream.streamStatus === 'failed') {
      const interruptedStep = currentRunningStep ?? lastRequestedStepRef.current;
      if (interruptedStep) {
        setPausedCheckpointStep(interruptedStep);
      }
      setIsAutoChainEnabled(false);
      currentRunPrefixRef.current = null;
      return;
    }

    if (generationStream.isStreamActive) {
      return;
    }

    if (!nextAvailableStep) {
      setIsAutoChainEnabled(false);
      currentRunPrefixRef.current = null;
      return;
    }

    const lastRequestedStep = lastRequestedStepRef.current;
    if (!lastRequestedStep || !completedStepsForFlow.has(lastRequestedStep)) {
      return;
    }

    if (lastRequestedStep === nextAvailableStep) {
      return;
    }

    void startGenerationStep(nextAvailableStep);
  }, [
    completedStepsForFlow,
    currentRunningStep,
    generationStream.isStreamActive,
    generationStream.streamStatus,
    isAutoChainEnabled,
    nextAvailableStep,
    startGenerationStep,
  ]);

  const handlePrimaryAction = useCallback(() => {
    if (machineViewModel.primaryActionPolicy === 'open-last-artifact') {
      return;
    }

    if (!readinessSnapshot.canStartFlow || generationStream.isStreamActive) {
      return;
    }

    const targetStep = primaryTargetStep;
    if (!targetStep) {
      return;
    }

    const runPrefix = currentRunPrefixRef.current ?? generateRequestId();
    currentRunPrefixRef.current = runPrefix;
    setDispatchError(null);
    setPausedCheckpointStep(null);
    setIsAutoChainEnabled(true);
    toolPageSend({ type: 'REQUEST_STEP_START', step: targetStep, runRequestPrefix: runPrefix });
  }, [
    generationStream.isStreamActive,
    machineViewModel.primaryActionPolicy,
    primaryTargetStep,
    readinessSnapshot.canStartFlow,
    toolPageSend,
  ]);

  const handleCancelGeneration = useCallback(() => {
    setIsAutoChainEnabled(false);
    const interruptedStep = currentRunningStep ?? lastRequestedStepRef.current;
    if (interruptedStep) {
      setPausedCheckpointStep(interruptedStep);
    }
    currentRunPrefixRef.current = null;
    toolPageSend({
      type: 'PROGRESS_SYNCED',
      artifacts: generationArtifacts.artifacts,
      intent,
      sourceArtifact,
      runRequestPrefix: null,
    });
    toolPageSend({ type: 'CANCEL_GENERATION' });
    generationStream.cancel();
  }, [
    currentRunningStep,
    generationArtifacts.artifacts,
    generationStream,
    intent,
    sourceArtifact,
    toolPageSend,
  ]);

  return {
    currentRunningStep,
    dispatchError,
    primaryTargetStep,
    pausedCheckpointStep,
    streamingStep,
    handlePrimaryAction,
    handleCancelGeneration,
  };
};
