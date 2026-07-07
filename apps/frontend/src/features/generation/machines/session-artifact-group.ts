import { toolStepOrder, type SupportedTool, type ToolStep } from '../../tools/machines/tool-flow.machine';

export type SessionArtifactEntry = {
  artifactId: string;
  requestId: string;
  projectId: string;
  stepKey: string | null;
  artifactRole: 'step' | 'final' | null;
  status: 'generating' | 'completed' | 'failed';
  content: string;
  updatedAt: string;
  failureReason: string | null;
  extractionContext?: Record<string, unknown> | null;
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

export const groupArtifactsByStep = (
  artifacts: SessionArtifactEntry[],
): Partial<Record<ToolStep, SessionArtifactEntry>> => {
  return artifacts.reduce<Partial<Record<ToolStep, SessionArtifactEntry>>>((acc, artifact) => {
    if (!artifact.stepKey) {
      return acc;
    }

    const step = artifact.stepKey as ToolStep;
    if (!acc[step]) {
      acc[step] = artifact;
    }

    return acc;
  }, {});
};

export const sortByCanonicalStepOrder = (
  artifacts: SessionArtifactEntry[],
  toolKey: SupportedTool,
): SessionArtifactEntry[] => {
  const orderedSteps = toolStepOrder[toolKey];
  const stepPosition = new Map<string, number>(
    orderedSteps.map((step, index) => [step, index]),
  );

  return [...artifacts].sort((a, b) => {
    const aPos = a.stepKey ? stepPosition.get(a.stepKey) : undefined;
    const bPos = b.stepKey ? stepPosition.get(b.stepKey) : undefined;

    if (aPos === undefined && bPos === undefined) {
      return Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
    }

    if (aPos === undefined) {
      return 1;
    }

    if (bPos === undefined) {
      return -1;
    }

    return aPos - bPos;
  });
};

export const filterFinalArtifacts = (
  group: SessionArtifactGroup,
): SessionArtifactEntry[] => {
  return group.artifacts.filter((artifact) => artifact.artifactRole === 'final');
};
