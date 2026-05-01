/**
 * ToolPageTemplate: Unified orchestration template for all tool pages
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uiPrimitives } from '../../../app/ui/primitives';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import type { GenerationRequest } from '../../generation/contracts/backend-stream';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import { getToolFormConfig, mapToolStepToCardConfig } from '../runtime/tool-form-architecture';
import { createStepRequest, getStepDependencies } from '../runtime/tool-generation-engine';
import {
  useProjectsLoader,
  useBriefingUpload,
  useToolFormInit,
  useAvailableSteps,
  useToolUiState,
} from '../runtime/useToolForm';
import { ToolGenerationFlowVertical } from './ToolGenerationFlowVertical';
import { ToolActionButtons } from './ToolActionButtons';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { getArtifactById, listArtifacts } from '../../artifacts/runtime/artifacts-client';
import {
  buildExtractionContextFromArtifact,
  buildLatestArtifactByStep,
  collectCompletedRunSteps,
  collectCompletedStepsByTool,
} from '../../generation/runtime/step-hydration';

interface ToolPageTemplateProps {
  toolKey: SupportedTool;
  sourceArtifactId?: string | null;
  intent?: 'new' | 'regenerate' | 'resume';
  initialProjectId?: string | null;
  relaunchTone?: string | null;
  relaunchNotes?: string | null;
  relaunchFromArtifactId?: string | null;
  briefingId?: string | null;
  briefingFileName?: string | null;
}

const readInputString = (artifact: GenerationArtifact | null, key: string): string | null => {
  const value = artifact?.sourceRequest.input?.[key];
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const randomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}`;
};

export const ToolPageTemplate = ({
  toolKey,
  sourceArtifactId,
  intent = 'new',
  initialProjectId,
  relaunchTone,
  relaunchNotes,
  relaunchFromArtifactId,
  briefingId,
  briefingFileName,
}: ToolPageTemplateProps) => {
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const navigate = useNavigate();
  const toolConfig = getToolFormConfig(toolKey);
  const [isAutoChainEnabled, setIsAutoChainEnabled] = useState(false);
  const [pausedCheckpointStep, setPausedCheckpointStep] = useState<ToolStep | null>(null);
  const [persistedArtifacts, setPersistedArtifacts] = useState<GenerationArtifact[]>([]);
  const [sourceArtifact, setSourceArtifact] = useState<GenerationArtifact | null>(null);
  const initialPrefillDoneRef = useRef(false);
  const currentRunPrefixRef = useRef<string | null>(null);
  const lastRequestedStepRef = useRef<ToolStep | null>(null);

  // 1. Initialize form state
  const { formState, setFormState } = useToolFormInit(
    toolKey,
    generation.focusedProjectId ?? initialProjectId ?? undefined,
  );

  // 2. Load projects
  const { projects, loading: projectsLoading } = useProjectsLoader();

  // 3. Manage briefing upload
  const briefingUpload = useBriefingUpload(toolKey, formState.projectId);

  // 4. Apply one-shot prefill from query params
  useEffect(() => {
    if (initialPrefillDoneRef.current) {
      return;
    }

    const nextProjectId = initialProjectId?.trim() ?? '';
    if (!nextProjectId) {
      initialPrefillDoneRef.current = true;
      return;
    }

    setFormState((prev) => ({
      ...prev,
      projectId: nextProjectId,
    }));
    generation.setFocusedProjectId(nextProjectId);
    initialPrefillDoneRef.current = true;
  }, [generation, initialProjectId, setFormState]);

  // 5. Load persisted artifacts for selected project (DB + fallback)
  useEffect(() => {
    const normalizedProjectId = formState.projectId.trim();
    if (!normalizedProjectId) {
      setPersistedArtifacts([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const list = await listArtifacts(
          {
            type: 'all',
            status: 'all',
            projectId: normalizedProjectId,
          },
          {
            apiBaseUrl: auth.apiBaseUrl,
            capabilities: auth.capabilities,
            localArtifacts: generation.artifacts,
          },
        );

        if (!cancelled) {
          setPersistedArtifacts(list);
        }
      } catch {
        if (!cancelled) {
          setPersistedArtifacts(generation.artifacts.filter((item) => item.projectId === normalizedProjectId));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.apiBaseUrl, auth.capabilities, formState.projectId, generation.artifacts]);

  const allArtifacts = useMemo(() => {
    const merged = [...generation.artifacts, ...persistedArtifacts];
    const byId = new Map<string, GenerationArtifact>();

    for (const artifact of merged) {
      if (!byId.has(artifact.artifactId)) {
        byId.set(artifact.artifactId, artifact);
      }
    }

    return [...byId.values()];
  }, [generation.artifacts, persistedArtifacts]);

  // 6. Resolve source artifact for relaunch intent
  useEffect(() => {
    const normalizedSourceArtifactId = sourceArtifactId?.trim() ?? '';
    if (!normalizedSourceArtifactId) {
      setSourceArtifact(null);
      return;
    }

    const localSource = allArtifacts.find((artifact) => artifact.artifactId === normalizedSourceArtifactId) ?? null;
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
          localArtifacts: allArtifacts,
        });

        if (!cancelled) {
          setSourceArtifact(detail);
        }
      } catch {
        if (!cancelled) {
          setSourceArtifact(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allArtifacts, auth.apiBaseUrl, auth.capabilities, sourceArtifactId]);

  // 7. Hydrate extraction context from source artifact when available
  useEffect(() => {
    if (!sourceArtifact) {
      return;
    }

    const sourceContext = buildExtractionContextFromArtifact(sourceArtifact);
    if (sourceContext) {
      generation.upsertExtractionContext(sourceContext);
    }
  }, [generation, sourceArtifact]);

  const normalizedProjectId = formState.projectId.trim();
  const extractionContext = briefingUpload.extractionContext
    ?? generation.getExtractionContext(normalizedProjectId)
    ?? (sourceArtifact ? buildExtractionContextFromArtifact(sourceArtifact) : null);

  const effectiveBriefingFileName = briefingUpload.fileName
    ?? briefingFileName
    ?? readInputString(sourceArtifact, 'briefingFileName');

  const effectiveBriefingStatus = (
    briefingUpload.status === 'ready' || extractionContext
      ? 'ready'
      : briefingUpload.status
  );

  const resolvedTone = relaunchTone ?? readInputString(sourceArtifact, 'tone') ?? '';
  const resolvedNotes = relaunchNotes ?? readInputString(sourceArtifact, 'notes') ?? '';
  const resolvedRelaunchSource = relaunchFromArtifactId
    ?? sourceArtifactId
    ?? sourceArtifact?.artifactId
    ?? null;

  // 8. Compute completed steps and artifacts mapping
  const historicalCompletedSteps = useMemo(() => {
    return collectCompletedStepsByTool(allArtifacts, toolKey, normalizedProjectId);
  }, [allArtifacts, normalizedProjectId, toolKey]);

  const runCompletedSteps = useMemo(() => {
    if (!currentRunPrefixRef.current) {
      return new Set<ToolStep>();
    }

    return collectCompletedRunSteps(
      allArtifacts,
      toolKey,
      normalizedProjectId,
      currentRunPrefixRef.current,
    );
  }, [allArtifacts, normalizedProjectId, toolKey]);

  const completedStepsForFlow = intent === 'regenerate' ? runCompletedSteps : historicalCompletedSteps;

  const latestArtifactByStep = useMemo(
    () => buildLatestArtifactByStep(allArtifacts, toolKey, normalizedProjectId),
    [allArtifacts, normalizedProjectId, toolKey],
  );

  const completedArtifactsByStep = useMemo(() => {
    return Object.entries(latestArtifactByStep).reduce<Partial<Record<ToolStep, string>>>((acc, entry) => {
      const [step, artifact] = entry;
      if (artifact?.artifactId) {
        acc[step as ToolStep] = artifact.artifactId;
      }

      return acc;
    }, {});
  }, [latestArtifactByStep]);

  const nextAvailableStep = useAvailableSteps(toolKey, completedStepsForFlow)[0] ?? null;

  const currentRunningStep = useMemo(() => {
    if (!generation.isStreamActive) {
      return null;
    }

    const candidate = (generation.snapshot.context.lastRequest?.input as Record<string, unknown> | undefined)?.step;
    if (typeof candidate !== 'string') {
      return null;
    }

    return toolConfig.steps.includes(candidate as ToolStep) ? candidate as ToolStep : null;
  }, [generation.isStreamActive, generation.snapshot.context.lastRequest, toolConfig.steps]);

  const isResumeIntent = intent === 'resume' && Boolean(sourceArtifactId);
  const lastCheckpointStep = useMemo(() => {
    if (pausedCheckpointStep && nextAvailableStep) {
      return pausedCheckpointStep;
    }

    if (isResumeIntent && historicalCompletedSteps.size > 0) {
      const sorted = toolConfig.steps.filter((step) => historicalCompletedSteps.has(step));
      return sorted.at(-1) ?? null;
    }

    return null;
  }, [historicalCompletedSteps, isResumeIntent, nextAvailableStep, pausedCheckpointStep, toolConfig.steps]);

  useEffect(() => {
    if (!pausedCheckpointStep) {
      return;
    }

    if (completedStepsForFlow.has(pausedCheckpointStep)) {
      setPausedCheckpointStep(null);
    }
  }, [completedStepsForFlow, pausedCheckpointStep]);

  // 9. Derive UI state
  const uiState = useToolUiState(toolKey, {
    formState: {
      ...formState,
      briefingStatus: effectiveBriefingStatus,
      briefingFileName: effectiveBriefingFileName ?? null,
      briefingError: briefingUpload.error,
      briefingFile: briefingUpload.file,
    },
    isGenerationStreamActive: generation.isStreamActive,
    completedSteps: completedStepsForFlow,
    currentRunningStep,
    hasCompletedPreviousGeneration: historicalCompletedSteps.size > 0,
    lastCheckpointStep,
    nextAvailableStep,
    generationError: generation.streamStatus === 'failed' ? 'Generation failed' : null,
  });

  // 10. Build project and step lists
  const currentProject = projects.find((p) => p.id === formState.projectId);

  // 11. Handle generation start and chaining
  const startGenerationStep = (step: ToolStep): boolean => {
    if (!auth.session || !normalizedProjectId || !extractionContext) {
      return false;
    }

    const runPrefix = currentRunPrefixRef.current ?? randomId();
    currentRunPrefixRef.current = runPrefix;

    const baseRequest: GenerationRequest = {
      requestId: runPrefix,
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
        tone: resolvedTone,
        notes: resolvedNotes,
        relaunchFromArtifactId: resolvedRelaunchSource,
        sourceArtifactId: sourceArtifactId ?? null,
        briefingId: extractionContext.briefingId || briefingId || readInputString(sourceArtifact, 'briefingId'),
        briefingFileName: effectiveBriefingFileName ?? null,
        extractionArtifactId: extractionContext.extractionArtifactId,
        extractionPayload: extractionContext.extractionPayload,
      },
    };

    const dependencies = getStepDependencies(toolKey, completedArtifactsByStep, step);
    const dependencyArtifactContentsByStep = Object.fromEntries(
      Object.entries(dependencies)
        .map(([stepKey, artifactId]): [string, string] => {
          const dependencyArtifact = allArtifacts.find((artifact) => artifact.artifactId === artifactId);
          return [stepKey, dependencyArtifact?.content ?? ''];
        })
        .filter((entry) => entry[1].trim().length > 0),
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

  const handlePrimaryAction = (): void => {
    const targetStep = uiState.primaryActionPolicy === 'resume-checkpoint' && pausedCheckpointStep
      ? pausedCheckpointStep
      : nextAvailableStep;

    if (!targetStep) {
      return;
    }

    setPausedCheckpointStep(null);
    setIsAutoChainEnabled(true);
    void startGenerationStep(targetStep);
  };

  const handleCancelGeneration = (): void => {
    setIsAutoChainEnabled(false);
    const interruptedStep = currentRunningStep ?? lastRequestedStepRef.current;
    if (interruptedStep) {
      setPausedCheckpointStep(interruptedStep);
    }
    currentRunPrefixRef.current = null;
    generation.cancel();
  };

  useEffect(() => {
    if (!isAutoChainEnabled) {
      return;
    }

    if (generation.streamStatus === 'failed') {
      const interruptedStep = currentRunningStep ?? lastRequestedStepRef.current;
      if (interruptedStep) {
        setPausedCheckpointStep(interruptedStep);
      }
      setIsAutoChainEnabled(false);
      currentRunPrefixRef.current = null;
      return;
    }

    if (generation.isStreamActive) {
      return;
    }

    if (!nextAvailableStep) {
      setIsAutoChainEnabled(false);
      currentRunPrefixRef.current = null;
      return;
    }

    const lastRequestedStep = lastRequestedStepRef.current;
    if (!lastRequestedStep) {
      return;
    }

    if (!completedStepsForFlow.has(lastRequestedStep)) {
      return;
    }

    if (lastRequestedStep === nextAvailableStep) {
      return;
    }

    void startGenerationStep(nextAvailableStep);
  }, [
    completedStepsForFlow,
    currentRunningStep,
    generation.isStreamActive,
    generation.streamStatus,
    isAutoChainEnabled,
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

            <form className="ui-tool-form">
              <div className="ui-tool-form-row">
                <label>
                  <span>Project</span>
                  <select
                    value={formState.projectId}
                    onChange={(e) => setFormState({ ...formState, projectId: e.target.value })}
                    disabled={projectsLoading || generation.isStreamActive}
                  >
                    <option value="">{projectsLoading ? 'Caricamento progetti...' : 'Seleziona un progetto'}</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Model</span>
                  <input
                    type="text"
                    value={formState.model}
                    onChange={(e) => setFormState({ ...formState, model: e.target.value })}
                    placeholder="e.g., openrouter/auto"
                  />
                </label>
              </div>

              <label>
                <span>Briefing File</span>
                <input
                  type="file"
                  accept=".docx,.txt,.md"
                  disabled={!formState.projectId.trim() || generation.isStreamActive}
                  onChange={(e) => {
                    void briefingUpload.handleFileSelected(e.target.files?.[0] ?? null);
                  }}
                />
              </label>

              {briefingUpload.error ? <p className={uiPrimitives.error}>{briefingUpload.error}</p> : null}

              <p className={uiPrimitives.metaLine}>
                Briefing status: {effectiveBriefingStatus}
                {effectiveBriefingFileName ? ` - ${effectiveBriefingFileName}` : ''}
              </p>

              <ToolActionButtons
                primaryPolicy={uiState.primaryActionPolicy}
                secondaryFlags={uiState.secondaryActions}
                onPrimaryAction={handlePrimaryAction}
                onCancelGeneration={handleCancelGeneration}
                isLoading={generation.isStreamActive}
              />
            </form>
          </section>

          <section className="ui-tool-column ui-tool-column-status">
            <ToolGenerationFlowVertical
              toolKey={toolKey}
              canonicalState={uiState.canonicalState}
              projectName={currentProject?.name ?? null}
              briefingFileName={effectiveBriefingFileName ?? null}
              briefingStatus={effectiveBriefingStatus}
              briefingError={briefingUpload.error}
              steps={toolConfig.steps.map((step) => ({
                step,
                displayName: mapToolStepToCardConfig(toolKey, step).displayName,
                status: uiState.stepStatuses[step] ?? 'idle',
                artifactId: latestArtifactByStep[step]?.artifactId ?? null,
                isStreaming:
                  generation.isStreamActive
                  && (generation.snapshot.context.lastRequest?.input as Record<string, unknown>)?.step === step,
              }))}
              currentRunningStep={currentRunningStep}
              completedStepsCount={completedStepsForFlow.size}
              totalStepsCount={toolConfig.steps.length}
              statusMessage={uiState.statusMessage}
              errorMessage={uiState.errorMessage}
              onViewArtifact={(artifactId) => {
                void navigate(`/artifacts/${artifactId}`);
              }}
            />
          </section>
        </div>
      </div>
    </section>
  );
};