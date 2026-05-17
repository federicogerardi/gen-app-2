import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GenerationForm } from '../ui/GenerationForm';
import { GenerationStreamPanel } from '../ui/GenerationStreamPanel';
import { ArtifactHistoryPanel } from '../ui/ArtifactHistoryPanel';
import {
  type ExtractionLifecycle,
  type ToolIntent,
  type ToolPhase,
} from '../ui/tool-ux-state';
import { useGenerationWorkspace } from '../runtime/GenerationWorkspaceProvider';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { uiPrimitives } from '../../../app/ui/primitives';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import {
  buildToolEntryPathFromArtifact,
  type GenerationArtifact,
} from '../ui/artifact-history';

export const GenerationConsolePage = () => {
  const navigate = useNavigate();
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const projectsQuery = useProjectsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    enabled: !!auth.session && auth.capabilities.projects,
  });

  const [, setToolSetupState] = useState<{
    phase: ToolPhase;
    intent: ToolIntent;
    extractionLifecycle: ExtractionLifecycle;
    hasProject: boolean;
    hasBriefing: boolean;
    hasCheckpoint: boolean;
    checkpointHasExtractionContext: boolean;
    hasSourceArtifact: boolean;
  }>({
    phase: 'idle',
    intent: 'new',
    extractionLifecycle: 'idle',
    hasProject: false,
    hasBriefing: false,
    hasCheckpoint: false,
    checkpointHasExtractionContext: false,
    hasSourceArtifact: false,
  });

  if (!auth.session) {
    return null;
  }

  const handleArtifactRelaunchNavigation = (
    artifact: GenerationArtifact,
  ): void => {
    const targetPath = buildToolEntryPathFromArtifact(artifact, 'regenerate');
    if (!targetPath) {
      return;
    }

    navigate(targetPath);
  };

  return (
    <section className={uiPrimitives.stack}>
      <section className={uiPrimitives.generationCanvas}>
        <GenerationForm
          userId={auth.session.user.id}
          toolsUploadEnabled={auth.capabilities.toolsUpload}
          projectOptions={projectsQuery.data.map((project) => ({ id: project.id, name: project.name }))}
          projectsLoading={projectsQuery.loading}
          projectsError={projectsQuery.error}
          disabled={generation.isStreamActive}
          checkpoints={generation.checkpoints}
          prefillProjectId={generation.focusedProjectId}
          onExtractionContextChange={generation.upsertExtractionContext}
          getExtractionContext={generation.getExtractionContext}
          onSetupStateChange={setToolSetupState}
          onStart={generation.start}
        />

        <GenerationStreamPanel
          status={generation.streamStatus}
          content={generation.snapshot.context.content}
          requestId={generation.snapshot.context.requestId}
          artifactId={generation.snapshot.context.artifactId}
          reconnectAttempts={generation.snapshot.context.reconnectAttempts}
          errorCode={generation.snapshot.context.errorCode}
          errorMessage={generation.snapshot.context.errorMessage}
          onRetry={generation.retry}
          onCancel={generation.cancel}
          onReset={generation.reset}
          canRetry={generation.snapshot.matches('failed')}
          canCancel={generation.isStreamActive}
        />

        <ArtifactHistoryPanel
          artifacts={generation.artifacts}
          relaunchDisabled={generation.isStreamActive}
          onOpenProject={(projectId) => generation.setFocusedProjectId(projectId)}
          onRelaunchFromArtifact={handleArtifactRelaunchNavigation}
        />
      </section>
    </section>
  );
};
