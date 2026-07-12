import { fromPromise } from 'xstate';

import type { PersistenceBatchInput } from '../types/xstate';
import type { PersistenceAdapter } from '../adapters/generation.adapters';

type SimplePersistenceInput = {
  input: PersistenceBatchInput;
  mode: 'success' | 'failure';
  reason?: string;
  adapters: { persistence: PersistenceAdapter };
};

export const simpleFinalizationActor = fromPromise(
  async ({ input }: { input: SimplePersistenceInput }): Promise<void> => {
    const { input: batchInput, mode, reason, adapters } = input;

    if (mode === 'success') {
      await adapters.persistence.finalizeSuccess(batchInput);
    } else {
      await adapters.persistence.finalizeFailure(batchInput, reason ?? 'generation_failed');
    }
  },
);