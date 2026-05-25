import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { appCopy } from '../../../app/copy/system';
import { useMswHandler } from '../../../test/mocks/server';
import { renderAdminPage } from '../test/renderAdminPage';
import { getMockAuthSession, resetMockAdminSession } from '../test/mockAdminSession';
import { AdminApiServicesPage } from './AdminApiServicesPage';

const feedbackApiSpy = vi.hoisted(() => ({
  publishSuccess: vi.fn(),
  publishError: vi.fn(),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
}));

type TestApiService = {
  id: string;
  key: string;
  label: string;
  baseUrl: string;
  resourcePath: string;
  accessMode: 'public' | 'token';
  timeoutMs: number;
  retryCount: number;
  requestMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  requestTemplateJson: Record<string, unknown>;
  requestMappingRulesJson: Array<Record<string, unknown>>;
  requestHeadersTemplateJson: Record<string, unknown>;
  tokenHeaderName: string | null;
  responseMappingRulesJson: Array<Record<string, unknown>>;
  errorMappingRulesJson: Array<Record<string, unknown>>;
  contractProfileVersion: number;
  status: 'active' | 'inactive';
  tokenConfigured: boolean;
  createdAt: string;
  updatedAt: string;
};

type TestBinding = {
  id: string;
  apiServiceId: string;
  toolKey: string;
  stepKey: string;
  workflowStepType: 'acquisition';
  bindingStatus: 'active' | 'inactive';
  requiredness: 'always-required' | 'required-by-tool-setting' | 'optional-by-tool-setting';
  createdAt: string;
  updatedAt: string;
};

let apiServicesDb: TestApiService[] = [];
let bindingsDb: TestBinding[] = [];

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => getMockAuthSession(),
}));

vi.mock('../../../app/providers/FeedbackMessageProvider', () => ({
  useFeedbackMessage: () => ({
    messages: [],
    ...feedbackApiSpy,
  }),
}));

const readJsonBody = async <T,>(request: Request): Promise<T> => request.json() as Promise<T>;

beforeEach(() => {
  feedbackApiSpy.publishSuccess.mockReset();
  feedbackApiSpy.publishError.mockReset();
  feedbackApiSpy.dismiss.mockReset();
  feedbackApiSpy.dismissAll.mockReset();

  resetMockAdminSession({
    role: 'admin',
    userId: 'admin_001',
    email: 'admin@test.com',
    capabilities: {
      adminApiServicesCrud: true,
      toolsApiServicesResolve: true,
    },
  });

  apiServicesDb = [
    {
      id: 'svc_001',
      key: 'core-api',
      label: 'Core API',
      baseUrl: 'https://api.example.com',
      resourcePath: '/v1/core',
      accessMode: 'public',
      timeoutMs: 3000,
      retryCount: 2,
      requestMethod: 'GET',
      requestTemplateJson: {},
      requestMappingRulesJson: [],
      requestHeadersTemplateJson: {},
      tokenHeaderName: null,
      responseMappingRulesJson: [],
      errorMappingRulesJson: [],
      contractProfileVersion: 1,
      status: 'active',
      tokenConfigured: false,
      createdAt: '2026-05-16T10:00:00.000Z',
      updatedAt: '2026-05-16T10:00:00.000Z',
    },
  ];

  bindingsDb = [
    {
      id: 'bind_001',
      apiServiceId: 'svc_001',
      toolKey: 'funnel-pages',
      stepKey: 'optin',
      workflowStepType: 'acquisition',
      bindingStatus: 'active',
      requiredness: 'required-by-tool-setting',
      createdAt: '2026-05-16T10:10:00.000Z',
      updatedAt: '2026-05-16T10:10:00.000Z',
    },
  ];

  useMswHandler(http.get('/api/admin/api-services', () => HttpResponse.json({ ok: true, data: { apiServices: apiServicesDb } })));

  useMswHandler(http.post('/api/admin/api-services', async ({ request }) => {
    const body = await readJsonBody<Partial<TestApiService>>(request as unknown as Request);

    const created: TestApiService = {
      id: `svc_${String(apiServicesDb.length + 1).padStart(3, '0')}`,
      key: body.key ?? 'missing-key',
      label: body.label ?? 'Missing label',
      baseUrl: body.baseUrl ?? 'https://example.invalid',
      resourcePath: body.resourcePath ?? '/',
      accessMode: (body.accessMode as 'public' | 'token') ?? 'public',
      timeoutMs: body.timeoutMs ?? 10000,
      retryCount: body.retryCount ?? 1,
      requestMethod: (body.requestMethod as TestApiService['requestMethod']) ?? 'GET',
      requestTemplateJson: body.requestTemplateJson ?? {},
      requestMappingRulesJson: body.requestMappingRulesJson ?? [],
      requestHeadersTemplateJson: body.requestHeadersTemplateJson ?? {},
      tokenHeaderName: typeof body.tokenHeaderName === 'string' ? body.tokenHeaderName : null,
      responseMappingRulesJson: body.responseMappingRulesJson ?? [],
      errorMappingRulesJson: body.errorMappingRulesJson ?? [],
      contractProfileVersion: body.contractProfileVersion ?? 1,
      status: (body.status as 'active' | 'inactive') ?? 'active',
      tokenConfigured: false,
      createdAt: '2026-05-16T11:00:00.000Z',
      updatedAt: '2026-05-16T11:00:00.000Z',
    };

    apiServicesDb = [...apiServicesDb, created];
    return HttpResponse.json({ ok: true, data: { apiService: created } }, { status: 201 });
  }));

  useMswHandler(http.put('/api/admin/api-services/:id', async ({ params, request }) => {
    const id = String(params.id);
    const body = await readJsonBody<Partial<TestApiService>>(request as unknown as Request);
    const current = apiServicesDb.find((apiService) => apiService.id === id);

    if (!current) {
      return new HttpResponse(null, { status: 404 });
    }

    const updated: TestApiService = {
      ...current,
      ...(body.key !== undefined ? { key: body.key } : {}),
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.baseUrl !== undefined ? { baseUrl: body.baseUrl } : {}),
      ...(body.resourcePath !== undefined ? { resourcePath: body.resourcePath } : {}),
      ...(body.accessMode !== undefined ? { accessMode: body.accessMode as TestApiService['accessMode'] } : {}),
      ...(body.timeoutMs !== undefined ? { timeoutMs: body.timeoutMs } : {}),
      ...(body.retryCount !== undefined ? { retryCount: body.retryCount } : {}),
      ...(body.requestMethod !== undefined ? { requestMethod: body.requestMethod as TestApiService['requestMethod'] } : {}),
      ...(body.requestTemplateJson !== undefined ? { requestTemplateJson: body.requestTemplateJson } : {}),
      ...(body.requestMappingRulesJson !== undefined ? { requestMappingRulesJson: body.requestMappingRulesJson } : {}),
      ...(body.requestHeadersTemplateJson !== undefined ? { requestHeadersTemplateJson: body.requestHeadersTemplateJson } : {}),
      ...(body.tokenHeaderName !== undefined ? { tokenHeaderName: typeof body.tokenHeaderName === 'string' ? body.tokenHeaderName : null } : {}),
      ...(body.responseMappingRulesJson !== undefined ? { responseMappingRulesJson: body.responseMappingRulesJson } : {}),
      ...(body.errorMappingRulesJson !== undefined ? { errorMappingRulesJson: body.errorMappingRulesJson } : {}),
      ...(body.contractProfileVersion !== undefined ? { contractProfileVersion: body.contractProfileVersion } : {}),
      ...(body.status !== undefined ? { status: body.status as TestApiService['status'] } : {}),
      updatedAt: '2026-05-16T11:30:00.000Z',
    };

    apiServicesDb = apiServicesDb.map((apiService) => (apiService.id === id ? updated : apiService));
    return HttpResponse.json({ ok: true, data: { apiService: updated } });
  }));

  useMswHandler(http.delete('/api/admin/api-services/:id', ({ params }) => {
    const id = String(params.id);
    apiServicesDb = apiServicesDb.filter((apiService) => apiService.id !== id);
    return new HttpResponse(null, { status: 204 });
  }));

  useMswHandler(http.get('/api/admin/api-services/:id/bindings', ({ params }) => {
    const apiServiceId = String(params.id);
    return HttpResponse.json({ ok: true, data: { bindings: bindingsDb.filter((binding) => binding.apiServiceId === apiServiceId) } });
  }));

  useMswHandler(http.put('/api/admin/api-services/:id/bindings', async ({ params, request }) => {
    const apiServiceId = String(params.id);
    const body = await readJsonBody<Partial<TestBinding>>(request as unknown as Request);
    const current = body.id ? bindingsDb.find((binding) => binding.id === body.id) : undefined;

    const created: TestBinding = current
      ? {
          ...current,
          ...(body.toolKey !== undefined ? { toolKey: body.toolKey } : {}),
          ...(body.stepKey !== undefined ? { stepKey: body.stepKey } : {}),
          ...(body.bindingStatus !== undefined ? { bindingStatus: body.bindingStatus as TestBinding['bindingStatus'] } : {}),
          ...(body.requiredness !== undefined ? { requiredness: body.requiredness as TestBinding['requiredness'] } : {}),
          updatedAt: '2026-05-16T11:45:00.000Z',
        }
      : {
          id: `bind_${String(bindingsDb.length + 1).padStart(3, '0')}`,
          apiServiceId,
          toolKey: body.toolKey ?? 'missing-tool',
          stepKey: body.stepKey ?? 'missing-step',
          workflowStepType: 'acquisition',
          bindingStatus: (body.bindingStatus as TestBinding['bindingStatus']) ?? 'active',
          requiredness: (body.requiredness as TestBinding['requiredness']) ?? 'required-by-tool-setting',
          createdAt: '2026-05-16T11:40:00.000Z',
          updatedAt: '2026-05-16T11:40:00.000Z',
        };

    bindingsDb = current
      ? bindingsDb.map((binding) => (binding.id === created.id ? created : binding))
      : [...bindingsDb, created];

    return HttpResponse.json({ ok: true, data: { binding: created } });
  }));

  useMswHandler(http.delete('/api/admin/api-services/:id/bindings/:bindingId', ({ params }) => {
    const bindingId = String(params.bindingId);
    bindingsDb = bindingsDb.filter((binding) => binding.id !== bindingId);
    return new HttpResponse(null, { status: 204 });
  }));
});

describe('AdminApiServicesPage', () => {
  it('renders, creates, updates, deletes api services and manages bindings', async () => {
    renderAdminPage(<AdminApiServicesPage />);

    expect(await screen.findByRole('heading', { name: appCopy.editorial.admin.apiServicesTitle })).toBeInTheDocument();
    expect(await screen.findByText('Core API')).toBeInTheDocument();

    const createFormHeading = await screen.findByRole('heading', { name: appCopy.ui.adminApiServices.createFormTitle });
    const createForm = createFormHeading.closest('form');
    expect(createForm).not.toBeNull();
    if (!createForm) {
      throw new Error('Create form not found');
    }

    fireEvent.change(createForm.querySelector('input[name="key"]')!, { target: { value: 'billing-api' } });
    fireEvent.change(createForm.querySelector('input[name="label"]')!, { target: { value: 'Billing API' } });
    fireEvent.change(createForm.querySelector('input[name="baseUrl"]')!, { target: { value: 'https://billing.example.com' } });
    fireEvent.change(createForm.querySelector('input[name="resourcePath"]')!, { target: { value: '/v2/billing' } });
    fireEvent.change(createForm.querySelector('input[name="tokenHeaderName"]')!, { target: { value: 'X-API-Key' } });
    fireEvent.click(screen.getByRole('button', { name: appCopy.ui.adminApiServices.createSubmitLabel }));

    expect(await screen.findByText('Billing API')).toBeInTheDocument();
    expect(apiServicesDb.find((service) => service.key === 'billing-api')?.tokenHeaderName).toBe('X-API-Key');
    expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
      appCopy.ui.feedback.adminApiServicesCreated,
      expect.objectContaining({ dedupeKey: 'admin-api-services:create:success' }),
    );

    const createdCell = await screen.findByText('Billing API');
    const createdRow = createdCell.closest('tr');
    expect(createdRow).not.toBeNull();
    fireEvent.click(within(createdRow as HTMLElement).getByRole('button', { name: appCopy.ui.actions.edit }));

    const editHeading = await screen.findByRole('heading', { name: appCopy.ui.adminApiServices.editFormTitle });
    const editForm = editHeading.closest('form');
    expect(editForm).not.toBeNull();
    if (!editForm) {
      throw new Error('Edit form not found');
    }

    fireEvent.change(editForm.querySelector('input[name="label"]')!, { target: { value: 'Billing API Updated' } });
    fireEvent.click(within(editForm).getByRole('button', { name: appCopy.ui.adminApiServices.editSubmitLabel }));

    expect(await screen.findByText('Billing API Updated')).toBeInTheDocument();
    expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
      appCopy.ui.feedback.adminApiServicesUpdated,
      expect.objectContaining({ dedupeKey: 'admin-api-services:update:svc_002:success' }),
    );

    const selectedRow = await screen.findByText('Billing API Updated');
    const selectedApiServiceRow = selectedRow.closest('tr');
    expect(selectedApiServiceRow).not.toBeNull();
    fireEvent.click(within(selectedApiServiceRow as HTMLElement).getByRole('button', { name: appCopy.ui.adminApiServices.openBindingsAction }));

    expect(await screen.findByRole('heading', { name: appCopy.editorial.admin.apiServiceBindingsTitle })).toBeInTheDocument();
    expect(await screen.findByText(appCopy.ui.adminApiServices.bindings.emptyForService)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: appCopy.ui.adminApiServices.bindings.formLabels.toolKey }), { target: { value: 'funnel-pages' } });
    fireEvent.change(screen.getByRole('textbox', { name: appCopy.ui.adminApiServices.bindings.formLabels.stepKey }), { target: { value: 'checkout' } });
    fireEvent.click(screen.getByRole('button', { name: appCopy.ui.adminApiServices.bindings.createAction }));

    expect(await screen.findByText('checkout')).toBeInTheDocument();
    expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
      appCopy.ui.feedback.adminApiServiceBindingsSaved,
      expect.objectContaining({ dedupeKey: 'admin-api-service-bindings:save:bind_002:success' }),
    );

    const bindingCell = await screen.findByText('checkout');
    const bindingRow = bindingCell.closest('tr');
    expect(bindingRow).not.toBeNull();
    fireEvent.click(within(bindingRow as HTMLElement).getByRole('button', { name: appCopy.ui.actions.edit }));
    fireEvent.change(screen.getByRole('textbox', { name: appCopy.ui.adminApiServices.bindings.formLabels.stepKey }), { target: { value: 'checkout-final' } });
    fireEvent.click(screen.getByRole('button', { name: appCopy.ui.adminApiServices.bindings.updateAction }));

    expect(await screen.findByText('checkout-final')).toBeInTheDocument();

    const updatedBindingCell = await screen.findByText('checkout-final');
    const updatedBindingRow = updatedBindingCell.closest('tr');
    expect(updatedBindingRow).not.toBeNull();
    fireEvent.click(within(updatedBindingRow as HTMLElement).getByRole('button', { name: appCopy.ui.actions.delete }));

    await waitFor(() => {
      expect(screen.queryByText('checkout-final')).toBeNull();
    });

    fireEvent.click(within(selectedApiServiceRow as HTMLElement).getByRole('button', { name: appCopy.ui.actions.delete }));

    await waitFor(() => {
      expect(screen.queryByText('Billing API Updated')).toBeNull();
    });

    expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
      appCopy.ui.feedback.adminApiServicesDeleted,
      expect.objectContaining({ dedupeKey: 'admin-api-services:delete:svc_002:success' }),
    );
  }, 15000);
});