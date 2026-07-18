import test from 'node:test';
import assert from 'node:assert/strict';

import { mapArtifactRowToDetail, mapArtifactRowToSummary } from '../types/artifacts';
import { mapProjectRowToDetail, mapProjectRowToSummary } from '../types/projects';

test('project mappers normalize nullable DB fields', () => {
  const row = {
    id: 'proj_1',
    user_id: 'user_1',
    name: null,
    status: null,
    created_at: '2026-04-24T10:00:00.000Z',
    updated_at: '2026-04-24T10:05:00.000Z',
  };

  const summary = mapProjectRowToSummary(row);
  assert.equal(summary.name, 'Untitled project');
  assert.equal(summary.description, '');
  assert.equal(summary.status, 'active');

  const detail = mapProjectRowToDetail(row);
  assert.equal(detail.userId, 'user_1');
  assert.equal(detail.createdAt, '2026-04-24T10:00:00.000Z');
  assert.equal(detail.status, 'active');
});

test('artifact mappers normalize row to API shape', () => {
  const row = {
    id: 'art_1',
    request_id: 'req_1',
    user_id: 'user_1',
    project_id: null,
    type: 'content',
    status: 'completed',
    model: 'openrouter/gpt-5.3-codex',
    workflow_type: null,
    input_json: { prompt: 'hello' },
    content: 'hello world',
    failure_reason: null,
    created_at: '2026-04-24T10:00:00.000Z',
    updated_at: '2026-04-24T10:05:00.000Z',
  };

  const summary = mapArtifactRowToSummary(row);
  assert.equal(summary.projectId, '');
  assert.equal(summary.artifactType, 'content');

  const detail = mapArtifactRowToDetail(row);
  assert.equal(detail.content, 'hello world');
  assert.deepEqual(detail.input, { prompt: 'hello' });
});

test('artifact mappers constrain free-form status/type/workflow/failure reason values', () => {
  const row = {
    id: 'art_2',
    request_id: 'req_2',
    user_id: 'user_1',
    project_id: 'project_1',
    type: 'unknown_type',
    status: 'unknown_status',
    model: 'openrouter/gpt-5.3-codex',
    workflow_type: 'unknown_workflow',
    input_json: {},
    content: 'x',
    failure_reason: 'unknown_failure_reason',
    created_at: '2026-04-24T10:00:00.000Z',
    updated_at: '2026-04-24T10:05:00.000Z',
  };

  const summary = mapArtifactRowToSummary(row);
  assert.equal(summary.artifactType, 'content');
  assert.equal(summary.status, 'completed');
  assert.equal(summary.workflowType, null);

  const detail = mapArtifactRowToDetail(row);
  assert.equal(detail.failureReason, null);
});
