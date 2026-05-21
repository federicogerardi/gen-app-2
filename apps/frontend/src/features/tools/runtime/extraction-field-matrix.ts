import {
  type ExtractionFieldKey,
  type ToolKey,
  InstructionRequiredExtractionFieldKeysByTool,
  LegacyExtractionFieldAliasByTool,
  normalizeExtractionFieldKeysForTool as normalizeExtractionFieldKeysForToolContract,
  ReadinessRequiredExtractionFieldKeysByTool,
} from '@gen-app-2/contracts';

export type {
  ExtractionFieldKey,
} from '@gen-app-2/contracts';

export {
  InstructionRequiredExtractionFieldKeysByTool,
  LegacyExtractionFieldAliasByTool,
  ReadinessRequiredExtractionFieldKeysByTool,
};

export const ExtractionFieldLabelByKey: Readonly<Record<ExtractionFieldKey, string>> = {
  avatar: 'Avatar',
  brand_or_company: 'Brand o azienda',
  creative_constraints: 'Vincoli creativi',
  funnel_goal: 'Obiettivo del funnel',
  goal: 'Obiettivo',
  knowledge_content: 'Knowledge content',
  market: 'Mercato',
  offer: 'Offerta',
  offer_or_service: 'Offerta o servizio',
  pain_point: 'Pain point',
  primary_cta: 'CTA principale',
  product_or_service: 'Prodotto o servizio',
  proof: 'Proof',
  proprietary_methodology_disclosure: 'Proprietary methodology disclosure',
  purchase_process_type: 'Purchase process type',
  required_sections: 'Sezioni richieste',
  target_audience: 'Target',
  target_duration_minutes: 'Target duration (minutes)',
  tone: 'Tone',
  website_goal: 'Obiettivo del sito',
} as const;

export const mapExtractionFieldKeyToLabel = (
  key: ExtractionFieldKey,
): string => ExtractionFieldLabelByKey[key];

export const mapExtractionFieldKeysToLabels = (
  keys: readonly ExtractionFieldKey[],
): string[] => keys.map((key) => mapExtractionFieldKeyToLabel(key));

export const normalizeExtractionFieldKeysForTool = (
  toolKey: ToolKey,
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> => normalizeExtractionFieldKeysForToolContract(toolKey, payload);

// Compile-time guard: every key used by instruction/readiness policies must have a label.
const _InstructionLabelCoverage: {
  [K in ToolKey]: readonly (keyof typeof ExtractionFieldLabelByKey)[];
} = InstructionRequiredExtractionFieldKeysByTool;

const _ReadinessLabelCoverage: {
  [K in ToolKey]: readonly (keyof typeof ExtractionFieldLabelByKey)[];
} = ReadinessRequiredExtractionFieldKeysByTool;

void _InstructionLabelCoverage;
void _ReadinessLabelCoverage;
