import {
  toApiServiceRedactedDto as toApiServiceRedactedMapper,
  type ApiService,
  type ApiServiceRedactedDto,
  type ApiServiceErrorMappingRule,
} from '../../types/api-service';

export type ApiServiceValidationInput = {
  key: string;
  label: string;
  baseUrl: string;
  resourcePath: string;
  accessMode: 'public' | 'token' | 'query-param';
  timeoutMs?: number;
  retryCount?: number;
  tokenRef?: string | null;
  tokenHeaderName?: string | null;
  tokenParamName?: string | null;
};

export type ToolStepBindingValidationInput = {
  toolKey: string;
  stepKey: string;
  workflowStepType?: string;
  bindingStatus?: string;
  requiredness?: string;
};

const API_SERVICE_KEY_REGEX = /^[a-zA-Z0-9:_-]{2,128}$/;
const HEADER_NAME_REGEX = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/;
const PATH_REGEX = /^[a-zA-Z0-9_.\[\]-]{1,256}$/;
const MAPPING_RULE_RESERVED_RUNTIME_KEYS = new Set([
  'requestId',
  'userId',
  'projectId',
  'idempotencyKey',
  'model',
  'workflowType',
  'toolKey',
]);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const validatePath = (path: string, field: string): string[] => {
  const trimmed = path.trim();
  const errors: string[] = [];

  if (!PATH_REGEX.test(trimmed)) {
    errors.push(`${field} must match ${PATH_REGEX.source}`);
  }

  if (
    trimmed.startsWith('__proto__')
    || trimmed.startsWith('constructor')
    || trimmed.startsWith('prototype')
  ) {
    errors.push(`${field} uses forbidden path prefix`);
  }

  return errors;
};

const validateRuleSet = (
  rules: unknown,
  kind: 'request' | 'response',
): string[] => {
  if (!Array.isArray(rules)) {
    return [`${kind} mapping rules must be an array`];
  }

  const errors: string[] = [];
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    if (!isPlainRecord(rule)) {
      errors.push(`${kind} mapping rule[${index}] must be an object`);
      continue;
    }

    const sourcePath = typeof rule.sourcePath === 'string' ? rule.sourcePath : '';
    const targetPath = typeof rule.targetPath === 'string' ? rule.targetPath : '';

    if (sourcePath.length === 0) {
      errors.push(`${kind} mapping rule[${index}] sourcePath is required`);
    }
    if (targetPath.length === 0) {
      errors.push(`${kind} mapping rule[${index}] targetPath is required`);
    }

    errors.push(...validatePath(sourcePath, `${kind} mapping rule[${index}] sourcePath`));
    errors.push(...validatePath(targetPath, `${kind} mapping rule[${index}] targetPath`));

    const firstTargetSegment = targetPath.split('.')[0] ?? '';
    if (MAPPING_RULE_RESERVED_RUNTIME_KEYS.has(firstTargetSegment)) {
      errors.push(`${kind} mapping rule[${index}] targetPath uses reserved runtime key`);
    }
  }

  return errors;
};

export const validateRequestTemplate = (template: unknown): string[] => {
  if (!isPlainRecord(template)) {
    return ['requestTemplateJson must be an object'];
  }
  return [];
};

export const validateRequestMappingRules = (
  rules: unknown,
): string[] => validateRuleSet(rules, 'request');

export const validateResponseMappingRules = (
  rules: unknown,
): string[] => validateRuleSet(rules, 'response');

export const validateErrorMappingRules = (rules: unknown): string[] => {
  if (!Array.isArray(rules)) {
    return ['errorMappingRulesJson must be an array'];
  }

  const errors: string[] = [];
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    if (!isPlainRecord(rule)) {
      errors.push(`error mapping rule[${index}] must be an object`);
      continue;
    }

    const typedRule = rule as ApiServiceErrorMappingRule;
    if (typeof typedRule.errorCode !== 'string' || typedRule.errorCode.trim().length === 0) {
      errors.push(`error mapping rule[${index}] errorCode is required`);
    }

    if (typedRule.sourcePath !== undefined) {
      errors.push(...validatePath(typedRule.sourcePath, `error mapping rule[${index}] sourcePath`));
    }

    if (typedRule.statusCode !== undefined) {
      if (!Number.isInteger(typedRule.statusCode) || typedRule.statusCode < 100 || typedRule.statusCode > 599) {
        errors.push(`error mapping rule[${index}] statusCode must be an HTTP status code`);
      }
    }
  }

  return errors;
};

export const validateToolStepBindingInput = (
  payload: ToolStepBindingValidationInput,
): string[] => {
  const errors: string[] = [];

  if (!API_SERVICE_KEY_REGEX.test(payload.toolKey.trim())) {
    errors.push('toolKey must be 2-128 chars matching [a-zA-Z0-9:_-]');
  }

  if (!API_SERVICE_KEY_REGEX.test(payload.stepKey.trim())) {
    errors.push('stepKey must be 2-128 chars matching [a-zA-Z0-9:_-]');
  }

  if (payload.workflowStepType !== undefined && payload.workflowStepType !== 'acquisition' && payload.workflowStepType !== 'crawling') {
    errors.push('workflowStepType must be acquisition or crawling');
  }

  if (
    payload.bindingStatus !== undefined
    && payload.bindingStatus !== 'active'
    && payload.bindingStatus !== 'inactive'
  ) {
    errors.push('bindingStatus must be active or inactive');
  }

  if (
    payload.requiredness !== undefined
    && payload.requiredness !== 'always-required'
    && payload.requiredness !== 'required-by-tool-setting'
    && payload.requiredness !== 'optional-by-tool-setting'
  ) {
    errors.push('requiredness must be always-required, required-by-tool-setting, or optional-by-tool-setting');
  }

  return errors;
};

export const normalizeTokenHeaderName = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const validateTokenHeaderName = (value: string | null | undefined): string[] => {
  const normalized = normalizeTokenHeaderName(value);
  if (!normalized) {
    return [];
  }

  if (!HEADER_NAME_REGEX.test(normalized)) {
    return ['tokenHeaderName must be a valid HTTP header name'];
  }

  return [];
};

export const validateApiServiceInput = (payload: ApiServiceValidationInput): string[] => {
  const errors: string[] = [];

  if (!API_SERVICE_KEY_REGEX.test(payload.key.trim())) {
    errors.push('key must be 2-128 chars matching [a-zA-Z0-9:_-]');
  }

  if (payload.label.trim().length < 2 || payload.label.trim().length > 256) {
    errors.push('label must be 2-256 chars');
  }

  try {
    const parsed = new URL(payload.baseUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      errors.push('baseUrl must use http or https');
    }
  } catch {
    errors.push('baseUrl must be a valid URL');
  }

  if (!payload.resourcePath.startsWith('/')) {
    errors.push('resourcePath must start with /');
  }

  if (payload.accessMode !== 'public' && payload.accessMode !== 'token' && payload.accessMode !== 'query-param') {
    errors.push('accessMode must be public, token, or query-param');
  }

  if (payload.timeoutMs !== undefined && (payload.timeoutMs < 100 || payload.timeoutMs > 120000)) {
    errors.push('timeoutMs must be between 100 and 120000');
  }

  if (payload.retryCount !== undefined && (payload.retryCount < 0 || payload.retryCount > 5)) {
    errors.push('retryCount must be between 0 and 5');
  }

  if (payload.accessMode === 'token' && (!payload.tokenRef || payload.tokenRef.trim().length === 0)) {
    errors.push('tokenRef is required when accessMode is token');
  }

  if (payload.accessMode === 'query-param' && (!payload.tokenRef || payload.tokenRef.trim().length === 0)) {
    errors.push('tokenRef is required when accessMode is query-param');
  }

  errors.push(...validateTokenHeaderName(payload.tokenHeaderName));

  return errors;
};

export const toApiServiceRedactedDto = (
  service: ApiService,
  tokenConfigured: boolean,
): ApiServiceRedactedDto => {
  return toApiServiceRedactedMapper(service, tokenConfigured);
};
