export type ToolEntryIntent = 'new' | 'resume' | 'regenerate';

export type ToolEntryParams = {
  intent: ToolEntryIntent;
  sourceArtifactId: string | null;
  initialProjectId: string | null;
  relaunchTone: string | null;
  relaunchNotes: string | null;
  relaunchFromArtifactId: string | null;
  briefingId: string | null;
  extractionArtifactId: string | null;
  briefingFileName: string | null;
};

export const parseToolIntent = (value: string | null): ToolEntryIntent => {
  if (value === 'resume' || value === 'regenerate') {
    return value;
  }

  return 'new';
};

export const parseOptionalString = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const parseToolEntryParams = (searchParams: URLSearchParams): ToolEntryParams => {
  return {
    intent: parseToolIntent(searchParams.get('intent')),
    sourceArtifactId: parseOptionalString(searchParams.get('sourceArtifactId')),
    initialProjectId: parseOptionalString(searchParams.get('projectId')),
    relaunchTone: parseOptionalString(searchParams.get('tone')),
    relaunchNotes: parseOptionalString(searchParams.get('notes')),
    relaunchFromArtifactId: parseOptionalString(searchParams.get('relaunchFromArtifactId')),
    briefingId: parseOptionalString(searchParams.get('briefingId')),
    extractionArtifactId: parseOptionalString(searchParams.get('extractionArtifactId')),
    briefingFileName: parseOptionalString(searchParams.get('briefingFileName')),
  };
};
