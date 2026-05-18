import type { ArtifactStatus, ArtifactType } from './artifact';

export type ArtifactListFilters = {
  type?: ArtifactType;
  status?: ArtifactStatus;
  projectId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
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
  workflowType: string | null;
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
  failureReason: string | null;
};

type ArtifactRow = {
  id: string;
  request_id: string;
  user_id: string | null;
  user_email?: string | null;
  project_id: string | null;
  type: string;
  status: string;
  model: string;
  workflow_type: string | null;
  session_id?: string | null;
  step_key?: string | null;
  artifact_role?: string | null;
  run_mode?: string | null;
  input_json: Record<string, unknown> | null;
  content: string;
  failure_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const toIso = (value: Date | string): string => {
  return typeof value === 'string' ? value : value.toISOString();
};

const toArtifactType = (value: string): ArtifactType => {
  if (value === 'seo' || value === 'code' || value === 'extraction') {
    return value;
  }

  return 'content';
};

const toArtifactStatus = (value: string): ArtifactStatus => {
  if (value === 'generating' || value === 'failed') {
    return value;
  }

  return 'completed';
};

export const mapArtifactRowToSummary = (row: ArtifactRow): ArtifactSummary => {
  return {
    artifactId: row.id,
    requestId: row.request_id,
    userId: row.user_id,
    userEmail: row.user_email ?? null,
    projectId: row.project_id ?? '',
    artifactType: toArtifactType(row.type),
    status: toArtifactStatus(row.status),
    model: row.model,
    workflowType: row.workflow_type,
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
    content: row.content,
    failureReason: row.failure_reason,
  };
};
