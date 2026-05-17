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
import {
  generateRequestId,
  generateSessionId,
  readInputField,
} from '../../../app/runtime/shared-utils';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import {
  useGenerationArtifactsWorkspace,
  useGenerationProjectWorkspace,
  useGenerationStreamWorkspace,
} from '../../generation/runtime/GenerationWorkspaceProvider';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import { briefingUploadMachine } from '../machines/briefing-upload.machine';
import { isExtractionContextValidForTool } from '../machines/extraction-context-validity';
import { toolPageMachine } from '../machines/tool-page.machine';
import { getToolFormConfig } from '../runtime/tool-form-architecture';
import { useToolFormInit, useAvailableSteps } from '../runtime/useToolForm';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { extractArtifactStep } from '../../generation/runtime/step-hydration';
import { getArtifactById } from '../../artifacts/runtime/artifacts-client';
import { mapInlineDispatchError, normalizeToneProfile } from './tool-page-runtime-utils';
import { useToolPageRunController } from './useToolPageRunController';

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
  const generationStream = useGenerationStreamWorkspace();
  const generationArtifacts = useGenerationArtifactsWorkspace();
  const generationProject = useGenerationProjectWorkspace();
  const navigate = useNavigate();
  const toolConfig = getToolFormConfig(toolKey);

  const [sourceArtifact, setSourceArtifact] = useState<GenerationArtifact | null>(null);

  const initialPrefillDoneRef = useRef(false);
  const sessionIdRef = useRef<string>(generateSessionId());
  const previousProjectIdRef = useRef<string>(
    (generationProject.focusedProjectId ?? initialProjectId ?? '').trim(),
  );
  const tonePrefillDoneRef = useRef(false);

  const [toolPageSnapshot, toolPageSend] = useMachine(toolPageMachine, {
      input: {
        toolKey,
        sessionId: sessionIdRef.current,
        projectId: generationProject.focusedProjectId ?? initialProjectId ?? '',
        model: toolConfig.defaultModel,
        registrySnapshotRef: toolConfig.defaults.registrySnapshotRef,
        apiBaseUrl: auth.apiBaseUrl,
      capabilities: auth.capabilities,
      userId: auth.session?.user.id ?? null,
    },
  });

  const { formState, setFormState } = useToolFormInit(
    toolKey,
    generationProject.focusedProjectId ?? initialProjectId ?? undefined,
  );

  const { data: projects, loading: projectsLoading } = useProjectsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    enabled: auth.session !== null && auth.capabilities.projects,
  });

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
    ? generationProject.getExtractionContext(normalizedProjectId)
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
    generationProject.setFocusedProjectId(nextProjectId);
    initialPrefillDoneRef.current = true;
  }, [generationProject, initialProjectId, setFormState]);

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

    generationProject.upsertExtractionContext({
      projectId: normalizedProjectId,
      briefingId: briefingIdFromActor,
      extractionArtifactId: extractionArtifactIdFromActor,
      extractionPayload: extractionPayloadFromActor,
      normalizedText: normalizedTextFromActor,
      parsedFormat: parsedFormatFromActor,
      updatedAt: new Date().toISOString(),
    });
  }, [briefingSnapshot, generationProject, normalizedProjectId, workspaceExtractionContext]);

  // 2. Resolve source artifact for relaunch intent
  useEffect(() => {
    const normalizedSourceArtifactId = sourceArtifactId?.trim() ?? '';
    if (!normalizedSourceArtifactId) {
      setSourceArtifact(null);
      return;
    }
    const localSource =
      generationArtifacts.artifacts.find((a) => a.artifactId === normalizedSourceArtifactId) ?? null;
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
          localArtifacts: generationArtifacts.artifacts,
        });
        if (!cancelled) setSourceArtifact(detail);
      } catch {
        if (!cancelled) setSourceArtifact(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [generationArtifacts.artifacts, auth.apiBaseUrl, auth.capabilities, sourceArtifactId]);

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
      localArtifacts: generationArtifacts.artifacts,
    });
  }, [
    generationArtifacts.artifacts,
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

  // 5. Sync progress to machine
  useEffect(() => {
    toolPageSend({
      type: 'PROGRESS_SYNCED',
      artifacts: generationArtifacts.artifacts,
      intent,
      sourceArtifact,
      runRequestPrefix: null,
    });
  }, [generationArtifacts.artifacts, intent, sourceArtifact, toolPageSend]);

  const currentProject = projects.find((p) => p.id === formState.projectId);
  const runController = useToolPageRunController({
    auth,
    toolKey,
    toolConfig,
    formState,
    intent,
    generationStream,
    generationArtifacts,
    sourceArtifact,
    sourceArtifactId: sourceArtifactId ?? null,
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
    pendingStepStart: toolPageSnapshot.context.pendingStepStart,
    toolPageSend,
    sessionId: sessionIdRef.current,
  });

  const effectiveCanonicalState = (
    isGenerating || generationStream.isStreamActive ? 'running' : machineViewModel.canonicalState
  );
  const primaryTargetStep = runController.primaryTargetStep;

  const handlePrimaryAction = useCallback((): void => {
    if (machineViewModel.primaryActionPolicy === 'open-last-artifact') {
      void navigate(`/sessionsummary/${sessionIdRef.current}`);
      return;
    }

    runController.handlePrimaryAction();
  }, [machineViewModel.primaryActionPolicy, navigate, runController]);

  const handleCancelGeneration = runController.handleCancelGeneration;
  const currentRunningStep = runController.currentRunningStep;
  const streamingStep = runController.streamingStep;
  const dispatchError = runController.dispatchError;

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
    isStreamActive: generationStream.isStreamActive,
    // Handlers
    handlePrimaryAction,
    handleCancelGeneration,
    handleBriefingFileSelected,
    handleBriefingReset,
    // Navigation
    navigate,
  };
};
