import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createApiService,
  deleteApiServiceBinding,
  deleteApiService,
  listApiServiceBindings,
  listApiServices,
  resolveApiServiceForAcquisition,
  upsertApiServiceBinding,
  updateApiService,
} from '../adapters/api-service.adapter';

type ApiServiceStoreRow = {
  id: string;
  key: string;
  label: string;
  base_url: string;
  resource_path: string;
  access_mode: 'public' | 'token';
  timeout_ms: number;
  retry_count: number;
  request_method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  request_template_json: Record<string, unknown>;
  request_mapping_rules_json: Array<Record<string, unknown>>;
  request_headers_template_json: Record<string, unknown>;
  token_header_name: string | null;
  response_mapping_rules_json: Array<Record<string, unknown>>;
  error_mapping_rules_json: Array<Record<string, unknown>>;
  contract_profile_version: number;
  token_ref: string | null;
  token_ciphertext: string | null;
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
};

type ApiServiceBindingStoreRow = {
  id: string;
  api_service_id: string;
  tool_key: string;
  step_key: string;
  workflow_step_type: 'acquisition';
  binding_status: 'active' | 'inactive';
  requiredness: 'always-required' | 'required-by-tool-setting' | 'optional-by-tool-setting';
  created_at: Date;
  updated_at: Date;
};

class ApiServiceDbStub {
  private readonly rows: ApiServiceStoreRow[] = [];
  private readonly bindings: ApiServiceBindingStoreRow[] = [];

  async query<T = unknown>(sqlText: string, values: unknown[] = []): Promise<{ rows: T[]; rowCount?: number }> {
    if (sqlText.includes('INSERT INTO api_services')) {
      const row: ApiServiceStoreRow = {
        id: `svc_${this.rows.length + 1}`,
        key: String(values[0]),
        label: String(values[1]),
        base_url: String(values[2]),
        resource_path: String(values[3]),
        access_mode: values[4] as ApiServiceStoreRow['access_mode'],
        timeout_ms: Number(values[5]),
        retry_count: Number(values[6]),
        request_method: (values[7] as ApiServiceStoreRow['request_method']) ?? 'GET',
        request_template_json: JSON.parse(String(values[8] ?? '{}')) as Record<string, unknown>,
        request_mapping_rules_json: JSON.parse(String(values[9] ?? '[]')) as Array<Record<string, unknown>>,
        request_headers_template_json: JSON.parse(String(values[10] ?? '{}')) as Record<string, unknown>,
        token_header_name: (values[11] as string | null) ?? null,
        response_mapping_rules_json: JSON.parse(String(values[12] ?? '[]')) as Array<Record<string, unknown>>,
        error_mapping_rules_json: JSON.parse(String(values[13] ?? '[]')) as Array<Record<string, unknown>>,
        contract_profile_version: Number(values[14] ?? 1),
        token_ref: (values[15] as string | null) ?? null,
        token_ciphertext: (values[16] as string | null) ?? null,
        status: (values[17] as ApiServiceStoreRow['status']) ?? 'active',
        created_at: new Date('2026-05-24T10:00:00.000Z'),
        updated_at: new Date('2026-05-24T10:00:00.000Z'),
      };
      this.rows.push(row);
      return { rows: [row as unknown as T] };
    }

    if (sqlText.includes('FROM api_services') && sqlText.includes('ORDER BY created_at DESC')) {
      return { rows: [...this.rows] as unknown as T[] };
    }

    if (sqlText.includes('UPDATE api_services')) {
      const id = String(values[values.length - 1]);
      const row = this.rows.find((item) => item.id === id);
      if (!row) {
        return { rows: [] };
      }

      if (sqlText.includes('label =')) {
        row.label = String(values[0]);
      }
      row.updated_at = new Date('2026-05-24T10:05:00.000Z');
      return { rows: [row as unknown as T] };
    }

    if (sqlText.includes('INSERT INTO api_service_tool_step_bindings')) {
      const row: ApiServiceBindingStoreRow = {
        id: (values[0] as string | null) ?? `bind_${this.bindings.length + 1}`,
        api_service_id: String(values[1]),
        tool_key: String(values[2]),
        step_key: String(values[3]),
        workflow_step_type: (values[4] as 'acquisition') ?? 'acquisition',
        binding_status: (values[5] as ApiServiceBindingStoreRow['binding_status']) ?? 'active',
        requiredness: (values[6] as ApiServiceBindingStoreRow['requiredness']) ?? 'required-by-tool-setting',
        created_at: new Date('2026-05-24T10:00:00.000Z'),
        updated_at: new Date('2026-05-24T10:00:00.000Z'),
      };

      const existingIndex = this.bindings.findIndex(
        (binding) => binding.api_service_id === row.api_service_id
          && binding.tool_key === row.tool_key
          && binding.step_key === row.step_key,
      );

      if (existingIndex >= 0) {
        const current = this.bindings[existingIndex];
        if (!current) {
          throw new Error('Binding upsert invariant violated: missing existing row');
        }
        current.workflow_step_type = row.workflow_step_type;
        current.binding_status = row.binding_status;
        current.requiredness = row.requiredness;
        current.updated_at = new Date('2026-05-24T10:05:00.000Z');
        return { rows: [current as unknown as T] };
      }

      this.bindings.push(row);
      return { rows: [row as unknown as T] };
    }

    if (sqlText.includes('FROM api_service_tool_step_bindings') && sqlText.includes('ORDER BY created_at DESC')) {
      const apiServiceId = String(values[0]);
      return {
        rows: this.bindings
          .filter((binding) => binding.api_service_id === apiServiceId)
          .slice()
          .sort((a, b) => b.created_at.getTime() - a.created_at.getTime()) as unknown as T[],
      };
    }

    if (sqlText.includes('DELETE FROM api_service_tool_step_bindings')) {
      const bindingId = String(values[0]);
      const apiServiceId = String(values[1]);
      const before = this.bindings.length;
      const filtered = this.bindings.filter(
        (binding) => !(binding.id === bindingId && binding.api_service_id === apiServiceId),
      );
      this.bindings.length = 0;
      this.bindings.push(...filtered);
      return { rows: [], rowCount: before - filtered.length };
    }

    if (sqlText.includes('SELECT') && sqlText.includes('token_ciphertext') && sqlText.includes("status = 'active'")) {
      const id = String(values[0]);
      const row = this.rows.find((item) => item.id === id && item.status === 'active');
      return { rows: row ? [row as unknown as T] : [] };
    }

    if (sqlText.includes('DELETE FROM api_services')) {
      const id = String(values[0]);
      const before = this.rows.length;
      const filtered = this.rows.filter((item) => item.id !== id);
      this.rows.length = 0;
      this.rows.push(...filtered);
      return { rows: [], rowCount: before - filtered.length };
    }

    throw new Error(`Unsupported SQL in ApiServiceDbStub: ${sqlText}`);
  }
}

test('api-service adapter CRUD path supports create/list/update/delete', async () => {
  const db = new ApiServiceDbStub();

  const created = await createApiService(db as any, {
    key: 'github-issues',
    label: 'GitHub Issues',
    baseUrl: 'https://api.github.com',
    resourcePath: '/repos/{owner}/{repo}/issues',
    accessMode: 'public',
  });
  assert.equal(created.key, 'github-issues');

  const listed = await listApiServices(db as any);
  assert.equal(listed.length, 1);

  const updated = await updateApiService(db as any, created.id, { label: 'GitHub Issues v2' });
  assert.ok(updated);
  assert.equal(updated?.label, 'GitHub Issues v2');

  const deleted = await deleteApiService(db as any, created.id);
  assert.equal(deleted, true);

  const listedAfterDelete = await listApiServices(db as any);
  assert.equal(listedAfterDelete.length, 0);
});

test('resolveApiServiceForAcquisition returns only active services', async () => {
  const db = new ApiServiceDbStub();

  const created = await createApiService(db as any, {
    key: 'private-endpoint',
    label: 'Private Endpoint',
    baseUrl: 'https://example.com',
    resourcePath: '/v1/private',
    accessMode: 'token',
    tokenRef: 'vault://private-endpoint',
    tokenCiphertext: 'encrypted-token',
    status: 'active',
  });

  const resolved = await resolveApiServiceForAcquisition(db as any, created.id);
  assert.ok(resolved);
  assert.equal(resolved?.tokenCiphertext, 'encrypted-token');
});

test('api-service adapter binding CRUD lifecycle supports list/upsert/delete', async () => {
  const db = new ApiServiceDbStub();

  const service = await createApiService(db as any, {
    key: 'github-issues',
    label: 'GitHub Issues',
    baseUrl: 'https://api.github.com',
    resourcePath: '/repos/{owner}/{repo}/issues',
    accessMode: 'public',
  });

  const createdBinding = await upsertApiServiceBinding(db as any, {
    apiServiceId: service.id,
    toolKey: 'funnel-pages',
    stepKey: 'optin',
    workflowStepType: 'acquisition',
    bindingStatus: 'active',
    requiredness: 'required-by-tool-setting',
  });
  assert.equal(createdBinding.apiServiceId, service.id);

  const listedBindings = await listApiServiceBindings(db as any, service.id);
  assert.equal(listedBindings.length, 1);
  assert.equal(listedBindings[0]?.stepKey, 'optin');

  const deleted = await deleteApiServiceBinding(db as any, service.id, createdBinding.id);
  assert.equal(deleted, true);

  const listedAfterDelete = await listApiServiceBindings(db as any, service.id);
  assert.equal(listedAfterDelete.length, 0);
});
