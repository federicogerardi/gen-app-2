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

const SELECT_COLS = `
  id,
  key,
  label,
  base_url,
  resource_path,
  access_mode,
  timeout_ms,
  retry_count,
  request_method,
  request_template_json,
  request_mapping_rules_json,
  request_headers_template_json,
  response_mapping_rules_json,
  error_mapping_rules_json,
  contract_profile_version,
  token_ref,
  status,
  created_at,
  updated_at
`;

const SELECT_BINDING_COLS = `
  id,
  api_service_id,
  tool_key,
  step_key,
  workflow_step_type,
  binding_status,
  requiredness,
  created_at,
  updated_at
`;

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
  workflowStepType?: 'acquisition';
  bindingStatus?: ApiServiceBindingStatus;
  requiredness?: ApiServiceBindingRequiredness;
};

export type ResolvedApiServiceForAcquisition = ApiService & {
  tokenCiphertext: string | null;
};

export const listApiServices = async (db: Pool): Promise<ApiService[]> => {
  const result = await db.query<ApiServiceRow>(
    `SELECT ${SELECT_COLS}
     FROM api_services
     ORDER BY created_at DESC`,
  );
  return result.rows.map(rowToApiService);
};

export const getApiServiceById = async (
  db: Pool,
  id: string,
): Promise<ApiService | null> => {
  const result = await db.query<ApiServiceRow>(
    `SELECT ${SELECT_COLS}
     FROM api_services
     WHERE id = $1`,
    [id],
  );
  return result.rows[0] ? rowToApiService(result.rows[0]) : null;
};

export const createApiService = async (
  db: Pool,
  payload: CreateApiServiceInput,
): Promise<ApiService> => {
  const result = await db.query<ApiServiceRow>(
    `INSERT INTO api_services (
      key,
      label,
      base_url,
      resource_path,
      access_mode,
      timeout_ms,
      retry_count,
      request_method,
      request_template_json,
      request_mapping_rules_json,
      request_headers_template_json,
      response_mapping_rules_json,
      error_mapping_rules_json,
      contract_profile_version,
      token_ref,
      token_ciphertext,
      status
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14, $15, $16)
     RETURNING ${SELECT_COLS}`,
    [
      payload.key,
      payload.label,
      payload.baseUrl,
      payload.resourcePath,
      payload.accessMode,
      payload.timeoutMs ?? 10000,
      payload.retryCount ?? 1,
      JSON.stringify(payload.requestTemplateJson ?? {}),
      JSON.stringify(payload.requestMappingRulesJson ?? []),
      JSON.stringify(payload.requestHeadersTemplateJson ?? {}),
      JSON.stringify(payload.responseMappingRulesJson ?? []),
      JSON.stringify(payload.errorMappingRulesJson ?? []),
      payload.contractProfileVersion ?? 1,
      payload.tokenRef ?? null,
      payload.tokenCiphertext ?? null,
      payload.status ?? 'active',
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Insert returned no row');
  }

  return rowToApiService(row);
};

export const updateApiService = async (
  db: Pool,
  id: string,
  payload: UpdateApiServiceInput,
): Promise<ApiService | null> => {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (payload.key !== undefined) {
    setClauses.push(`key = $${index++}`);
    values.push(payload.key);
  }
  if (payload.label !== undefined) {
    setClauses.push(`label = $${index++}`);
    values.push(payload.label);
  }
  if (payload.baseUrl !== undefined) {
    setClauses.push(`base_url = $${index++}`);
    values.push(payload.baseUrl);
  }
  if (payload.resourcePath !== undefined) {
    setClauses.push(`resource_path = $${index++}`);
    values.push(payload.resourcePath);
  }
  if (payload.accessMode !== undefined) {
    setClauses.push(`access_mode = $${index++}`);
    values.push(payload.accessMode);
  }
  if (payload.timeoutMs !== undefined) {
    setClauses.push(`timeout_ms = $${index++}`);
    values.push(payload.timeoutMs);
  }
  if (payload.retryCount !== undefined) {
    setClauses.push(`retry_count = $${index++}`);
    values.push(payload.retryCount);
  }
  if (payload.requestMethod !== undefined) {
    setClauses.push(`request_method = $${index++}`);
    values.push(payload.requestMethod);
  }
  if (payload.requestTemplateJson !== undefined) {
    setClauses.push(`request_template_json = $${index++}::jsonb`);
    values.push(JSON.stringify(payload.requestTemplateJson));
  }
  if (payload.requestMappingRulesJson !== undefined) {
    setClauses.push(`request_mapping_rules_json = $${index++}::jsonb`);
    values.push(JSON.stringify(payload.requestMappingRulesJson));
  }
  if (payload.requestHeadersTemplateJson !== undefined) {
    setClauses.push(`request_headers_template_json = $${index++}::jsonb`);
    values.push(JSON.stringify(payload.requestHeadersTemplateJson));
  }
  if (payload.responseMappingRulesJson !== undefined) {
    setClauses.push(`response_mapping_rules_json = $${index++}::jsonb`);
    values.push(JSON.stringify(payload.responseMappingRulesJson));
  }
  if (payload.errorMappingRulesJson !== undefined) {
    setClauses.push(`error_mapping_rules_json = $${index++}::jsonb`);
    values.push(JSON.stringify(payload.errorMappingRulesJson));
  }
  if (payload.contractProfileVersion !== undefined) {
    setClauses.push(`contract_profile_version = $${index++}`);
    values.push(payload.contractProfileVersion);
  }
  if (payload.tokenRef !== undefined) {
    setClauses.push(`token_ref = $${index++}`);
    values.push(payload.tokenRef);
  }
  if (payload.tokenCiphertext !== undefined) {
    setClauses.push(`token_ciphertext = $${index++}`);
    values.push(payload.tokenCiphertext);
  }
  if (payload.status !== undefined) {
    setClauses.push(`status = $${index++}`);
    values.push(payload.status);
  }

  if (setClauses.length === 0) {
    return getApiServiceById(db, id);
  }

  setClauses.push('updated_at = now()');
  values.push(id);

  const result = await db.query<ApiServiceRow>(
    `UPDATE api_services
     SET ${setClauses.join(', ')}
     WHERE id = $${index}
     RETURNING ${SELECT_COLS}`,
    values,
  );

  return result.rows[0] ? rowToApiService(result.rows[0]) : null;
};

export const deleteApiService = async (db: Pool, id: string): Promise<boolean> => {
  const result = await db.query('DELETE FROM api_services WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};

export const resolveApiServiceForAcquisition = async (
  db: Pool,
  id: string,
): Promise<ResolvedApiServiceForAcquisition | null> => {
  const result = await db.query<
    ApiServiceRow & { token_ciphertext: string | null }
  >(
    `SELECT ${SELECT_COLS}, token_ciphertext
     FROM api_services
     WHERE id = $1
       AND status = 'active'`,
    [id],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    ...rowToApiService(row),
    tokenCiphertext: row.token_ciphertext,
  };
};

export const listApiServiceBindings = async (
  db: Pool,
  apiServiceId: string,
): Promise<ApiServiceToolStepBinding[]> => {
  const result = await db.query<ApiServiceToolStepBindingRow>(
    `SELECT ${SELECT_BINDING_COLS}
     FROM api_service_tool_step_bindings
     WHERE api_service_id = $1
     ORDER BY created_at DESC`,
    [apiServiceId],
  );

  return result.rows.map(rowToApiServiceBinding);
};

export const upsertApiServiceBinding = async (
  db: Pool,
  payload: UpsertApiServiceBindingInput,
): Promise<ApiServiceToolStepBinding> => {
  const result = await db.query<ApiServiceToolStepBindingRow>(
    `INSERT INTO api_service_tool_step_bindings (
      id,
      api_service_id,
      tool_key,
      step_key,
      workflow_step_type,
      binding_status,
      requiredness
    )
     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7)
     ON CONFLICT (api_service_id, tool_key, step_key)
     DO UPDATE SET
       workflow_step_type = EXCLUDED.workflow_step_type,
       binding_status = EXCLUDED.binding_status,
       requiredness = EXCLUDED.requiredness,
       updated_at = now()
     RETURNING ${SELECT_BINDING_COLS}`,
    [
      payload.id ?? null,
      payload.apiServiceId,
      payload.toolKey,
      payload.stepKey,
      payload.workflowStepType ?? 'acquisition',
      payload.bindingStatus ?? 'active',
      payload.requiredness ?? 'required-by-tool-setting',
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Binding upsert returned no row');
  }

  return rowToApiServiceBinding(row);
};

export const deleteApiServiceBinding = async (
  db: Pool,
  apiServiceId: string,
  bindingId: string,
): Promise<boolean> => {
  const result = await db.query(
    `DELETE FROM api_service_tool_step_bindings
     WHERE id = $1
       AND api_service_id = $2`,
    [bindingId, apiServiceId],
  );

  return (result.rowCount ?? 0) > 0;
};
