import {
  normalizeArtifactFailureReason,
  normalizeArtifactStatus,
  normalizeArtifactType,
  normalizeToolWorkflow,
  type ArtifactFailureReason,
  type ArtifactStatus,
  type ArtifactType,
  type ToolWorkflow,
} from './artifact';

export type ArtifactListFilters = {
  type?: ArtifactType;
  status?: ArtifactStatus;
  projectId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type ArtifactReadProjection = {
  includeInput?: boolean;
  includeContent?: boolean;
};

export type ArtifactSummary = {
  artifactId: string;
  requestId: string;
  userId: string | null;
  userEmail?: string | null;
  projectId: string;
  artifactType: ArtifactType;
  status: ArtifactStatus;
  model: string;
  workflowType: ToolWorkflow | null;
  sessionId?: string | null;
  stepKey?: string | null;
  artifactRole?: 'step' | 'final' | null;
  runMode?: 'new' | 'resume' | 'regenerate' | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionListEntry = {
  sessionId: string;
  projectId: string;
  toolKey: string | null;
  status: 'generating' | 'completed' | 'failed';
  artifactCount: number;
  updatedAt: string;
};

export type ArtifactDetail = ArtifactSummary & {
  userId: string | null;
  input: Record<string, unknown>;
  content: string;
  failureReason: ArtifactFailureReason | null;
};

type ArtifactRow = {
  id: string;
  request_id: string;
  user_id: string | null;
  user_email?: string | null;
  project_id: string | null;
  type: unknown;
  status: unknown;
  model: string;
  workflow_type: unknown;
  session_id?: string | null;
  step_key?: string | null;
  artifact_role?: string | null;
  run_mode?: string | null;
  input_json?: Record<string, unknown> | null;
  content?: string | null;
  failure_reason?: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

const toIso = (value: Date | string): string => {
  return typeof value === 'string' ? value : value.toISOString();
};

export const mapArtifactRowToSummary = (row: ArtifactRow): ArtifactSummary => {
  return {
    artifactId: row.id,
    requestId: row.request_id,
    userId: row.user_id,
    userEmail: row.user_email ?? null,
    projectId: row.project_id ?? '',
    artifactType: normalizeArtifactType(row.type),
    status: normalizeArtifactStatus(row.status),
    model: row.model,
    workflowType: normalizeToolWorkflow(row.workflow_type),
    sessionId: row.session_id ?? null,
    stepKey: row.step_key ?? null,
    artifactRole:
      row.artifact_role === 'step' || row.artifact_role === 'final'
        ? row.artifact_role
        : null,
    runMode:
      row.run_mode === 'new' || row.run_mode === 'resume' || row.run_mode === 'regenerate'
        ? row.run_mode
        : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
};

export const mapArtifactRowToDetail = (row: ArtifactRow): ArtifactDetail => {
  return {
    ...mapArtifactRowToSummary(row),
    input: row.input_json ?? {},
    content: typeof row.content === 'string' ? row.content : '',
    failureReason: normalizeArtifactFailureReason(row.failure_reason),
  };
};
