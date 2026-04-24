import { useMachine } from '@xstate/react';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { frontendStreamMachine, type FrontendStreamStatus } from '../machines/frontend-stream.machine';
import type { GenerationRequest } from '../contracts/backend-stream';
import type { ToolCheckpoint } from '../ui/tool-checkpoints';
import { buildRelaunchRequest, type GenerationArtifact } from '../ui/artifact-history';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';

export type ToolExtractionContext = {
  projectId: string;
  briefingId: string;
  extractionArtifactId: string;
  extractionPayload: Record<string, unknown>;
  normalizedText: string;
  parsedFormat: 'txt' | 'md' | 'docx';
  updatedAt: string;
};

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
  checkpoints: ToolCheckpoint[];
  artifacts: GenerationArtifact[];
  focusedProjectId: string | null;
  extractionByProject: Record<string, ToolExtractionContext>;
  setFocusedProjectId: (projectId: string | null) => void;
  upsertExtractionContext: (context: ToolExtractionContext) => void;
  getExtractionContext: (projectId: string) => ToolExtractionContext | null;
  start: (request: GenerationRequest) => void;
  retry: () => void;
  cancel: () => void;
  reset: () => void;
  relaunch: (artifact: GenerationArtifact, mode: 'primary' | 'secondary') => void;
};

const GenerationWorkspaceContext = createContext<GenerationWorkspaceValue | null>(null);

export const GenerationWorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuthSession();
  const [checkpoints, setCheckpoints] = useState<ToolCheckpoint[]>([]);
  const [artifacts, setArtifacts] = useState<GenerationArtifact[]>([]);
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [extractionByProject, setExtractionByProject] = useState<Record<string, ToolExtractionContext>>({});

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

    setCheckpoints((prev) => {
      const index = prev.findIndex((item) => item.artifactId === nextCheckpoint.artifactId);
      if (index === -1) {
        return [nextCheckpoint, ...prev].slice(0, 100);
      }

      const clone = [...prev];
      clone[index] = nextCheckpoint;
      return clone;
    });

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
    setExtractionByProject({});
  }, [auth.session, send]);

  const value = useMemo<GenerationWorkspaceValue>(() => {
    return {
      snapshot,
      streamStatus,
      isStreamActive: snapshot.matches('active'),
      checkpoints,
      artifacts,
      focusedProjectId,
      extractionByProject,
      setFocusedProjectId,
      upsertExtractionContext: (context) => {
        setExtractionByProject((prev) => ({
          ...prev,
          [context.projectId]: context,
        }));
      },
      getExtractionContext: (projectId) => {
        const normalized = projectId.trim();
        if (!normalized) {
          return null;
        }

        return extractionByProject[normalized] ?? null;
      },
      start: (request) => send({ type: 'REQUEST_START', request }),
      retry: () => send({ type: 'RETRY' }),
      cancel: () => send({ type: 'CANCEL' }),
      reset: () => send({ type: 'RESET' }),
      relaunch: (artifact, mode) => {
        const nextRequest = buildRelaunchRequest(artifact, mode);
        send({ type: 'REQUEST_START', request: nextRequest });
      },
    };
  }, [artifacts, checkpoints, extractionByProject, focusedProjectId, send, snapshot, streamStatus]);

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
