import type Redis from 'ioredis';
import { createComponentLogger, LogComponent } from './log-components';

const CHANNEL_PREFIX = 'generation';

export const buildJobChannel = (jobId: string): string =>
  `${CHANNEL_PREFIX}:${jobId}`;

export type JobEventType =
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'workflow_completed'
  | 'workflow_failed';

export type JobProgressEvent = {
  type: JobEventType;
  jobId: string;
  timestamp: string;
  stepKey?: string;
  artifactId?: string;
  stepIndex?: number;
  totalSteps?: number;
  status?: 'running' | 'done' | 'error';
  errorMessage?: string;
  result?: {
    sessionId?: string;
    artifactIds?: string[];
  };
};

const bridgeLog = createComponentLogger(LogComponent.JOB_EVENT_BRIDGE);

export const createJobEventPublisher = (redis: Redis) => ({
  publish: async (event: JobProgressEvent): Promise<void> => {
    const channel = buildJobChannel(event.jobId);
    const payload = JSON.stringify(event);

    try {
      const receiverCount = await redis.publish(channel, payload);
      bridgeLog.info(
        {
          channel,
          eventType: event.type,
          jobId: event.jobId,
          stepKey: event.stepKey,
          receivers: receiverCount,
        },
        'event published',
      );
    } catch (error) {
      bridgeLog.error(
        { channel, eventType: event.type, jobId: event.jobId, err: error },
        'event publish failed (non-critical)',
      );
    }
  },
});

export type JobEventCallback = (event: JobProgressEvent) => void;

export const subscribeToJobEvents = async (
  subscriber: Redis,
  jobId: string,
  callback: JobEventCallback,
): Promise<() => void> => {
  const channel = buildJobChannel(jobId);

  await subscriber.subscribe(channel);

  const listener = (_channel: string, message: string) => {
    try {
      const event = JSON.parse(message) as JobProgressEvent;
      callback(event);
    } catch {
      bridgeLog.warn({ channel, message }, 'unparseable event message');
    }
  };

  subscriber.on('message', listener);

  bridgeLog.info({ channel, jobId }, 'subscribed to job events');

  return () => {
    subscriber.off('message', listener);
    subscriber.unsubscribe(channel).catch((err) =>
      bridgeLog.error({ channel, jobId, err }, 'unsubscribe failed'),
    );
  };
};
