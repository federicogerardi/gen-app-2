/**
 * SerpApi Google AI Overview normalizer
 * Converts SerpApi AI Overview API responses to Geometric tool CrawlingResult format
 * Implements dual-channel crawling pattern per DDD-129
 */

export type SerpApiAiOverviewResponse = {
  search_metadata: {
    id: string;
    status: 'Success' | 'Error' | 'Processing';
    created_at: string;
    processed_at: string;
    total_time_taken: number;
  };
  search_parameters: {
    engine: 'google_ai_overview';
    page_token: string;
  };
  ai_overview: {
    text_blocks: Array<{
      type: 'paragraph' | 'list' | 'heading' | 'expandable' | 'comparison';
      snippet?: string;
      reference_indexes?: number[];
      title?: string;
      list?: Array<{
        title?: string;
        snippet?: string;
        reference_indexes?: number[];
      }>;
    }>;
    references: Array<{
      title: string;
      link: string;
      snippet: string;
      source: string;
      index: number;
    }>;
  };
  error?: string;
};

export type SerpApiGoogleSearchResponse = {
  search_metadata: {
    id: string;
    status: 'Success' | 'Error' | 'Processing';
    created_at: string;
    processed_at: string;
    total_time_taken: number;
  };
  search_parameters: {
    engine: 'google';
    q: string;
    location?: string;
    hl: string;
    gl: string;
  };
  ai_overview?: {
    page_token?: string;
    text_blocks?: Array<{
      type: 'paragraph' | 'list';
      snippet?: string;
      reference_indexes?: number[];
    }>;
    references?: Array<{
      title: string;
      link: string;
      snippet: string;
      source: string;
      index: number;
    }>;
  };
  organic_results?: Array<{
    position: number;
    title: string;
    link: string;
    snippet?: string;
    source?: string;
    sitelinks?: Array<{ title: string; link: string }>;
  }>;
  related_questions?: Array<{
    question: string;
    snippet?: string;
    title?: string;
    link?: string;
  }>;
  error?: string;
};

import type { CrawlingResult, SourceType } from './crawling.adapter';

const extractAiOverviewSnippet = (textBlocks: SerpApiAiOverviewResponse['ai_overview']['text_blocks']): string => {
  const snippets: string[] = [];
  
  for (const block of textBlocks) {
    if (block.type === 'paragraph' && block.snippet) {
      snippets.push(block.snippet);
    } else if (block.type === 'list' && block.list) {
      for (const item of block.list) {
        if (item.snippet) {
          snippets.push(`• ${item.title ? item.title + ': ' : ''}${item.snippet}`);
        }
      }
    } else if (block.snippet) {
      snippets.push(block.snippet);
    }
  }
  
  return snippets.join('\n\n').trim();
};

const classifySourceType = (url: string, title: string, source: string): SourceType => {
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();
  const sourceLower = source.toLowerCase();
  
  // Video detection
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be') || 
      sourceLower.includes('youtube') || titleLower.includes('video')) {
    return 'video';
  }
  
  // UGC/Community detection
  if (urlLower.includes('reddit.com') || urlLower.includes('quora.com') || 
      urlLower.includes('forum') || urlLower.includes('community') ||
      sourceLower.includes('reddit') || sourceLower.includes('quora')) {
    return 'ugc';
  }
  
  // News detection (basic heuristic)
  if (sourceLower.includes('news') || sourceLower.includes('bbc') || 
      sourceLower.includes('cnn') || sourceLower.includes('repubblica')) {
    return 'news';
  }
  
  // Default to organic
  return 'organic';
};

export const normalizeSerpApiAiOverview = (response: SerpApiAiOverviewResponse): Omit<CrawlingResult, 'screenshotPath'> => {
  if (response.error || response.search_metadata.status === 'Error') {
    throw new Error(`SerpApi error: ${response.error ?? 'Unknown error'}`);
  }
  
  if (!response.ai_overview) {
    return {
      aiOverviewSnippet: null,
      aiOverviewConfidence: 0.0,
      selectorUsed: 'serpapi-ai-overview',
      sources: [],
      adsCount: 0,
      videoCount: 0,
    };
  }
  
  const aiOverviewSnippet = extractAiOverviewSnippet(response.ai_overview.text_blocks);
  const sources = response.ai_overview.references.map((ref) => ({
    title: ref.title,
    url: ref.link,
    snippet: ref.snippet || null,
    sourceType: classifySourceType(ref.link, ref.title, ref.source),
  }));
  
  const adsCount = sources.filter(s => s.sourceType === 'sponsored').length;
  const videoCount = sources.filter(s => s.sourceType === 'video').length;
  
  return {
    aiOverviewSnippet: aiOverviewSnippet || null,
    aiOverviewConfidence: 0.95, // High confidence for SerpApi structured data
    selectorUsed: 'serpapi-ai-overview',
    sources,
    adsCount,
    videoCount,
  };
};

export const extractPAAQueriesFromSerpApi = (response: SerpApiGoogleSearchResponse): string[] => {
  if (!response.related_questions) {
    return [];
  }
  
  return response.related_questions
    .slice(0, 4) // Max 4 PAA queries per DDD-118
    .map(rq => rq.question)
    .filter(Boolean);
};

/**
 * Determines if a Google search response contains an AI Overview that requires
 * a separate SerpApi Google AI Overview API call
 */
export const requiresSeparateAiOverviewRequest = (response: SerpApiGoogleSearchResponse): string | null => {
  return response.ai_overview?.page_token || null;
};