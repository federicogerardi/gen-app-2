import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool } from 'pg';
import type Redis from 'ioredis';
import type { Queue } from 'bullmq';

import type {
  AuthRepositoryBundle,
  IdempotencyAdapter,
  OrchestrateArtifactCache,
  UserQueryRepositoryBundle,
} from '../../../adapters';
import type { ToolWorkflowJobRepository } from '../../../adapters/postgres-redis.interfaces';
import type { AuthSessionPrincipal } from '../../../types/auth';
import type { ToolWorkflowJobData } from '../../tool-workflow-job-queue';
import type {
  AuthHttpWriteErrorFn,
  AuthHttpWriteSuccessFn,
} from '../support';
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
import {
  createToolsAssetHandlers,
  type ToolsAssetHandlers,
} from './tools-asset-handlers';
import {
  createToolsJobHandlers,
  type ToolsJobHandlers,
} from './tools-job-handlers';
import {
  createToolsJobStreamHandler,
  type ToolsJobStreamHandler,
} from './tools-job-stream-handler';

export type CreateToolsHandlersDependencies = {
  repositories: AuthRepositoryBundle;
  idempotency: IdempotencyAdapter | null;
  orchestrateCache: OrchestrateArtifactCache | null;
  toolWorkflowJob?: ToolWorkflowJobRepository | null | undefined;
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
  queue?: Queue<ToolWorkflowJobData> | undefined;
  redis?: Redis | undefined;
};

export type ToolsHandlers =
  & ToolsBriefHandlers
  & ToolsHydrateHandlers
  & ToolsOrchestrateHandlers
  & ToolsSessionHandlers
  & ToolsApiServiceHandlers
  & ToolsAssetHandlers
  & ToolsJobHandlers
  & ToolsJobStreamHandler;

export const createToolsHandlers = (deps: CreateToolsHandlersDependencies): ToolsHandlers => {
  const briefHandlers = createToolsBriefHandlers(deps);
  const hydrateHandlers = createToolsHydrateHandlers(deps);
  const orchestrateHandlers = createToolsOrchestrateHandlers(deps);
  const sessionHandlers = createToolsSessionHandlers(deps);
  const apiServiceHandlers = createToolsApiServiceHandlers(deps);
  const assetHandlers = createToolsAssetHandlers(deps);

  const jobHandlers = deps.queue && deps.redis
    ? createToolsJobHandlers({
        queue: deps.queue,
        redis: deps.redis,
        repositories: deps.repositories,
        toolWorkflowJob: deps.toolWorkflowJob,
        now: deps.now,
        parseJsonBody: deps.parseJsonBody,
        requireSessionPrincipal: deps.requireSessionPrincipal,
        requireQueryRepositories: deps.requireQueryRepositories,
        writeError: deps.writeError,
        writeSuccess: deps.writeSuccess,
      })
    : createNoopJobHandlers();

  const streamHandler = deps.redis
    ? createToolsJobStreamHandler({
        redis: deps.redis,
        repositories: deps.repositories,
        now: deps.now,
        requireSessionPrincipal: deps.requireSessionPrincipal,
        writeError: deps.writeError,
      })
    : createNoopStreamHandler();

  return {
    ...briefHandlers,
    ...hydrateHandlers,
    ...orchestrateHandlers,
    ...sessionHandlers,
    ...apiServiceHandlers,
    ...assetHandlers,
    ...jobHandlers,
    ...streamHandler,
  };
};

const createNoopJobHandlers = (): ToolsJobHandlers => {
  const notReady = async (_req: IncomingMessage, res: ServerResponse) => {
    writeError(res, 503, 'service_unavailable', 'ToolWorkflowJob system not configured');
  };
  return {
    handleSubmitJob: notReady,
    handleGetJobStatus: notReady,
    handleCancelJob: notReady,
    handleListJobs: notReady,
  };
};

const createNoopStreamHandler = (): ToolsJobStreamHandler => {
  const notReady = async (_req: IncomingMessage, res: ServerResponse) => {
    writeError(res, 503, 'service_unavailable', 'ToolWorkflowJob system not configured');
  };
  return { handleJobStream: notReady };
};

const writeError = (res: ServerResponse, status: number, code: string, message: string) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: { code, message } }));
};
