import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeStepKey,
  normalizeToolWorkflowKey,
  resolveToolStepArtifactRole,
} from '../runtime/workflow-normalizers';

test('normalizeToolWorkflowKey maps canonical aliases', () => {
  assert.equal(normalizeToolWorkflowKey('hl_funnel'), 'funnel-pages');
  assert.equal(normalizeToolWorkflowKey('funnel_pages'), 'funnel-pages');
  assert.equal(normalizeToolWorkflowKey('funnelpages'), 'funnel-pages');
  assert.equal(normalizeToolWorkflowKey('youtube_lf_script'), 'youtube-lf-script');
  assert.equal(normalizeToolWorkflowKey('youtube-long-form'), 'youtube-lf-script');
  assert.equal(normalizeToolWorkflowKey('youtube_long_form'), 'youtube-lf-script');
  assert.equal(normalizeToolWorkflowKey('YOUTUBE_LONG_FORM'), 'youtube-lf-script');
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

test('resolveToolStepArtifactRole maps final steps for funnel, nextland, and youtube-lf-script', () => {
  assert.equal(resolveToolStepArtifactRole('funnel-pages', 'optin'), 'step');
  assert.equal(resolveToolStepArtifactRole('funnel-pages', 'vsl'), 'final');

  assert.equal(resolveToolStepArtifactRole('nextland', 'landing'), 'step');
  assert.equal(resolveToolStepArtifactRole('nextland', 'thank-you'), 'final');

  assert.equal(resolveToolStepArtifactRole('youtube-lf-script', 'packaging'), 'step');
  assert.equal(resolveToolStepArtifactRole('youtube-lf-script', 'outro-structure'), 'final');

  assert.equal(resolveToolStepArtifactRole('angle-generator', 'angle-prioritization'), 'step');
  assert.equal(resolveToolStepArtifactRole('angle-generator', 'creative-activation'), 'final');
});

test('resolveToolStepArtifactRole preserves explicit role and returns null for unknown tool', () => {
  assert.equal(resolveToolStepArtifactRole('funnel-pages', 'optin', 'final'), 'final');
  assert.equal(resolveToolStepArtifactRole('unknown-tool', 'step-1'), null);
});
