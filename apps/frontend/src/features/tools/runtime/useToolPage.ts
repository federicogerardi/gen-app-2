import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { readInputField } from '../../../app/runtime/shared-utils';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { useGenerationArtifactsWorkspace, useGenerationProjectWorkspace, useGenerationStreamWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { extractArtifactStep } from '../../generation/runtime/step-hydration';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import { getToolFormConfig } from '../runtime/tool-form-architecture';
import { useToolFormInit, useAvailableSteps } from '../runtime/useToolForm';
import { useToolPageContext } from './tool-page-context';
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

export const useToolPage = ({ toolKey, sourceArtifactId, intent = 'new', initialProjectId, relaunchTone, relaunchNotes, relaunchFromArtifactId, briefingId, extractionArtifactId, briefingFileName }: UseToolPageProps) => {
  const auth = useAuthSession();
  const generationStream = useGenerationStreamWorkspace();
  const generationArtifacts = useGenerationArtifactsWorkspace();
  const generationProject = useGenerationProjectWorkspace();
  const navigate = useNavigate();
  const toolConfig = getToolFormConfig(toolKey);
  const { formState, setFormState } = useToolFormInit(toolKey, generationProject.focusedProjectId ?? initialProjectId ?? undefined);
  const { data: projects, loading: projectsLoading } = useProjectsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    enabled: auth.session !== null && auth.capabilities.projects,
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

  const progressState = toolPageSnapshot.context.progress;
  const readinessSnapshot = toolPageSnapshot.context.readiness;
  const machineViewModel = toolPageSnapshot.context.viewModel;
  const isGenerating = toolPageSnapshot.matches('generating');
  const completedStepsForFlow = progressState.completedSteps;
  const latestArtifactByStep = progressState.latestArtifactByStep;
  const completedArtifactsByStep = useMemo(() => Object.entries(latestArtifactByStep).reduce<Partial<Record<ToolStep, string>>>((acc, [step, artifact]) => {
    if (artifact?.artifactId) acc[step as ToolStep] = artifact.artifactId;
    return acc;
  }, {}), [latestArtifactByStep]);
  const nextAvailableStep = useAvailableSteps(toolKey, completedStepsForFlow)[0] ?? null;
  const sourceStep = useMemo(() => {
    const candidate = extractArtifactStep(sourceArtifact);
    return candidate && toolConfig.steps.includes(candidate) ? candidate : null;
  }, [sourceArtifact, toolConfig.steps]);
  const currentProject = projects.find((project) => project.id === formState.projectId);
  const resolvedNotes = relaunchNotes ?? readInputField(sourceArtifact as GenerationArtifact | null, 'notes') ?? '';
  const resolvedRelaunchSource = relaunchFromArtifactId ?? sourceArtifactId ?? sourceArtifact?.artifactId ?? null;

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
    sessionId,
  });
  const getCurrentRunRequestPrefix = runController.getCurrentRunRequestPrefix;
  const handleRunControllerPrimaryAction = runController.handlePrimaryAction;
  const handleCancelGeneration = runController.handleCancelGeneration;
  const currentRunningStep = runController.currentRunningStep;
  const streamingStep = runController.streamingStep;
  const dispatchError = runController.dispatchError;
  const artifactsReloadError = generationArtifacts.artifactsReloadError;

  useEffect(() => {
    toolPageSend({ type: 'PROGRESS_SYNCED', artifacts: generationArtifacts.artifacts, intent, sourceArtifact, runRequestPrefix: getCurrentRunRequestPrefix() });
  }, [briefingStatus, generationArtifacts.artifacts, getCurrentRunRequestPrefix, intent, sourceArtifact, toolPageSend]);

  const effectiveCanonicalState = isGenerating || generationStream.isStreamActive ? 'running' : machineViewModel.canonicalState;
  const handlePrimaryAction = useCallback(() => {
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
    source: 'angle-detector',
  }), [toolPageSend]);
  const handleBriefingReset = useCallback(() => toolPageSend({ type: 'BRIEFING_RESET' }), [toolPageSend]);

  return {
    toolConfig,
    formState,
    setFormState,
    projects,
    projectsLoading,
    briefingError,
    briefingGuidance,
    dispatchError,
    artifactsReloadError,
    effectiveBriefingStatus,
    effectiveBriefingFileName,
    angleDetectorFileName: briefingSnapshot.context.angleDetectorFileName,
    machineViewModel,
    isGenerating,
    readinessSnapshot,
    completedStepsForFlow,
    latestArtifactByStep,
    completedArtifactsByStep,
    currentRunningStep,
    streamingStep,
    nextAvailableStep,
    effectiveCanonicalState,
    currentProject,
    isStreamActive: generationStream.isStreamActive,
    handlePrimaryAction,
    handleCancelGeneration,
    handleBriefingFileSelected,
    handleAngleDetectorFileSelected,
    handleBriefingReset,
    navigate,
  };
};