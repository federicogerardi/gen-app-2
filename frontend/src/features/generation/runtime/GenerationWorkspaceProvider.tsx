import { useMachine } from '@xstate/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { frontendStreamMachine, type FrontendStreamStatus, type ExtractionContext } from '../machines/frontend-stream.machine';

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

type GenerationWorkspaceValue = {
  snapshot: ReturnType<typeof frontendStreamMachine.transition>;
  streamStatus: FrontendStreamStatus;
  isStreamActive: boolean;
  terminalCompletedStep: string | null;
  terminalFailedStep: string | null;
  checkpoints: ToolCheckpoint[];
  artifacts: GenerationArtifact[];
  focusedProjectId: string | null;
  extractionByProject: Record<string, ExtractionContext>;
  setFocusedProjectId: (projectId: string | null) => void;
  upsertExtractionContext: (context: ExtractionContext) => void;
  getExtractionContext: (projectId: string) => ExtractionContext | null;
  start: (request: GenerationRequest) => void;
  retry: () => void;
  cancel: () => void;
  reset: () => void;
  relaunch: (artifact: GenerationArtifact) => void;
  reloadArtifacts: () => void;
};

const GenerationWorkspaceContext = createContext<GenerationWorkspaceValue | null>(null);

export const GenerationWorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuthSession();
  const [artifacts, setArtifacts] = useState<GenerationArtifact[]>([]);
  const [persistedArtifacts, setPersistedArtifacts] = useState<GenerationArtifact[]>([]);
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);

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

    setArtifacts((prev) => {
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
    snapshot.context.artifactId,
    snapshot.context.content,
    snapshot.context.lastRequest,
    streamStatus,
  ]);

  useEffect(() => {
    if (auth.session) {
      return;
    }

    send({ type: 'RESET' });
    setFocusedProjectId(null);
    setPersistedArtifacts([]);
  }, [auth.session, send]);

  const reloadPersistedArtifacts = useCallback(() => {
    if (!auth.session) {
      return;
    }

    void listArtifacts(
      { type: 'all', status: 'all', projectId: 'all' },
      { apiBaseUrl: auth.apiBaseUrl, capabilities: auth.capabilities },
    ).then((fetched) => {
      setPersistedArtifacts(fetched.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    }).catch(() => {
      // silently ignore — dashboard will show in-memory artifacts as fallback
    });
  }, [auth.apiBaseUrl, auth.capabilities, auth.session]);

  useEffect(() => {
    reloadPersistedArtifacts();
  }, [reloadPersistedArtifacts]);

  // Merge persisted (DB) artifacts with in-memory stream artifacts.
  // In-memory entries take precedence (they're the live/most-recent version).
  const mergedArtifacts = useMemo<GenerationArtifact[]>(() => {
    const inMemoryIds = new Set(artifacts.map((a) => a.artifactId));
    const dbOnly = persistedArtifacts.filter((a) => !inMemoryIds.has(a.artifactId));
    return [...artifacts, ...dbOnly].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [artifacts, persistedArtifacts]);

  const value = useMemo<GenerationWorkspaceValue>(() => {
    return {
      snapshot,
      streamStatus,
      isStreamActive: snapshot.matches('active'),
      terminalCompletedStep: snapshot.context.terminalCompletedStep,
      terminalFailedStep: snapshot.context.terminalFailedStep,
      checkpoints: snapshot.context.checkpoints,
      artifacts: mergedArtifacts,
      focusedProjectId,
      extractionByProject: snapshot.context.extractionByProject,
      setFocusedProjectId,
      upsertExtractionContext: (context) => {
        send({ type: 'EXTRACTION_UPSERTED', context });
      },
      getExtractionContext: (projectId) => {
        const normalized = projectId.trim();
        if (!normalized) {
          return null;
        }

        return snapshot.context.extractionByProject[normalized] ?? null;
      },
      start: (request) => send({ type: 'REQUEST_START', request }),
      retry: () => send({ type: 'RETRY' }),
      cancel: () => send({ type: 'CANCEL' }),
      reset: () => send({ type: 'RESET' }),
      relaunch: (artifact) => {
        const nextRequest = buildRelaunchRequest(artifact);
        send({ type: 'REQUEST_START', request: nextRequest });
      },
      reloadArtifacts: reloadPersistedArtifacts,
    };
  }, [mergedArtifacts, focusedProjectId, reloadPersistedArtifacts, send, snapshot, streamStatus]);

  return (
    <GenerationWorkspaceContext value={value}>
      {children}
    </GenerationWorkspaceContext>
  );
};

export const useGenerationWorkspace = (): GenerationWorkspaceValue => {
  const value = useContext(GenerationWorkspaceContext);
  if (!value) {
    throw new Error('useGenerationWorkspace must be used inside GenerationWorkspaceProvider');
  }

  return value;
};
