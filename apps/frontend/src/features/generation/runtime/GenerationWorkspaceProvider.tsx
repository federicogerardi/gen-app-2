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

export type { ExtractionContext };
import type { GenerationRequest } from '../contracts/backend-stream';
import type { ToolCheckpoint } from '../ui/tool-checkpoints';
import { buildRelaunchRequest, type GenerationArtifact } from '../ui/artifact-history';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { listArtifacts } from '../../artifacts/runtime/artifacts-client';

const readInputString = (request: GenerationRequest, key: string): string | null => {
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

export type GenerationArtifactsWorkspaceValue = {
  artifacts: GenerationArtifact[];
  reloadArtifacts: () => void;
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

const useGenerationArtifactsState = (
  auth: ReturnType<typeof useAuthSession>,
  snapshot: FrontendStreamSnapshot,
  send: FrontendStreamSend,
  streamStatus: FrontendStreamStatus,
) => {
  const [liveArtifacts, setLiveArtifacts] = useState<GenerationArtifact[]>([]);
  const [persistedArtifacts, setPersistedArtifacts] = useState<GenerationArtifact[]>([]);

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
      contentPreview: snapshot.context.content.slice(0, 240),
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
        return [nextArtifact, ...prev].slice(0, 200);
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
  }, [auth.session]);

  const reloadPersistedArtifacts = useCallback(() => {
    if (!auth.session) {
      return;
    }

    void listArtifacts(
      { type: 'all', status: 'all', projectId: 'all' },
      { apiBaseUrl: auth.apiBaseUrl, capabilities: auth.capabilities },
    )
      .then((fetched) => {
        setPersistedArtifacts(
          fetched.artifacts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        );
      })
      .catch(() => {
        // silently ignore — dashboard will show in-memory artifacts as fallback
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
  } satisfies GenerationArtifactsWorkspaceValue;
};

const useGenerationProjectState = (
  snapshot: FrontendStreamSnapshot,
  send: FrontendStreamSend,
) => {
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);

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
  const [snapshot, send] = useMachine(frontendStreamMachine, {
    input: {
      apiBaseUrl: auth.apiBaseUrl,
      maxReconnectAttempts: 3,
      reconnectBaseDelayMs: 500,
      reconnectMaxDelayMs: 4000,
    },
  });

  const streamStatus = getStreamStatus(snapshot);

  useEffect(() => {
    if (auth.session) {
      return;
    }

    send({ type: 'RESET' });
  }, [auth.session, send]);

  const streamValue = useMemo<GenerationStreamWorkspaceValue>(
    () => ({
      snapshot,
      streamStatus,
      isStreamActive: snapshot.matches('active'),
      terminalCompletedStep: snapshot.context.terminalCompletedStep,
      terminalFailedStep: snapshot.context.terminalFailedStep,
      checkpoints: snapshot.context.checkpoints,
      start: (request) => send({ type: 'REQUEST_START', request }),
      retry: () => send({ type: 'RETRY' }),
      cancel: () => send({ type: 'CANCEL' }),
      reset: () => send({ type: 'RESET' }),
      relaunch: (artifact) => {
        const nextRequest = buildRelaunchRequest(artifact);
        send({ type: 'REQUEST_START', request: nextRequest });
      },
    }),
    [send, snapshot, streamStatus],
  );

  const artifactsValue = useGenerationArtifactsState(auth, snapshot, send, streamStatus);
  const projectValue = useGenerationProjectState(snapshot, send);

  const value = useMemo<GenerationWorkspaceValue>(
    () => ({
      ...streamValue,
      ...artifactsValue,
      ...projectValue,
    }),
    [artifactsValue, projectValue, streamValue],
  );

  return (
    <GenerationWorkspaceContext value={value}>
      <GenerationStreamWorkspaceContext value={streamValue}>
        <GenerationArtifactsWorkspaceContext value={artifactsValue}>
          <GenerationProjectWorkspaceContext value={projectValue}>
            {children}
          </GenerationProjectWorkspaceContext>
        </GenerationArtifactsWorkspaceContext>
      </GenerationStreamWorkspaceContext>
    </GenerationWorkspaceContext>
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
