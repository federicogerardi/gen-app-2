export type ApiServiceAccessMode = 'public' | 'token';
export type ApiServiceStatus = 'active' | 'inactive';
export type ApiServiceRequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ApiServiceBindingStatus = 'active' | 'inactive';
export type ApiServiceBindingRequiredness =
  | 'always-required'
  | 'required-by-tool-setting'
  | 'optional-by-tool-setting';

export type ApiServiceRequestMappingRule = {
  sourcePath: string;
  targetPath: string;
  required?: boolean;
};

export type ApiServiceResponseMappingRule = {
  sourcePath: string;
  targetPath: string;
  required?: boolean;
};

export type ApiServiceErrorMappingRule = {
  statusCode?: number;
  sourcePath?: string;
  errorCode: string;
  message?: string;
};

export type ApiService = {
  id: string;
  key: string;
  label: string;
  baseUrl: string;
  resourcePath: string;
  accessMode: ApiServiceAccessMode;
  timeoutMs: number;
  retryCount: number;
  requestMethod: ApiServiceRequestMethod;
  requestTemplateJson: Record<string, unknown>;
  requestMappingRulesJson: ApiServiceRequestMappingRule[];
  requestHeadersTemplateJson: Record<string, unknown>;
  responseMappingRulesJson: ApiServiceResponseMappingRule[];
  errorMappingRulesJson: ApiServiceErrorMappingRule[];
  contractProfileVersion: number;
  tokenRef: string | null;
  status: ApiServiceStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ApiServiceToolStepBinding = {
  id: string;
  apiServiceId: string;
  toolKey: string;
  stepKey: string;
  workflowStepType: 'acquisition';
  bindingStatus: ApiServiceBindingStatus;
  requiredness: ApiServiceBindingRequiredness;
  createdAt: Date;
  updatedAt: Date;
};

export type ApiServiceRedactedDto = {
  id: string;
  key: string;
  label: string;
  baseUrl: string;
  resourcePath: string;
  accessMode: ApiServiceAccessMode;
  timeoutMs: number;
  retryCount: number;
  requestMethod: ApiServiceRequestMethod;
  requestTemplateJson: Record<string, unknown>;
  requestMappingRulesJson: ApiServiceRequestMappingRule[];
  requestHeadersTemplateJson: Record<string, unknown>;
  responseMappingRulesJson: ApiServiceResponseMappingRule[];
  errorMappingRulesJson: ApiServiceErrorMappingRule[];
  contractProfileVersion: number;
  status: ApiServiceStatus;
  tokenRef: string | null;
  tokenConfigured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiServiceRow = {
  id: string;
  key: string;
  label: string;
  base_url: string;
  resource_path: string;
  access_mode: string;
  timeout_ms: number;
  retry_count: number;
  request_method?: string;
  request_template_json?: unknown;
  request_mapping_rules_json?: unknown;
  request_headers_template_json?: unknown;
  response_mapping_rules_json?: unknown;
  error_mapping_rules_json?: unknown;
  contract_profile_version?: number;
  token_ref: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
};

export type ApiServiceToolStepBindingRow = {
  id: string;
  api_service_id: string;
  tool_key: string;
  step_key: string;
  workflow_step_type: string;
  binding_status: string;
  requiredness: string;
  created_at: Date;
  updated_at: Date;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const asArray = <T>(value: unknown): T[] => {
  return Array.isArray(value) ? (value as T[]) : [];
};

export const rowToApiServiceBinding = (row: ApiServiceToolStepBindingRow): ApiServiceToolStepBinding => ({
  id: row.id,
  apiServiceId: row.api_service_id,
  toolKey: row.tool_key,
  stepKey: row.step_key,
  workflowStepType: 'acquisition',
  bindingStatus: row.binding_status as ApiServiceBindingStatus,
  requiredness: row.requiredness as ApiServiceBindingRequiredness,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const rowToApiService = (row: ApiServiceRow): ApiService => ({
  id: row.id,
  key: row.key,
  label: row.label,
  baseUrl: row.base_url,
  resourcePath: row.resource_path,
  accessMode: row.access_mode as ApiServiceAccessMode,
  timeoutMs: row.timeout_ms,
  retryCount: row.retry_count,
  requestMethod: (row.request_method as ApiServiceRequestMethod | undefined) ?? 'GET',
  requestTemplateJson: asRecord(row.request_template_json),
  requestMappingRulesJson: asArray<ApiServiceRequestMappingRule>(row.request_mapping_rules_json),
  requestHeadersTemplateJson: asRecord(row.request_headers_template_json),
  responseMappingRulesJson: asArray<ApiServiceResponseMappingRule>(row.response_mapping_rules_json),
  errorMappingRulesJson: asArray<ApiServiceErrorMappingRule>(row.error_mapping_rules_json),
  contractProfileVersion: row.contract_profile_version ?? 1,
  tokenRef: row.token_ref,
  status: row.status as ApiServiceStatus,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toApiServiceRedactedDto = (
  service: ApiService,
  tokenConfigured: boolean,
): ApiServiceRedactedDto => ({
  id: service.id,
  key: service.key,
  label: service.label,
  baseUrl: service.baseUrl,
  resourcePath: service.resourcePath,
  accessMode: service.accessMode,
  timeoutMs: service.timeoutMs,
  retryCount: service.retryCount,
  requestMethod: service.requestMethod,
  requestTemplateJson: service.requestTemplateJson,
  requestMappingRulesJson: service.requestMappingRulesJson,
  requestHeadersTemplateJson: service.requestHeadersTemplateJson,
  responseMappingRulesJson: service.responseMappingRulesJson,
  errorMappingRulesJson: service.errorMappingRulesJson,
  contractProfileVersion: service.contractProfileVersion,
  status: service.status,
  tokenRef: service.tokenRef,
  tokenConfigured,
  createdAt: service.createdAt.toISOString(),
  updatedAt: service.updatedAt.toISOString(),
});
