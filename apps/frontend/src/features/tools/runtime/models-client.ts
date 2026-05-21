/**
 * LlmModelCatalog client for the frontend.
 * Consumes GET /api/models to populate the LlmModelSelector.
 * DDD-057: LlmModelSelector is the Frontend bounded-context term for the model select component.
 */

import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { joinApiPath, requestJson } from '../../../app/runtime/http-client';

/**
 * A model option exposed to the frontend LlmModelSelector.
 * Maps LlmModel.key → LlmModelId, LlmModel.label → display text,
 * and LlmModel.isDefault → whether this is the catalog default. DDD-056.
 */
export type LlmModelOption = {
  key: string;
  label: string;
  isDefault: boolean;
};

type ModelsApiResponse = {
  data?: {
    models?: Array<{ key?: unknown; label?: unknown; isDefault?: unknown }>;
  };
};

type ModelsClientOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
};

/**
 * Lists enabled LlmModel entries from the backend catalog.
 * Returns [] only when the capability flag is off.
 * Throws when catalog fetch fails so callers can render explicit error states.
 * DDD-055: LlmModelCatalog; DDD-056: LlmModelId.
 */
export const listEnabledModels = async (
  options: ModelsClientOptions,
): Promise<LlmModelOption[]> => {
  if (!options.capabilities.models) {
    return [];
  }

  try {
    const payload = await requestJson<ModelsApiResponse>(
      joinApiPath(options.apiBaseUrl, '/api/models'),
      { method: 'GET', credentials: 'include' },
    );

    const raw = payload.data?.models;
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter((m) => typeof m.key === 'string' && typeof m.label === 'string')
      .map((m) => ({ key: m.key as string, label: m.label as string, isDefault: m.isDefault === true }));
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Unable to load models catalog: ${error.message}`);
    }
    throw new Error('Unable to load models catalog');
  }
};
