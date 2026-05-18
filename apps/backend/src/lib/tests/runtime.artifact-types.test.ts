import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canTransitionArtifactStatus,
  normalizeArtifactFailureReason,
  normalizeArtifactStatus,
  normalizeArtifactType,
  normalizeToolWorkflow,
} from '../types/artifact';

test('artifact lifecycle transition guard only allows terminal transitions from generating', () => {
  assert.equal(canTransitionArtifactStatus('generating', 'generating'), true);
  assert.equal(canTransitionArtifactStatus('generating', 'completed'), true);
  assert.equal(canTransitionArtifactStatus('generating', 'failed'), true);

  assert.equal(canTransitionArtifactStatus('completed', 'failed'), false);
  assert.equal(canTransitionArtifactStatus('completed', 'generating'), false);
  assert.equal(canTransitionArtifactStatus('failed', 'completed'), false);
});

test('artifact normalizers constrain unknown values to canonical fallbacks', () => {
  assert.equal(normalizeArtifactType('content'), 'content');
  assert.equal(normalizeArtifactType('unknown'), 'content');

  assert.equal(normalizeArtifactStatus('failed'), 'failed');
  assert.equal(normalizeArtifactStatus('bogus'), 'completed');

  assert.equal(normalizeToolWorkflow('funnel_pages'), 'funnel_pages');
  assert.equal(normalizeToolWorkflow('not_a_workflow'), null);

  assert.equal(normalizeArtifactFailureReason('idempotency_conflict'), 'idempotency_conflict');
  assert.equal(normalizeArtifactFailureReason('non_canonical_reason'), null);
  assert.equal(normalizeArtifactFailureReason('llm_timeout'), 'llm_timeout');
}
);