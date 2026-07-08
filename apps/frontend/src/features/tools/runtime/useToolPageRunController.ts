import { useCallback, useEffect, useRef, useState } from 'react';
import { appCopy } from '../../../app/copy/system';
import { generateRequestId } from '../../../app/runtime/shared-utils';
import type { AuthStateValue, ApiConfigValue } from '../../../app/providers/AuthSessionProvider';
import type { GenerationArtifactsWorkspaceValue, GenerationProjectWorkspaceValue, GenerationStreamWorkspaceValue, GenerationGenerationWorkspaceValue } from '../../generation/runtime/GenerationWorkspaceProvider';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { getArtifactById } from '../../artifacts/runtime/artifacts-client';
import type { HydrationResult, ReadinessSnapshot, ToolPageViewModel } from '../machines/tool-page.machine';
import type { ToolPageEvent } from '../machines/tool-page.types';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import type { FrontendGenerationStatus } from '../../generation/machines/frontend-generation.machine';
import type { ToolFormConfig, ToolFormState } from './tool-form-architecture';
import { getAvailableSteps } from './tool-form-architecture';
import { createStepRequest } from './tool-generation-engine';
import { buildBaseGenerationRequest, buildBlogArticleGeneratorDirectInputExtractionInfo, buildGeometricDirectInputExtractionInfo, buildYoutubeDescriptionDirectInputExtractionInfo, mergeResolvedExtractionArtifact, needsResolvedExtractionArtifact, readRequestedStep, resolveToolPageRuntimeIntent, selectGenerationExtractionInfo, selectInterruptedStep, selectPrimaryTargetStep, selectStreamingStep, selectStreamTerminalResolution } from './tool-page-selectors';
import { orchestrateToolStep } from './tools-client';
import { mapInlineDispatchError } from './tool-page-runtime-utils';

type UseToolPageRunControllerArgs = {
  auth: AuthStateValue & ApiConfigValue;
  toolKey: SupportedTool;
  toolConfig: ToolFormConfig;
  formState: ToolFormState;
  intent: 'new' | 'resume' | 'regenerate';
  generationStream: GenerationStreamWorkspaceValue;
  generationRun: GenerationGenerationWorkspaceValue;
  generationArtifacts: GenerationArtifactsWorkspaceValue;
  sourceArtifact: GenerationArtifact | null;
  sourceArtifactId?: string | null;
  machineHydrationResult: HydrationResult | null;
  workspaceExtractionContext: GenerationProjectWorkspaceValue['extractionByProject'][string] | null;
  briefingSnapshot: { context: { extractionArtifactId: string | null; extractionPayload: Record<string, unknown> | null; briefingId: string | null; normalizedText: string | null }; matches: any };
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
  toolPageSend: (event: ToolPageEvent) => void;
  sessionId: string;
};

export const useToolPageRunController = ({ auth, toolKey, toolConfig, formState, intent, generationStream, generationRun, generationArtifacts, sourceArtifact, sourceArtifactId, machineHydrationResult, workspaceExtractionContext, briefingSnapshot, effectiveBriefingFileName, resolvedBriefingId, resolvedNotes, resolvedRelaunchSource, nextAvailableStep, sourceStep, machineViewModel, readinessSnapshot, completedStepsForFlow, pendingStepStart, toolPageSend, sessionId }: UseToolPageRunControllerArgs) => {
  const [isAutoChainEnabled, setIsAutoChainEnabled] = useState(false);
  const [pausedCheckpointStep, setPausedCheckpointStep] = useState<ToolStep | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const currentRunPrefixRef = useRef<string | null>(null);
  const lastRequestedStepRef = useRef<ToolStep | null>(null);
  const nonStreamingCompletedStepsRef = useRef(new Set<ToolStep>());
  const wasStreamActiveRef = useRef(false);
  const primaryActionPolicy = machineViewModel.primaryActionPolicy;

  const volatileArgsRef = useRef({
    auth, briefingSnapshot, effectiveBriefingFileName, formState, generationArtifacts, generationStream, generationRun,
    intent, machineHydrationResult, nextAvailableStep, primaryActionPolicy,
    primaryTargetStep: selectPrimaryTargetStep({ primaryActionPolicy, pausedCheckpointStep, sourceStep, nextAvailableStep }),
    readinessSnapshot, resolvedBriefingId, resolvedNotes, resolvedRelaunchSource,
    runtimeIntent: resolveToolPageRuntimeIntent({ primaryActionPolicy, intent, sourceArtifactId, sourceArtifact, machineHydrationResult }),
    sessionId, sourceArtifact, sourceArtifactId, sourceStep, workspaceExtractionContext,
  });
  volatileArgsRef.current = {
    auth, briefingSnapshot, effectiveBriefingFileName, formState, generationArtifacts, generationStream, generationRun,
    intent, machineHydrationResult, nextAvailableStep, primaryActionPolicy,
    primaryTargetStep: selectPrimaryTargetStep({ primaryActionPolicy, pausedCheckpointStep, sourceStep, nextAvailableStep }),
    readinessSnapshot, resolvedBriefingId, resolvedNotes, resolvedRelaunchSource,
    runtimeIntent: resolveToolPageRuntimeIntent({ primaryActionPolicy, intent, sourceArtifactId, sourceArtifact, machineHydrationResult }),
    sessionId, sourceArtifact, sourceArtifactId, sourceStep, workspaceExtractionContext,
  };
  const streamingStep = selectStreamingStep({ isStreamActive: generationStream.isStreamActive, lastRequest: generationStream.snapshot.context.lastRequest, toolSteps: toolConfig.steps });
  const currentRunningStep = streamingStep;
  const primaryTargetStep = volatileArgsRef.current.primaryTargetStep;
  const generationStatus: FrontendGenerationStatus = (() => {
    if (generationRun.snapshot.matches('idle')) return 'idle';
    if (generationRun.snapshot.matches('running')) return 'running';
    if (generationRun.snapshot.matches('completed')) return 'completed';
    return 'failed';
  })();
  const stopAutoChain = () => {
    setIsAutoChainEnabled(false);
  };

  useEffect(() => {
    if (pausedCheckpointStep && completedStepsForFlow.has(pausedCheckpointStep)) setPausedCheckpointStep(null);
  }, [completedStepsForFlow, pausedCheckpointStep]);

  const startGenerationStep = useCallback(async (step: ToolStep) => {
    const v = volatileArgsRef.current;
    const normalizedProjectId = v.formState.projectId.trim();
    if (!v.auth.session || !normalizedProjectId) return false;

    if (import.meta.env.DEV) {
      console.info('[useToolPage] generation start', {
        step, toolKey, routeIntent: v.intent, runtimeIntent: v.runtimeIntent, primaryActionPolicy: v.primaryActionPolicy, readiness: v.readinessSnapshot,
        sourceArtifactId: v.sourceArtifactId, resolvedBriefingId: v.resolvedBriefingId, hydrationResult: v.machineHydrationResult,
        nextAvailableStep: v.nextAvailableStep, sourceStep: v.sourceStep, primaryTargetStep: v.primaryTargetStep, hasSession: true, normalizedProjectId,
        briefingTextLength: (v.briefingSnapshot.context.normalizedText ?? '').length,
        extractionPayloadKeys: Object.keys(v.briefingSnapshot.context.extractionPayload ?? {}).length,
      });
    }

    const extractionInfo = selectGenerationExtractionInfo({
      machineHydrationResult: v.machineHydrationResult,
      workspaceExtractionContext: v.workspaceExtractionContext,
      briefingSnapshot: v.briefingSnapshot,
      toolKey,
      hasSourceArtifact: v.sourceArtifact !== null,
      directInputExtractionInfo: (() => {
        if (toolKey === 'youtube-description') {
          return buildYoutubeDescriptionDirectInputExtractionInfo({
            videoTitle: v.formState.videoTitle,
            topic: v.formState.topic,
            keywords: v.formState.keywords,
            ctaText: v.formState.ctaText,
            ctaLink: v.formState.ctaLink,
            credentialsOrProof: v.formState.credentialsOrProof,
            chaptersWithTimestamps: v.formState.chaptersWithTimestamps,
            socialLinks: v.formState.socialLinks,
            hashtags: v.formState.hashtags,
          });
        }
        if (toolKey === 'geometric') {
          return buildGeometricDirectInputExtractionInfo({
            baseQuery: (v.formState as unknown as Record<string, string>).baseQuery ?? '',
            language: (v.formState as unknown as Record<string, string>).language ?? '',
            country: (v.formState as unknown as Record<string, string>).country ?? '',
            brandName: (v.formState as unknown as Record<string, string>).brandName ?? '',
          });
        }
        if (toolKey === 'blog-article-generator') {
          return buildBlogArticleGeneratorDirectInputExtractionInfo({
            titolo: v.formState.titolo,
          });
        }
        return null;
      })(),
    });
    if (!extractionInfo) return false;

    let effectiveExtractionInfo = extractionInfo;
    if (needsResolvedExtractionArtifact(effectiveExtractionInfo)) {
      const extractionArtifact = await getArtifactById(effectiveExtractionInfo.extractionArtifactId, {
        apiBaseUrl: v.auth.apiBaseUrl,
        capabilities: v.auth.capabilities,
        localArtifacts: v.generationArtifacts.artifacts,
      }).catch(() => null);
      if (extractionArtifact) {
        effectiveExtractionInfo = mergeResolvedExtractionArtifact({ extractionInfo: effectiveExtractionInfo, extractionArtifact });
      }
    }

    const runPrefix = currentRunPrefixRef.current ?? generateRequestId();
    currentRunPrefixRef.current = runPrefix;
    lastRequestedStepRef.current = step;
    toolPageSend({ type: 'PROGRESS_SYNCED', artifacts: v.generationArtifacts.artifacts, intent: v.intent, sourceArtifact: v.sourceArtifact, runRequestPrefix: runPrefix });

    const baseRequest = buildBaseGenerationRequest({
      userId: v.auth.session.user.id,
      projectId: normalizedProjectId,
      sessionId: v.sessionId,
      toolKey,
      runtimeIntent: v.runtimeIntent,
      formState: v.formState,
      toolConfig,
      resolvedNotes: v.resolvedNotes,
      resolvedRelaunchSource: v.resolvedRelaunchSource,
      sourceArtifactId: v.sourceArtifactId,
      resolvedBriefingId: v.resolvedBriefingId,
      effectiveBriefingFileName: v.effectiveBriefingFileName,
      extractionInfo: effectiveExtractionInfo,
      runPrefix,
    });

    try {
      const orchestrationResult = await orchestrateToolStep(normalizedProjectId, toolKey, step, { apiBaseUrl: v.auth.apiBaseUrl, capabilities: v.auth.capabilities });
      const stepArtifactEntries = Object.entries(orchestrationResult.dependencyArtifactIdsByStep).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      );
      const artifactResolutionPromises = stepArtifactEntries.map(async ([stepKey, artifactId]) => {
        const local = v.generationArtifacts.artifacts.find(a => a.artifactId === artifactId);
        if (local && typeof local.content === 'string' && local.content.trim().length > 0) {
          return { stepKey, content: local.content };
        }
        const detail = await getArtifactById(artifactId, {
          apiBaseUrl: v.auth.apiBaseUrl,
          capabilities: v.auth.capabilities,
          localArtifacts: v.generationArtifacts.artifacts,
        });
        if (detail && typeof detail.content === 'string' && detail.content.trim().length > 0) {
          return { stepKey, content: detail.content };
        }
        return { stepKey, content: null };
      });
      const resolvedArtifacts = await Promise.allSettled(artifactResolutionPromises);
      const resolvedArtifactContentMap: Record<string, string> = {};
      for (const result of resolvedArtifacts) {
        if (result.status === 'fulfilled' && result.value.content !== null) {
          resolvedArtifactContentMap[result.value.stepKey] = result.value.content;
        }
      }
      if (import.meta.env.DEV && stepArtifactEntries.length > 0) {
        console.debug('[useToolPage] artifact content resolved', {
          step,
          resolvedSteps: Object.keys(resolvedArtifactContentMap),
        });
      }
      const request = createStepRequest(baseRequest, toolKey, step, orchestrationResult.dependencyArtifactIdsByStep, resolvedArtifactContentMap);
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
      v.generationRun.startRun(request);
      return true;
    } catch (err) {
      console.error('[useToolPage] orchestrateToolStep failed', { toolKey, step, err });
      return false;
    }
  }, [toolKey, toolConfig.steps, toolPageSend]);

  useEffect(() => {
    if (!pendingStepStart) return;
    currentRunPrefixRef.current = pendingStepStart.runRequestPrefix;
    toolPageSend({ type: 'STEP_REQUEST_DISPATCHED' });
    void startGenerationStep(pendingStepStart.step).then((success) => {
      if (!success) {
        setDispatchError(appCopy.ui.toolPage.runtimeErrors.dispatchFailed);
        toolPageSend({ type: 'CANCEL_GENERATION' });
      }
    });
  }, [pendingStepStart, startGenerationStep, toolPageSend]);

  useEffect(() => {
    if (generationStream.isStreamActive) {
      wasStreamActiveRef.current = true;
      return;
    }
    if (generationRun.isGenerationActive) {
      return;
    }
    if (!wasStreamActiveRef.current && generationStatus !== 'completed' && generationStatus !== 'failed') return;
    wasStreamActiveRef.current = false;

    if (generationStatus === 'completed') {
      const step = readRequestedStep(generationRun.snapshot.context.lastRequest, toolConfig.steps);
      const resolved = step ?? nextAvailableStep ?? lastRequestedStepRef.current;
      if (resolved && nonStreamingCompletedStepsRef.current.has(resolved)) return;
      if (import.meta.env.DEV) {
        console.info('[useToolPage] non-streaming completed', { step, nextAvailableStep, lastRequestedStep: lastRequestedStepRef.current, resolved });
      }
      if (resolved) {
        nonStreamingCompletedStepsRef.current = new Set(nonStreamingCompletedStepsRef.current).add(resolved);
        toolPageSend({ type: 'STEP_DONE', step: resolved });
        if (import.meta.env.DEV) {
          console.info('[useToolPage] dispatching NONSTREAMING_STEP_COMPLETED', { step: resolved });
        }
        toolPageSend({ type: 'NONSTREAMING_STEP_COMPLETED', step: resolved });
        if (import.meta.env.DEV) {
          console.info('[useToolPage] dispatched NONSTREAMING_STEP_COMPLETED', { step: resolved });
        }
      }
      generationArtifacts.reloadArtifacts();
      return;
    }
    if (generationStatus === 'failed') {
      const errorMessage = generationRun.snapshot.context.errorMessage ?? 'Generation failed';
      const resolvedStep = lastRequestedStepRef.current ?? nextAvailableStep;
      if (resolvedStep) {
        toolPageSend({ type: 'STEP_FAILED', step: resolvedStep, message: errorMessage });
      }
      const mappedError = mapInlineDispatchError(errorMessage) ?? appCopy.ui.toolPage.runtimeErrors.dispatchFailed;
      setDispatchError(mappedError);
      stopAutoChain();
      toolPageSend({ type: 'CANCEL_GENERATION' });
      return;
    }

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
    generationStream.terminalCompletedStep, generationStream.terminalFailedStep,
    generationRun.isGenerationActive, generationRun.snapshot.context.errorMessage,
    generationRun.snapshot.context.lastRequest, generationStatus, toolConfig.steps, toolPageSend,
    nextAvailableStep,
  ]);

  useEffect(() => {
    if (!isAutoChainEnabled) return;
    if (generationStream.streamStatus === 'failed' || generationStatus === 'failed') {
      const interruptedStep = selectInterruptedStep(currentRunningStep, lastRequestedStepRef.current);
      if (interruptedStep) setPausedCheckpointStep(interruptedStep);
      stopAutoChain();
      return;
    }
    if (generationStream.isStreamActive || generationRun.isGenerationActive) return;
    if (pendingStepStart) return; // Prevent duplicate dispatch when request is already in flight

    const locallyCompleted = new Set([...completedStepsForFlow, ...nonStreamingCompletedStepsRef.current]);
    const effectiveNextStep = getAvailableSteps(toolKey, locallyCompleted)[0] ?? null;
    if (!effectiveNextStep) {
      stopAutoChain();
      return;
    }

    const lastRequestedStep = lastRequestedStepRef.current;
    if (import.meta.env.DEV) {
      console.info('[useToolPage] auto-chain check', { lastRequestedStep, nextAvailableStep, effectiveNextStep, locallyCompleted: Array.from(locallyCompleted), completedStepsForFlow: Array.from(completedStepsForFlow), isAutoChainEnabled });
    }
    if (lastRequestedStep && locallyCompleted.has(lastRequestedStep) && lastRequestedStep !== effectiveNextStep) {
      if (import.meta.env.DEV) {
        console.info('[useToolPage] auto-chain starting next step', { effectiveNextStep });
      }
      void startGenerationStep(effectiveNextStep);
    }
  }, [
    completedStepsForFlow, currentRunningStep, generationStream.isStreamActive,
    generationStream.streamStatus, generationRun.isGenerationActive, generationStatus,
    isAutoChainEnabled, nextAvailableStep, startGenerationStep, toolKey, toolConfig.steps,
    pendingStepStart,
  ]);

  const handlePrimaryAction = useCallback(() => {
    if (primaryActionPolicy === 'open-last-artifact' || !readinessSnapshot.canStartFlow || generationStream.isStreamActive || generationRun.isGenerationActive || !primaryTargetStep) return;
    const runPrefix = generateRequestId();
    currentRunPrefixRef.current = runPrefix;
    nonStreamingCompletedStepsRef.current = new Set();
    setDispatchError(null);
    setPausedCheckpointStep(null);
    setIsAutoChainEnabled(true);
    toolPageSend({ type: 'REQUEST_STEP_START', step: primaryTargetStep, runRequestPrefix: runPrefix });
  }, [generationStream.isStreamActive, generationRun.isGenerationActive, primaryActionPolicy, primaryTargetStep, readinessSnapshot.canStartFlow, toolPageSend]);

  const handleCancelGeneration = useCallback(() => {
    setIsAutoChainEnabled(false);
    nonStreamingCompletedStepsRef.current = new Set();
    const interruptedStep = selectInterruptedStep(currentRunningStep, lastRequestedStepRef.current);
    if (interruptedStep) setPausedCheckpointStep(interruptedStep);
    currentRunPrefixRef.current = null;
    toolPageSend({ type: 'PROGRESS_SYNCED', artifacts: generationArtifacts.artifacts, intent, sourceArtifact, runRequestPrefix: null });
    toolPageSend({ type: 'CANCEL_GENERATION' });
    generationStream.cancel();
    generationRun.resetRun();
  }, [currentRunningStep, generationArtifacts.artifacts, generationStream, generationRun, intent, sourceArtifact, toolPageSend]);

  const getCurrentRunRequestPrefix = useCallback(() => currentRunPrefixRef.current, []);

  return { currentRunningStep, dispatchError, getCurrentRunRequestPrefix, primaryTargetStep, pausedCheckpointStep, streamingStep, handlePrimaryAction, handleCancelGeneration };
};