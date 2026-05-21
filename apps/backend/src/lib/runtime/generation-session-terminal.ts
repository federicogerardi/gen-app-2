import type { BackendStreamEvent } from './stream-contract';

export type TerminalSnapshotContext = {
  artifactId: string | null;
  failureReason?: string | null;
};

export const resolveTerminalStatus = (stateValue: string): 'completed' | 'failed' => {
  return stateValue === 'completed' ? 'completed' : 'failed';
};

export const buildTerminalStreamEvent = (
  context: TerminalSnapshotContext,
  status: 'completed' | 'failed',
): BackendStreamEvent => {
  return {
    event: 'terminal',
    data: {
      artifactId: context.artifactId,
      status,
      reason: context.failureReason ?? null,
    },
  };
};
