import type { ResolvedApiServiceForAcquisition } from '../../adapters/api-service.adapter';
import {
  normalizeTokenHeaderName,
  validateTokenHeaderName,
} from './api-service-validation';

export type ApiAcquisitionExecutionInput = {
  service: ResolvedApiServiceForAcquisition;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
};

export type ApiAcquisitionExecutionResult = {
  statusCode: number;
  payload: Record<string, unknown>;
};

const RETRY_BACKOFF_BASE_MS = 100;
const RETRY_BACKOFF_MAX_MS = 2000;
const RETRY_JITTER_RATIO = 0.2;
const RETRY_MAX_ELAPSED_MS = 120000;

class ApiAcquisitionHttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

type RequestEnvelope = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query: Record<string, string>;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const toPathSegments = (path: string): string[] => {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
};

const getByPath = (value: unknown, path: string): unknown => {
  const segments = toPathSegments(path);
  let current: unknown = value;

  for (const segment of segments) {
    if (!isPlainRecord(current) && !Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
};

const setByPath = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const segments = toPathSegments(path);
  if (segments.length === 0) {
    return;
  }

  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index] as string;
    const next = cursor[segment];

    if (!isPlainRecord(next)) {
      cursor[segment] = {};
    }

    cursor = cursor[segment] as Record<string, unknown>;
  }

  const leaf = segments[segments.length - 1] as string;
  cursor[leaf] = value;
};

const normalizeQueryRecord = (query: Record<string, unknown>): Record<string, string> => {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) {
      continue;
    }
    normalized[key] = String(value);
  }

  return normalized;
};

const normalizeStringRecord = (value: unknown): Record<string, string> => {
  if (!isPlainRecord(value)) {
    return {};
  }

  const output: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === null || item === undefined) {
      continue;
    }
    output[key] = String(item);
  }
  return output;
};

const upsertHeaderCaseInsensitive = (
  headers: Record<string, string>,
  headerName: string,
  value: string,
): void => {
  const normalizedKey = headerName.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === normalizedKey) {
      delete headers[key];
    }
  }
  headers[headerName] = value;
};

const resolveTokenHeaderName = (service: ResolvedApiServiceForAcquisition): string => {
  const normalized = normalizeTokenHeaderName(service.tokenHeaderName);
  if (!normalized) {
    return 'Authorization';
  }

  const validationErrors = validateTokenHeaderName(normalized);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join('; '));
  }

  return normalized;
};

const buildLegacyEnvelope = (input: ApiAcquisitionExecutionInput): RequestEnvelope => {
  const method = (input.method ?? 'GET') as RequestEnvelope['method'];
  return {
    method,
    query: { ...(input.query ?? {}) },
    headers: normalizeStringRecord(input.headers),
    ...(input.body ? { body: input.body } : {}),
  };
};

const hasContractProfileConfig = (service: ResolvedApiServiceForAcquisition): boolean => {
  return service.requestMethod !== 'GET'
    || Object.keys(service.requestTemplateJson).length > 0
    || service.requestMappingRulesJson.length > 0
    || Object.keys(service.requestHeadersTemplateJson).length > 0
    || service.responseMappingRulesJson.length > 0
    || service.errorMappingRulesJson.length > 0;
};

const buildProfileEnvelope = (input: ApiAcquisitionExecutionInput): RequestEnvelope => {
  const envelope: Record<string, unknown> = {
    method: input.service.requestMethod,
    query: {},
    headers: normalizeStringRecord(input.service.requestHeadersTemplateJson),
  };

  const requestTemplate = input.service.requestTemplateJson;
  if (isPlainRecord(requestTemplate)) {
    if (isPlainRecord(requestTemplate.query)) {
      envelope.query = {
        ...(envelope.query as Record<string, unknown>),
        ...requestTemplate.query,
      };
    }

    if (isPlainRecord(requestTemplate.headers)) {
      envelope.headers = {
        ...(envelope.headers as Record<string, unknown>),
        ...requestTemplate.headers,
      };
    }

    if (isPlainRecord(requestTemplate.body)) {
      envelope.body = {
        ...(isPlainRecord(envelope.body) ? envelope.body : {}),
        ...requestTemplate.body,
      };
    }
  }

  const source = {
    query: input.query ?? {},
    body: input.body ?? {},
    headers: input.headers ?? {},
    input: {
      query: input.query ?? {},
      body: input.body ?? {},
      headers: input.headers ?? {},
    },
  };

  for (const [index, rawRule] of input.service.requestMappingRulesJson.entries()) {
    if (!isPlainRecord(rawRule)) {
      continue;
    }

    const sourcePath = typeof rawRule.sourcePath === 'string' ? rawRule.sourcePath : '';
    const targetPath = typeof rawRule.targetPath === 'string' ? rawRule.targetPath : '';
    const required = rawRule.required === true;

    if (!sourcePath || !targetPath) {
      continue;
    }

    const mappedValue = getByPath(source, sourcePath);
    if (mappedValue === undefined) {
      if (required) {
        throw new Error(`Api acquisition request mapping missing required sourcePath at index ${index}`);
      }
      continue;
    }

    setByPath(envelope, targetPath, mappedValue);
  }

  const method = String(envelope.method ?? input.service.requestMethod).toUpperCase();
  const normalizedMethod = (
    method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
  )
    ? method
    : 'GET';

  return {
    method: normalizedMethod,
    query: normalizeQueryRecord(isPlainRecord(envelope.query) ? envelope.query : {}),
    headers: normalizeStringRecord(envelope.headers),
    ...(isPlainRecord(envelope.body) ? { body: envelope.body } : {}),
  };
};

const applyResponseMapping = (
  payload: Record<string, unknown>,
  service: ResolvedApiServiceForAcquisition,
): Record<string, unknown> => {
  if (service.responseMappingRulesJson.length === 0) {
    return payload;
  }

  const normalized: Record<string, unknown> = {};

  for (const [index, rawRule] of service.responseMappingRulesJson.entries()) {
    if (!isPlainRecord(rawRule)) {
      continue;
    }

    const sourcePath = typeof rawRule.sourcePath === 'string' ? rawRule.sourcePath : '';
    const targetPath = typeof rawRule.targetPath === 'string' ? rawRule.targetPath : '';
    const required = rawRule.required === true;

    if (!sourcePath || !targetPath) {
      continue;
    }

    const value = getByPath(payload, sourcePath);
    if (value === undefined) {
      if (required) {
        throw new Error(`Api acquisition response mapping missing required sourcePath at index ${index}`);
      }
      continue;
    }

    setByPath(normalized, targetPath, value);
  }

  return normalized;
};

const projectError = (
  service: ResolvedApiServiceForAcquisition,
  statusCode: number,
  payload: Record<string, unknown>,
): ApiAcquisitionHttpError => {
  const baseMessage = `Acquisition HTTP ${statusCode}`;

  for (const rule of service.errorMappingRulesJson) {
    if (!isPlainRecord(rule)) {
      continue;
    }

    const ruleStatusCode = typeof rule.statusCode === 'number' ? rule.statusCode : undefined;
    if (ruleStatusCode !== undefined && ruleStatusCode !== statusCode) {
      continue;
    }

    const errorCode = typeof rule.errorCode === 'string' && rule.errorCode.trim().length > 0
      ? rule.errorCode.trim()
      : 'api_acquisition_error';

    const messageFromRule = typeof rule.message === 'string' ? rule.message.trim() : '';
    const sourcePath = typeof rule.sourcePath === 'string' ? rule.sourcePath : undefined;
    const sourceValue = sourcePath ? getByPath(payload, sourcePath) : undefined;
    const sourceMessage = typeof sourceValue === 'string' ? sourceValue : undefined;

    const message = messageFromRule || sourceMessage || baseMessage;
    return new ApiAcquisitionHttpError(statusCode, `${baseMessage} [${errorCode}] ${message}`);
  }

  const payloadMessage = typeof payload.error === 'string'
    ? payload.error
    : (typeof getByPath(payload, 'error.message') === 'string'
      ? (getByPath(payload, 'error.message') as string)
      : undefined);

  return new ApiAcquisitionHttpError(
    statusCode,
    payloadMessage ? `${baseMessage} ${payloadMessage}` : baseMessage,
  );
};

const isRetryableAcquisitionError = (error: unknown): boolean => {
  if (error instanceof ApiAcquisitionHttpError) {
    return error.statusCode === 429 || error.statusCode >= 500;
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }

  return error instanceof TypeError;
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const computeRetryDelayMs = (attempt: number): number => {
  const exponential = Math.min(RETRY_BACKOFF_MAX_MS, RETRY_BACKOFF_BASE_MS * (2 ** Math.max(0, attempt - 1)));
  const jitterRange = exponential * RETRY_JITTER_RATIO;
  const jitter = (Math.random() * (2 * jitterRange)) - jitterRange;
  const jittered = Math.round(exponential + jitter);
  return Math.max(RETRY_BACKOFF_BASE_MS, Math.min(RETRY_BACKOFF_MAX_MS, jittered));
};

const buildUrl = (service: ResolvedApiServiceForAcquisition, query?: Record<string, string>): URL => {
  const url = new URL(service.resourcePath, service.baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
};

const normalizePayload = async (response: Response): Promise<Record<string, unknown>> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return await response.json() as Record<string, unknown>;
  }

  return {
    text: await response.text(),
  };
};

export const executeApiAcquisition = async (
  input: ApiAcquisitionExecutionInput,
): Promise<ApiAcquisitionExecutionResult> => {
  const maxAttempts = Math.max(1, input.service.retryCount + 1);
  const timeoutMs = input.service.timeoutMs;
  const requestEnvelope = hasContractProfileConfig(input.service)
    ? buildProfileEnvelope(input)
    : buildLegacyEnvelope(input);

  let attempt = 0;
  let lastError: unknown = null;
  const startedAt = Date.now();

  while (attempt < maxAttempts) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = buildUrl(input.service, requestEnvelope.query);
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        ...requestEnvelope.headers,
      };

      if (input.service.accessMode === 'token' && input.service.tokenCiphertext) {
        const tokenHeaderName = resolveTokenHeaderName(input.service);
        const tokenValue = tokenHeaderName.toLowerCase() === 'authorization'
          ? `Bearer ${input.service.tokenCiphertext}`
          : input.service.tokenCiphertext;
        upsertHeaderCaseInsensitive(headers, tokenHeaderName, tokenValue);
      } else if (input.service.accessMode === 'query-param' && input.service.tokenCiphertext) {
        const paramName = input.service.tokenParamName || 'api_key';
        url.searchParams.set(paramName, input.service.tokenCiphertext);
      }

      const method = requestEnvelope.method;

      const response = await fetch(url, {
        method,
        headers,
        ...(requestEnvelope.body && method !== 'GET'
          ? { body: JSON.stringify(requestEnvelope.body) }
          : {}),
        signal: controller.signal,
      });

      const payload = await normalizePayload(response);

      if (!response.ok) {
        throw projectError(input.service, response.status, payload);
      }

      return {
        statusCode: response.status,
        payload: applyResponseMapping(payload, input.service),
      };
    } catch (error) {
      lastError = error;
      const retryable = isRetryableAcquisitionError(error);
      if (!retryable || attempt >= maxAttempts) {
        break;
      }

      const elapsedMs = Date.now() - startedAt;
      const nextDelayMs = computeRetryDelayMs(attempt);
      if (elapsedMs + nextDelayMs > RETRY_MAX_ELAPSED_MS) {
        break;
      }

      await sleep(nextDelayMs);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Api acquisition failed after ${maxAttempts} attempts: ${String(lastError)}`);
};
