import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthState, useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { readInputField } from '../../../app/runtime/shared-utils';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { useGenerationArtifactsWorkspace, useGenerationGenerationWorkspace, useGenerationProjectWorkspace, useGenerationStreamWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import { getToolFormConfig } from '../runtime/tool-form-architecture';
import { useToolFormInit, useAvailableSteps } from '../runtime/useToolForm';
import { buildReactiveViewModel } from '../machines/tool-page-view-model';
import { useToolPageContext } from './tool-page-context';
import { useToolPageRunController } from './useToolPageRunController';
import { useBackendStreamEventConsumer } from './useBackendStreamEventConsumer';
import { useAuthSessionStateConsumer } from './useAuthSessionStateConsumer';
// DDD-158: UI state downstream consumer (BCM Line 25) — Sprint 4 Session 2 Phase 1 Step 5.
import { useToolPageStateConsumer } from './useToolPageStateConsumer';

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

export const useToolPage = ({ toolKey, sourceArtifactId, intent = 'new', initialProjectId, relaunchTone, relaunchNotes, relaunchFromArtifactId, briefingId, extractionArtifactId, briefingFileName }: UseToolPageProps) => {
  const autoStartGenerationAfterExtractionRef = useRef(false);
  const navigate = useNavigate();
  const authState = useAuthState();
  const apiConfig = useApiConfig();
  const auth = { ...authState, ...apiConfig };
  const generationStream = useGenerationStreamWorkspace();
  const generationRun = useGenerationGenerationWorkspace();
  const generationArtifacts = useGenerationArtifactsWorkspace();
  const generationProject = useGenerationProjectWorkspace();
  const toolConfig = getToolFormConfig(toolKey);
  const { formState, setFormState } = useToolFormInit(toolKey, generationProject.focusedProjectId ?? initialProjectId ?? undefined);

  // DDD-160: Auth session downstream consumer (BCM Line 25)
  const authSession = useAuthSessionStateConsumer();

  // DDD-159: Backend stream event downstream consumer (BCM Line 25)
  const streamEvents = useBackendStreamEventConsumer({
    generationStream,
    generationArtifacts,
  });

  const {
    sessionId,
    toolPageSnapshot,
    toolPageSend,
    sourceArtifact,
    briefingSnapshot,
    briefingStatus,
    briefingError,
    briefingGuidance,
    workspaceExtractionContext,
    machineHydrationResult,
    effectiveBriefingFileName,
    effectiveBriefingStatus,
    resolvedBriefingId,
  } = useToolPageContext({
    auth,
    toolKey,
    toolConfig,
    formState,
    setFormState,
    generationArtifacts,
    generationProject,
    sourceArtifactId,
    intent,
    initialProjectId,
    relaunchTone,
    briefingId,
    extractionArtifactId,
    briefingFileName,
  });

  // DDD-158: UI state derived from machine snapshot (BCM Line 25)
  const { data: projects, loading: projectsLoading } = useProjectsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    enabled: authSession.session !== null && (authSession.capabilities.projects ?? false),
  });

  const progressState = toolPageSnapshot.context.progress;
  const readinessSnapshot = toolPageSnapshot.context.readiness;
  const configuringSubstate = typeof toolPageSnapshot.value === 'object' && toolPageSnapshot.value !== null && 'configuring' in toolPageSnapshot.value
    ? (toolPageSnapshot.value as { configuring: string }).configuring as 'clean' | 'hydrationFailed' | 'generationFailed'
    : 'clean' as const;
  const machineViewModel = buildReactiveViewModel(toolPageSnapshot.context, configuringSubstate);
  const isGenerating = toolPageSnapshot.matches('generating');
  const completedStepsForFlow = progressState.completedSteps;
  const latestArtifactByStep = progressState.latestArtifactByStep;

  const completedArtifactsByStep = useMemo(() => Object.entries(latestArtifactByStep).reduce<Partial<Record<ToolStep, string>>>((acc, [step, artifact]) => {
    if (artifact?.artifactId) acc[step as ToolStep] = artifact.artifactId;
    return acc;
  }, {}), [latestArtifactByStep]);

  const nextAvailableStep = useAvailableSteps(toolKey, completedStepsForFlow)[0] ?? null;
  const currentProject = projects.find((project) => project.id === formState.projectId);

  const isExtractionInProgress = effectiveBriefingStatus === 'uploading' || effectiveBriefingStatus === 'extracting';
  const effectiveCanonicalState = isExtractionInProgress
    ? 'processing-briefing'
    : isGenerating || streamEvents.isStreamActive
      ? 'running'
      : machineViewModel.canonicalState;

  const resolvedNotes = relaunchNotes ?? readInputField(sourceArtifact as GenerationArtifact | null, 'notes') ?? '';
  const resolvedRelaunchSource = relaunchFromArtifactId ?? sourceArtifactId ?? sourceArtifact?.artifactId ?? null;

  const runController = useToolPageRunController({
    auth,
    toolKey,
    toolConfig,
    formState,
    intent,
    generationStream,
    generationRun,
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
    sourceStep: null,
    machineViewModel,
    readinessSnapshot,
    completedStepsForFlow,
    pendingStepStart: toolPageSnapshot.context.pendingStepStart,
    toolPageSend,
    sessionId,
  });
  const getCurrentRunRequestPrefix = runController.getCurrentRunRequestPrefix;
  const handleRunControllerPrimaryAction = runController.handlePrimaryAction;
  const handleCancelGeneration = runController.handleCancelGeneration;
  const currentRunningStep = runController.currentRunningStep;
  const streamingStep = runController.streamingStep;
  const pausedCheckpointStep = runController.pausedCheckpointStep;
  const dispatchError = runController.dispatchError;

  useEffect(() => {
    toolPageSend({ type: 'PROGRESS_SYNCED', artifacts: generationArtifacts.artifacts, intent, sourceArtifact, runRequestPrefix: getCurrentRunRequestPrefix() });
  }, [briefingStatus, formState.projectId, generationArtifacts.artifacts, getCurrentRunRequestPrefix, intent, sourceArtifact, toolPageSend]);

  const handlePrimaryAction = useCallback(() => {
    autoStartGenerationAfterExtractionRef.current = false;
    if (machineViewModel.primaryActionPolicy === 'open-last-artifact') {
      void navigate(`/sessionsummary/${sessionId}`);
      return;
    }
    handleRunControllerPrimaryAction();
  }, [handleRunControllerPrimaryAction, machineViewModel.primaryActionPolicy, navigate, sessionId]);
  const handleBriefingFileSelected = useCallback((file: File) => toolPageSend({ type: 'BRIEFING_FILE_SELECTED', file }), [toolPageSend]);
  const handleAngleDetectorFileSelected = useCallback((file: File) => toolPageSend({
    type: 'BRIEFING_FILE_SELECTED',
    file,
    sourceKey: 'angle-detector-file',
  }), [toolPageSend]);
  const handleExtractionStart = useCallback((options?: { autoStartGeneration?: boolean }) => {
    autoStartGenerationAfterExtractionRef.current = options?.autoStartGeneration === true;
    toolPageSend({ type: 'BRIEFING_EXTRACTION_REQUESTED' });
  }, [toolPageSend]);
  const handleBriefingReset = useCallback(() => {
    autoStartGenerationAfterExtractionRef.current = false;
    toolPageSend({ type: 'BRIEFING_RESET' });
  }, [toolPageSend]);

  useEffect(() => {
    if (!autoStartGenerationAfterExtractionRef.current) {
      return;
    }

    if (effectiveBriefingStatus === 'ready') {
      if (!readinessSnapshot.canStartFlow || machineViewModel.primaryActionPolicy === 'disabled') {
        return;
      }

      autoStartGenerationAfterExtractionRef.current = false;
      handleRunControllerPrimaryAction();
      return;
    }

    if (effectiveBriefingStatus !== 'uploading' && effectiveBriefingStatus !== 'extracting') {
      autoStartGenerationAfterExtractionRef.current = false;
    }
  }, [effectiveBriefingStatus, handleRunControllerPrimaryAction, machineViewModel.primaryActionPolicy, readinessSnapshot.canStartFlow]);

  // DDD-158: ToolPageStateConsumer — UI-only state via downstream consumer pattern.
  // The consumer returns a memoized { pageState, formState, navigationState } view
  // (pure UI concerns, no domain/execution logic). The runController + streamEvents
  // + local handlers remain external and are composed back into the flat return
  // object below so the public API of useToolPage is identical (no breaking
  // change for callers / tests). Sprint 4 Session 2 Phase 1 Step 5.
  const toolPageState = useToolPageStateConsumer({
    toolConfig,
    formState,
    setFormState,
    projects,
    projectsLoading,
    briefingError,
    briefingGuidance,
    effectiveBriefingStatus,
    effectiveBriefingFileName,
    angleDetectorFileName: briefingSnapshot.context.angleDetectorFileName,
    machineViewModel,
    isGenerating,
    readinessSnapshot,
    completedStepsForFlow,
    latestArtifactByStep,
    completedArtifactsByStep,
    nextAvailableStep,
    currentRunningStep,
    streamingStep,
    pausedCheckpointStep,
    effectiveCanonicalState,
    currentProject,
    navigate,
    sessionId,
  });

  return {
    // pageState (DDD-158)
    toolConfig: toolPageState.formState.toolConfig,
    machineViewModel: toolPageState.pageState.machineViewModel,
    isGenerating: toolPageState.pageState.isGenerating,
    readinessSnapshot: toolPageState.pageState.readinessSnapshot,
    completedStepsForFlow: toolPageState.pageState.completedStepsForFlow,
    latestArtifactByStep: toolPageState.pageState.latestArtifactByStep,
    completedArtifactsByStep: toolPageState.pageState.completedArtifactsByStep,
    currentRunningStep: toolPageState.pageState.currentRunningStep,
    streamingStep: toolPageState.pageState.streamingStep,
    pausedCheckpointStep: toolPageState.pageState.pausedCheckpointStep,
    nextAvailableStep: toolPageState.pageState.nextAvailableStep,
    effectiveCanonicalState: toolPageState.pageState.effectiveCanonicalState,
    sessionId: toolPageState.pageState.sessionId,
    // formState (DDD-158)
    formState: toolPageState.formState.formState,
    setFormState: toolPageState.formState.setFormState,
    projects: toolPageState.formState.projects,
    projectsLoading: toolPageState.formState.projectsLoading,
    briefingError: toolPageState.formState.briefingError,
    briefingGuidance: toolPageState.formState.briefingGuidance,
    effectiveBriefingStatus: toolPageState.formState.effectiveBriefingStatus,
    effectiveBriefingFileName: toolPageState.formState.effectiveBriefingFileName,
    angleDetectorFileName: toolPageState.formState.angleDetectorFileName,
    currentProject: toolPageState.formState.currentProject,
    // navigationState (DDD-158)
    navigate: toolPageState.navigationState.navigate,
    // Non-consumer fields: runController execution state + streamEvents + local handlers.
    dispatchError,
    artifactsReloadError: streamEvents.artifactsReloadError,
    isStreamActive: streamEvents.isStreamActive,
    handlePrimaryAction,
    handleCancelGeneration,
    handleBriefingFileSelected,
    handleAngleDetectorFileSelected,
    handleExtractionStart,
    handleBriefingReset,
  };
};
