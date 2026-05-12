import type { IncomingMessage, ServerResponse } from 'node:http';

export type ToolsHandlers = {
  handleToolsBriefUpload(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleToolsHydrate(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleToolsOrchestrate(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleToolsSessionsList(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleToolsSessionArtifacts(request: IncomingMessage, response: ServerResponse, sessionId: string): Promise<void>;
  handleToolsSessionStepArtifact(
    request: IncomingMessage,
    response: ServerResponse,
    sessionId: string,
    stepKey: string,
  ): Promise<void>;
};

export const createToolsHandlers = (handlers: ToolsHandlers): ToolsHandlers => handlers;
