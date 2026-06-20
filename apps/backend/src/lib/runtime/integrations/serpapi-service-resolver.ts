/**
 * SerpApi Service Resolver
 * Resolves the configured SerpApi service for SERP crawling.
 * Part of DDD-129 SerpApi crawling implementation.
 */

import type { ResolvedApiServiceForAcquisition } from '../../adapters/api-service.adapter';
import type { ApiServiceAdapter } from '../../adapters/generation.adapters';

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
      console.warn(`SerpApi service not found: ${serviceId}.`);
      return undefined;
    }

    if (service.status !== 'active') {
      console.warn(`SerpApi service disabled: ${serviceId}.`);
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
    console.warn(
      `Failed to resolve SerpApi service ${serviceId}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }.`
    );
    return undefined;
  }
};

export const isSerpApiConfigured = (): boolean => {
  return Boolean(process.env.SERP_API_SERVICE_ID);
};