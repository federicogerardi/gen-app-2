import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { appCopy } from '../../../app/copy/system';
import { useMswHandler } from '../../../test/mocks/server';
import { AdminModelsPage } from './AdminModelsPage';

const feedbackApiSpy = vi.hoisted(() => ({
  publishSuccess: vi.fn(),
  publishError: vi.fn(),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
}));

type TestModel = {
  id: string;
  key: string;
  label: string;
  status: 'enabled' | 'disabled';
  isDefault: boolean;
  sortOrder: number | null;
};

let modelsDb: TestModel[] = [
  {
    id: 'model-1',
    key: 'openrouter/auto',
    label: 'OpenRouter Auto',
    status: 'enabled',
    isDefault: true,
    sortOrder: 1,
  },
];

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: { user: { id: 'seed-user-001', email: 'admin@test.com', role: 'admin' } },
    loading: false,
    error: null,
    apiBaseUrl: '',
    capabilities: { adminModels: true },
  }),
}));

vi.mock('../../../app/providers/FeedbackMessageProvider', () => ({
  useFeedbackMessage: () => ({
    messages: [],
    ...feedbackApiSpy,
  }),
}));

beforeEach(() => {
  feedbackApiSpy.publishSuccess.mockReset();
  feedbackApiSpy.publishError.mockReset();
  feedbackApiSpy.dismiss.mockReset();
  feedbackApiSpy.dismissAll.mockReset();

  modelsDb = [
    {
      id: 'model-1',
      key: 'openrouter/auto',
      label: 'OpenRouter Auto',
      status: 'enabled',
      isDefault: true,
      sortOrder: 1,
    },
  ];

  useMswHandler(
    http.get('/api/admin/models', () => HttpResponse.json({ data: { models: modelsDb } })),
  );

  useMswHandler(
    http.post('/api/admin/models', async ({ request }) => {
      const body = await request.json() as Partial<TestModel>;
      const created: TestModel = {
        id: `model-${modelsDb.length + 1}`,
        key: body.key ?? 'missing/model',
        label: body.label ?? 'Missing',
        status: (body.status as 'enabled' | 'disabled') ?? 'enabled',
        isDefault: false,
        sortOrder: modelsDb.length + 1,
      };
      modelsDb = [...modelsDb, created];
      return HttpResponse.json({ ok: true, data: { model: created } }, { status: 201 });
    }),
  );

  useMswHandler(
    http.put('/api/admin/models/:id', async ({ params, request }) => {
      const id = String(params.id);
      const body = await request.json() as Partial<TestModel>;
      modelsDb = modelsDb.map((model) => {
        if (model.id !== id) return model;
        return {
          ...model,
          ...(body.status !== undefined ? { status: body.status as 'enabled' | 'disabled' } : {}),
          ...(body.isDefault ? { isDefault: true } : {}),
        };
      });
      if (body.isDefault) {
        modelsDb = modelsDb.map((model) => (model.id === id ? model : { ...model, isDefault: false }));
      }
      return HttpResponse.json({ ok: true });
    }),
  );

  useMswHandler(
    http.delete('/api/admin/models/:id', ({ params }) => {
      const id = String(params.id);
      modelsDb = modelsDb.filter((model) => model.id !== id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
});

describe('AdminModelsPage', () => {
  it('renders models and publishes global success for create mutation', async () => {
    render(
      <MemoryRouter>
        <AdminModelsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('OpenRouter Auto')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('es. openrouter/auto'), { target: { value: 'gpt-4.1-mini' } });
    fireEvent.change(screen.getByPlaceholderText('Nome visualizzato'), { target: { value: 'GPT 4.1 Mini' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crea modello' }));

    await waitFor(() => {
      expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
        appCopy.ui.feedback.adminModelsCreated,
        expect.objectContaining({ dedupeKey: 'admin-models:create:success' }),
      );
    });

    expect(screen.queryByText('Modello creato.')).not.toBeInTheDocument();
  });

  it('publishes global error for failed mutation', async () => {
    useMswHandler(
      http.post('/api/admin/models', () => new HttpResponse(null, { status: 500 })),
    );

    render(
      <MemoryRouter>
        <AdminModelsPage />
      </MemoryRouter>,
    );

    await screen.findByText('OpenRouter Auto');

    fireEvent.change(screen.getByPlaceholderText('es. openrouter/auto'), { target: { value: 'gpt-fail' } });
    fireEvent.change(screen.getByPlaceholderText('Nome visualizzato'), { target: { value: 'GPT Fail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crea modello' }));

    await waitFor(() => {
      expect(feedbackApiSpy.publishError).toHaveBeenCalledWith(
        appCopy.ui.feedback.adminModelsCreateFailed,
        expect.objectContaining({ dedupeKey: 'admin-models:create:error' }),
      );
    });
  });
});
