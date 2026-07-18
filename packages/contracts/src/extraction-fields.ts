import type { ToolKey } from './tool-workflows';

export const EXTRACTION_FIELD_KEYS = [
  'avatar',
  'brand_or_company',
  'budget_context',
  'campaign_objective',
  'cluster_opportunities',
  'creative_constraints',
  'dominant_pain_points',
  'funnel_goal',
  'goal',
  'lf8_priority',
  'knowledge_content',
  'market',
  'objections',
  'offer',
  'offer_or_service',
  'pain_point',
  'primary_offer',
  'primary_cta',
  'product_or_service',
  'proof',
  'proof_points',
  'proprietary_methodology_disclosure',
  'purchase_process_type',
  'required_sections',
  'target_audience',
  'target_duration_minutes',
  'tone',
  'unique_mechanism',
  'website_goal',
  'awareness_priority',
  'angle_candidates',
  'base_query',
  'language',
  'country',
] as const;

export type ExtractionFieldKey = (typeof EXTRACTION_FIELD_KEYS)[number];

export const isExtractionFieldKey = (value: string): value is ExtractionFieldKey => (
  (EXTRACTION_FIELD_KEYS as readonly string[]).includes(value)
);

export const InstructionRequiredExtractionFieldKeysByTool: Readonly<Record<ToolKey, readonly ExtractionFieldKey[]>> = {
  'funnel-pages': [
    'funnel_goal',
    'target_audience',
    'offer',
    'proof',
    'primary_cta',
  ],
  nextland: [
    'website_goal',
    'brand_or_company',
    'target_audience',
    'offer_or_service',
    'required_sections',
  ],
  'youtube-lf-script': [
    'knowledge_content',
    'avatar',
    'pain_point',
    'purchase_process_type',
    'offer',
    'proof',
    'target_duration_minutes',
    'proprietary_methodology_disclosure',
  ],
  'angle-generator': [
    'goal',
    'product_or_service',
    'market',
    'target_audience',
    'pain_point',
    'offer',
    'proof',
    'creative_constraints',
  ],
  'meta-ads': [
    'product_or_service',
    'target_audience',
    'campaign_objective',
    'budget_context',
    'primary_offer',
    'proof_points',
    'dominant_pain_points',
    'objections',
    'awareness_priority',
    'lf8_priority',
    'unique_mechanism',
    'angle_candidates',
    'cluster_opportunities',
  ],
  'youtube-description': [],
  'geometric': [],
  'blog-article-generator': [],
  'brief-generator': [
    'product_or_service',
    'target_audience',
    'campaign_objective',
    'primary_offer',
    'tone',
  ],
} as const;

export const ReadinessRequiredExtractionFieldKeysByTool: Readonly<Record<ToolKey, readonly ExtractionFieldKey[]>> = {
  'funnel-pages': [],
  nextland: [],
  'youtube-lf-script': [
    'knowledge_content',
    'avatar',
    'pain_point',
    'offer',
    'proof',
  ],
  'angle-generator': [],
  'meta-ads': [],
  'youtube-description': [],
  'geometric': [],
  'blog-article-generator': [],
  'brief-generator': [],
} as const;

export const LegacyExtractionFieldAliasByTool: Readonly<Record<ToolKey, Readonly<Record<string, ExtractionFieldKey>>>> = {
  'funnel-pages': {
    'obiettivo del funnel': 'funnel_goal',
    target: 'target_audience',
    offerta: 'offer',
    'proof o testimonianze': 'proof',
    'cta principale': 'primary_cta',
  },
  nextland: {
    'obiettivo del sito': 'website_goal',
    'brand o azienda': 'brand_or_company',
    target: 'target_audience',
    'offerta o servizio': 'offer_or_service',
    'sezioni richieste': 'required_sections',
  },
  'youtube-lf-script': {
    'knowledge content': 'knowledge_content',
    avatar: 'avatar',
    'pain point': 'pain_point',
    'purchase process type': 'purchase_process_type',
    offer: 'offer',
    proof: 'proof',
    tone: 'tone',
    'target duration minutes': 'target_duration_minutes',
    'proprietary methodology disclosure': 'proprietary_methodology_disclosure',
  },
  'angle-generator': {
    obiettivo: 'goal',
    'prodotto o servizio': 'product_or_service',
    mercato: 'market',
    target: 'target_audience',
    'pain point': 'pain_point',
    proof: 'proof',
    'vincoli creativi': 'creative_constraints',
    offerta: 'offer',
  },
  'meta-ads': {
    'prodotto o servizio': 'product_or_service',
    target: 'target_audience',
    'obiettivo campagna': 'campaign_objective',
    'contesto budget': 'budget_context',
    'offerta principale': 'primary_offer',
    'punti di prova': 'proof_points',
    'pain point dominanti': 'dominant_pain_points',
    obiezioni: 'objections',
    'awareness priority': 'awareness_priority',
    'lf8 priority': 'lf8_priority',
    'meccanismo unico': 'unique_mechanism',
    'angle candidates': 'angle_candidates',
    'cluster opportunities': 'cluster_opportunities',
  },
  'youtube-description': {},
  'geometric': {},
  'blog-article-generator': {},
  'brief-generator': {},
} as const;

const normalizeAliasCandidate = (value: string): string => value.trim().toLowerCase();

export const normalizeExtractionFieldKeysForTool = (
  toolKey: ToolKey,
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> => {
  if (!payload) {
    return {};
  }

  const aliasMap = LegacyExtractionFieldAliasByTool[toolKey];
  const normalized: Record<string, unknown> = {};

  for (const [sourceKey, value] of Object.entries(payload)) {
    const normalizedSourceKey = normalizeAliasCandidate(sourceKey);
    const canonicalKey = aliasMap[normalizedSourceKey]
      ?? (isExtractionFieldKey(normalizedSourceKey) ? normalizedSourceKey : null);

    if (!canonicalKey) {
      normalized[sourceKey] = value;
      continue;
    }

    if (normalizedSourceKey === canonicalKey) {
      normalized[canonicalKey] = value;
      continue;
    }

    if (!(canonicalKey in normalized)) {
      normalized[canonicalKey] = value;
    }
  }

  return normalized;
};
