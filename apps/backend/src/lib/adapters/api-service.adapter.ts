import { Kysely, sql } from 'kysely';
import type { Pool } from 'pg';

import {
  rowToApiService,
  rowToApiServiceBinding,
  type ApiService,
  type ApiServiceAccessMode,
  type ApiServiceBindingRequiredness,
  type ApiServiceBindingStatus,
  type ApiServiceRequestMethod,
  type ApiServiceRow,
  type ApiServiceStatus,
  type ApiServiceToolStepBinding,
  type ApiServiceToolStepBindingRow,
} from '../types/api-service';

import { createKyselyDb } from './postgres-kysely.dialect';
import type { DB } from './postgres-kysely.types';

/**
 * Escape hatch: Kysely has no typed builder API for PostgreSQL server-side timestamp functions.
 * NOW() must be expressed via the sql template tag; the return type is Date to satisfy
 * Generated<Date> column expectations in .values() and .set() contexts.
 */
const dbNow = sql<Date>`NOW()`;

/**
 * Escape hatch: Kysely has no typed builder API for PostgreSQL UUID generation functions.
 * gen_random_uuid() must be expressed via the sql template tag.
 */
const dbGenUuid = sql<string>`gen_random_uuid()`;

/**
 * Module-level Kysely instance cache keyed by pool identity, mirroring the
 * class-based repository pattern (this.db = createKyselyDb(pg) in constructor).
 * Prevents creating a new Kysely object on every function call.
 */
const _kyselyDbCache = new WeakMap<object, Kysely<DB>>();

function getDb(pool: Pool): Kysely<DB> {
  let db = _kyselyDbCache.get(pool);
  if (!db) {
    db = createKyselyDb(pool);
    _kyselyDbCache.set(pool, db);
  }
  return db;
}

export type CreateApiServiceInput = {
  key: string;
  label: string;
  baseUrl: string;
  resourcePath: string;
  accessMode: ApiServiceAccessMode;
  timeoutMs?: number;
  retryCount?: number;
  requestMethod?: ApiServiceRequestMethod;
  requestTemplateJson?: Record<string, unknown>;
  requestMappingRulesJson?: Array<Record<string, unknown>>;
  requestHeadersTemplateJson?: Record<string, unknown>;
  tokenHeaderName?: string | null;
  tokenParamName?: string | null;
  responseMappingRulesJson?: Array<Record<string, unknown>>;
  errorMappingRulesJson?: Array<Record<string, unknown>>;
  contractProfileVersion?: number;
  tokenRef?: string | null;
  tokenCiphertext?: string | null;
  status?: ApiServiceStatus;
};

export type UpdateApiServiceInput = Partial<CreateApiServiceInput>;

export type UpsertApiServiceBindingInput = {
  id?: string;
  apiServiceId: string;
  toolKey: string;
  stepKey: string;
  workflowStepType?: 'acquisition' | 'crawling';
  bindingStatus?: ApiServiceBindingStatus;
  requiredness?: ApiServiceBindingRequiredness;
};

export type ResolvedApiServiceForAcquisition = ApiService & {
  tokenCiphertext: string | null;
};

export const listApiServices = async (pool: Pool): Promise<ApiService[]> => {
  const rows = await getDb(pool)
    .selectFrom('api_services')
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute() as unknown as ApiServiceRow[];

  return rows.map(rowToApiService);
};

export const getApiServiceById = async (
  pool: Pool,
  id: string,
): Promise<ApiService | null> => {
  const row = await getDb(pool)
    .selectFrom('api_services')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst() as unknown as ApiServiceRow | undefined;

  return row ? rowToApiService(row) : null;
};

export const createApiService = async (
  pool: Pool,
  payload: CreateApiServiceInput,
): Promise<ApiService> => {
  const row = await getDb(pool)
    .insertInto('api_services')
    .values({
      id: dbGenUuid,
      key: payload.key,
      label: payload.label,
      base_url: payload.baseUrl,
      resource_path: payload.resourcePath,
      access_mode: payload.accessMode,
      timeout_ms: payload.timeoutMs ?? 10000,
      retry_count: payload.retryCount ?? 1,
      request_method: payload.requestMethod ?? 'GET',
      request_template_json: payload.requestTemplateJson ?? {},
      request_mapping_rules_json: payload.requestMappingRulesJson ?? [],
      request_headers_template_json: payload.requestHeadersTemplateJson ?? {},
      token_header_name: payload.tokenHeaderName ?? null,
      token_param_name: payload.tokenParamName ?? null,
      response_mapping_rules_json: payload.responseMappingRulesJson ?? [],
      error_mapping_rules_json: payload.errorMappingRulesJson ?? [],
      contract_profile_version: payload.contractProfileVersion ?? 1,
      token_ref: payload.tokenRef ?? null,
      token_ciphertext: payload.tokenCiphertext ?? null,
      status: payload.status ?? 'active',
      created_at: dbNow,
      updated_at: dbNow,
    })
    .returningAll()
    .executeTakeFirstOrThrow() as unknown as ApiServiceRow;

  return rowToApiService(row);
};

export const updateApiService = async (
  pool: Pool,
  id: string,
  payload: UpdateApiServiceInput,
): Promise<ApiService | null> => {
  const setValues: Record<string, unknown> = {};

  if (payload.key !== undefined) setValues.key = payload.key;
  if (payload.label !== undefined) setValues.label = payload.label;
  if (payload.baseUrl !== undefined) setValues.base_url = payload.baseUrl;
  if (payload.resourcePath !== undefined) setValues.resource_path = payload.resourcePath;
  if (payload.accessMode !== undefined) setValues.access_mode = payload.accessMode;
  if (payload.timeoutMs !== undefined) setValues.timeout_ms = payload.timeoutMs;
  if (payload.retryCount !== undefined) setValues.retry_count = payload.retryCount;
  if (payload.requestMethod !== undefined) setValues.request_method = payload.requestMethod;
  if (payload.requestTemplateJson !== undefined) setValues.request_template_json = payload.requestTemplateJson;
  if (payload.requestMappingRulesJson !== undefined) setValues.request_mapping_rules_json = payload.requestMappingRulesJson;
  if (payload.requestHeadersTemplateJson !== undefined) setValues.request_headers_template_json = payload.requestHeadersTemplateJson;
  if (payload.tokenHeaderName !== undefined) setValues.token_header_name = payload.tokenHeaderName;
  if (payload.tokenParamName !== undefined) setValues.token_param_name = payload.tokenParamName;
  if (payload.responseMappingRulesJson !== undefined) setValues.response_mapping_rules_json = payload.responseMappingRulesJson;
  if (payload.errorMappingRulesJson !== undefined) setValues.error_mapping_rules_json = payload.errorMappingRulesJson;
  if (payload.contractProfileVersion !== undefined) setValues.contract_profile_version = payload.contractProfileVersion;
  if (payload.tokenRef !== undefined) setValues.token_ref = payload.tokenRef;
  if (payload.tokenCiphertext !== undefined) setValues.token_ciphertext = payload.tokenCiphertext;
  if (payload.status !== undefined) setValues.status = payload.status;

  if (Object.keys(setValues).length === 0) {
    return getApiServiceById(pool, id);
  }

  setValues.updated_at = dbNow;

  const row = await getDb(pool)
    .updateTable('api_services')
    .set(setValues as any)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst() as unknown as ApiServiceRow | undefined;

  return row ? rowToApiService(row) : null;
};

export const deleteApiService = async (pool: Pool, id: string): Promise<boolean> => {
  const result = await getDb(pool)
    .deleteFrom('api_services')
    .where('id', '=', id)
    .execute();

  return Number(result[0]?.numDeletedRows ?? 0) > 0;
};

/**
 * Resolves an active ApiService by ID with decrypted token for runtime execution.
 * 
 * This function works for any workflow step type (acquisition, crawling, etc.), 
 * not just acquisition despite the function name. The name is preserved for 
 * backward compatibility with existing callers.
 * 
 * @deprecated Consider using resolveApiServiceById for semantic neutrality or 
 * resolveApiServiceForCrawling for crawling-specific contexts. This function
 * will remain available for backward compatibility.
 * 
 * @param pool Database connection pool
 * @param id ApiService UUID to resolve
 * @returns ResolvedApiServiceForAcquisition with tokenCiphertext, or null if not found/inactive
 */
export const resolveApiServiceForAcquisition = async (
  pool: Pool,
  id: string,
): Promise<ResolvedApiServiceForAcquisition | null> => {
  const row = await getDb(pool)
    .selectFrom('api_services')
    .selectAll()
    .where('id', '=', id)
    .where('status', '=', 'active')
    .executeTakeFirst() as unknown as ApiServiceRow | undefined;

  if (!row) {
    return null;
  }

  return {
    ...rowToApiService(row),
    tokenCiphertext: row.token_ciphertext,
  };
};

/**
 * Semantically neutral alias for resolveApiServiceForAcquisition.
 * Resolves an active ApiService by ID for any workflow step type.
 * 
 * @param pool Database connection pool
 * @param id ApiService UUID to resolve
 * @returns ResolvedApiServiceForAcquisition with tokenCiphertext, or null if not found/inactive
 */
export const resolveApiServiceById = resolveApiServiceForAcquisition;

/**
 * Semantically clear alias for crawling workflow steps.
 * Resolves an active ApiService by key for crawling step execution.
 * 
 * @param pool Database connection pool  
 * @param key ApiService key to resolve
 * @returns ResolvedApiServiceForAcquisition with tokenCiphertext, or null if not found/inactive
 */
export const resolveApiServiceForCrawling = async (
  pool: Pool,
  key: string,
): Promise<ResolvedApiServiceForAcquisition | null> => {
  const row = await getDb(pool)
    .selectFrom('api_services')
    .selectAll()
    .where('key', '=', key)
    .where('status', '=', 'active')
    .executeTakeFirst() as unknown as ApiServiceRow | undefined;

  if (!row) {
    return null;
  }

  return {
    ...rowToApiService(row),
    tokenCiphertext: row.token_ciphertext,
  };
};

export const listApiServiceBindings = async (
  pool: Pool,
  apiServiceId: string,
): Promise<ApiServiceToolStepBinding[]> => {
  const rows = await getDb(pool)
    .selectFrom('api_service_tool_step_bindings')
    .selectAll()
    .where('api_service_id', '=', apiServiceId)
    .orderBy('created_at', 'desc')
    .execute() as unknown as ApiServiceToolStepBindingRow[];

  return rows.map(rowToApiServiceBinding);
};

export const upsertApiServiceBinding = async (
  pool: Pool,
  payload: UpsertApiServiceBindingInput,
): Promise<ApiServiceToolStepBinding> => {
  const row = await getDb(pool)
    .insertInto('api_service_tool_step_bindings')
    .values({
      // Escape hatch: COALESCE with ::uuid cast preserves a caller-supplied id when
      // present, otherwise falls back to gen_random_uuid(). Kysely has no typed API
      // for conditional UUID generation or the PostgreSQL ::uuid cast operator.
      id: sql<string>`COALESCE(${payload.id ?? null}::uuid, gen_random_uuid())`,
      api_service_id: payload.apiServiceId,
      tool_key: payload.toolKey,
      step_key: payload.stepKey,
      workflow_step_type: payload.workflowStepType ?? 'acquisition',
      binding_status: payload.bindingStatus ?? 'active',
      requiredness: payload.requiredness ?? 'required-by-tool-setting',
      created_at: dbNow,
      updated_at: dbNow,
    })
    .onConflict((oc) => oc
      .columns(['api_service_id', 'tool_key', 'step_key'])
      .doUpdateSet({
        workflow_step_type: payload.workflowStepType ?? 'acquisition',
        binding_status: payload.bindingStatus ?? 'active',
        requiredness: payload.requiredness ?? 'required-by-tool-setting',
        updated_at: dbNow,
      }))
    .returningAll()
    .executeTakeFirstOrThrow() as unknown as ApiServiceToolStepBindingRow;

  return rowToApiServiceBinding(row);
};

export const deleteApiServiceBinding = async (
  pool: Pool,
  apiServiceId: string,
  bindingId: string,
): Promise<boolean> => {
  const result = await getDb(pool)
    .deleteFrom('api_service_tool_step_bindings')
    .where('id', '=', bindingId)
    .where('api_service_id', '=', apiServiceId)
    .execute();

  return Number(result[0]?.numDeletedRows ?? 0) > 0;
};
