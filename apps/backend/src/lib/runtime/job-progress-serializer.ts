import type Redis from 'ioredis';
import type { WorkflowStepState } from '../types/xstate';
import { createComponentLogger, LogComponent } from './log-components';

const KEY_PREFIX = 'generation:job';
const DEFAULT_TTL_SECONDS = 3600;

export type SerializedJobProgress = {
  jobId: string;
  completedSteps: WorkflowStepState[];
  currentStepIndex: number;
  lastUpdated: string;
};

const buildProgressKey = (jobId: string): string =>
  `${KEY_PREFIX}:${jobId}:progress`;

const progressLog = createComponentLogger(LogComponent.JOB_PROGRESS_SERIALIZER);

export const createJobProgressSerializer = (redis: Redis, ttlSeconds = DEFAULT_TTL_SECONDS) => ({
  save: async (jobId: string, progress: Omit<SerializedJobProgress, 'jobId' | 'lastUpdated'>): Promise<void> => {
    const key = buildProgressKey(jobId);
    const payload: SerializedJobProgress = {
      jobId,
      ...progress,
      lastUpdated: new Date().toISOString(),
    };

    try {
      const result = await redis.set(key, JSON.stringify(payload), 'EX', ttlSeconds);
      progressLog.info(
        { jobId, currentStepIndex: progress.currentStepIndex, completedCount: progress.completedSteps.length, redisResult: result },
        'progress saved',
      );
    } catch (error) {
      progressLog.error({ jobId, err: error }, 'progress save failed — resume will fall back to full retry');
    }
  },

  load: async (jobId: string): Promise<SerializedJobProgress | null> => {
    const key = buildProgressKey(jobId);

    try {
      const raw = await redis.get(key);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as SerializedJobProgress;
      if (!parsed.completedSteps || !Array.isArray(parsed.completedSteps)) {
        progressLog.warn({ jobId, parsed }, 'invalid progress shape in Redis — ignoring');
        return null;
      }

      progressLog.info(
        { jobId, completedCount: parsed.completedSteps.length, currentStepIndex: parsed.currentStepIndex },
        'progress loaded for resume',
      );
      return parsed;
    } catch (error) {
      progressLog.error({ jobId, err: error }, 'progress load failed — falling back to full retry');
      return null;
    }
  },

  clear: async (jobId: string): Promise<void> => {
    const key = buildProgressKey(jobId);

    try {
      await redis.del(key);
      progressLog.info({ jobId }, 'progress cleared after workflow completion');
    } catch (error) {
      progressLog.warn({ jobId, err: error }, 'progress clear failed — key will expire via TTL');
    }
  },
});
