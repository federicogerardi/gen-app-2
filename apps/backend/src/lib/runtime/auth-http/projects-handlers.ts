import type { IncomingMessage, ServerResponse } from 'node:http';

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

export const createProjectsHandlers = (handlers: ProjectsHandlers): ProjectsHandlers => handlers;
