import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveBackendCapabilities } from '../../../app/runtime/backend-capabilities';
import {
  isToolApiBindingStatusAdapterEnabled,
  resolveToolApiBindingStatuses,
} from './tool-api-binding-status-adapter';

const requestJsonMock = vi.fn();

vi.mock('../../../app/runtime/http-client', () => ({
  requestJson: (...args: unknown[]) => requestJsonMock(...args),
  joinApiPath: (base: string, path: string) => `${base}${path}`,
}));

describe('tool-api-binding-status-adapter', () => {
  beforeEach(() => {
    requestJsonMock.mockReset();
  });

  it('keeps feature flag disabled by default', () => {
    const previousFeatureFlag = import.meta.env.VITE_FF_TOOLS_API_BINDING_STATUS;
    (import.meta.env as Record<string, string | undefined>).VITE_FF_TOOLS_API_BINDING_STATUS = undefined;

    try {
      expect(isToolApiBindingStatusAdapterEnabled()).toBe(false);
    } finally {
      (import.meta.env as Record<string, string | undefined>).VITE_FF_TOOLS_API_BINDING_STATUS = previousFeatureFlag;
    }
  });

  it('maps backend resolve payload to connected status when active binding exists', async () => {
    requestJsonMock.mockResolvedValue({
      data: {
        apiService: { status: 'active' },
        resolveContract: {
          bindings: [
            { id: 'bind-1', toolKey: 'funnel-pages', bindingStatus: 'active' },
          ],
        },
      },
    });

    const result = await resolveToolApiBindingStatuses({
      apiBaseUrl: '',
      capabilities: resolveBackendCapabilities({ toolsApiServicesResolve: true }),
      toolKey: 'funnel-pages',
      apiAcquisitionInputs: [
        {
          key: 'market-intel-service',
          label: 'MarketIntelService',
          requiredness: 'required-by-tool-setting',
        },
      ],
    });

    expect(result).toEqual([
      {
        key: 'market-intel-service',
        connected: true,
        bindingLabel: 'bind-1',
      },
    ]);
  });
});
