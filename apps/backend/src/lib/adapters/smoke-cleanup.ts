import { createComponentLogger, LogComponent } from '../runtime/log-components';

export type SmokeCleanupTask = () => Promise<void>;

export type SmokeCleanup = {
  register(task: SmokeCleanupTask): void;
  run(): Promise<void>;
};

export const createSmokeCleanup = (): SmokeCleanup => {
  const tasks: SmokeCleanupTask[] = [];

  return {
    register(task) {
      tasks.push(task);
    },
    async run() {
      for (const task of [...tasks].reverse()) {
        try {
          await task();
        } catch (error) {
          const log = createComponentLogger(LogComponent.SMOKE_CLEANUP);
          log.warn({ error }, 'smoke cleanup warning');
        }
      }
    },
  };
};