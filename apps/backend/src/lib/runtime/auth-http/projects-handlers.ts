import type { IncomingMessage, ServerResponse } from 'node:http';

import type { ArtifactReadProjection } from '../../types/artifacts';

export type ProjectsHandlers = {
  handleProjectsList(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleProjectsCreate(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleProjectById(request: IncomingMessage, response: ServerResponse, projectId: string): Promise<void>;
  handleArtifactsList(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleArtifactById(request: IncomingMessage, response: ServerResponse, artifactId: string): Promise<void>;
  handleArtifactDownload(
    request: IncomingMessage,
    response: ServerResponse,
    artifactId: string,
  ): Promise<void>;
};

const parseBooleanQueryFlag = (value: string | null): boolean => {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

export const parseArtifactReadProjection = (searchParams: URLSearchParams): ArtifactReadProjection => {
  return {
    includeInput: parseBooleanQueryFlag(searchParams.get('includeInput')),
    includeContent: parseBooleanQueryFlag(searchParams.get('includeContent')),
  };
};

export const createProjectsHandlers = (handlers: ProjectsHandlers): ProjectsHandlers => handlers;
