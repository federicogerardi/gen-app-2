export type SerpSourceType = 'organic' | 'sitelink' | 'video' | 'sponsored'

export interface SerpSource {
  title: string
  url: string
  snippet: string
  sourceType: SerpSourceType
}

export type DomainTier = 'TIER_1' | 'TIER_2' | 'TIER_3'

export interface DomainScore {
  domain: string
  geoScore: number
  tier: DomainTier
  sources: number
}

export type CompetitorRanking = Record<
  string,
  { geoScore: number; tier: string; queriesCovered: string[] }
>

const SOURCE_TYPE_WEIGHTS: Record<SerpSourceType, number> = {
  organic: 3.0,
  sitelink: 2.0,
  video: 2.0,
  sponsored: 1.5,
}

const GEO_SCORE_MIN = 1
const GEO_SCORE_MAX = 10
const TIER_1_THRESHOLD = 8
const TIER_2_THRESHOLD = 5

/**
 * Extracts the domain (hostname) from a URL string.
 *
 * @param url - A valid or potentially malformed URL string.
 * @returns The hostname, or the original string if parsing fails.
 */
const extractDomain = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/**
 * Returns the weight multiplier for a given SERP source type.
 * Falls back to 0 for unknown types.
 *
 * @param sourceType - The type of SERP result.
 * @returns The numeric weight for that type.
 */
const resolveWeight = (sourceType: string): number => {
  return SOURCE_TYPE_WEIGHTS[sourceType as SerpSourceType] ?? 0
}

/**
 * Assigns a competitiveness tier based on a normalized geoScore.
 *
 * @param score - Normalized score on a 1–10 scale.
 * @returns The applicable tier.
 */
const assignTier = (score: number): DomainTier => {
  if (score >= TIER_1_THRESHOLD) {
    return 'TIER_1'
  }

  if (score >= TIER_2_THRESHOLD) {
    return 'TIER_2'
  }

  return 'TIER_3'
}

/**
 * Computes raw scores per domain by summing (weight * count) for each source type.
 *
 * @param sources - Array of SERP sources.
 * @returns A map of domain to raw score and source count.
 */
const computeRawScores = (
  sources: SerpSource[],
): Map<string, { rawScore: number; count: number }> => {
  const map = new Map<string, { rawScore: number; count: number }>()

  for (const source of sources) {
    const domain = extractDomain(source.url)
    const existing = map.get(domain) ?? { rawScore: 0, count: 0 }
    const weight = resolveWeight(source.sourceType)

    map.set(domain, {
      rawScore: existing.rawScore + weight,
      count: existing.count + 1,
    })
  }

  return map
}

/**
 * Normalizes raw scores to a 1–10 scale using min-max scaling.
 * If all scores are identical or only one domain exists, every domain receives the midpoint (5.5).
 *
 * @param scores - Map of domain to raw score and count.
 * @returns Array of domain scores with normalized geoScore, tier, and source count.
 */
const normalizeScores = (
  scores: Map<string, { rawScore: number; count: number }>,
): DomainScore[] => {
  const entries = Array.from(scores.entries())
  const rawValues = entries.map(([, { rawScore }]) => rawScore)

  if (rawValues.length === 0) {
    return []
  }

  const minRaw = Math.min(...rawValues)
  const maxRaw = Math.max(...rawValues)
  const range = maxRaw - minRaw

  return entries.map(([domain, { rawScore, count }]) => {
    let normalized: number

    if (range === 0) {
      normalized = (GEO_SCORE_MIN + GEO_SCORE_MAX) / 2
    } else {
      normalized =
        GEO_SCORE_MIN +
        ((rawScore - minRaw) / range) * (GEO_SCORE_MAX - GEO_SCORE_MIN)
    }

    const geoScore = parseFloat(normalized.toFixed(2))

    return {
      domain,
      geoScore,
      tier: assignTier(geoScore),
      sources: count,
    }
  })
}

/**
 * Computes domain-level competitiveness scores from an array of SERP sources.
 *
 * Steps:
 * 1. Group sources by domain (extracted from URL).
 * 2. Weight each source by type: organic (3.0), sitelink (2.0), video (2.0), sponsored (1.5).
 * 3. Calculate a raw score per domain.
 * 4. Normalize raw scores to a 1–10 scale using min-max scaling.
 * 5. Assign tiers: TIER_1 (8–10), TIER_2 (5–7.9), TIER_3 (1–4.9).
 * 6. Sort descending by geoScore.
 *
 * @param sources - Array of SERP sources to score.
 * @returns Sorted array of domain scores.
 */
export const computeDomainScores = (sources: SerpSource[]): DomainScore[] => {
  const rawScores = computeRawScores(sources)
  const normalized = normalizeScores(rawScores)

  return normalized.sort((a, b) => b.geoScore - a.geoScore)
}

/**
 * Computes a competitor ranking map keyed by domain.
 * This is a convenience wrapper around {@link computeDomainScores} useful when
 * you only need a record and want to track which queries each domain appeared for.
 *
 * @param sources - Array of lightweight objects with `url` and optional `sourceType`.
 * @param queryLabel - Optional label for the query context (defaults to 'default').
 * @returns A record mapping each domain to its score, tier, and covered query labels.
 */
export const computeCompetitorRanking = (
  sources: { url: string; sourceType?: string }[],
  queryLabel = 'default',
): CompetitorRanking => {
  const typedSources: SerpSource[] = sources.map((s) => ({
    title: '',
    url: s.url,
    snippet: '',
    sourceType: (s.sourceType as SerpSourceType) ?? 'organic',
  }))

  const domainScores = computeDomainScores(typedSources)
  const ranking: CompetitorRanking = {}

  for (const entry of domainScores) {
    ranking[entry.domain] = {
      geoScore: entry.geoScore,
      tier: entry.tier,
      queriesCovered: [queryLabel],
    }
  }

  return ranking
}
