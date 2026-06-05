import { useMachine } from '@xstate/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from 'react';
import {
  frontendStreamMachine,
  type FrontendStreamStatus,
  type ExtractionContext,
} from '../machines/frontend-stream.machine';
import {
  frontendGenerationMachine,
  type FrontendGenerationStatus,
} from '../machines/frontend-generation.machine';

export type { ExtractionContext };
import type { GenerationRequest } from '../contracts/backend-stream';
import type { ToolCheckpoint } from '../ui/tool-checkpoints';
import { STREAM_CONFIG } from '../../../app/config/stream-config';
import { UI_CONFIG } from '../../../app/config/ui-config';
import { buildRelaunchRequest, type GenerationArtifact } from '../ui/artifact-history';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { listArtifactsPaginated } from '../../artifacts/runtime/artifacts-client';

const readInputString = (
  request: GenerationRequest,
  key: 'briefingFileName' | 'sourceArtifactId',
): string | null => {
  const value = request.input[key];
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const getStreamStatus = (
  snapshot: ReturnType<typeof frontendStreamMachine.transition>,
): FrontendStreamStatus => {
  if (snapshot.matches('idle')) {
    return 'idle';
  }

  if (snapshot.matches({ active: 'connecting' })) {
    return 'connecting';
  }

  if (snapshot.matches({ active: 'streaming' })) {
    return 'streaming';
  }

  if (snapshot.matches({ active: 'reconnecting' })) {
    return 'reconnecting';
  }

  if (snapshot.matches('completed')) {
    return 'completed';
  }

  return 'failed';
};

export type GenerationGenerationWorkspaceValue = {
  snapshot: ReturnType<typeof frontendGenerationMachine.transition>;
  generationStatus: FrontendGenerationStatus;
  isGenerationActive: boolean;
  startRun: (request: GenerationRequest) => void;
  resetRun: () => void;
};

export type GenerationStreamWorkspaceValue = {
  snapshot: ReturnType<typeof frontendStreamMachine.transition>;
  streamStatus: FrontendStreamStatus;
  isStreamActive: boolean;
  terminalCompletedStep: string | null;
  terminalFailedStep: string | null;
  checkpoints: ToolCheckpoint[];
  start: (request: GenerationRequest) => void;
  retry: () => void;
  cancel: () => void;
  reset: () => void;
  relaunch: (artifact: GenerationArtifact) => void;
};

type FrontendStreamSnapshot = ReturnType<typeof frontendStreamMachine.transition>;
type FrontendStreamEvent = Parameters<typeof frontendStreamMachine.transition>[1];
type FrontendStreamSend = (event: FrontendStreamEvent) => void;
type FrontendGenerationSnapshot = ReturnType<typeof frontendGenerationMachine.transition>;

export type GenerationArtifactsWorkspaceValue = {
  artifacts: GenerationArtifact[];
  reloadArtifacts: () => void;
  artifactsReloadError: string | null;
};

export type GenerationProjectWorkspaceValue = {
  focusedProjectId: string | null;
  extractionByProject: Record<string, ExtractionContext>;
  setFocusedProjectId: (projectId: string | null) => void;
  upsertExtractionContext: (context: ExtractionContext) => void;
  getExtractionContext: (projectId: string) => ExtractionContext | null;
};

type GenerationWorkspaceValue =
  & GenerationStreamWorkspaceValue
  & GenerationArtifactsWorkspaceValue
  & GenerationProjectWorkspaceValue;

const GenerationWorkspaceContext = createContext<GenerationWorkspaceValue | null>(null);
const GenerationStreamWorkspaceContext = createContext<GenerationStreamWorkspaceValue | null>(null);
const GenerationArtifactsWorkspaceContext = createContext<GenerationArtifactsWorkspaceValue | null>(
  null,
);
const GenerationProjectWorkspaceContext = createContext<GenerationProjectWorkspaceValue | null>(null);
const GenerationGenerationWorkspaceContext = createContext<GenerationGenerationWorkspaceValue | null>(null);

const useGenerationArtifactsState = (
  auth: ReturnType<typeof useAuthSession>,
  snapshot: FrontendStreamSnapshot,
  send: FrontendStreamSend,
  streamStatus: FrontendStreamStatus,
) => {
  const [liveArtifacts, setLiveArtifacts] = useState<GenerationArtifact[]>([]);
  const [persistedArtifacts, setPersistedArtifacts] = useState<GenerationArtifact[]>([]);
  const [artifactsReloadError, setArtifactsReloadError] = useState<string | null>(null);

  useEffect(() => {
    const artifactId = snapshot.context.artifactId;
    const request = snapshot.context.lastRequest;
    if (!artifactId || !request) {
      return;
    }

    const checkpointStatus: ToolCheckpoint['status'] = (() => {
      if (streamStatus === 'completed') {
        return 'completed';
      }

      if (streamStatus === 'failed') {
        return snapshot.context.content.trim().length > 0 ? 'completed_partial' : 'failed_hard';
      }

      return 'generating';
    })();

    const extractionContextAvailable =
      readInputString(request, 'briefingFileName') !== null
      || readInputString(request, 'sourceArtifactId') !== null;

    const nextCheckpoint: ToolCheckpoint = {
      artifactId,
      projectId: request.projectId,
      status: checkpointStatus,
      extractionContextAvailable,
      model: request.model,
      workflowType: request.workflowType ?? null,
      toolKey: request.toolKey ?? null,
      contentPreview: snapshot.context.content.slice(0, UI_CONFIG.preview.contentPreviewMaxLength),
      updatedAt: new Date().toISOString(),
    };

    send({ type: 'CHECKPOINT_UPSERTED', checkpoint: nextCheckpoint });

    setLiveArtifacts((prev) => {
      const nowIso = new Date().toISOString();
      const artifactStatus: GenerationArtifact['status'] = (() => {
        if (streamStatus === 'completed') {
          return 'completed';
        }

        if (streamStatus === 'failed') {
          return 'failed';
        }

        return 'generating';
      })();

      const existingIndex = prev.findIndex((item) => item.artifactId === artifactId);
      const createdAt = existingIndex >= 0 ? prev[existingIndex]?.createdAt ?? nowIso : nowIso;
      const nextArtifact: GenerationArtifact = {
        artifactId,
        requestId: request.requestId,
        projectId: request.projectId,
        artifactType: request.artifactType,
        status: artifactStatus,
        model: request.model,
        toolKey: request.toolKey ?? null,
        workflowType: request.workflowType ?? null,
        content: snapshot.context.content,
        createdAt,
        updatedAt: nowIso,
        sourceRequest: request,
      };

      if (existingIndex === -1) {
        return [nextArtifact, ...prev].slice(0, UI_CONFIG.limits.maxLocalArtifactsCache);
      }

      const clone = [...prev];
      clone[existingIndex] = nextArtifact;
      return clone;
    });
  }, [
    send,
    snapshot.context.artifactId,
    snapshot.context.content,
    snapshot.context.lastRequest,
    streamStatus,
  ]);

  useEffect(() => {
    if (auth.session) {
      return;
    }

    setLiveArtifacts([]);
    setPersistedArtifacts([]);
    setArtifactsReloadError(null);
  }, [auth.session]);

  const reloadPersistedArtifacts = useCallback(() => {
    if (!auth.session) {
      return;
    }

    setArtifactsReloadError(null);

    void listArtifactsPaginated(
      { type: 'all', status: 'all', projectId: 'all' },
      { apiBaseUrl: auth.apiBaseUrl, capabilities: auth.capabilities },
    )
      .then((fetched) => {
        setArtifactsReloadError(null);
        setPersistedArtifacts(
          fetched.artifacts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        );
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : 'Unable to reload artifacts';
        setArtifactsReloadError(message);
      });
  }, [auth.apiBaseUrl, auth.capabilities, auth.session]);

  useEffect(() => {
    reloadPersistedArtifacts();
  }, [reloadPersistedArtifacts]);

  const artifacts = useMemo<GenerationArtifact[]>(() => {
    const inMemoryIds = new Set(liveArtifacts.map((artifact) => artifact.artifactId));
    const dbOnly = persistedArtifacts.filter((artifact) => !inMemoryIds.has(artifact.artifactId));
    return [...liveArtifacts, ...dbOnly].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [liveArtifacts, persistedArtifacts]);

  return {
    artifacts,
    reloadArtifacts: reloadPersistedArtifacts,
    artifactsReloadError,
  } satisfies GenerationArtifactsWorkspaceValue;
};

const useGenerationProjectState = (
  auth: ReturnType<typeof useAuthSession>,
  snapshot: FrontendStreamSnapshot,
  send: FrontendStreamSend,
) => {
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.session) {
      setFocusedProjectId(null);
    }
  }, [auth.session]);

  const upsertExtractionContext = useCallback(
    (context: ExtractionContext) => {
      send({ type: 'EXTRACTION_UPSERTED', context });
    },
    [send],
  );

  const getExtractionContext = useCallback(
    (projectId: string): ExtractionContext | null => {
      const normalized = projectId.trim();
      if (!normalized) {
        return null;
      }

      return snapshot.context.extractionByProject[normalized] ?? null;
    },
    [snapshot.context.extractionByProject],
  );

  return {
    focusedProjectId,
    extractionByProject: snapshot.context.extractionByProject,
    setFocusedProjectId,
    upsertExtractionContext,
    getExtractionContext,
  } satisfies GenerationProjectWorkspaceValue;
};

export const GenerationWorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuthSession();
  const [streamSnapshot, streamSend] = useMachine(frontendStreamMachine, {
    input: {
      apiBaseUrl: auth.apiBaseUrl,
      maxReconnectAttempts: STREAM_CONFIG.reconnect.maxAttempts,
      reconnectBaseDelayMs: STREAM_CONFIG.reconnect.baseDelayMs,
      reconnectMaxDelayMs: STREAM_CONFIG.reconnect.maxDelayMs,
    },
  });
  const [generationSnapshot, generationSend] = useMachine(frontendGenerationMachine, {
    input: {
      apiBaseUrl: auth.apiBaseUrl,
    },
  });

  const streamStatus = getStreamStatus(streamSnapshot);

  const getGenerationStatus = (
    snapshot: FrontendGenerationSnapshot,
  ): FrontendGenerationStatus => {
    if (snapshot.matches('idle')) return 'idle';
    if (snapshot.matches('running')) return 'running';
    if (snapshot.matches('completed')) return 'completed';
    return 'failed';
  };

  const generationStatus = getGenerationStatus(generationSnapshot);

  useEffect(() => {
    if (auth.session) {
      return;
    }

    streamSend({ type: 'RESET' });
    generationSend({ type: 'RESET' });
  }, [auth.session, streamSend, generationSend]);

  const streamValue = useMemo<GenerationStreamWorkspaceValue>(
    () => ({
      snapshot: streamSnapshot,
      streamStatus,
      isStreamActive: streamSnapshot.matches('active'),
      terminalCompletedStep: streamSnapshot.context.terminalCompletedStep,
      terminalFailedStep: streamSnapshot.context.terminalFailedStep,
      checkpoints: streamSnapshot.context.checkpoints,
      start: (request) => streamSend({ type: 'REQUEST_START', request }),
      retry: () => streamSend({ type: 'RETRY' }),
      cancel: () => streamSend({ type: 'CANCEL' }),
      reset: () => streamSend({ type: 'RESET' }),
      relaunch: (artifact) => {
        const nextRequest = buildRelaunchRequest(artifact);
        streamSend({ type: 'REQUEST_START', request: nextRequest });
      },
    }),
    [streamSend, streamSnapshot, streamStatus],
  );

  const generationValue = useMemo<GenerationGenerationWorkspaceValue>(
    () => ({
      snapshot: generationSnapshot,
      generationStatus,
      isGenerationActive: generationSnapshot.matches('running'),
      startRun: (request) => generationSend({ type: 'REQUEST_START', request }),
      resetRun: () => generationSend({ type: 'RESET' }),
    }),
    [generationSend, generationSnapshot, generationStatus],
  );

  const artifactsValue = useGenerationArtifactsState(auth, streamSnapshot, streamSend, streamStatus);
  const projectValue = useGenerationProjectState(auth, streamSnapshot, streamSend);

  const value = useMemo<GenerationWorkspaceValue>(
    () => ({
      ...streamValue,
      ...artifactsValue,
      ...projectValue,
    }),
    [artifactsValue, projectValue, streamValue],
  );

  return (
    <GenerationWorkspaceContext.Provider value={value}>
      <GenerationStreamWorkspaceContext.Provider value={streamValue}>
        <GenerationArtifactsWorkspaceContext.Provider value={artifactsValue}>
          <GenerationProjectWorkspaceContext.Provider value={projectValue}>
            <GenerationGenerationWorkspaceContext.Provider value={generationValue}>
              {children}
            </GenerationGenerationWorkspaceContext.Provider>
          </GenerationProjectWorkspaceContext.Provider>
        </GenerationArtifactsWorkspaceContext.Provider>
      </GenerationStreamWorkspaceContext.Provider>
    </GenerationWorkspaceContext.Provider>
  );
};

const useRequiredContext = <TValue,>(
  context: Context<TValue | null>,
  hookName: string,
): TValue => {
  const value = useContext(context);
  if (!value) {
    throw new Error(`${hookName} must be used inside GenerationWorkspaceProvider`);
  }

  return value;
};

export const useGenerationStreamWorkspace = (): GenerationStreamWorkspaceValue =>
  useRequiredContext(GenerationStreamWorkspaceContext, 'useGenerationStreamWorkspace');

export const useGenerationArtifactsWorkspace = (): GenerationArtifactsWorkspaceValue =>
  useRequiredContext(GenerationArtifactsWorkspaceContext, 'useGenerationArtifactsWorkspace');

export const useGenerationProjectWorkspace = (): GenerationProjectWorkspaceValue =>
  useRequiredContext(GenerationProjectWorkspaceContext, 'useGenerationProjectWorkspace');

export const useGenerationWorkspace = (): GenerationWorkspaceValue =>
  useRequiredContext(GenerationWorkspaceContext, 'useGenerationWorkspace');

export const useGenerationGenerationWorkspace = (): GenerationGenerationWorkspaceValue =>
  useRequiredContext(GenerationGenerationWorkspaceContext, 'useGenerationGenerationWorkspace');
