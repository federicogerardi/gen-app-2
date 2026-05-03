/**
 * ToolPageTemplate: Unified orchestration template for all tool pages
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMachine, useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import { useNavigate } from 'react-router-dom';
import { uiPrimitives } from '../../../app/ui/primitives';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import type { GenerationRequest } from '../../generation/contracts/backend-stream';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import { briefingUploadMachine } from '../machines/briefing-upload.machine';
import { toolPageMachine } from '../machines/tool-page.machine';
import { getToolFormConfig, mapToolStepToCardConfig } from '../runtime/tool-form-architecture';
import { createStepRequest, getStepDependencies } from '../runtime/tool-generation-engine';
import {
  useProjectsLoader,
  useToolFormInit,
  useAvailableSteps,
} from '../runtime/useToolForm';
import { ToolGenerationFlowVertical } from './ToolGenerationFlowVertical';
import { ToolActionButtons } from './ToolActionButtons';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { getArtifactById, listArtifacts } from '../../artifacts/runtime/artifacts-client';

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

const readArtifactStep = (artifact: GenerationArtifact | null): ToolStep | null => {
  const step = artifact?.sourceRequest.input?.step;
  return typeof step === 'string' ? step as ToolStep : null;
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
  const wasStreamActiveRef = useRef(false);
  const previousProjectIdRef = useRef<string>((generation.focusedProjectId ?? initialProjectId ?? '').trim());

  const [toolPageSnapshot, toolPageSend] = useMachine(toolPageMachine, {
    input: {
      toolKey,
      projectId: generation.focusedProjectId ?? initialProjectId ?? '',
      model: toolConfig.defaultModel,
      registrySnapshotRef: toolConfig.defaults.registrySnapshotRef,
      apiBaseUrl: auth.apiBaseUrl,
      capabilities: auth.capabilities,
      userId: auth.session?.user.id ?? null,
    },
  });

  // 1. Initialize form state
  const { formState, setFormState } = useToolFormInit(
    toolKey,
    generation.focusedProjectId ?? initialProjectId ?? undefined,
  );

  // 2. Load projects
  const { projects, loading: projectsLoading } = useProjectsLoader();

  // 3. Read briefing upload state from toolPageMachine child actor.
  const briefingSnapshot = useSelector(
    toolPageSnapshot.context.briefingActorRef as ActorRefFrom<typeof briefingUploadMachine>,
    (state) => state,
  );

  const briefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready' = briefingSnapshot.matches('uploading')
    ? 'uploading'
    : briefingSnapshot.matches('extracting')
      ? 'extracting'
      : briefingSnapshot.matches('ready')
        ? 'ready'
        : 'idle';
  const briefingError = briefingSnapshot.context.error;
  const briefingFileNameFromActor = briefingSnapshot.context.fileName;

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

  // 7. Hydrate extraction context from source artifact: send HYDRATE_REQUESTED to machine.
  useEffect(() => {
    if (!sourceArtifact) {
      return;
    }

    toolPageSend({
      type: 'HYDRATE_REQUESTED',
      intent,
      sourceArtifactId: sourceArtifact.artifactId,
      resolvedBriefingId: readInputString(sourceArtifact, 'briefingId') ?? briefingId ?? null,
      sourceExtractionArtifactId: readInputString(sourceArtifact, 'extractionArtifactId'),
      localArtifacts: allArtifacts,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceArtifact]);

  const normalizedProjectId = formState.projectId.trim();

  const resolvedBriefingId = briefingId
    ?? readInputString(sourceArtifact, 'briefingId')
    ?? null;

  useEffect(() => {
    if (previousProjectIdRef.current === normalizedProjectId) {
      return;
    }

    toolPageSend({ type: 'PROJECT_SELECTED', projectId: normalizedProjectId });
    previousProjectIdRef.current = normalizedProjectId;
  }, [normalizedProjectId, toolPageSend]);

  // Phase 4: extraction context letto dallo snapshot della macchina, non dalla workspace.
  const machineHydrationResult = toolPageSnapshot.context.hydrationResult;

  const effectiveBriefingFileName = briefingFileNameFromActor
    ?? briefingFileName
    ?? readInputString(sourceArtifact, 'briefingFileName');

  const effectiveBriefingStatus = (
    briefingStatus === 'ready' || machineHydrationResult !== null
      ? 'ready'
      : briefingStatus
  );

  const resolvedTone = relaunchTone ?? readInputString(sourceArtifact, 'tone') ?? '';
  const resolvedNotes = relaunchNotes ?? readInputString(sourceArtifact, 'notes') ?? '';
  const resolvedRelaunchSource = relaunchFromArtifactId
    ?? sourceArtifactId
    ?? sourceArtifact?.artifactId
    ?? null;

  const progressState = toolPageSnapshot.context.progress;
  const readinessSnapshot = toolPageSnapshot.context.readiness;
  const machineViewModel = toolPageSnapshot.context.viewModel;
  const effectiveCanonicalState = (
    toolPageSnapshot.matches('generating') || generation.isStreamActive
      ? 'running'
      : machineViewModel.canonicalState
  );

  const completedStepsForFlow = progressState.completedSteps;
  const latestArtifactByStep = progressState.latestArtifactByStep;

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

  const sourceStep = useMemo(() => {
    const candidate = readArtifactStep(sourceArtifact);
    if (!candidate) {
      return null;
    }

    return toolConfig.steps.includes(candidate) ? candidate : null;
  }, [sourceArtifact, toolConfig.steps]);

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

  useEffect(() => {
    if (!pausedCheckpointStep) {
      return;
    }

    if (completedStepsForFlow.has(pausedCheckpointStep)) {
      setPausedCheckpointStep(null);
    }
  }, [completedStepsForFlow, pausedCheckpointStep]);

  const primaryTargetStep = useMemo(() => {
    if (machineViewModel.primaryActionPolicy === 'resume-checkpoint' && pausedCheckpointStep) {
      return pausedCheckpointStep;
    }

    if (machineViewModel.primaryActionPolicy === 'regenerate-current-step') {
      return sourceStep ?? nextAvailableStep;
    }

    if (
      machineViewModel.primaryActionPolicy === 'start-generation'
      || machineViewModel.primaryActionPolicy === 'resume-checkpoint'
    ) {
      return nextAvailableStep;
    }

    return null;
  }, [machineViewModel.primaryActionPolicy, nextAvailableStep, pausedCheckpointStep, sourceStep]);

  // 8. Sync progress into toolPageMachine context.
  // Phase 4: boolean readiness derivati dalla macchina, non passati dall'UI.
  // briefingSnapshot nelle dep: quando l'actor diventa ready, PROGRESS_SYNCED ri-triggera
  // e syncProgress ricalcola deriveHasExtractionContext correttamente.
  useEffect(() => {
    toolPageSend({
      type: 'PROGRESS_SYNCED',
      artifacts: allArtifacts,
      intent,
      sourceArtifact,
      runRequestPrefix: currentRunPrefixRef.current,
    });
  }, [allArtifacts, briefingSnapshot, intent, sourceArtifact, toolPageSend]);

  // 10. Build project and step lists
  const currentProject = projects.find((p) => p.id === formState.projectId);

  // 11. Handle generation start and chaining
  const startGenerationStep = (step: ToolStep): boolean => {
    if (!auth.session || !normalizedProjectId) {
      return false;
    }

    // Contesto estrazione: preferisce machineHydrationResult (recovery da artifact),
    // fallback a briefingSnapshot.context (flusso upload utente).
    const extractionInfo = (() => {
      if (machineHydrationResult !== null) {
        return {
          extractionArtifactId: machineHydrationResult.extractionArtifactId,
          extractionPayload: machineHydrationResult.extractionPayload,
          briefingId: machineHydrationResult.briefingId,
        };
      }
      const bc = briefingSnapshot.context;
      if (bc.extractionArtifactId && bc.briefingId) {
        return {
          extractionArtifactId: bc.extractionArtifactId,
          extractionPayload: bc.extractionPayload ?? {},
          briefingId: bc.briefingId,
        };
      }
      return null;
    })();

    if (!extractionInfo) {
      return false;
    }

    const runPrefix = currentRunPrefixRef.current ?? randomId();
    currentRunPrefixRef.current = runPrefix;
    toolPageSend({
      type: 'PROGRESS_SYNCED',
      artifacts: allArtifacts,
      intent,
      sourceArtifact,
      runRequestPrefix: runPrefix,
    });

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
        briefingId: extractionInfo.briefingId || resolvedBriefingId,
        briefingFileName: effectiveBriefingFileName ?? null,
        extractionArtifactId: extractionInfo.extractionArtifactId,
        extractionPayload: extractionInfo.extractionPayload,
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

  const openResultsArchive = (): void => {
    void navigate('/artifacts');
  };

  const handlePrimaryAction = (): void => {
    if (machineViewModel.primaryActionPolicy === 'open-last-artifact') {
      openResultsArchive();
      return;
    }

    if (!readinessSnapshot.canStartFlow) {
      return;
    }

    // Prevent starting a new generation if another tool is already streaming.
    if (generation.isStreamActive) {
      return;
    }

    const targetStep = primaryTargetStep;

    if (!targetStep) {
      return;
    }

    const runPrefix = currentRunPrefixRef.current ?? randomId();
    currentRunPrefixRef.current = runPrefix;

    setPausedCheckpointStep(null);
    setIsAutoChainEnabled(true);
    toolPageSend({ type: 'REQUEST_STEP_START', step: targetStep, runRequestPrefix: runPrefix });
  };

  const handleCancelGeneration = (): void => {
    setIsAutoChainEnabled(false);
    const interruptedStep = currentRunningStep ?? lastRequestedStepRef.current;
    if (interruptedStep) {
      setPausedCheckpointStep(interruptedStep);
    }
    currentRunPrefixRef.current = null;
    toolPageSend({
      type: 'PROGRESS_SYNCED',
      artifacts: allArtifacts,
      intent,
      sourceArtifact,
      runRequestPrefix: null,
    });
    toolPageSend({ type: 'CANCEL_GENERATION' });
    generation.cancel();
  };

  useEffect(() => {
    const pending = toolPageSnapshot.context.pendingStepStart;
    if (!pending) {
      return;
    }

    currentRunPrefixRef.current = pending.runRequestPrefix;
    void startGenerationStep(pending.step);
    toolPageSend({ type: 'STEP_REQUEST_DISPATCHED' });
  }, [startGenerationStep, toolPageSend, toolPageSnapshot.context.pendingStepStart]);

  // Bridge: quando generation stream termina, invia STEP_DONE/STEP_FAILED alla macchina.
  // Necessario perché toolFlowMachine (invocato in 'generating') attende questi eventi per avanzare.
  // Senza di essi la macchina resta bloccata in 'generating' e il pulsante mostra "In elaborazione..." indefinitamente.
  useEffect(() => {
    if (generation.isStreamActive) {
      wasStreamActiveRef.current = true;
      return;
    }

    // isStreamActive è ora false
    if (!wasStreamActiveRef.current) {
      // Era già inattivo (mount iniziale o stato precedente): skip
      return;
    }

    wasStreamActiveRef.current = false;

    const step = lastRequestedStepRef.current;
    if (!step) {
      return;
    }

    if (generation.streamStatus === 'completed') {
      toolPageSend({ type: 'STEP_DONE', step });
    } else if (generation.streamStatus === 'failed') {
      toolPageSend({ type: 'STEP_FAILED', step, message: 'Generazione fallita' });
    }
  }, [generation.isStreamActive, generation.streamStatus, toolPageSend]);

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
                    const selectedFile = e.target.files?.[0] ?? null;
                    if (selectedFile) {
                      toolPageSend({ type: 'BRIEFING_FILE_SELECTED', file: selectedFile });
                    } else {
                      toolPageSend({ type: 'BRIEFING_RESET' });
                    }
                  }}
                />
              </label>

              {briefingError ? <p className={uiPrimitives.error}>{briefingError}</p> : null}

              <p className={uiPrimitives.metaLine}>
                Briefing status: {effectiveBriefingStatus}
                {effectiveBriefingFileName ? ` - ${effectiveBriefingFileName}` : ''}
              </p>

              <ToolActionButtons
                primaryPolicy={machineViewModel.primaryActionPolicy}
                secondaryFlags={{
                  ...machineViewModel.secondaryActionFlags,
                  // canCancelGeneration è sempre false in buildDefaultViewModel perché la macchina
                  // non conosce il proprio stato corrente dentro buildToolPageViewModel.
                  // Lo deriviamo direttamente dallo stato macchina.
                  canCancelGeneration: toolPageSnapshot.matches('generating'),
                }}
                onPrimaryAction={handlePrimaryAction}
                onCancelGeneration={handleCancelGeneration}
                isLoading={toolPageSnapshot.matches('generating')}
              />
            </form>
          </section>

          <section className="ui-tool-column ui-tool-column-status">
            <ToolGenerationFlowVertical
              canonicalState={effectiveCanonicalState}
              projectName={currentProject?.name ?? null}
              briefingFileName={effectiveBriefingFileName ?? null}
              briefingStatus={effectiveBriefingStatus}
              readinessReasonCodes={readinessSnapshot.reasonCodes}
              briefingError={briefingError}
              steps={toolConfig.steps.map((step) => ({
                step,
                displayName: mapToolStepToCardConfig(toolKey, step).displayName,
                status: generation.isStreamActive && currentRunningStep === step
                  ? 'running'
                  : machineViewModel.stepStatuses[step] ?? 'idle',
                artifactId: latestArtifactByStep[step]?.artifactId ?? null,
                isStreaming:
                  generation.isStreamActive
                  && (generation.snapshot.context.lastRequest?.input as Record<string, unknown>)?.step === step,
              }))}
              completedStepsCount={completedStepsForFlow.size}
              totalStepsCount={toolConfig.steps.length}
              errorMessage={machineViewModel.messages.error}
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