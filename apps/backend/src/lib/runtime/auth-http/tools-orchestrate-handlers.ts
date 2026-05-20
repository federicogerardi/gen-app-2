import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { TOOL_WORKFLOW_BY_TOOL_KEY } from '@gen-app-2/contracts';

import type {
  AuthRepositoryBundle,
  IdempotencyAdapter,
  UserQueryRepositoryBundle,
} from '../../adapters';
import type { AuthSessionPrincipal } from '../../types/auth';
import {
  GenerationRoutePipelineError,
  createGenerationRouteDeadline,
  runGenerationRoutePipeline,
} from '../generation-route-pipeline';
import { buildToolsOrchestrateIdempotencyInput } from '../request-contract';
import {
  buildCompletedArtifactsByStep,
  isSupportedToolWorkflow,
  resolveStepDependencyIds,
} from '../tool-workflow-registry';
import type { AuthHttpWriteErrorFn, AuthHttpWriteSuccessFn } from './support';

type ToolOrchestrationRequestBody = {
  projectId?: unknown;
  toolKey?: unknown;
  targetStep?: unknown;
  requestId?: unknown;
  idempotencyKey?: unknown;
};

export type CreateToolsOrchestrateHandlersDependencies = {
  repositories: Pick<AuthRepositoryBundle, 'sessions'>;
  idempotency: IdempotencyAdapter | null;
  now: () => Date;
  toolsOrchestrateTimeoutMs: number;
  toolsOrchestrateArtifactScanLimit: number;
  parseJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  requireSessionPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  requireQueryRepositories: (response: ServerResponse) => UserQueryRepositoryBundle | null;
  writeError: AuthHttpWriteErrorFn;
  writeSuccess: AuthHttpWriteSuccessFn;
};

export type ToolsOrchestrateHandlers = {
  handleToolsOrchestrate(request: IncomingMessage, response: ServerResponse): Promise<void>;
};

export const createToolsOrchestrateHandlers = (
  deps: CreateToolsOrchestrateHandlersDependencies,
): ToolsOrchestrateHandlers => {
  const {
    repositories,
    idempotency,
    now,
    toolsOrchestrateTimeoutMs,
    toolsOrchestrateArtifactScanLimit,
    parseJsonBody,
    requireSessionPrincipal,
    requireQueryRepositories,
    writeError,
    writeSuccess,
  } = deps;

  const handleToolsOrchestrate = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for tools orchestrate');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    let body: ToolOrchestrationRequestBody;
    try {
      body = await parseJsonBody<ToolOrchestrationRequestBody>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    if (!projectId) {
      writeError(response, 400, 'bad_request', 'projectId is required');
      return;
    }

    const project = await queries.projects.getProjectByIdForUser(principal.user.id, projectId);
    if (!project) {
      writeError(response, 403, 'forbidden', 'Project ownership check failed');
      return;
    }

    const toolKey = typeof body.toolKey === 'string' ? body.toolKey.trim() : '';
    if (!toolKey) {
      writeError(response, 400, 'bad_request', 'toolKey is required');
      return;
    }

    if (!isSupportedToolWorkflow(toolKey)) {
      writeError(response, 400, 'bad_request', `Unsupported toolKey: ${toolKey}`);
      return;
    }

    const targetStep = typeof body.targetStep === 'string' ? body.targetStep.trim() : '';
    if (!targetStep) {
      writeError(response, 400, 'bad_request', 'targetStep is required');
      return;
    }

    const correlationId = `orchestrate:${randomUUID()}`;
    const route = '/api/tools/orchestrate';
    const deadlineMs = toolsOrchestrateTimeoutMs;
    const artifactScanLimit = toolsOrchestrateArtifactScanLimit;
    const deadline = createGenerationRouteDeadline(deadlineMs);
    const routeStartedAtMs = Date.now();
    const workflowType = TOOL_WORKFLOW_BY_TOOL_KEY[toolKey].workflowType;
    const idempotencyInput = buildToolsOrchestrateIdempotencyInput({
      requestId: body.requestId,
      userId: principal.user.id,
      projectId,
      toolKey,
      idempotencyKey: body.idempotencyKey,
    });

    let stepDependencyArtifactIds: string[] = [];
    let dependencyArtifactIdsByStep: Record<string, string> = {};
    let idempotencyClaimed = false;
    let idempotencyCompletionPending = false;
    let artifactSummaryCount = 0;
    let artifactDetailBatchCount = 0;

    const withOrchestrateMeta = (meta: Record<string, unknown>): Record<string, unknown> => ({
      ...meta,
      deadlineMs,
      artifactScanLimit,
      elapsedMs: Date.now() - routeStartedAtMs,
      artifactSummaryCount,
      artifactDetailBatchCount,
    });

    if (idempotencyInput) {
      if (!idempotency) {
        writeError(response, 503, 'service_unavailable', 'Idempotency adapter unavailable');
        return;
      }

      try {
        const decision = await idempotency.checkAndClaim(idempotencyInput);
        if (decision.status === 'conflict') {
          writeError(response, 409, 'conflict', 'Duplicate orchestrate request in progress');
          return;
        }

        if (decision.status === 'replay') {
          let replayPayload: {
            toolKey: string;
            targetStep: string;
            stepDependencyArtifactIds: string[];
            dependencyArtifactIdsByStep: Record<string, string>;
          };

          try {
            replayPayload = JSON.parse(decision.content) as {
              toolKey: string;
              targetStep: string;
              stepDependencyArtifactIds: string[];
              dependencyArtifactIdsByStep: Record<string, string>;
            };
          } catch {
            writeError(response, 500, 'internal', 'Invalid replay payload for orchestrate idempotency');
            return;
          }

          if (replayPayload.toolKey !== toolKey || replayPayload.targetStep !== targetStep) {
            writeError(response, 409, 'conflict', 'Idempotency key reused with different orchestrate input');
            return;
          }

          await repositories.sessions.touchSession(principal.session.id, now());
          writeSuccess(response, 200, {
            orchestration: {
              toolKey,
              targetStep,
              stepDependencyArtifactIds: replayPayload.stepDependencyArtifactIds,
              dependencyArtifactIdsByStep: replayPayload.dependencyArtifactIdsByStep,
            },
          });
          return;
        }

        idempotencyClaimed = true;
      } catch {
        writeError(response, 500, 'internal', 'Failed idempotency claim for orchestrate request');
        return;
      }
    }

    try {
      ({ stepDependencyArtifactIds, dependencyArtifactIdsByStep } = await runGenerationRoutePipeline(
        route,
        correlationId,
        async () => {
          const allCompleted = await queries.artifacts.listRecentCompletedArtifactsForToolByUser(
            principal.user.id,
            {
              projectId,
              workflowType,
              limit: artifactScanLimit,
            },
          );
          artifactSummaryCount = allCompleted.length;

          const completedArtifactsByStep = await buildCompletedArtifactsByStep(
            principal.user.id,
            toolKey,
            allCompleted,
            async (userId, artifactIds) => {
              artifactDetailBatchCount += 1;
              return queries.artifacts.getArtifactsByIdsForUser(userId, artifactIds, { includeInput: true });
            },
            route,
            correlationId,
            deadline,
          );

          return resolveStepDependencyIds(
            toolKey,
            targetStep,
            completedArtifactsByStep,
          );
        },
        {
          info: (message, meta) => {
            console.info(message, withOrchestrateMeta(meta));
          },
          warn: (message, meta) => {
            console.warn(message, withOrchestrateMeta(meta));
          },
          error: (message, meta) => {
            console.error(message, withOrchestrateMeta(meta));
          },
        },
      ));

      if (idempotencyInput && idempotency && idempotencyClaimed) {
        idempotencyCompletionPending = true;
        await idempotency.markCompleted(
          idempotencyInput,
          `orchestrate:${toolKey}:${targetStep}`,
          JSON.stringify({
            toolKey,
            targetStep,
            stepDependencyArtifactIds,
            dependencyArtifactIdsByStep,
          }),
        );
        idempotencyCompletionPending = false;
      }
    } catch (error) {
      if (idempotencyInput && idempotency && idempotencyClaimed) {
        await idempotency.markFailed(idempotencyInput);
      }

      if (error instanceof GenerationRoutePipelineError && error.code === 'deadline_exceeded') {
        writeError(response, 503, 'service_unavailable', 'Tools orchestration timeout');
        return;
      }

      if (idempotencyCompletionPending) {
        writeError(response, 500, 'internal', 'Failed idempotency completion for orchestrate request');
        return;
      }

      writeError(response, 500, 'internal', 'Failed to orchestrate tool dependencies');
      return;
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, {
      orchestration: {
        toolKey,
        targetStep,
        stepDependencyArtifactIds,
        dependencyArtifactIdsByStep,
      },
    });
  };

  return {
    handleToolsOrchestrate,
  };
};