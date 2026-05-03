export type ArtifactType = 'content' | 'seo' | 'code' | 'extraction';
export type OutputFormat = 'plain' | 'json' | 'markdown';

export type GenerationRequest = {
  requestId: string;
  userId: string;
  projectId: string;
  artifactType: ArtifactType;
  model: string;
  input: Record<string, unknown>;
  toolKey?: string | null;
  workflowType?: string | null;
  idempotencyKey?: string;
  outputFormat?: OutputFormat;
  registryVersion?: string;
  registrySnapshotRef?: string;
  briefingId?: string | null;
  extractionArtifactId?: string | null;
  stepDependencyArtifactIds?: string[] | null;
};

export type BackendStreamEvent =
  | {
    event: 'start';
    data: { requestId: string; artifactId: string };
  }
  | {
    event: 'chunk';
    data: { artifactId: string; chunk: string; sequence: number };
  }
  | {
    event: 'terminal';
    data: { artifactId: string | null; status: 'completed' | 'failed'; reason: string | null };
  };
