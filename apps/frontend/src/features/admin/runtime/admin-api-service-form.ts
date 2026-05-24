import { z } from 'zod';

import type { ApiService, ApiServiceAccessMode, ApiServiceRequestMethod, ApiServiceStatus } from './admin-client';

export const ADMIN_API_SERVICE_ACCESS_MODE_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'token', label: 'Token' },
] as const satisfies ReadonlyArray<{ value: ApiServiceAccessMode; label: string }>;

export const ADMIN_API_SERVICE_REQUEST_METHOD_OPTIONS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
] as const satisfies ReadonlyArray<{ value: ApiServiceRequestMethod; label: string }>;

export const ADMIN_API_SERVICE_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const satisfies ReadonlyArray<{ value: ApiServiceStatus; label: string }>;

const isValidJson = (value: string): boolean => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

const stringJson = (message: string) => z.string().refine((value) => isValidJson(value), message);
const HEADER_NAME_REGEX = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/;

export const adminApiServiceFormSchema = z.object({
  key: z.string().min(1, 'Key richiesto'),
  label: z.string().min(1, 'Label richiesta'),
  baseUrl: z.string().min(1, 'Base URL richiesta'),
  resourcePath: z.string().min(1, 'Resource path richiesta'),
  accessMode: z.enum(['public', 'token']),
  requestMethod: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  tokenHeaderName: z.string().optional().refine((value) => {
    if (!value?.trim()) {
      return true;
    }
    return HEADER_NAME_REGEX.test(value.trim());
  }, 'Token header name non valido'),
  timeoutMs: z.string().optional().refine((value) => !value?.trim() || Number.isInteger(Number(value)) && Number(value) >= 0, 'Timeout must be a non-negative integer'),
  retryCount: z.string().optional().refine((value) => !value?.trim() || Number.isInteger(Number(value)) && Number(value) >= 0, 'Retry count must be a non-negative integer'),
  contractProfileVersion: z.string().optional().refine((value) => !value?.trim() || Number.isInteger(Number(value)) && Number(value) >= 1, 'Contract profile version must be a positive integer'),
  status: z.enum(['active', 'inactive']),
  requestTemplateJson: stringJson('Request template JSON non valido'),
  requestMappingRulesJson: stringJson('Request mapping JSON non valido'),
  requestHeadersTemplateJson: stringJson('Request headers JSON non valido'),
  responseMappingRulesJson: stringJson('Response mapping JSON non valido'),
  errorMappingRulesJson: stringJson('Error mapping JSON non valido'),
});

export type AdminApiServiceFormValues = z.infer<typeof adminApiServiceFormSchema>;

export const createEmptyAdminApiServiceForm = (): AdminApiServiceFormValues => ({
  key: '',
  label: '',
  baseUrl: '',
  resourcePath: '',
  accessMode: 'public',
  requestMethod: 'GET',
  tokenHeaderName: '',
  timeoutMs: '',
  retryCount: '',
  contractProfileVersion: '1',
  status: 'active',
  requestTemplateJson: '{}',
  requestMappingRulesJson: '[]',
  requestHeadersTemplateJson: '{}',
  responseMappingRulesJson: '[]',
  errorMappingRulesJson: '[]',
});

export const createEditAdminApiServiceForm = (service: ApiService): AdminApiServiceFormValues => ({
  key: service.key,
  label: service.label,
  baseUrl: service.baseUrl,
  resourcePath: service.resourcePath,
  accessMode: service.accessMode,
  requestMethod: service.requestMethod,
  tokenHeaderName: service.tokenHeaderName ?? '',
  timeoutMs: String(service.timeoutMs),
  retryCount: String(service.retryCount),
  contractProfileVersion: String(service.contractProfileVersion),
  status: service.status,
  requestTemplateJson: JSON.stringify(service.requestTemplateJson, null, 2),
  requestMappingRulesJson: JSON.stringify(service.requestMappingRulesJson, null, 2),
  requestHeadersTemplateJson: JSON.stringify(service.requestHeadersTemplateJson, null, 2),
  responseMappingRulesJson: JSON.stringify(service.responseMappingRulesJson, null, 2),
  errorMappingRulesJson: JSON.stringify(service.errorMappingRulesJson, null, 2),
});

export const parseOptionalInteger = (value: string | undefined): number | undefined => {
  if (!value || !value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
};

export const parsePositiveInteger = (value: string | undefined): number | undefined => {
  if (!value || !value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
};

export const parseOptionalTokenHeaderName = (value: string | undefined): string | null => {
  if (!value || !value.trim()) {
    return null;
  }

  return value.trim();
};

export const parseJsonRecord = <T extends Record<string, unknown>>(value: string, fallback: T): T => {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as T;
    }
  } catch {
    // validation happens before submit
  }

  return fallback;
};

export const parseJsonArray = <T>(value: string, fallback: T[] = []): T[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
};
