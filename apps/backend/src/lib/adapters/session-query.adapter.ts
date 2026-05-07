import type { ArtifactQueryRepository } from './postgres-redis.interfaces';

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

export class SessionQueryAdapter {
  constructor(private readonly artifactQueries: ArtifactQueryRepository) {}

  async fetchSessionArtifacts(sessionId: string, userId: string): Promise<SessionArtifactGroup | null> {
    const normalizedSessionId = sessionId.trim();
    if (normalizedSessionId.length === 0) {
      return null;
    }

    const summaries = await this.artifactQueries.listArtifactsByUser(userId, {});
    const inSession = summaries.filter((artifact) => artifact.sessionId === normalizedSessionId);

    if (inSession.length === 0) {
      return null;
    }

    const details = await Promise.all(
      inSession.map(async (summary) => this.artifactQueries.getArtifactByIdForUser(userId, summary.artifactId)),
    );

    const artifacts: SessionArtifactEntry[] = details
      .filter((artifact): artifact is NonNullable<typeof artifact> => artifact !== null)
      .map((artifact) => {
        const toolWorkflow = readToolWorkflow(artifact.input);
        const stepFromInput = readString(toolWorkflow.stepKey) ?? readString(artifact.input.step);
        const toolKeyFromInput = readString(toolWorkflow.toolKey) ?? readString(artifact.input.toolKey);

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
          toolKey: toolKeyFromInput,
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

  async fetchStepArtifact(
    sessionId: string,
    stepKey: string,
    userId: string,
  ): Promise<SessionArtifactEntry | null> {
    const group = await this.fetchSessionArtifacts(sessionId, userId);
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
