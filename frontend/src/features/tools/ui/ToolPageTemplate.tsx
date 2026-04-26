/**
 * ToolPageTemplate: Unified orchestration template for all tool pages
 * 
 * Combines:
 * - Form state management via useToolForm hooks
 * - Generation state from GenerationWorkspace
 * - UI state derivation for canonical state + CTA policy
 * - Component composition: status card + step cards + action buttons
 * 
 * Usage in tool-specific pages:
 * ```tsx
 * export const MyToolPage = () => <ToolPageTemplate toolKey="my-tool" />
 * ```
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { uiPrimitives } from '../../../app/ui/primitives';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import type { GenerationRequest } from '../../generation/contracts/backend-stream';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import {
  getToolFormConfig,
} from '../runtime/tool-form-architecture';
import { createStepRequest, getStepDependencies } from '../runtime/tool-generation-engine';
import {
  useProjectsLoader,
  useBriefingUpload,
  useToolFormInit,
  useAvailableSteps,
  useToolUiState,
} from '../runtime/useToolForm';
import { ToolStatusCard } from './ToolStatusCard';
import { ToolStepCard } from './ToolStepCard';
import { ToolActionButtons } from './ToolActionButtons';

interface ToolPageTemplateProps {
  toolKey: SupportedTool;
  sourceArtifactId?: string | null;
  intent?: 'new' | 'regenerate' | 'resume';
}

export const ToolPageTemplate = ({
  toolKey,
  sourceArtifactId,
  intent = 'new',
}: ToolPageTemplateProps) => {
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const toolConfig = getToolFormConfig(toolKey);
  const isResumeIntent = intent === 'resume' && Boolean(sourceArtifactId);
  const [isAutoChainEnabled, setIsAutoChainEnabled] = useState(false);
  const lastRequestedStepRef = useRef<ToolStep | null>(null);

  // 1. Initialize form state
  const { formState, setFormState, validation } = useToolFormInit(
    toolKey,
    generation.focusedProjectId ?? undefined,
  );

  // 2. Load projects
  const { projects, loading: projectsLoading } = useProjectsLoader();

  // 3. Manage briefing upload
  const briefingUpload = useBriefingUpload(toolKey, formState.projectId);

  // 4. Build completed steps set from artifacts
  const completedSteps = useMemo(() => {
    return new Set(
      generation.artifacts
        .filter(
          a =>
            a.projectId === formState.projectId.trim()
            && a.status === 'completed'
            && a.toolKey === toolKey,
        )
        .map(a => {
          // Extract step from artifact sourceRequest
          const step = (a.sourceRequest?.input as any)?.step;
          return typeof step === 'string' ? (step as ToolStep) : null;
        })
        .filter((s): s is ToolStep => s !== null),
    );
  }, [generation.artifacts, formState.projectId, toolKey]);

  const completedArtifactsByStep = useMemo(() => {
    return generation.artifacts
      .filter(
        artifact =>
          artifact.projectId === formState.projectId.trim()
          && artifact.status === 'completed'
          && artifact.toolKey === toolKey,
      )
      .reduce<Partial<Record<ToolStep, string>>>((acc, artifact) => {
        const step = artifact.sourceRequest?.input?.step;
        if (typeof step === 'string') {
          acc[step as ToolStep] = artifact.artifactId;
        }
        return acc;
      }, {});
  }, [generation.artifacts, formState.projectId, toolKey]);

  // 5. Get available steps
  const nextAvailableStep = useAvailableSteps(toolKey, completedSteps)[0] ?? null;

  // 6. Derive UI state
  const uiState = useToolUiState(toolKey, {
    formState: {
      ...formState,
      briefingStatus: briefingUpload.status,
      briefingFileName: briefingUpload.fileName,
      briefingError: briefingUpload.error,
      briefingFile: briefingUpload.file,
    },
    isGenerationStreamActive: generation.isStreamActive,
    completedSteps,
    currentRunningStep: generation.isStreamActive
      ? (generation.snapshot.context.lastRequest?.input as any)?.step ?? null
      : null,
    hasCompletedPreviousGeneration: generation.artifacts.some(
      a => a.toolKey === toolKey && a.status === 'completed',
    ),
    lastCheckpointStep: isResumeIntent
      ? (completedSteps.size > 0 ? Array.from(completedSteps)[0] ?? null : null)
      : null,
    nextAvailableStep,
    generationError: generation.streamStatus === 'failed' ? 'Generation failed' : null,
  });

  // 7. Build project and step lists
  const currentProject = projects.find(p => p.id === formState.projectId);
  const completedStepIds = Array.from(completedSteps);

  // 8. Handle form submission
  const startGenerationStep = (step: ToolStep): boolean => {
    const normalizedProjectId = formState.projectId.trim();
    const extractionContext =
      briefingUpload.extractionContext ?? generation.getExtractionContext(normalizedProjectId);

    if (
      !auth.session
      || !normalizedProjectId
      || !extractionContext
    ) {
      return false;
    }

    const baseRequest: GenerationRequest = {
      requestId: crypto.randomUUID(),
      userId: auth.session.user.id,
      projectId: normalizedProjectId,
      artifactType: 'content',
      model: formState.model,
      outputFormat: 'markdown',
      toolKey,
      workflowType: toolKey,
      registrySnapshotRef: formState.registrySnapshotRef,
      input: {
        intent,
        briefingId: extractionContext.briefingId,
        extractionArtifactId: extractionContext.extractionArtifactId,
        extractionPayload: extractionContext.extractionPayload,
      },
    };

    const dependencies = getStepDependencies(toolKey, completedArtifactsByStep, step);

    const dependencyArtifactContentsByStep = Object.fromEntries(
      Object.entries(dependencies)
        .map(([stepKey, artifactId]) => {
          const dependencyArtifact = generation.artifacts.find(
            artifact => artifact.artifactId === artifactId,
          );
          return [stepKey, dependencyArtifact?.content ?? ''];
        })
        .filter(
          (entry): entry is [string, string] =>
            typeof entry[1] === 'string' && entry[1].trim().length > 0,
        ),
    );

    const request = createStepRequest(
      baseRequest,
      toolKey,
      step,
      dependencies,
      dependencyArtifactContentsByStep,
    );

    generation.start(request);
    lastRequestedStepRef.current = step;
    return true;
  };

  const handleStartGeneration = (): void => {
    if (!nextAvailableStep) {
      return;
    }

    setIsAutoChainEnabled(true);
    void startGenerationStep(nextAvailableStep);
  };

  useEffect(() => {
    if (!isAutoChainEnabled) {
      return;
    }

    if (generation.streamStatus === 'failed') {
      setIsAutoChainEnabled(false);
      return;
    }

    if (generation.isStreamActive) {
      return;
    }

    if (!nextAvailableStep) {
      setIsAutoChainEnabled(false);
      return;
    }

    const lastRequestedStep = lastRequestedStepRef.current;
    if (!lastRequestedStep) {
      return;
    }

    if (!completedSteps.has(lastRequestedStep)) {
      return;
    }

    if (lastRequestedStep === nextAvailableStep) {
      return;
    }

    void startGenerationStep(nextAvailableStep);
  }, [
    isAutoChainEnabled,
    generation.streamStatus,
    generation.isStreamActive,
    completedSteps,
    nextAvailableStep,
  ]);

  return (
    <section className="ui-tool-page-template">
      <div className={uiPrimitives.stack}>
        <div className="ui-tool-layout-grid">
          <section className="ui-tool-column ui-tool-column-inputs">
            <header>
              <h2>{toolConfig.displayName}</h2>
              <p className={uiPrimitives.metaLine}>{toolConfig.displayName} configuration and generation</p>
            </header>

            {/* Form section */}
            <form className="ui-tool-form">
              {/* Project selector */}
              <label>
                <span>Project</span>
                <select
                  value={formState.projectId}
                  onChange={e => setFormState({ ...formState, projectId: e.target.value })}
                  disabled={projectsLoading || generation.isStreamActive}
                >
                  <option value="">Select a project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              {projectsLoading && (
                <p className={uiPrimitives.metaLine}>Loading projects...</p>
              )}

              {/* Model selector */}
              <label>
                <span>Model</span>
                <input
                  type="text"
                  value={formState.model}
                  onChange={e => setFormState({ ...formState, model: e.target.value })}
                  placeholder="e.g., openrouter/auto"
                />
              </label>

              {/* Registry snapshot */}
              <label>
                <span>Registry Snapshot</span>
                <input
                  type="text"
                  value={formState.registrySnapshotRef}
                  onChange={e => setFormState({ ...formState, registrySnapshotRef: e.target.value })}
                  placeholder="e.g., snapshot:default"
                />
              </label>

              {/* Briefing upload */}
              <label>
                <span>Briefing File</span>
                <input
                  type="file"
                  accept=".docx,.txt,.md"
                  disabled={!formState.projectId.trim() || generation.isStreamActive}
                  onChange={e => void briefingUpload.handleFileSelected(e.target.files?.[0] ?? null)}
                />
              </label>

              {briefingUpload.error && (
                <p className={uiPrimitives.error}>{briefingUpload.error}</p>
              )}

              <p className={uiPrimitives.metaLine}>
                Briefing status: {briefingUpload.status}
                {briefingUpload.fileName && ` - ${briefingUpload.fileName}`}
              </p>

              <ToolActionButtons
                primaryPolicy={uiState.primaryActionPolicy}
                secondaryFlags={uiState.secondaryActions}
                onPrimaryAction={handleStartGeneration}
                isLoading={generation.isStreamActive}
              />
            </form>
          </section>

          <section className="ui-tool-column ui-tool-column-status">
            <ToolStatusCard
              canonicalState={uiState.canonicalState}
              statusMessage={uiState.statusMessage}
              errorMessage={uiState.errorMessage}
              projectName={currentProject?.name ?? null}
              briefingFileName={briefingUpload.fileName}
              completedStepsCount={completedSteps.size}
              totalStepsCount={toolConfig.steps.length}
            />

            {/* Step cards */}
            {toolConfig.steps.length > 0 && (
              <div className="ui-tool-steps-container">
                <h3>Generation Steps</h3>
                {toolConfig.steps.map(step => (
                  <ToolStepCard
                    key={step}
                    toolKey={toolKey}
                    step={step}
                    status={
                      uiState.stepStatuses[step] ?? 'idle'
                    }
                    previewContent={
                      generation.artifacts.find(
                        a =>
                          a.toolKey === toolKey
                          && (a.sourceRequest?.input as any)?.step === step,
                      )?.content ?? null
                    }
                    artifactId={
                      generation.artifacts.find(
                        a =>
                          a.toolKey === toolKey
                          && (a.sourceRequest?.input as any)?.step === step,
                      )?.artifactId ?? null
                    }
                    isStreaming={
                      generation.isStreamActive
                      && (generation.snapshot.context.lastRequest?.input as any)?.step === step
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
};
