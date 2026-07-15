import { createComponentLogger, LogComponent } from '../../runtime/log-components';

const glog = createComponentLogger(LogComponent.GEOMETRIC);

export const mergeAcquisitionIntoGenerationInput = (
  baseInput: Record<string, unknown>,
  acquisitionOutput: unknown,
): Record<string, unknown> => {
  const normalizedBase = { ...baseInput };

  if (!acquisitionOutput || typeof acquisitionOutput !== 'object' || Array.isArray(acquisitionOutput)) {
    return normalizedBase;
  }

  const acquisitionPayload = acquisitionOutput as Record<string, unknown>;
  return {
    ...normalizedBase,
    acquisition: {
      ...(typeof normalizedBase.acquisition === 'object' && normalizedBase.acquisition !== null
        ? (normalizedBase.acquisition as Record<string, unknown>)
        : {}),
      ...acquisitionPayload,
    },
  };
};

export const mergeCrawlingIntoGenerationInput = (
  baseInput: Record<string, unknown>,
  crawlingOutput: unknown,
): Record<string, unknown> => {
  const normalizedBase = { ...baseInput };

  if (!crawlingOutput || typeof crawlingOutput !== 'object') {
    return normalizedBase;
  }

  const output = crawlingOutput as Record<string, unknown>;
  const crawlArtifacts = output.crawlArtifacts;
  const paaQueries = output.paaQueries;

  const snippets = Array.isArray(crawlArtifacts)
    ? crawlArtifacts
        .map((a: unknown) => (a as Record<string, unknown>)?.content)
        .filter((c): c is string => typeof c === 'string')
        .join('\n\n')
    : '';

  const sources = Array.isArray(crawlArtifacts)
    ? crawlArtifacts.flatMap((a: unknown) => {
        const sp = (a as Record<string, unknown>)?.structuredPayload;
        if (sp && typeof sp === 'object' && 'sources' in sp) {
          return Array.isArray((sp as Record<string, unknown>).sources)
            ? (sp as Record<string, unknown>).sources
            : [];
        }
        return [];
      })
    : [];

  return {
    ...normalizedBase,
    crawling: {
      snippets,
      sources,
      paaQueries: Array.isArray(paaQueries) ? paaQueries : [],
    },
  };
};

/**
 * Assemble input for strategic-reporting step.
 * Receives assembledGenerationInput (crawling + scoring) and produces LLM prompt context.
 * **Token efficiency rule**: SerpApi-only structured data — text snippets and JSON only.
 */
export const assembleStrategicReportingInput = (
  assembledInput: Record<string, unknown>,
  requestId?: string,
): Record<string, unknown> => {
  const crawling = assembledInput.crawling as Record<string, unknown> | undefined;
  const scoring = assembledInput.scoring as Record<string, unknown> | undefined;
  const brandName = typeof assembledInput.brandName === 'string' ? assembledInput.brandName : '';

  const result: Record<string, unknown> = {
    serpSnippets: (typeof crawling?.snippets === 'string' && crawling.snippets.length > 0)
      ? [crawling.snippets]
      : [],
    paaQueries: Array.isArray(crawling?.paaQueries) ? crawling.paaQueries : [],
    competitorRanking: scoring ?? {},
    currentDate: new Date().toLocaleDateString('it-IT'),
  };

  if (brandName) {
    result.brandName = brandName;
  }

  glog.info({ requestId: requestId ?? 'unknown', operation: 'assembleStrategicReportingInput', snippetCount: (result.serpSnippets as string[]).length, paaCount: (result.paaQueries as string[]).length, competitorCount: Object.keys(result.competitorRanking as Record<string, unknown>).length, brandName: brandName || 'none' }, 'assembly.strategic_reporting');

  return result;
};

/**
 * Assemble input for unified-report step.
 * Receives assembledGenerationInput (crawling + scoring) and produces LLM prompt context.
 * **Token efficiency rule**: SerpApi-only structured data — text and JSON only.
 */
export const assembleUnifiedReportInput = (
  assembledInput: Record<string, unknown>,
  requestId?: string,
): Record<string, unknown> => {
  const crawling = assembledInput.crawling as Record<string, unknown> | undefined;
  const scoring = assembledInput.scoring as Record<string, unknown> | undefined;
  const brandName = typeof assembledInput.brandName === 'string' ? assembledInput.brandName : '';
  const baseQuery = typeof assembledInput.baseQuery === 'string' ? assembledInput.baseQuery : '';

  const serpSnippets = (typeof crawling?.snippets === 'string' && crawling.snippets.length > 0)
    ? [crawling.snippets]
    : [];
  const paaQueries = Array.isArray(crawling?.paaQueries) ? crawling.paaQueries : [];

  const result: Record<string, unknown> = {
    serpSnippets,
    paaQueries,
    baseQuery,
    queryCount: 1 + paaQueries.length,
    competitorRanking: scoring ?? {},
    currentDate: new Date().toLocaleDateString('it-IT'),
  };

  if (brandName) {
    result.brandName = brandName;
  }

  glog.info({ requestId: requestId ?? 'unknown', operation: 'assembleUnifiedReportInput', snippetCount: serpSnippets.length, paaCount: paaQueries.length, competitorCount: Object.keys(result.competitorRanking as Record<string, unknown>).length, brandName: brandName || 'none', baseQuery: baseQuery || 'none' }, 'assembly.unified_report');

  return result;
};

/**
 * Determines which assembly function to apply based on current tool step.
 * Returns null if no special assembly is needed (default generation input is fine).
 */
export const selectGeometricAssembly = (
  stepKey: string,
  assembledInput: Record<string, unknown>,
  requestId?: string,
): Record<string, unknown> | null => {
  glog.info({ requestId: requestId ?? 'unknown', operation: 'selectGeometricAssembly', stepKey }, 'assembly.select');

  switch (stepKey) {
    case 'strategic-reporting':
      return assembleStrategicReportingInput(assembledInput, requestId);
    case 'unified-report':
      return assembleUnifiedReportInput(assembledInput, requestId);
    default:
      return null;
  }
};
