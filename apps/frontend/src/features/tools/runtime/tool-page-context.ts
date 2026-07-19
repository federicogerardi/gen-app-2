import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useMachine, useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import { appCopy } from '../../../app/copy/system';
import { generateSessionId, readInputField } from '../../../app/runtime/shared-utils';
import type { AuthStateValue, ApiConfigValue } from '../../../app/providers/AuthSessionProvider';
import type {
  GenerationArtifactsWorkspaceValue,
  GenerationProjectWorkspaceValue,
} from '../../generation/runtime/GenerationWorkspaceProvider';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { getArtifactById } from '../../artifacts/runtime/artifacts-client';
import { briefingUploadMachine } from '../machines/briefing-upload.machine';
import { isExtractionContextValidForTool } from '../machines/extraction-context-validity';
import { toolPageMachine } from '../machines/tool-page.machine';
import type { SupportedTool } from '../machines/tool-flow.machine';
import { getRequiredToolInputFiles, type ToolFormConfig, type ToolFormState } from './tool-form-architecture';
import { mapInlineDispatchError } from './tool-page-runtime-utils';

type UseToolPageContextArgs = {
  auth: AuthStateValue & ApiConfigValue;
  toolKey: SupportedTool;
  toolConfig: ToolFormConfig;
  formState: ToolFormState;
  setFormState: Dispatch<SetStateAction<ToolFormState>>;
  generationArtifacts: GenerationArtifactsWorkspaceValue;
  generationProject: GenerationProjectWorkspaceValue;
  sourceArtifactId: string | null | undefined;
  intent: 'new' | 'regenerate' | 'resume';
  initialProjectId: string | null | undefined;
  briefingId: string | null | undefined;
  extractionArtifactId: string | null | undefined;
  briefingFileName: string | null | undefined;
};

export const useToolPageContext = ({
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
  briefingId,
  extractionArtifactId,
  briefingFileName,
}: UseToolPageContextArgs) => {
  const [toolPageSnapshot, toolPageSend] = useMachine(toolPageMachine, {
    input: {
      toolKey,
      sessionId: generateSessionId(),
      projectId: generationProject.focusedProjectId ?? initialProjectId ?? '',
      model: toolConfig.defaultModel,
      campaignObjective: formState.campaignObjective,
      registrySnapshotRef: toolConfig.defaults.registrySnapshotRef,
      apiBaseUrl: auth.apiBaseUrl,
      capabilities: auth.capabilities,
      userId: auth.session?.user.id ?? null,
    },
  });
  const [sourceArtifact, setSourceArtifact] = useState<GenerationArtifact | null>(null);
  const initialPrefillDoneRef = useRef(false);
  const previousProjectIdRef = useRef((generationProject.focusedProjectId ?? initialProjectId ?? '').trim());
  const previousCampaignObjectiveRef = useRef(formState.campaignObjective.trim());
  const sessionIdRef = useRef(toolPageSnapshot.context.sessionId);
  const briefingSnapshot = useSelector(
    toolPageSnapshot.context.briefingActorRef as ActorRefFrom<typeof briefingUploadMachine>,
    (state) => state,
  );
  const briefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready' = briefingSnapshot.matches('uploading')
    ? 'uploading'
    : briefingSnapshot.matches('extracting')
      ? 'extracting'
      : briefingSnapshot.matches('ready') ? 'ready' : 'idle';
  const briefingUploadMessage = briefingSnapshot.matches({ idle: 'failed' })
    ? appCopy.ui.toolPage.runtimeErrors.briefingContextInsufficient
    : null;
  const requiredInputFiles = getRequiredToolInputFiles(toolKey);
  const hasRequiredAngleDetector = requiredInputFiles.some((entry) => entry.key === 'angle-detector-file');
  const briefingGuidance = hasRequiredAngleDetector
    && !!briefingSnapshot.context.file
    && !briefingSnapshot.context.angleDetectorFile
    && briefingSnapshot.matches({ idle: 'failed' })
    ? appCopy.ui.toolPage.guidance.angleDetectorRequired
    : null;
  const briefingError = briefingGuidance ? null : mapInlineDispatchError(briefingUploadMessage);
  const normalizedProjectId = formState.projectId.trim();
  const workspaceExtractionContext = normalizedProjectId
    ? generationProject.getExtractionContext(normalizedProjectId)
    : null;

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
    if (!briefingSnapshot.matches('ready') || !normalizedProjectId) return;
    const nextBriefingId = briefingSnapshot.context.briefingId?.trim() ?? '';
    const nextExtractionArtifactId = briefingSnapshot.context.extractionArtifactId?.trim() ?? '';
    const nextNormalizedText = briefingSnapshot.context.normalizedText?.trim() ?? '';
    const nextExtractionPayload = briefingSnapshot.context.extractionPayload ?? {};
    const nextParsedFormat = briefingSnapshot.context.parsedFormat;
    if (!nextBriefingId || !nextExtractionArtifactId || !nextNormalizedText || nextParsedFormat === null) return;
    if (!isExtractionContextValidForTool(toolKey, nextExtractionPayload, nextNormalizedText)) return;

    const isWorkspaceContextCurrent = workspaceExtractionContext !== null
      && workspaceExtractionContext.projectId === normalizedProjectId
      && workspaceExtractionContext.briefingId === nextBriefingId
      && workspaceExtractionContext.extractionArtifactId === nextExtractionArtifactId
      && workspaceExtractionContext.normalizedText === nextNormalizedText
      && workspaceExtractionContext.parsedFormat === nextParsedFormat
      && JSON.stringify(workspaceExtractionContext.extractionPayload) === JSON.stringify(nextExtractionPayload);

    if (!isWorkspaceContextCurrent) {
      generationProject.upsertExtractionContext({
        projectId: normalizedProjectId,
        briefingId: nextBriefingId,
        extractionArtifactId: nextExtractionArtifactId,
        extractionPayload: nextExtractionPayload,
        normalizedText: nextNormalizedText,
        parsedFormat: nextParsedFormat,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [briefingSnapshot, generationProject, normalizedProjectId, toolKey, workspaceExtractionContext]);

  useEffect(() => {
    const normalizedSourceArtifactId = sourceArtifactId?.trim() ?? '';
    if (!normalizedSourceArtifactId) {
      setSourceArtifact(null);
      return;
    }
    const localSource = generationArtifacts.artifacts.find((artifact) => artifact.artifactId === normalizedSourceArtifactId) ?? null;
    if (localSource) {
      setSourceArtifact(localSource);
      return;
    }
    let cancelled = false;
    void getArtifactById(normalizedSourceArtifactId, {
      apiBaseUrl: auth.apiBaseUrl,
      capabilities: auth.capabilities,
      localArtifacts: generationArtifacts.artifacts,
    }).then((detail) => {
      if (!cancelled) setSourceArtifact(detail);
    }).catch(() => {
      if (!cancelled) setSourceArtifact(null);
    });
    return () => {
      cancelled = true;
    };
  }, [auth.apiBaseUrl, auth.capabilities, generationArtifacts.artifacts, sourceArtifactId]);

  useEffect(() => {
    if (!sourceArtifact || !normalizedProjectId) return;
    const resolvedHydrationBriefingId = (briefingId?.trim() ?? '') || readInputField(sourceArtifact, 'briefingId');
    const resolvedSourceExtractionArtifactId = readInputField(sourceArtifact, 'extractionArtifactId') ?? extractionArtifactId ?? null;
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
  }, [briefingId, extractionArtifactId, generationArtifacts.artifacts, intent, normalizedProjectId, sourceArtifact, toolPageSend]);

  useEffect(() => {
    if (previousProjectIdRef.current === normalizedProjectId) return;
    toolPageSend({ type: 'PROJECT_SELECTED', projectId: normalizedProjectId });
    previousProjectIdRef.current = normalizedProjectId;
  }, [normalizedProjectId, toolPageSend]);

  useEffect(() => {
    const normalizedCampaignObjective = formState.campaignObjective.trim();
    if (previousCampaignObjectiveRef.current === normalizedCampaignObjective) return;
    toolPageSend({ type: 'CAMPAIGN_OBJECTIVE_CHANGED', campaignObjective: normalizedCampaignObjective });
    previousCampaignObjectiveRef.current = normalizedCampaignObjective;
  }, [formState.campaignObjective, toolPageSend]);

  const machineHydrationResult = toolPageSnapshot.context.hydrationResult;
  const effectiveBriefingFileName = briefingSnapshot.context.fileName ?? briefingFileName ?? readInputField(sourceArtifact, 'briefingFileName');
  const effectiveBriefingStatus = (briefingStatus === 'ready' || machineHydrationResult !== null ? 'ready' : briefingStatus) as 'idle' | 'uploading' | 'extracting' | 'ready';
  const resolvedBriefingId = briefingId ?? readInputField(sourceArtifact, 'briefingId') ?? null;

  return {
    sessionId: sessionIdRef.current,
    toolPageSnapshot,
    toolPageSend,
    sourceArtifact,
    briefingSnapshot,
    briefingStatus,
    briefingError,
    briefingGuidance,
    normalizedProjectId,
    workspaceExtractionContext,
    machineHydrationResult,
    effectiveBriefingFileName,
    effectiveBriefingStatus,
    resolvedBriefingId,
  };
};