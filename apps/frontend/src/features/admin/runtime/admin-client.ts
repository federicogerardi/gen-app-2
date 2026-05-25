import { buildApiPaths } from '../../../app/runtime/api-paths';
import { resolveBackendCapabilities, type BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import type { AuthUserRole, AuthUserStatus } from '../../auth/runtime/auth-client';
import {
  isHttpClientError,
  joinApiPath,
  requestJson,
  requestVoid,
} from '../../../app/runtime/http-client';

export type AdminUser = {
  id: string;
  email: string;
  role: AuthUserRole;
  status: AuthUserStatus;
  monthlyQuota?: number;
  monthlyUsed?: number;
};

export type CreateAdminUserInput = {
  email: string;
  role?: AuthUserRole;
  status?: AuthUserStatus;
  password?: string;
  monthlyQuota?: number;
  monthlyUsed?: number;
};

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
  tokenHeaderName: string | null;
  responseMappingRulesJson: ApiServiceResponseMappingRule[];
  errorMappingRulesJson: ApiServiceErrorMappingRule[];
  contractProfileVersion: number;
  status: ApiServiceStatus;
  tokenConfigured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiServiceBinding = {
  id: string;
  apiServiceId: string;
  toolKey: string;
  stepKey: string;
  workflowStepType: 'acquisition';
  bindingStatus: ApiServiceBindingStatus;
  requiredness: ApiServiceBindingRequiredness;
  createdAt: string;
  updatedAt: string;
};

export type CreateAdminApiServiceInput = {
  key: string;
  label: string;
  baseUrl: string;
  resourcePath: string;
  accessMode: ApiServiceAccessMode;
  timeoutMs?: number;
  retryCount?: number;
  requestMethod?: ApiServiceRequestMethod;
  requestTemplateJson?: Record<string, unknown>;
  requestMappingRulesJson?: ApiServiceRequestMappingRule[];
  requestHeadersTemplateJson?: Record<string, unknown>;
  tokenHeaderName?: string | null;
  responseMappingRulesJson?: ApiServiceResponseMappingRule[];
  errorMappingRulesJson?: ApiServiceErrorMappingRule[];
  contractProfileVersion?: number;
  status?: ApiServiceStatus;
};

export type UpdateAdminApiServiceInput = Partial<CreateAdminApiServiceInput>;

export type UpsertAdminApiServiceBindingInput = {
  id?: string;
  toolKey: string;
  stepKey: string;
  workflowStepType?: 'acquisition';
  bindingStatus?: ApiServiceBindingStatus;
  requiredness?: ApiServiceBindingRequiredness;
};

type AdminApiServicesEnvelope = {
  apiServices?: unknown;
  apiService?: unknown;
  data?: {
    apiServices?: unknown;
    apiService?: unknown;
  };
};

type AdminApiServiceBindingsEnvelope = {
  bindings?: unknown;
  binding?: unknown;
  data?: {
    bindings?: unknown;
    binding?: unknown;
  };
};

const readString = (value: unknown): string | null => (
  typeof value === 'string' ? value : null
);

const readNumber = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const readBoolean = (value: unknown): boolean => value === true;

const readRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const readArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

const readApiService = (value: unknown): ApiService | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const service = value as Record<string, unknown>;
  const id = readString(service.id);
  const key = readString(service.key);
  const label = readString(service.label);
  const baseUrl = readString(service.baseUrl);
  const resourcePath = readString(service.resourcePath);
  const accessMode = readString(service.accessMode) as ApiServiceAccessMode | null;
  const requestMethod = readString(service.requestMethod) as ApiServiceRequestMethod | null;
  const status = readString(service.status) as ApiServiceStatus | null;
  const tokenHeaderNameRaw = service.tokenHeaderName;
  const createdAt = readString(service.createdAt);
  const updatedAt = readString(service.updatedAt);

  if (!id || !key || !label || !baseUrl || !resourcePath || !accessMode || !requestMethod || !status || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    key,
    label,
    baseUrl,
    resourcePath,
    accessMode,
    timeoutMs: readNumber(service.timeoutMs) ?? 0,
    retryCount: readNumber(service.retryCount) ?? 0,
    requestMethod,
    requestTemplateJson: readRecord(service.requestTemplateJson),
    requestMappingRulesJson: readArray<ApiServiceRequestMappingRule>(service.requestMappingRulesJson),
    requestHeadersTemplateJson: readRecord(service.requestHeadersTemplateJson),
    tokenHeaderName: typeof tokenHeaderNameRaw === 'string'
      ? tokenHeaderNameRaw
      : null,
    responseMappingRulesJson: readArray<ApiServiceResponseMappingRule>(service.responseMappingRulesJson),
    errorMappingRulesJson: readArray<ApiServiceErrorMappingRule>(service.errorMappingRulesJson),
    contractProfileVersion: readNumber(service.contractProfileVersion) ?? 1,
    status,
    tokenConfigured: readBoolean(service.tokenConfigured),
    createdAt,
    updatedAt,
  };
};

const readApiServiceList = (payload: unknown): ApiService[] => {
  if (Array.isArray(payload)) {
    return payload.map(readApiService).filter((service): service is ApiService => service !== null);
  }

  if (payload && typeof payload === 'object') {
    const envelope = payload as AdminApiServicesEnvelope;
    const services = envelope.apiServices ?? envelope.data?.apiServices;
    if (services) {
      return readApiServiceList(services);
    }

    const single = envelope.apiService ?? envelope.data?.apiService;
    if (single) {
      const service = readApiService(single);
      return service ? [service] : [];
    }
  }

  return [];
};

const readApiServiceBinding = (value: unknown): ApiServiceBinding | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const binding = value as Record<string, unknown>;
  const id = readString(binding.id);
  const apiServiceId = readString(binding.apiServiceId);
  const toolKey = readString(binding.toolKey);
  const stepKey = readString(binding.stepKey);
  const workflowStepType = readString(binding.workflowStepType);
  const bindingStatus = readString(binding.bindingStatus) as ApiServiceBindingStatus | null;
  const requiredness = readString(binding.requiredness) as ApiServiceBindingRequiredness | null;
  const createdAt = readString(binding.createdAt);
  const updatedAt = readString(binding.updatedAt);

  if (!id || !apiServiceId || !toolKey || !stepKey || workflowStepType !== 'acquisition' || !bindingStatus || !requiredness || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    apiServiceId,
    toolKey,
    stepKey,
    workflowStepType: 'acquisition',
    bindingStatus,
    requiredness,
    createdAt,
    updatedAt,
  };
};

const readApiServiceBindingsList = (payload: unknown): ApiServiceBinding[] => {
  if (Array.isArray(payload)) {
    return payload.map(readApiServiceBinding).filter((binding): binding is ApiServiceBinding => binding !== null);
  }

  if (payload && typeof payload === 'object') {
    const envelope = payload as AdminApiServiceBindingsEnvelope;
    const bindings = envelope.bindings ?? envelope.data?.bindings;
    if (bindings) {
      return readApiServiceBindingsList(bindings);
    }

    const single = envelope.binding ?? envelope.data?.binding;
    if (single) {
      const binding = readApiServiceBinding(single);
      return binding ? [binding] : [];
    }
  }

  return [];
};

const readApiServiceBindingItem = (payload: unknown): ApiServiceBinding | null => {
  if (Array.isArray(payload)) {
    return readApiServiceBinding(payload[0] ?? null);
  }

  if (payload && typeof payload === 'object') {
    const envelope = payload as AdminApiServiceBindingsEnvelope;
    const binding = envelope.binding ?? envelope.data?.binding;
    if (binding) {
      return readApiServiceBinding(binding);
    }
  }

  return readApiServiceBinding(payload);
};

const missingApiServiceError = (scope: 'catalog' | 'bindings'): Error => {
  return new Error(
    scope === 'catalog'
      ? 'Admin ApiService CRUD is disabled in this environment.'
      : 'Admin ApiService bindings CRUD is disabled in this environment.',
  );
};

const requireAdminApiServicePath = (path: string | null, scope: 'catalog' | 'bindings'): string => {
  if (!path) {
    throw missingApiServiceError(scope);
  }

  return path;
};

const readApiServiceResponse = (payload: unknown): ApiService | null => {
  const services = readApiServiceList(payload);
  return services[0] ?? null;
};

export type UpdateAdminUserInput = {
  email?: string;
  role?: AuthUserRole;
  status?: AuthUserStatus;
  password?: string;
  monthlyQuota?: number;
  monthlyUsed?: number;
};

type AdminClientOptions = {
  apiBaseUrl?: string;
  capabilities?: Partial<BackendCapabilities>;
};

type AdminUsersResponse =
  | AdminUser[]
  | {
    user?: AdminUser;
    users?: AdminUser[];
    data?: {
      user?: AdminUser;
      users?: AdminUser[];
    };
  };
const readAdminUsers = (payload: AdminUsersResponse): AdminUser[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  const users = payload.users ?? payload.data?.users;
  if (users) {
    return users;
  }

  const user = payload.user ?? payload.data?.user;
  return user ? [user] : [];
};

const readAdminUser = (payload: AdminUsersResponse): AdminUser | null => {
  if (Array.isArray(payload)) {
    return payload[0] ?? null;
  }

  return payload.user ?? payload.data?.user ?? readAdminUsers(payload)[0] ?? null;
};

export const listAdminUsers = async (
  options: AdminClientOptions = {},
): Promise<AdminUser[]> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).admin.users;

  try {
    const payload = await requestJson<AdminUsersResponse>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'GET',
      credentials: 'include',
    });

    return readAdminUsers(payload);
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to list admin users (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const getAdminUserById = async (
  id: string,
  options: AdminClientOptions = {},
): Promise<AdminUser | null> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).admin.userById(id);

  try {
    const payload = await requestJson<AdminUsersResponse>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'GET',
      credentials: 'include',
    });

    return readAdminUser(payload);
  } catch (error) {
    if (isHttpClientError(error) && error.status === 404) {
      return null;
    }

    if (isHttpClientError(error)) {
      throw new Error(`Unable to load admin user detail (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const createAdminUser = async (
  input: CreateAdminUserInput,
  options: AdminClientOptions = {},
): Promise<AdminUser> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).admin.users;

  try {
    const payload = await requestJson<AdminUsersResponse>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const created = readAdminUser(payload);
    if (!created) {
      throw new Error('Unable to create admin user (invalid payload)');
    }

    return created;
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to create admin user (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const updateAdminUser = async (
  id: string,
  input: UpdateAdminUserInput,
  options: AdminClientOptions = {},
): Promise<AdminUser> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).admin.userById(id);

  try {
    const payload = await requestJson<AdminUsersResponse>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const updated = readAdminUser(payload);
    if (!updated) {
      throw new Error('Unable to update admin user (invalid payload)');
    }

    return updated;
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to update admin user (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const deleteAdminUser = async (
  id: string,
  options: AdminClientOptions = {},
): Promise<void> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).admin.userById(id);

  try {
    await requestVoid(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to delete admin user (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const listAdminApiServices = async (
  options: AdminClientOptions = {},
): Promise<ApiService[]> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = requireAdminApiServicePath(buildApiPaths(capabilities).admin.apiServices, 'catalog');

  try {
    const payload = await requestJson<unknown>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'GET',
      credentials: 'include',
    });

    return readApiServiceList(payload);
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to load admin ApiService catalog (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const createAdminApiService = async (
  input: CreateAdminApiServiceInput,
  options: AdminClientOptions = {},
): Promise<ApiService> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = requireAdminApiServicePath(buildApiPaths(capabilities).admin.apiServices, 'catalog');

  try {
    const payload = await requestJson<unknown>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const created = readApiServiceResponse(payload);
    if (!created) {
      throw new Error('Unable to create admin ApiService (invalid payload)');
    }

    return created;
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to create admin ApiService (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const updateAdminApiService = async (
  id: string,
  input: UpdateAdminApiServiceInput,
  options: AdminClientOptions = {},
): Promise<ApiService> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = requireAdminApiServicePath(buildApiPaths(capabilities).admin.apiServiceById(id), 'catalog');

  try {
    const payload = await requestJson<unknown>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const updated = readApiServiceResponse(payload);
    if (!updated) {
      throw new Error('Unable to update admin ApiService (invalid payload)');
    }

    return updated;
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to update admin ApiService (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const deleteAdminApiService = async (
  id: string,
  options: AdminClientOptions = {},
): Promise<void> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = requireAdminApiServicePath(buildApiPaths(capabilities).admin.apiServiceById(id), 'catalog');

  try {
    await requestVoid(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to delete admin ApiService (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const listAdminApiServiceBindings = async (
  apiServiceId: string,
  options: AdminClientOptions = {},
): Promise<ApiServiceBinding[]> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = requireAdminApiServicePath(
    buildApiPaths(capabilities).admin.apiServiceBindings(apiServiceId),
    'bindings',
  );

  try {
    const payload = await requestJson<unknown>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'GET',
      credentials: 'include',
    });

    return readApiServiceBindingsList(payload);
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to load admin ApiService bindings (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const upsertAdminApiServiceBinding = async (
  apiServiceId: string,
  input: UpsertAdminApiServiceBindingInput,
  options: AdminClientOptions = {},
): Promise<ApiServiceBinding> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = requireAdminApiServicePath(
    buildApiPaths(capabilities).admin.apiServiceBindings(apiServiceId),
    'bindings',
  );

  try {
    const payload = await requestJson<unknown>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        workflowStepType: 'acquisition',
      }),
    });

    const binding = readApiServiceBindingItem(payload);
    if (!binding) {
      throw new Error('Unable to upsert admin ApiService binding (invalid payload)');
    }

    return binding;
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to upsert admin ApiService binding (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const deleteAdminApiServiceBinding = async (
  apiServiceId: string,
  bindingId: string,
  options: AdminClientOptions = {},
): Promise<void> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = requireAdminApiServicePath(
    buildApiPaths(capabilities).admin.apiServiceBindingById(apiServiceId, bindingId),
    'bindings',
  );

  try {
    await requestVoid(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to delete admin ApiService binding (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};


