export type ToolCheckpointStatus =
  | 'generating'
  | 'completed_partial'
  | 'completed'
  | 'failed_hard';

export type ToolCheckpoint = {
  artifactId: string;
  projectId: string;
  status: ToolCheckpointStatus;
  extractionContextAvailable: boolean;
  model: string;
  workflowType: string | null;
  toolKey: string | null;
  contentPreview: string;
  updatedAt: string;
};

const checkpointPriority: Record<ToolCheckpointStatus, number> = {
  generating: 0,
  completed_partial: 1,
  completed: 2,
  failed_hard: 3,
};

export const sortCheckpointsForResume = (
  checkpoints: ToolCheckpoint[],
): ToolCheckpoint[] => {
  return [...checkpoints].sort((a, b) => {
    const byPriority = checkpointPriority[a.status] - checkpointPriority[b.status];
    if (byPriority !== 0) {
      return byPriority;
    }

    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
};

export const selectBestCheckpointForProject = (
  checkpoints: ToolCheckpoint[],
  projectId: string,
): ToolCheckpoint | null => {
  const normalizedProjectId = projectId.trim();
  if (normalizedProjectId.length === 0) {
    return null;
  }

  const filtered = checkpoints.filter((checkpoint) => checkpoint.projectId === normalizedProjectId);
  if (filtered.length === 0) {
    return null;
  }

  return sortCheckpointsForResume(filtered)[0] ?? null;
};

/**
 * Select a checkpoint for a project with optional preferred checkpoint ID.
 * Consolidates the pattern of filtering by project, then selecting by ID or best match.
 * Returns the preferred checkpoint if ID provided and found, otherwise the best checkpoint for project,
 * or null if no checkpoints available or projectId empty.
 */
export const selectCheckpointForProject = (
  checkpoints: ToolCheckpoint[],
  projectId: string,
  preferredCheckpointId?: string,
): ToolCheckpoint | null => {
  const normalizedProjectId = projectId.trim();
  if (normalizedProjectId.length === 0) {
    return null;
  }

  const filtered = checkpoints.filter((checkpoint) => checkpoint.projectId === normalizedProjectId);
  if (filtered.length === 0) {
    return null;
  }

  if (preferredCheckpointId) {
    return filtered.find((c) => c.artifactId === preferredCheckpointId) ?? null;
  }

  return sortCheckpointsForResume(filtered)[0] ?? null;
};

export const shouldRequireBriefingForResume = (
  checkpoint: Pick<ToolCheckpoint, 'extractionContextAvailable'> | null,
): boolean => {
  if (!checkpoint) {
    return true;
  }

  return !checkpoint.extractionContextAvailable;
};
