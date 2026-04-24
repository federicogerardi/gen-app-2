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

export const shouldRequireBriefingForResume = (
  checkpoint: Pick<ToolCheckpoint, 'extractionContextAvailable'> | null,
): boolean => {
  if (!checkpoint) {
    return true;
  }

  return !checkpoint.extractionContextAvailable;
};
