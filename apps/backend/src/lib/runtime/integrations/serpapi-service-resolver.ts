/**
 * SerpApi Service Resolver
 * Resolves the configured SerpApi service for SERP crawling.
 * Part of DDD-129 SerpApi crawling implementation.
 */

import type { ResolvedApiServiceForAcquisition } from '../../adapters/api-service.adapter';
import type { ApiServiceAdapter } from '../../adapters/generation.adapters';
import { createComponentLogger, LogComponent } from '../log-components';

/**
 * Resolves the SerpApi service configuration for crawling.
 * Returns undefined if SERP_API_SERVICE_ID is not configured or service is not found.
 */
export const resolveSerpApiService = async (
  apiServiceAdapter: ApiServiceAdapter,
): Promise<ResolvedApiServiceForAcquisition | undefined> => {
  const serviceId = process.env.SERP_API_SERVICE_ID;
  const apiKey = process.env.SERP_API_KEY;

  if (!serviceId) {
    return undefined;
  }

  try {
    const service = await apiServiceAdapter.resolveApiServiceForCrawling(serviceId);
    
    if (!service) {
      const log = createComponentLogger(LogComponent.SERPAPI_RESOLVER);
      log.warn({ serviceId }, 'SerpApi service not found');
      return undefined;
    }

    if (service.status !== 'active') {
      const log = createComponentLogger(LogComponent.SERPAPI_RESOLVER);
      log.warn({ serviceId }, 'SerpApi service disabled');
      return undefined;
    }

    if (apiKey) {
      const resolvedService: ResolvedApiServiceForAcquisition = {
        ...service,
        tokenCiphertext: apiKey,
      };
      return resolvedService;
    }

    return service;
  } catch (error) {
    const log = createComponentLogger(LogComponent.SERPAPI_RESOLVER);
    log.warn({ serviceId, reason: error instanceof Error ? error.message : 'Unknown error' }, 'failed to resolve SerpApi service');
    return undefined;
  }
};

export const isSerpApiConfigured = (): boolean => {
  return Boolean(process.env.SERP_API_SERVICE_ID);
};