import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeAcquisitionIntoGenerationInput } from '../machines/generation/context-generation-assembly';

test('mergeAcquisitionIntoGenerationInput merges acquisition payload over base input', () => {
  const merged = mergeAcquisitionIntoGenerationInput(
    {
      prompt: 'Generate draft',
      acquisition: { existing: true },
    },
    {
      externalContext: 'fetched-value',
    },
  );

  assert.deepEqual(merged, {
    prompt: 'Generate draft',
    acquisition: {
      existing: true,
      externalContext: 'fetched-value',
    },
  });
});

test('mergeAcquisitionIntoGenerationInput leaves base input unchanged for invalid payload', () => {
  const merged = mergeAcquisitionIntoGenerationInput({ prompt: 'Generate' }, null);
  assert.deepEqual(merged, { prompt: 'Generate' });
});
