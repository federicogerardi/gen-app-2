import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
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
import { listProjects, type ProjectSummary } from '../../projects/runtime/projects-client';
import {
  buildToolEntryPathFromArtifact,
  type GenerationArtifact,
} from '../ui/artifact-history';

export const GenerationConsolePage = () => {
  const navigate = useNavigate();
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!auth.session || !auth.capabilities.projects) {
      setProjects([]);
      setProjectsLoading(false);
      setProjectsError(null);
      return;
    }

    let cancelled = false;
    setProjectsLoading(true);

    void (async () => {
      try {
        const nextProjects = await listProjects({
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: auth.capabilities,
        });

        if (cancelled) {
          return;
        }

        setProjects(nextProjects);
        setProjectsError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setProjects([]);
        setProjectsError(loadError instanceof Error ? loadError.message : appCopy.ui.fallbackErrors.loadProjects);
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.apiBaseUrl, auth.capabilities, auth.session]);

  if (!auth.session) {
    return null;
  }

  const handleArtifactIntentNavigation = (
    artifact: GenerationArtifact,
    intent: 'new' | 'resume' | 'regenerate',
  ): void => {
    const targetPath = buildToolEntryPathFromArtifact(artifact, intent);
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
          projectOptions={projects.map((project) => ({ id: project.id, name: project.name }))}
          projectsLoading={projectsLoading}
          projectsError={projectsError}
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
          onResumeFromArtifact={(artifact) => handleArtifactIntentNavigation(artifact, 'new')}
          onRegenerateFromArtifact={(artifact) => handleArtifactIntentNavigation(artifact, 'regenerate')}
        />
      </section>
    </section>
  );
};
