import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeStepKey, normalizeToolWorkflowKey } from '../runtime/workflow-normalizers';

test('normalizeToolWorkflowKey maps canonical aliases', () => {
  assert.equal(normalizeToolWorkflowKey('hl_funnel'), 'funnel-pages');
  assert.equal(normalizeToolWorkflowKey('funnel_pages'), 'funnel-pages');
  assert.equal(normalizeToolWorkflowKey('youtube_lf_script'), 'youtube-lf-script');
  assert.equal(normalizeToolWorkflowKey('thank-you'), 'thank_you');
  assert.equal(normalizeToolWorkflowKey('thankyou'), 'thank_you');
});

test('normalizeToolWorkflowKey handles null and empty input', () => {
  assert.equal(normalizeToolWorkflowKey(null), null);
  assert.equal(normalizeToolWorkflowKey(undefined), null);
  assert.equal(normalizeToolWorkflowKey('   '), null);
});

test('normalizeStepKey maps thank-you aliases and ignores non-string values', () => {
  assert.equal(normalizeStepKey('thank-you'), 'thank_you');
  assert.equal(normalizeStepKey('thankyou'), 'thank_you');
  assert.equal(normalizeStepKey('  intro-structure  '), 'intro-structure');
  assert.equal(normalizeStepKey(null), null);
  assert.equal(normalizeStepKey(42), null);
  assert.equal(normalizeStepKey('   '), null);
});
