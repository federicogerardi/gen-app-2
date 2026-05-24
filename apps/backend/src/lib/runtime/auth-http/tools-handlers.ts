import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool } from 'pg';

import type {
  AuthRepositoryBundle,
  IdempotencyAdapter,
  UserQueryRepositoryBundle,
} from '../../adapters';
import type { AuthSessionPrincipal } from '../../types/auth';
import type {
  AuthHttpWriteErrorFn,
  AuthHttpWriteSuccessFn,
} from './support';
import {
  createToolsBriefHandlers,
  type ToolsBriefHandlers,
} from './tools-brief-handlers';
import {
  createToolsHydrateHandlers,
  type ToolsHydrateHandlers,
} from './tools-hydrate-handlers';
import {
  createToolsOrchestrateHandlers,
  type ToolsOrchestrateHandlers,
} from './tools-orchestrate-handlers';
import {
  createToolsSessionHandlers,
  type ToolsSessionHandlers,
} from './tools-session-handlers';
import {
  createToolsApiServiceHandlers,
  type ToolsApiServiceHandlers,
} from './tools-api-service-handlers';

export type CreateToolsHandlersDependencies = {
  repositories: AuthRepositoryBundle;
  idempotency: IdempotencyAdapter | null;
  now: () => Date;
  toolsOrchestrateTimeoutMs: number;
  toolsOrchestrateArtifactScanLimit: number;
  toolsHydrateArtifactScanLimit: number;
  requireDb: (response: ServerResponse) => Pool | null;
  parseRequestUrl: (request: IncomingMessage) => URL;
  parseJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  requireSessionPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  requireQueryRepositories: (response: ServerResponse) => UserQueryRepositoryBundle | null;
  writeError: AuthHttpWriteErrorFn;
  writeSuccess: AuthHttpWriteSuccessFn;
};

export type ToolsHandlers =
  & ToolsBriefHandlers
  & ToolsHydrateHandlers
  & ToolsOrchestrateHandlers
  & ToolsSessionHandlers
  & ToolsApiServiceHandlers;

export const createToolsHandlers = (deps: CreateToolsHandlersDependencies): ToolsHandlers => {
  const briefHandlers = createToolsBriefHandlers(deps);
  const hydrateHandlers = createToolsHydrateHandlers(deps);
  const orchestrateHandlers = createToolsOrchestrateHandlers(deps);
  const sessionHandlers = createToolsSessionHandlers(deps);
  const apiServiceHandlers = createToolsApiServiceHandlers(deps);

  return {
    ...briefHandlers,
    ...hydrateHandlers,
    ...orchestrateHandlers,
    ...sessionHandlers,
    ...apiServiceHandlers,
  };
};
