/**
 * Crawling adapter — SerpApi-only SERP extraction.
 * Uses SerpApi Google Search + Google AI Overview APIs.
 * If SerpApi fails, the error propagates and stops the process.
 *
 * Used by invokeCrawling fromPromise actor in crawling-chain.machine.ts.
 */

import type { ResolvedApiServiceForAcquisition } from '../../adapters/api-service.adapter';
import { executeApiAcquisition } from './api-acquisition.adapter';
import {
  normalizeSerpApiAiOverview,
  extractPAAQueriesFromSerpApi,
  requiresSeparateAiOverviewRequest,
  type SerpApiGoogleSearchResponse,
  type SerpApiAiOverviewResponse,
} from './serpapi-normalizer';

export type SourceType = 'organic' | 'sitelink' | 'video' | 'sponsored' | 'ugc' | 'news' | 'unknown';

export type CrawlingResult = {
  aiOverviewSnippet: string | null;
  sources: {
    title: string;
    url: string;
    snippet: string | null;
    sourceType: SourceType;
    sitelinks?: string[];
    videoMeta?: { platform: string; views?: string };
  }[];
  adsCount: number;
  videoCount: number;
};

/**
 * API Channel: Crawl using SerpApi Google Search + AI Overview APIs.
 * If SerpApi fails, the error propagates and stops the crawling process.
 */
const crawlSerpViaApi = async (
  query: string,
  language: string,
  country: string,
  apiService: ResolvedApiServiceForAcquisition,
): Promise<CrawlingResult> => {
  // Step 1: Get Google search results with potential AI Overview
  const searchResponse = await executeApiAcquisition({
    service: apiService,
    query: {
      engine: 'google',
      q: query,
      hl: language,
      gl: country.replace('google.', ''), // google.it -> it
      output: 'json',
      no_cache: 'false',
    },
  });

  if (searchResponse.statusCode !== 200) {
    throw new Error(`SerpApi search failed: HTTP ${searchResponse.statusCode}`);
  }

  const googleSearchResult = searchResponse.payload as SerpApiGoogleSearchResponse;
  
  if (googleSearchResult.error) {
    throw new Error(`SerpApi search error: ${googleSearchResult.error}`);
  }

  // Step 2: Check if separate AI Overview request is needed
  const aiOverviewPageToken = requiresSeparateAiOverviewRequest(googleSearchResult);
  
  let aiOverviewData;
  if (aiOverviewPageToken) {
    // Make separate AI Overview request
    const aiOverviewResponse = await executeApiAcquisition({
      service: apiService,
      query: {
        engine: 'google_ai_overview',
        page_token: aiOverviewPageToken,
        output: 'json',
        no_cache: 'false',
      },
    });

    if (aiOverviewResponse.statusCode === 200) {
      const aiOverviewResult = aiOverviewResponse.payload as SerpApiAiOverviewResponse;
      if (!aiOverviewResult.error) {
        aiOverviewData = normalizeSerpApiAiOverview(aiOverviewResult);
      }
    }
  }

  // Step 3: Normalize data - prioritize AI Overview data, fallback to search results
  if (aiOverviewData) {
    return aiOverviewData;
  }

  // Fallback: Extract from embedded AI Overview in search results
  if (googleSearchResult.ai_overview && googleSearchResult.ai_overview.references) {
    const sources = googleSearchResult.ai_overview.references.map(ref => ({
      title: ref.title,
      url: ref.link,
      snippet: ref.snippet || null,
      sourceType: 'organic' as SourceType, // Simplified typing for embedded results
    }));

    const aiOverviewSnippet = googleSearchResult.ai_overview.text_blocks
      ?.filter(block => block.type === 'paragraph' && block.snippet)
      .map(block => block.snippet)
      .join('\n\n') || null;

    return {
      aiOverviewSnippet,
      sources,
      adsCount: 0,
      videoCount: sources.filter(s => s.url.includes('youtube.com')).length,
    };
  }

  // No AI Overview found - return minimal result
  return {
    aiOverviewSnippet: null,
    sources: googleSearchResult.organic_results?.slice(0, 10).map(result => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet || null,
      sourceType: 'organic' as SourceType,
    })) || [],
    adsCount: 0,
    videoCount: 0,
  };
};

/**
 * API Channel: Discover PAA queries using SerpApi
 */
const discoverPAAQueriesViaApi = async (
  baseQuery: string,
  language: string,
  country: string,
  apiService: ResolvedApiServiceForAcquisition,
): Promise<string[]> => {
  const response = await executeApiAcquisition({
    service: apiService,
    query: {
      engine: 'google',
      q: baseQuery,
      hl: language,
      gl: country.replace('google.', ''),
      output: 'json',
      no_cache: 'false',
    },
  });

  if (response.statusCode !== 200) {
    return [];
  }

  const searchResult = response.payload as SerpApiGoogleSearchResponse;
  if (searchResult.error) {
    return [];
  }

  return extractPAAQueriesFromSerpApi(searchResult);
};

/**
 * SerpApi Channel: Crawl using SerpApi Google Search + Google AI Overview APIs.
 * If SerpApi fails, the error propagates.
 */
export const crawlSerp = async (
  query: string,
  language: string,
  country: string,
  apiService: ResolvedApiServiceForAcquisition,
): Promise<CrawlingResult> => {
  return crawlSerpViaApi(query, language, country, apiService);
};

/**
 * SerpApi Channel: Discover PAA queries using SerpApi.
 * If SerpApi fails, the error propagates.
 */
export const discoverPAAQueries = async (
  baseQuery: string,
  language: string,
  country: string,
  apiService: ResolvedApiServiceForAcquisition,
): Promise<string[]> => {
  return discoverPAAQueriesViaApi(baseQuery, language, country, apiService);
};
