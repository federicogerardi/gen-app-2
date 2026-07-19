import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { appCopy } from '../../../app/copy/system';
import { useMswHandler } from '../../../test/mocks/server';
import { renderAdminPage } from '../test/renderAdminPage';
import { getMockAuthSession, resetMockAdminSession } from '../test/mockAdminSession';
import { AdminModelsPage } from './AdminModelsPage';

import { createFeedbackApiSpy } from '../../../test/mocks/feedback-message-spy.mock';
const feedbackApiSpy = createFeedbackApiSpy();

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
  useAuthSession: () => getMockAuthSession(),
  useAuthState: () => {
    const auth = getMockAuthSession();
    return { session: auth.session, loading: auth.loading, hasError: auth.hasError };
  },
  useAuthActions: () => ({
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    clearError: () => {},
  }),
  useApiConfig: () => {
    const auth = getMockAuthSession();
    return { apiBaseUrl: auth.apiBaseUrl, capabilities: auth.capabilities };
  },
  useOAuthUrl: () => ({
    oauthStartUrl: '',
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

  resetMockAdminSession({
    role: 'admin',
    userId: 'seed-user-001',
    email: 'admin@test.com',
    capabilities: { adminModels: true },
  });

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
    renderAdminPage(<AdminModelsPage />);

    expect(await screen.findByText('OpenRouter Auto')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('e.g. openrouter/auto'), { target: { value: 'gpt-4.1-mini' } });
    fireEvent.change(screen.getByPlaceholderText('Display name'), { target: { value: 'GPT 4.1 Mini' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create model' }));

    await waitFor(() => {
      expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
        appCopy.ui.feedback.adminModelsCreated,
        expect.objectContaining({ dedupeKey: 'admin-models:create:success' }),
      );
    });

    expect(screen.queryByText(appCopy.ui.feedback.adminModelsCreated)).not.toBeInTheDocument();
  });

  it('publishes global error for failed mutation', async () => {
    useMswHandler(
      http.post('/api/admin/models', () => new HttpResponse(null, { status: 500 })),
    );

    renderAdminPage(<AdminModelsPage />);

    await screen.findByText('OpenRouter Auto');

    fireEvent.change(screen.getByPlaceholderText('e.g. openrouter/auto'), { target: { value: 'gpt-fail' } });
    fireEvent.change(screen.getByPlaceholderText('Display name'), { target: { value: 'GPT Fail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create model' }));

    await waitFor(() => {
      expect(feedbackApiSpy.publishError).toHaveBeenCalledWith(
        appCopy.ui.feedback.adminModelsCreateFailed,
        expect.objectContaining({ dedupeKey: 'admin-models:create:error' }),
      );
    });
  });

  it('handles status toggle and default promotion with global feedback', async () => {
    modelsDb = [
      ...modelsDb,
      {
        id: 'model-2',
        key: 'gpt-4.1-mini',
        label: 'GPT 4.1 Mini',
        status: 'disabled',
        isDefault: false,
        sortOrder: 2,
      },
    ];

    renderAdminPage(<AdminModelsPage />);

    const modelCell = await screen.findByText('GPT 4.1 Mini');
    const row = modelCell.closest('tr');
    expect(row).not.toBeNull();

    const rowScope = within(row as HTMLElement);

    fireEvent.click(rowScope.getByRole('button', { name: 'Enable' }));
    await waitFor(() => {
      expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
        appCopy.ui.feedback.adminModelsStatusUpdated,
        expect.objectContaining({ dedupeKey: 'admin-models:toggle:model-2:success' }),
      );
    });

    fireEvent.click(rowScope.getByRole('button', { name: 'Default' }));
    await waitFor(() => {
      expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
        appCopy.ui.feedback.adminModelsDefaultUpdated,
        expect.objectContaining({ dedupeKey: 'admin-models:default:model-2:success' }),
      );
    });
  });

  it('publishes global error when status toggle mutation fails', async () => {
    modelsDb = [
      ...modelsDb,
      {
        id: 'model-2',
        key: 'gpt-4.1-mini',
        label: 'GPT 4.1 Mini',
        status: 'disabled',
        isDefault: false,
        sortOrder: 2,
      },
    ];

    useMswHandler(
      http.put('/api/admin/models/:id', () => new HttpResponse(null, { status: 500 })),
    );

    renderAdminPage(<AdminModelsPage />);

    const modelCell = await screen.findByText('GPT 4.1 Mini');
    const row = modelCell.closest('tr');
    expect(row).not.toBeNull();

    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: 'Enable' }));

    await waitFor(() => {
      expect(feedbackApiSpy.publishError).toHaveBeenCalledWith(
        appCopy.ui.feedback.adminModelsStatusUpdateFailed,
        expect.objectContaining({ dedupeKey: 'admin-models:toggle:model-2:error' }),
      );
    });
  });
});
