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
  useToolUiState,
} from '../runtime/useToolForm';
import { ToolGenerationFlowVertical } from './ToolGenerationFlowVertical';
import { ToolActionButtons } from './ToolActionButtons';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { getArtifactById, listArtifacts } from '../../artifacts/runtime/artifacts-client';
import { buildExtractionContextFromArtifact } from '../../generation/runtime/step-hydration';

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
  const briefingFile = briefingSnapshot.context.file;
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

  const resolvedBriefingId = briefingId
    ?? readInputString(sourceArtifact, 'briefingId')
    ?? null;
  const sourceExtractionArtifactId = readInputString(sourceArtifact, 'extractionArtifactId');

  useEffect(() => {
    if (!briefingSnapshot.matches('ready')) {
      return;
    }

    if (!normalizedProjectId) {
      return;
    }

    const briefingIdFromActor = briefingSnapshot.context.briefingId;
    const extractionArtifactId = briefingSnapshot.context.extractionArtifactId;
    const extractionPayload = briefingSnapshot.context.extractionPayload;
    const normalizedText = briefingSnapshot.context.normalizedText;
    const parsedFormat = briefingSnapshot.context.parsedFormat;

    if (!briefingIdFromActor || !extractionArtifactId || !extractionPayload || !normalizedText || !parsedFormat) {
      return;
    }

    const existingContext = generation.getExtractionContext(normalizedProjectId);
    if (
      existingContext?.briefingId === briefingIdFromActor
      && existingContext.extractionArtifactId === extractionArtifactId
      && existingContext.normalizedText === normalizedText
      && existingContext.parsedFormat === parsedFormat
    ) {
      return;
    }

    generation.upsertExtractionContext({
      projectId: normalizedProjectId,
      briefingId: briefingIdFromActor,
      extractionArtifactId,
      extractionPayload,
      normalizedText,
      parsedFormat,
      updatedAt: new Date().toISOString(),
    });
  }, [briefingSnapshot, generation, normalizedProjectId]);

  useEffect(() => {
    if (!briefingSnapshot.matches('extracting')) {
      return;
    }

    const briefingIdFromActor = briefingSnapshot.context.briefingId;
    const normalizedText = briefingSnapshot.context.normalizedText;
    const parsedFormat = briefingSnapshot.context.parsedFormat;
    if (!normalizedProjectId || !briefingIdFromActor || !normalizedText || !parsedFormat) {
      return;
    }

    let cancelled = false;

    const tryRecoverExtraction = async (): Promise<boolean> => {
      const artifacts = await listArtifacts(
        {
          type: 'extraction',
          status: 'completed',
          projectId: normalizedProjectId,
        },
        {
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: auth.capabilities,
          localArtifacts: generation.artifacts,
        },
      );

      if (cancelled) {
        return false;
      }

      const recoveredArtifact = artifacts
        .filter((artifact) => {
          const artifactBriefingId = artifact.sourceRequest.input?.briefingId;
          const artifactToolKey = artifact.sourceRequest.input?.toolKey;
          return artifactBriefingId === briefingIdFromActor && artifactToolKey === toolKey;
        })
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];

      if (!recoveredArtifact) {
        return false;
      }

      let payload: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(recoveredArtifact.content) as unknown;
        if (parsed && typeof parsed === 'object') {
          payload = parsed as Record<string, unknown>;
        }
      } catch {
        payload = {};
      }

      generation.upsertExtractionContext({
        projectId: normalizedProjectId,
        briefingId: briefingIdFromActor,
        extractionArtifactId: recoveredArtifact.artifactId,
        extractionPayload: payload,
        normalizedText,
        parsedFormat,
        updatedAt: recoveredArtifact.updatedAt,
      });

      toolPageSnapshot.context.briefingActorRef?.send({
        type: 'EXTRACTION_RECOVERED',
        artifactId: recoveredArtifact.artifactId,
        payload,
      });

      return true;
    };

    void tryRecoverExtraction();
    const timerId = window.setInterval(() => {
      void tryRecoverExtraction().then((recovered) => {
        if (recovered && !cancelled) {
          window.clearInterval(timerId);
        }
      });
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [
    auth.apiBaseUrl,
    auth.capabilities,
    briefingSnapshot,
    generation,
    generation.artifacts,
    normalizedProjectId,
    toolKey,
    toolPageSnapshot.context.briefingActorRef,
  ]);

  // 7.b Recovery fallback for relaunch entrypoints with missing extraction fields.
  useEffect(() => {
    if (!normalizedProjectId) {
      return;
    }

    const shouldRecover = Boolean(resolvedBriefingId || sourceExtractionArtifactId || sourceArtifactId);
    if (!shouldRecover) {
      return;
    }

    const existingContext = generation.getExtractionContext(normalizedProjectId);
    if (existingContext && (!resolvedBriefingId || existingContext.briefingId === resolvedBriefingId)) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const artifacts = await listArtifacts(
          {
            type: 'extraction',
            status: 'completed',
            projectId: normalizedProjectId,
          },
          {
            apiBaseUrl: auth.apiBaseUrl,
            capabilities: auth.capabilities,
            localArtifacts: generation.artifacts,
          },
        );

        if (cancelled) {
          return;
        }

        const recoveredArtifact = artifacts
          .filter((artifact) => {
            const artifactToolKey = artifact.sourceRequest.input?.toolKey;
            return artifactToolKey === toolKey;
          })
          .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
          .sort((left, right) => {
            const leftIsSourceExtraction = sourceExtractionArtifactId && left.artifactId === sourceExtractionArtifactId ? 1 : 0;
            const rightIsSourceExtraction = sourceExtractionArtifactId && right.artifactId === sourceExtractionArtifactId ? 1 : 0;
            if (leftIsSourceExtraction !== rightIsSourceExtraction) {
              return rightIsSourceExtraction - leftIsSourceExtraction;
            }

            const leftBriefingId = typeof left.sourceRequest.input?.briefingId === 'string'
              ? left.sourceRequest.input.briefingId
              : null;
            const rightBriefingId = typeof right.sourceRequest.input?.briefingId === 'string'
              ? right.sourceRequest.input.briefingId
              : null;
            const leftMatchesBriefing = resolvedBriefingId && leftBriefingId === resolvedBriefingId ? 1 : 0;
            const rightMatchesBriefing = resolvedBriefingId && rightBriefingId === resolvedBriefingId ? 1 : 0;
            return rightMatchesBriefing - leftMatchesBriefing;
          })[0];

        if (!recoveredArtifact) {
          return;
        }

        const recoveredBriefingId = (() => {
          const raw = recoveredArtifact.sourceRequest.input?.briefingId;
          if (typeof raw === 'string' && raw.trim().length > 0) {
            return raw.trim();
          }

          if (resolvedBriefingId) {
            return resolvedBriefingId;
          }

          return null;
        })();

        if (!recoveredBriefingId) {
          return;
        }

        let extractionPayload: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(recoveredArtifact.content) as unknown;
          if (parsed && typeof parsed === 'object') {
            extractionPayload = parsed as Record<string, unknown>;
          }
        } catch {
          extractionPayload = {};
        }

        generation.upsertExtractionContext({
          projectId: normalizedProjectId,
          briefingId: recoveredBriefingId,
          extractionArtifactId: recoveredArtifact.artifactId,
          extractionPayload,
          normalizedText: readInputString(sourceArtifact, 'briefingText') ?? '',
          parsedFormat: (() => {
            const raw = readInputString(sourceArtifact, 'parsedFormat')?.toLowerCase();
            if (raw === 'txt' || raw === 'md' || raw === 'docx') {
              return raw;
            }
            return 'md';
          })(),
          updatedAt: recoveredArtifact.updatedAt,
        });

        toolPageSnapshot.context.briefingActorRef?.send({
          type: 'EXTRACTION_RECOVERED',
          artifactId: recoveredArtifact.artifactId,
          payload: extractionPayload,
        });
      } catch {
        // No-op: preserve current UI, user can still upload briefing manually.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    auth.apiBaseUrl,
    auth.capabilities,
    generation,
    generation.artifacts,
    normalizedProjectId,
    resolvedBriefingId,
    sourceArtifactId,
    sourceExtractionArtifactId,
    sourceArtifact,
    toolKey,
    toolPageSnapshot.context.briefingActorRef,
  ]);

  useEffect(() => {
    if (previousProjectIdRef.current === normalizedProjectId) {
      return;
    }

    toolPageSend({ type: 'PROJECT_SELECTED', projectId: normalizedProjectId });
    previousProjectIdRef.current = normalizedProjectId;
  }, [normalizedProjectId, toolPageSend]);

  const extractionContext = generation.getExtractionContext(normalizedProjectId)
    ?? (sourceArtifact ? buildExtractionContextFromArtifact(sourceArtifact) : null);

  const effectiveBriefingFileName = briefingFileNameFromActor
    ?? briefingFileName
    ?? readInputString(sourceArtifact, 'briefingFileName');

  const effectiveBriefingStatus = (
    briefingStatus === 'ready' || extractionContext
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

  const lastCheckpointStep = useMemo(() => {
    if (pausedCheckpointStep && nextAvailableStep) {
      return pausedCheckpointStep;
    }

    return progressState.lastCheckpointStep;
  }, [nextAvailableStep, pausedCheckpointStep, progressState.lastCheckpointStep]);

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
    intent,
    formState: {
      ...formState,
      briefingStatus: effectiveBriefingStatus,
      briefingFileName: effectiveBriefingFileName ?? null,
      briefingError,
      briefingFile,
    },
    isGenerationStreamActive: generation.isStreamActive,
    completedSteps: completedStepsForFlow,
    currentRunningStep,
    hasCompletedPreviousGeneration: completedStepsForFlow.size > 0,
    lastCheckpointStep,
    nextAvailableStep,
    generationError: generation.streamStatus === 'failed' ? 'Generation failed' : null,
    hasStartedCurrentRun: currentRunPrefixRef.current !== null,
  });

  const primaryTargetStep = useMemo(() => {
    if (uiState.primaryActionPolicy === 'resume-checkpoint' && pausedCheckpointStep) {
      return pausedCheckpointStep;
    }

    if (uiState.primaryActionPolicy === 'regenerate-current-step') {
      return sourceStep ?? nextAvailableStep;
    }

    if (uiState.primaryActionPolicy === 'start-generation' || uiState.primaryActionPolicy === 'resume-checkpoint') {
      return nextAvailableStep;
    }

    return null;
  }, [nextAvailableStep, pausedCheckpointStep, sourceStep, uiState.primaryActionPolicy]);

  const canStartFlow = Boolean(
    normalizedProjectId
    && extractionContext
    && primaryTargetStep,
  );

  // 8. Sync progress into toolPageMachine context and consume a single selector.
  useEffect(() => {
    toolPageSend({
      type: 'PROGRESS_SYNCED',
      artifacts: allArtifacts,
      intent,
      sourceArtifact,
      runRequestPrefix: currentRunPrefixRef.current,
      canStartFlow,
    });
  }, [allArtifacts, canStartFlow, intent, sourceArtifact, toolPageSend]);

  // 10. Build project and step lists
  const currentProject = projects.find((p) => p.id === formState.projectId);

  // 11. Handle generation start and chaining
  const startGenerationStep = (step: ToolStep): boolean => {
    if (!auth.session || !normalizedProjectId || !extractionContext) {
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
      canStartFlow: true,
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
        briefingId: extractionContext.briefingId || resolvedBriefingId,
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

  const openLatestArtifact = (): void => {
    const latestArtifactId = [...toolConfig.steps]
      .reverse()
      .map((step) => latestArtifactByStep[step]?.artifactId)
      .find((artifactId): artifactId is string => typeof artifactId === 'string' && artifactId.length > 0);

    if (latestArtifactId) {
      void navigate(`/artifacts/${latestArtifactId}`);
    }
  };

  const handlePrimaryAction = (): void => {
    if (uiState.primaryActionPolicy === 'open-last-artifact') {
      openLatestArtifact();
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
      canStartFlow: false,
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
              briefingError={briefingError}
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