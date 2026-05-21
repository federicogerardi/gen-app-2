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
          console.error('Smoke cleanup warning:', error);
        }
      }
    },
  };
};