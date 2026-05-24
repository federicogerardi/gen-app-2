import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toApiServiceRedactedDto,
  validateErrorMappingRules,
  validateApiServiceInput,
  validateRequestMappingRules,
  validateRequestTemplate,
  validateResponseMappingRules,
  validateToolStepBindingInput,
} from '../runtime/integrations/api-service-validation';
import type { ApiService } from '../types/api-service';

test('validateApiServiceInput accepts valid public service payload', () => {
  const errors = validateApiServiceInput({
    key: 'github-issues',
    label: 'GitHub Issues',
    baseUrl: 'https://api.github.com',
    resourcePath: '/repos/{owner}/{repo}/issues',
    accessMode: 'public',
    timeoutMs: 5000,
    retryCount: 2,
  });

  assert.deepEqual(errors, []);
});

test('validateApiServiceInput rejects token mode without tokenRef', () => {
  const errors = validateApiServiceInput({
    key: 'private-api',
    label: 'Private API',
    baseUrl: 'https://example.com',
    resourcePath: '/v1/resources',
    accessMode: 'token',
  });

  assert.ok(errors.includes('tokenRef is required when accessMode is token'));
});

test('toApiServiceRedactedDto never exposes secrets and marks tokenConfigured', () => {
  const service: ApiService = {
    id: 'svc_1',
    key: 'github-issues',
    label: 'GitHub Issues',
    baseUrl: 'https://api.github.com',
    resourcePath: '/repos/{owner}/{repo}/issues',
    accessMode: 'token',
    timeoutMs: 5000,
    retryCount: 1,
    requestMethod: 'GET',
    requestTemplateJson: {},
    requestMappingRulesJson: [],
    requestHeadersTemplateJson: {},
    responseMappingRulesJson: [],
    errorMappingRulesJson: [],
    contractProfileVersion: 1,
    tokenRef: 'vault://services/github',
    status: 'active',
    createdAt: new Date('2026-05-24T08:00:00.000Z'),
    updatedAt: new Date('2026-05-24T08:05:00.000Z'),
  };

  const dto = toApiServiceRedactedDto(service, true);

  assert.equal(dto.id, 'svc_1');
  assert.equal(dto.tokenConfigured, true);
  assert.equal(dto.tokenRef, 'vault://services/github');
  assert.equal('tokenCiphertext' in (dto as Record<string, unknown>), false);
});

test('contract profile validators reject unsafe mapping rules', () => {
  const requestTemplateErrors = validateRequestTemplate({ query: { owner: 'acme' } });
  assert.deepEqual(requestTemplateErrors, []);

  const requestMappingErrors = validateRequestMappingRules([
    { sourcePath: 'input.owner', targetPath: 'query.owner' },
    { sourcePath: '__proto__.polluted', targetPath: 'query.bad' },
  ]);
  assert.ok(requestMappingErrors.some((error) => error.includes('forbidden path prefix')));

  const responseMappingErrors = validateResponseMappingRules([
    { sourcePath: 'response.items[0].id', targetPath: 'requestId' },
  ]);
  assert.ok(responseMappingErrors.some((error) => error.includes('reserved runtime key')));

  const errorRulesErrors = validateErrorMappingRules([
    { errorCode: 'upstream_error', statusCode: 502, sourcePath: 'response.error.message' },
    { errorCode: '', statusCode: 700 },
  ]);
  assert.ok(errorRulesErrors.some((error) => error.includes('errorCode is required')));
  assert.ok(errorRulesErrors.some((error) => error.includes('HTTP status code')));
});

test('validateToolStepBindingInput enforces canonical binding values', () => {
  const validErrors = validateToolStepBindingInput({
    toolKey: 'funnel-pages',
    stepKey: 'optin',
    workflowStepType: 'acquisition',
    bindingStatus: 'active',
    requiredness: 'required-by-tool-setting',
  });
  assert.deepEqual(validErrors, []);

  const invalidErrors = validateToolStepBindingInput({
    toolKey: 'f',
    stepKey: 'x',
    workflowStepType: 'generation',
    bindingStatus: 'disabled',
    requiredness: 'mandatory',
  });
  assert.ok(invalidErrors.some((error) => error.includes('workflowStepType must be acquisition')));
  assert.ok(invalidErrors.some((error) => error.includes('bindingStatus must be active or inactive')));
  assert.ok(invalidErrors.some((error) => error.includes('requiredness must be')));
});
