import type { ArtifactQueryRepository } from './postgres-redis.interfaces';
import { normalizeToolWorkflowKey } from '../runtime/workflow-normalizers';
import type { ArtifactReadProjection, SessionListEntry } from '../types/artifacts';

export type SessionArtifactEntry = {
  artifactId: string;
  requestId: string;
  projectId: string;
  stepKey: string | null;
  artifactRole: 'step' | 'final' | null;
  runMode: 'new' | 'resume' | 'regenerate' | null;
  status: 'generating' | 'completed' | 'failed';
  content: string;
  failureReason: string | null;
  updatedAt: string;
  workflowType: string | null;
  toolKey: string | null;
};

export type SessionArtifactGroup = {
  sessionId: string;
  toolKey: string | null;
  status: 'generating' | 'completed' | 'failed';
  artifacts: SessionArtifactEntry[];
};

export type { SessionListEntry };

const readToolWorkflow = (input: Record<string, unknown>): Record<string, unknown> => {
  const candidate = input.toolWorkflow;
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    return candidate as Record<string, unknown>;
  }

  return {};
};

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const readArtifactRole = (value: unknown): 'step' | 'final' | null => {
  return value === 'step' || value === 'final' ? value : null;
};

const readRunMode = (value: unknown): 'new' | 'resume' | 'regenerate' | null => {
  return value === 'new' || value === 'resume' || value === 'regenerate' ? value : null;
};

const deriveGroupStatus = (artifacts: SessionArtifactEntry[]): 'generating' | 'completed' | 'failed' => {
  if (artifacts.some((artifact) => artifact.status === 'generating')) {
    return 'generating';
  }

  if (artifacts.some((artifact) => artifact.status === 'failed')) {
    return 'failed';
  }

  return 'completed';
};

const deriveToolKeyFromWorkflowType = (workflowType: string | null): string | null => {
  return normalizeToolWorkflowKey(workflowType);
};

export class SessionQueryAdapter {
  constructor(private readonly artifactQueries: ArtifactQueryRepository) {}

  async fetchSessionArtifacts(
    sessionId: string,
    userId: string,
    projection: ArtifactReadProjection = {},
  ): Promise<SessionArtifactGroup | null> {
    const normalizedSessionId = sessionId.trim();
    if (normalizedSessionId.length === 0) {
      return null;
    }

    const details = await this.artifactQueries.listArtifactDetailsBySession(
      userId,
      normalizedSessionId,
      projection,
    );

    if (details.length === 0) {
      return null;
    }

    const artifacts: SessionArtifactEntry[] = details
      .map((artifact) => {
        const toolWorkflow = readToolWorkflow(artifact.input);
        const stepFromInput = readString(toolWorkflow.stepKey) ?? readString(artifact.input.step);
        const toolKeyFromInput = readString(toolWorkflow.toolKey) ?? readString(artifact.input.toolKey);
        const toolKeyFromWorkflow = deriveToolKeyFromWorkflowType(artifact.workflowType);

        return {
          artifactId: artifact.artifactId,
          requestId: artifact.requestId,
          projectId: artifact.projectId,
          stepKey: artifact.stepKey ?? stepFromInput,
          artifactRole: artifact.artifactRole ?? readArtifactRole(toolWorkflow.artifactRole),
          runMode: artifact.runMode ?? readRunMode(toolWorkflow.runMode),
          status: artifact.status,
          content: artifact.content,
          failureReason: artifact.failureReason,
          updatedAt: artifact.updatedAt,
          workflowType: artifact.workflowType,
          toolKey: toolKeyFromInput ?? toolKeyFromWorkflow,
        };
      })
      .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));

    if (artifacts.length === 0) {
      return null;
    }

    return {
      sessionId: normalizedSessionId,
      toolKey: artifacts[0]?.toolKey ?? null,
      status: deriveGroupStatus(artifacts),
      artifacts,
    };
  }

  async fetchSessionsList(userId: string, projectId: string | null): Promise<SessionListEntry[]> {
    return this.artifactQueries.listSessionSummaries(userId, projectId);
  }

  async fetchStepArtifact(
    sessionId: string,
    stepKey: string,
    userId: string,
    projection: ArtifactReadProjection = {},
  ): Promise<SessionArtifactEntry | null> {
    const group = await this.fetchSessionArtifacts(sessionId, userId, projection);
    if (!group) {
      return null;
    }

    const normalizedStepKey = stepKey.trim();
    if (normalizedStepKey.length === 0) {
      return null;
    }

    const match = group.artifacts.find((artifact) => artifact.stepKey === normalizedStepKey);
    return match ?? null;
  }
}
