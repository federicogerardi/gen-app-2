import type { ArtifactStatus, ArtifactType } from './artifact';

export type ArtifactListFilters = {
  type?: ArtifactType;
  status?: ArtifactStatus;
  projectId?: string;
  from?: string;
  to?: string;
};

export type ArtifactSummary = {
  artifactId: string;
  requestId: string;
  projectId: string;
  artifactType: ArtifactType;
  status: ArtifactStatus;
  model: string;
  workflowType: string | null;
  createdAt: string;
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
  project_id: string | null;
  type: string;
  status: string;
  model: string;
  workflow_type: string | null;
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
    projectId: row.project_id ?? '',
    artifactType: toArtifactType(row.type),
    status: toArtifactStatus(row.status),
    model: row.model,
    workflowType: row.workflow_type,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
};

export const mapArtifactRowToDetail = (row: ArtifactRow): ArtifactDetail => {
  return {
    ...mapArtifactRowToSummary(row),
    userId: row.user_id,
    input: row.input_json ?? {},
    content: row.content,
    failureReason: row.failure_reason,
  };
};
