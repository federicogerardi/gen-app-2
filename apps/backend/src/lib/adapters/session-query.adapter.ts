import type { ArtifactQueryRepository } from './postgres-redis.interfaces';
import { normalizeToolWorkflowKey } from '../runtime/workflow-normalizers';
import type {
  ArtifactDetail,
  ArtifactReadProjection,
  SessionListCursor,
  SessionListEntry,
} from '../types/artifacts';

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
  model?: string | null;
  modelSource?: 'user-selection' | 'step-override' | null;
  overrideReason?: string | null;
};

export type SessionArtifactGroup = {
  sessionId: string;
  toolKey: string | null;
  status: 'generating' | 'completed' | 'failed';
  artifacts: SessionArtifactEntry[];
};

export type { SessionListEntry };

export type SessionListPage = {
  sessions: SessionListEntry[];
  nextCursor: string | null;
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

type ModelResolutionMetadata = {
  modelSource: 'user-selection' | 'step-override';
  overrideReason?: string;
};

const readModelResolution = (input: Record<string, unknown>): ModelResolutionMetadata | null => {
  const candidate = input.modelResolution;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const resolution = candidate as Record<string, unknown>;
  const modelSource = resolution.modelSource;

  if (modelSource !== 'user-selection' && modelSource !== 'step-override') {
    return null;
  }

  const overrideReason = typeof resolution.overrideReason === 'string'
    ? resolution.overrideReason
    : undefined;

  return {
    modelSource,
    ...(overrideReason ? { overrideReason } : {}),
  };
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

  private mapDetailToSessionArtifactEntry(artifact: ArtifactDetail): SessionArtifactEntry {
    const toolWorkflow = readToolWorkflow(artifact.input);
    const stepFromInput = readString(toolWorkflow.stepKey) ?? readString(artifact.input.step);
    const toolKeyFromInput = readString(toolWorkflow.toolKey) ?? readString(artifact.input.toolKey);
    const toolKeyFromWorkflow = deriveToolKeyFromWorkflowType(artifact.workflowType);

    // Extract model resolution metadata from input
    const modelResolution = readModelResolution(artifact.input);

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
      model: artifact.model,
      modelSource: modelResolution?.modelSource ?? null,
      overrideReason: modelResolution?.overrideReason ?? null,
    };
  }

  static encodeCursor(cursor: SessionListCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf-8').toString('base64url');
  }

  static decodeCursor(cursor: string): SessionListCursor | null {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
      const parsed = JSON.parse(decoded) as Record<string, unknown>;
      if (typeof parsed.updatedAt !== 'string' || typeof parsed.sessionId !== 'string') {
        return null;
      }

      if (parsed.updatedAt.trim().length === 0 || parsed.sessionId.trim().length === 0) {
        return null;
      }

      if (Number.isNaN(Date.parse(parsed.updatedAt))) {
        return null;
      }

      return {
        updatedAt: parsed.updatedAt,
        sessionId: parsed.sessionId,
      };
    } catch {
      return null;
    }
  }

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
      .map((artifact) => this.mapDetailToSessionArtifactEntry(artifact))
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

  async fetchSessionsList(
    userId: string,
    projectId: string | null,
    options: { limit?: number; cursor?: string | null } = {},
  ): Promise<SessionListPage> {
    const decodedCursor = options.cursor
      ? SessionQueryAdapter.decodeCursor(options.cursor)
      : null;

    const page = await this.artifactQueries.listSessionSummaries(userId, projectId, {
      ...(typeof options.limit === 'number' ? { limit: options.limit } : {}),
      ...(decodedCursor ? { cursor: decodedCursor } : {}),
    });

    return {
      sessions: page.entries,
      nextCursor: page.nextCursor ? SessionQueryAdapter.encodeCursor(page.nextCursor) : null,
    };
  }

  async fetchStepArtifact(
    sessionId: string,
    stepKey: string,
    userId: string,
    projection: ArtifactReadProjection = {},
  ): Promise<SessionArtifactEntry | null> {
    const normalizedSessionId = sessionId.trim();
    if (normalizedSessionId.length === 0) {
      return null;
    }

    const normalizedStepKey = stepKey.trim();
    if (normalizedStepKey.length === 0) {
      return null;
    }

    const detail = await this.artifactQueries.getArtifactDetailBySessionStep(
      userId,
      normalizedSessionId,
      normalizedStepKey,
      projection,
    );

    return detail ? this.mapDetailToSessionArtifactEntry(detail) : null;
  }
}
