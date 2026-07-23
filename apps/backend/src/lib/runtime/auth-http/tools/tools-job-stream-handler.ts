import type { IncomingMessage, ServerResponse } from 'node:http';
import type Redis from 'ioredis';

import type { AuthRepositoryBundle } from '../../../adapters';
import type { AuthSessionPrincipal } from '../../../types/auth';
import { applySseHeaders } from '../../http-sse';
import { subscribeToJobEvents, type JobProgressEvent } from '../../job-event-bridge';
import { createComponentLogger, LogComponent } from '../../log-components';
import type { AuthHttpWriteErrorFn } from '../support';

const log = createComponentLogger(LogComponent.TOOL_WORKFLOW_JOB_STREAM);

const JOB_STATUS_PREFIX = 'tool-job:';
const HEARTBEAT_INTERVAL_MS = 30_000;
const STREAM_TIMEOUT_MS = 30 * 60 * 1000;

export type CreateToolsJobStreamHandlerDependencies = {
  redis: Redis;
  repositories: Pick<AuthRepositoryBundle, 'sessions'>;
  now: () => Date;
  requireSessionPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  writeError: AuthHttpWriteErrorFn;
};

export type ToolsJobStreamHandler = {
  handleJobStream(request: IncomingMessage, response: ServerResponse, jobId: string): Promise<void>;
};

const serializeSseFrame = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const createToolsJobStreamHandler = (
  deps: CreateToolsJobStreamHandlerDependencies,
): ToolsJobStreamHandler => {
  const {
    redis,
    repositories,
    now,
    requireSessionPrincipal,
    writeError,
  } = deps;

  const handleJobStream = async (
    request: IncomingMessage,
    response: ServerResponse,
    jobId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for job stream');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    if (!jobId || jobId.trim().length === 0) {
      writeError(response, 400, 'bad_request', 'jobId is required');
      return;
    }

    const raw = await redis.get(`${JOB_STATUS_PREFIX}${jobId}`);
    if (!raw) {
      writeError(response, 404, 'not_found', 'Job not found or expired');
      return;
    }

    let statusData: Record<string, unknown>;
    try {
      statusData = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      writeError(response, 500, 'internal', 'Invalid job status data');
      return;
    }

    if (statusData.userId !== principal.user.id) {
      writeError(response, 403, 'forbidden', 'Access denied');
      return;
    }

    applySseHeaders(response);

    repositories.sessions.touchSession(principal.session.id, now());

    const subscriber = redis.duplicate();
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let streamTimeout: ReturnType<typeof setTimeout> | null = null;
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (heartbeat) clearInterval(heartbeat);
      if (streamTimeout) clearTimeout(streamTimeout);
      unsubscribe?.();
      subscriber.quit().catch(() => {});
      if (!response.writableEnded && !response.destroyed) {
        response.end();
      }
    };

    let unsubscribe: (() => void) | null = null;

    const onEvent = (event: JobProgressEvent) => {
      if (response.writableEnded || response.destroyed) {
        cleanup();
        return;
      }

      const isTerminal = event.type === 'workflow_completed' || event.type === 'workflow_failed';

      if (isTerminal) {
        const frame = serializeSseFrame('terminal', {
          status: event.type === 'workflow_completed' ? 'completed' : 'failed',
          reason: event.errorMessage ?? null,
          result: event.result ?? null,
        });
        response.write(frame, () => cleanup());
      } else {
        const frame = serializeSseFrame('progress', {
          step: event.stepKey,
          status: event.status,
          artifactId: event.artifactId,
          stepIndex: event.stepIndex,
          totalSteps: event.totalSteps,
        });
        response.write(frame);
      }
    };

    try {
      unsubscribe = await subscribeToJobEvents(subscriber, jobId, onEvent);
    } catch (error) {
      log.error({ jobId, err: error }, 'failed to subscribe to job events');
      if (!response.writableEnded) {
        response.end();
      }
      return;
    }

    heartbeat = setInterval(() => {
      if (response.writableEnded || response.destroyed) {
        cleanup();
        return;
      }
      response.write(':keepalive\n\n');
    }, HEARTBEAT_INTERVAL_MS);

    streamTimeout = setTimeout(() => {
      log.warn({ jobId }, 'stream timeout reached');
      cleanup();
    }, STREAM_TIMEOUT_MS);

    response.on('close', cleanup);
    response.on('error', cleanup);

    request.on('close', cleanup);
    request.on('error', cleanup);
  };

  return { handleJobStream };
};
