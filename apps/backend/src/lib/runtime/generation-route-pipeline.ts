export type GenerationRoutePipelineLogger = {
  info: (message: string, meta: Record<string, unknown>) => void;
  warn: (message: string, meta: Record<string, unknown>) => void;
  error: (message: string, meta: Record<string, unknown>) => void;
};

export type GenerationRouteDeadline = {
  startedAtMs: number;
  deadlineAtMs: number;
};

export type GenerationRoutePipelineErrorCode =
  | 'deadline_exceeded'
  | 'route_execution_failed';

export class GenerationRoutePipelineError extends Error {
  readonly code: GenerationRoutePipelineErrorCode;

  constructor(code: GenerationRoutePipelineErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

import { logger } from './logger';

const defaultLogger: GenerationRoutePipelineLogger = {
  info: (message, meta) => logger.info(meta, message),
  warn: (message, meta) => logger.warn(meta, message),
  error: (message, meta) => logger.error(meta, message),
};

export const createGenerationRouteDeadline = (timeoutMs: number): GenerationRouteDeadline => {
  const startedAtMs = Date.now();
  return {
    startedAtMs,
    deadlineAtMs: startedAtMs + Math.max(1, timeoutMs),
  };
};

export const assertGenerationRouteDeadline = (
  deadline: GenerationRouteDeadline,
  route: string,
  correlationId: string,
): void => {
  if (Date.now() <= deadline.deadlineAtMs) {
    return;
  }

  throw new GenerationRoutePipelineError(
    'deadline_exceeded',
    `${route} deadline exceeded (corr=${correlationId})`,
  );
};

export const runGenerationRoutePipeline = async <T>(
  route: string,
  correlationId: string,
  execute: () => Promise<T>,
  logger: Partial<GenerationRoutePipelineLogger> = {},
): Promise<T> => {
  const runtimeLogger: GenerationRoutePipelineLogger = {
    info: logger.info ?? defaultLogger.info,
    warn: logger.warn ?? defaultLogger.warn,
    error: logger.error ?? defaultLogger.error,
  };

  runtimeLogger.info('[gen-route][start]', { route, correlationId });
  try {
    const result = await execute();
    runtimeLogger.info('[gen-route][ok]', { route, correlationId });
    return result;
  } catch (error) {
    if (error instanceof GenerationRoutePipelineError) {
      runtimeLogger.warn('[gen-route][guard-fail]', {
        route,
        correlationId,
        code: error.code,
        message: error.message,
      });
      throw error;
    }

    runtimeLogger.error('[gen-route][error]', {
      route,
      correlationId,
      error,
    });
    throw new GenerationRoutePipelineError(
      'route_execution_failed',
      error instanceof Error ? error.message : 'route_execution_failed',
    );
  }
};
