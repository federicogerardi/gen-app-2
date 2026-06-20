/**
 * SerpApi Service Resolver
 * Resolves the configured SerpApi service for dual-channel crawling
 * Part of DDD-129 dual-channel crawling implementation
 */

import type { ResolvedApiServiceForAcquisition } from '../../adapters/api-service.adapter';
import type { ApiServiceAdapter } from '../../adapters/generation.adapters';

/**
 * Resolves the SerpApi service configuration for dual-channel crawling
 * Returns undefined if SERP_API_SERVICE_ID is not configured or service is not found
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
      console.warn(`SerpApi service not found: ${serviceId}. Falling back to Puppeteer-only crawling.`);
      return undefined;
    }

    if (service.status !== 'active') {
      console.warn(`SerpApi service disabled: ${serviceId}. Falling back to Puppeteer-only crawling.`);
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
      }. Falling back to Puppeteer-only crawling.`
    );
    return undefined;
  }
};

export const isSerpApiConfigured = (): boolean => {
  return Boolean(process.env.SERP_API_SERVICE_ID);
};