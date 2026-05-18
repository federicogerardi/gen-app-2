import { useCallback, useEffect, useRef, useState } from 'react';
import { generateRequestId } from '../../../app/runtime/shared-utils';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import type { GenerationArtifactsWorkspaceValue, GenerationProjectWorkspaceValue, GenerationStreamWorkspaceValue } from '../../generation/runtime/GenerationWorkspaceProvider';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { getArtifactById } from '../../artifacts/runtime/artifacts-client';
import type { HydrationResult, ReadinessSnapshot, ToolPageViewModel } from '../machines/tool-page.machine';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import type { ToolFormConfig, ToolFormState } from './tool-form-architecture';
import { createStepRequest } from './tool-generation-engine';
import { buildBaseGenerationRequest, buildDependencyArtifactContentsByStep, mergeResolvedExtractionArtifact, needsResolvedExtractionArtifact, resolveToolPageRuntimeIntent, selectGenerationExtractionInfo, selectInterruptedStep, selectPrimaryTargetStep, selectStreamingStep, selectStreamTerminalResolution } from './tool-page-selectors';
import { orchestrateToolStep } from './tools-client';

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
  briefingSnapshot: { context: { error: string | null; extractionArtifactId: string | null; extractionPayload: Record<string, unknown> | null; briefingId: string | null; normalizedText: string | null } };
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

export const useToolPageRunController = ({ auth, toolKey, toolConfig, formState, intent, generationStream, generationArtifacts, sourceArtifact, sourceArtifactId, machineHydrationResult, workspaceExtractionContext, briefingSnapshot, effectiveBriefingFileName, resolvedBriefingId, resolvedNotes, resolvedRelaunchSource, nextAvailableStep, sourceStep, machineViewModel, readinessSnapshot, completedStepsForFlow, pendingStepStart, toolPageSend, sessionId }: UseToolPageRunControllerArgs) => {
  const [isAutoChainEnabled, setIsAutoChainEnabled] = useState(false);
  const [pausedCheckpointStep, setPausedCheckpointStep] = useState<ToolStep | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const currentRunPrefixRef = useRef<string | null>(null);
  const lastRequestedStepRef = useRef<ToolStep | null>(null);
  const wasStreamActiveRef = useRef(false);
  const primaryActionPolicy = machineViewModel.primaryActionPolicy;
  const streamingStep = selectStreamingStep({ isStreamActive: generationStream.isStreamActive, lastRequest: generationStream.snapshot.context.lastRequest, toolSteps: toolConfig.steps });
  const currentRunningStep = streamingStep;
  const runtimeIntent = resolveToolPageRuntimeIntent({ primaryActionPolicy, intent, sourceArtifactId, sourceArtifact, machineHydrationResult });
  const primaryTargetStep = selectPrimaryTargetStep({ primaryActionPolicy, pausedCheckpointStep, sourceStep, nextAvailableStep });
  const stopAutoChain = () => {
    setIsAutoChainEnabled(false);
    currentRunPrefixRef.current = null;
  };

  useEffect(() => {
    if (pausedCheckpointStep && completedStepsForFlow.has(pausedCheckpointStep)) setPausedCheckpointStep(null);
  }, [completedStepsForFlow, pausedCheckpointStep]);

  const startGenerationStep = useCallback(async (step: ToolStep) => {
    const normalizedProjectId = formState.projectId.trim();
    if (!auth.session || !normalizedProjectId) return false;

    if (import.meta.env.DEV) {
      console.info('[useToolPage] generation start', {
        step, toolKey, routeIntent: intent, runtimeIntent, primaryActionPolicy, readiness: readinessSnapshot,
        sourceArtifactId, resolvedBriefingId, hydrationResult: machineHydrationResult, pausedCheckpointStep,
        nextAvailableStep, sourceStep, primaryTargetStep, hasSession: true, normalizedProjectId,
        briefingTextLength: (briefingSnapshot.context.normalizedText ?? '').length,
        extractionPayloadKeys: Object.keys(briefingSnapshot.context.extractionPayload ?? {}).length,
      });
    }

    const extractionInfo = selectGenerationExtractionInfo({
      machineHydrationResult,
      workspaceExtractionContext,
      briefingSnapshot,
      toolKey,
      hasSourceArtifact: sourceArtifact !== null,
    });
    if (!extractionInfo) return false;

    let effectiveExtractionInfo = extractionInfo;
    if (needsResolvedExtractionArtifact(effectiveExtractionInfo)) {
      const extractionArtifact = await getArtifactById(effectiveExtractionInfo.extractionArtifactId, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
        localArtifacts: generationArtifacts.artifacts,
      }).catch(() => null);
      if (extractionArtifact) {
        effectiveExtractionInfo = mergeResolvedExtractionArtifact({ extractionInfo: effectiveExtractionInfo, extractionArtifact });
      }
    }

    const runPrefix = currentRunPrefixRef.current ?? generateRequestId();
    currentRunPrefixRef.current = runPrefix;
    lastRequestedStepRef.current = step;
    toolPageSend({ type: 'PROGRESS_SYNCED', artifacts: generationArtifacts.artifacts, intent, sourceArtifact, runRequestPrefix: runPrefix });

    const baseRequest = buildBaseGenerationRequest({
      userId: auth.session.user.id,
      projectId: normalizedProjectId,
      sessionId,
      toolKey,
      runtimeIntent,
      formState,
      toolConfig,
      resolvedNotes,
      resolvedRelaunchSource,
      sourceArtifactId,
      resolvedBriefingId,
      effectiveBriefingFileName,
      extractionInfo: effectiveExtractionInfo,
      runPrefix,
    });

    try {
      const orchestrationResult = await orchestrateToolStep(normalizedProjectId, toolKey, step, { apiBaseUrl: auth.apiBaseUrl, capabilities: auth.capabilities });
      const request = createStepRequest(baseRequest, toolKey, step, orchestrationResult.dependencyArtifactIdsByStep, buildDependencyArtifactContentsByStep(orchestrationResult.dependencyArtifactIdsByStep, generationArtifacts.artifacts));
      if (import.meta.env.DEV) {
        console.info('[useToolPage] generation request dispatched', {
          step,
          runtimeIntent: request.input.intent,
          requestId: request.requestId,
          briefingTextLength: typeof request.input.briefingText === 'string' ? request.input.briefingText.length : 0,
          extractionArtifactId: request.input.extractionArtifactId,
          extractionPayloadKeys: request.input.extractionPayload && typeof request.input.extractionPayload === 'object'
            ? Object.keys(request.input.extractionPayload as Record<string, unknown>).length
            : 0,
        });
      }
      generationStream.start(request);
      return true;
    } catch (err) {
      console.error('[useToolPage] orchestrateToolStep failed', { toolKey, step, err });
      return false;
    }
  }, [
    auth, briefingSnapshot, effectiveBriefingFileName, formState, generationArtifacts.artifacts, generationStream,
    intent, machineHydrationResult, nextAvailableStep, pausedCheckpointStep, primaryActionPolicy,
    primaryTargetStep, readinessSnapshot, resolvedBriefingId, resolvedNotes, resolvedRelaunchSource,
    runtimeIntent, sessionId, sourceArtifact, sourceArtifactId, sourceStep, toolConfig, toolKey,
    toolPageSend, workspaceExtractionContext,
  ]);

  useEffect(() => {
    if (!pendingStepStart) return;
    currentRunPrefixRef.current = pendingStepStart.runRequestPrefix;
    toolPageSend({ type: 'STEP_REQUEST_DISPATCHED' });
    void startGenerationStep(pendingStepStart.step).then((success) => {
      if (!success) {
        setDispatchError('Impossibile avviare la generazione. Controlla la connessione e riprova.');
        toolPageSend({ type: 'CANCEL_GENERATION' });
      }
    });
  }, [pendingStepStart, startGenerationStep, toolPageSend]);

  useEffect(() => {
    if (generationStream.isStreamActive) {
      wasStreamActiveRef.current = true;
      return;
    }
    if (!wasStreamActiveRef.current) return;
    wasStreamActiveRef.current = false;

    const terminalResolution = selectStreamTerminalResolution({
      streamStatus: generationStream.streamStatus,
      completedStep: generationStream.terminalCompletedStep,
      failedStep: generationStream.terminalFailedStep,
      lastRequest: generationStream.snapshot.context.lastRequest,
      errorMessage: generationStream.snapshot.context.errorMessage,
      toolSteps: toolConfig.steps,
    });
    if (terminalResolution.status === 'done' || terminalResolution.status === 'inferred') {
      toolPageSend({ type: 'STEP_DONE', step: terminalResolution.step });
      return;
    }
    if (terminalResolution.status === 'failed') {
      if (terminalResolution.step) {
        toolPageSend({ type: 'STEP_FAILED', step: terminalResolution.step, message: terminalResolution.message });
      }
      setDispatchError(terminalResolution.message);
      stopAutoChain();
      toolPageSend({ type: 'CANCEL_GENERATION' });
    }
  }, [
    generationStream.isStreamActive, generationStream.snapshot.context.errorMessage,
    generationStream.snapshot.context.lastRequest, generationStream.streamStatus,
    generationStream.terminalCompletedStep, generationStream.terminalFailedStep, toolConfig.steps, toolPageSend,
  ]);

  useEffect(() => {
    if (!isAutoChainEnabled) return;
    if (generationStream.streamStatus === 'failed') {
      const interruptedStep = selectInterruptedStep(currentRunningStep, lastRequestedStepRef.current);
      if (interruptedStep) setPausedCheckpointStep(interruptedStep);
      stopAutoChain();
      return;
    }
    if (generationStream.isStreamActive) return;
    if (!nextAvailableStep) {
      stopAutoChain();
      return;
    }
    const lastRequestedStep = lastRequestedStepRef.current;
    if (lastRequestedStep && completedStepsForFlow.has(lastRequestedStep) && lastRequestedStep !== nextAvailableStep) {
      void startGenerationStep(nextAvailableStep);
    }
  }, [
    completedStepsForFlow, currentRunningStep, generationStream.isStreamActive,
    generationStream.streamStatus, isAutoChainEnabled, nextAvailableStep, startGenerationStep,
  ]);

  const handlePrimaryAction = useCallback(() => {
    if (primaryActionPolicy === 'open-last-artifact' || !readinessSnapshot.canStartFlow || generationStream.isStreamActive || !primaryTargetStep) return;
    const runPrefix = currentRunPrefixRef.current ?? generateRequestId();
    currentRunPrefixRef.current = runPrefix;
    setDispatchError(null);
    setPausedCheckpointStep(null);
    setIsAutoChainEnabled(true);
    toolPageSend({ type: 'REQUEST_STEP_START', step: primaryTargetStep, runRequestPrefix: runPrefix });
  }, [generationStream.isStreamActive, primaryActionPolicy, primaryTargetStep, readinessSnapshot.canStartFlow, toolPageSend]);

  const handleCancelGeneration = useCallback(() => {
    setIsAutoChainEnabled(false);
    const interruptedStep = selectInterruptedStep(currentRunningStep, lastRequestedStepRef.current);
    if (interruptedStep) setPausedCheckpointStep(interruptedStep);
    currentRunPrefixRef.current = null;
    toolPageSend({ type: 'PROGRESS_SYNCED', artifacts: generationArtifacts.artifacts, intent, sourceArtifact, runRequestPrefix: null });
    toolPageSend({ type: 'CANCEL_GENERATION' });
    generationStream.cancel();
  }, [currentRunningStep, generationArtifacts.artifacts, generationStream, intent, sourceArtifact, toolPageSend]);

  const getCurrentRunRequestPrefix = useCallback(() => currentRunPrefixRef.current, []);

  return { currentRunningStep, dispatchError, getCurrentRunRequestPrefix, primaryTargetStep, pausedCheckpointStep, streamingStep, handlePrimaryAction, handleCancelGeneration };
};