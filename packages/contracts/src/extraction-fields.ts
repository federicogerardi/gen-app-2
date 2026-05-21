import type { ToolKey } from './tool-workflows';

export const EXTRACTION_FIELD_KEYS = [
  'avatar',
  'brand_or_company',
  'creative_constraints',
  'funnel_goal',
  'goal',
  'knowledge_content',
  'market',
  'offer',
  'offer_or_service',
  'pain_point',
  'primary_cta',
  'product_or_service',
  'proof',
  'proprietary_methodology_disclosure',
  'purchase_process_type',
  'required_sections',
  'target_audience',
  'target_duration_minutes',
  'tone',
  'website_goal',
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
