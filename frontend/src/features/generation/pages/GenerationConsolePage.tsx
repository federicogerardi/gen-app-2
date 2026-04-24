import { useState } from 'react';
import { GenerationForm } from '../ui/GenerationForm';
import { GenerationStreamPanel } from '../ui/GenerationStreamPanel';
import { ArtifactHistoryPanel } from '../ui/ArtifactHistoryPanel';
import {
  deriveCanonicalToolUiState,
  derivePrimaryActionPolicy,
  type ExtractionLifecycle,
  type ToolIntent,
  type ToolPhase,
} from '../ui/tool-ux-state';
import { useGenerationWorkspace } from '../runtime/GenerationWorkspaceProvider';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';

export const GenerationConsolePage = () => {
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();

  const [toolSetupState, setToolSetupState] = useState<{
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

  const canonicalState = deriveCanonicalToolUiState({
    ...toolSetupState,
    streamStatus: generation.streamStatus,
  });
  const primaryActionPolicy = derivePrimaryActionPolicy(canonicalState);

  if (!auth.session) {
    return null;
  }

  return (
    <section className="page-stack">
      <section className="layout-grid">
        <GenerationForm
          userId={auth.session.user.id}
          disabled={generation.isStreamActive}
          checkpoints={generation.checkpoints}
          prefillProjectId={generation.focusedProjectId}
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
          canonicalState={canonicalState}
          primaryActionPolicy={primaryActionPolicy}
        />
      </section>

      <ArtifactHistoryPanel
        artifacts={generation.artifacts}
        relaunchDisabled={generation.isStreamActive}
        onOpenProject={(projectId) => generation.setFocusedProjectId(projectId)}
        onRelaunch={generation.relaunch}
      />
    </section>
  );
};
