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
  base_query: 'Base query',
  behaviors: 'Behaviors',
  brand_or_company: 'Brand or company',
  budget_context: 'Budget context',
  campaign_objective: 'Campaign objective',
  cluster_opportunities: 'Cluster opportunities',
  country: 'Country',
  creative_constraints: 'Creative constraints',
  demographics: 'Demographics',
  dominant_pain_points: 'Dominant pain points',
  funnel_goal: 'Funnel goal',
  goal: 'Goal',
  goals: 'Goals',
  language: 'Language',
  lf8_priority: 'LF8 priority',
  knowledge_content: 'Knowledge content',
  market: 'Market',
  objections: 'Objections',
  offer: 'Offer',
  offer_or_service: 'Offer or service',
  pain_point: 'Pain point',
  primary_offer: 'Primary offer',
  primary_cta: 'Primary CTA',
  product_or_service: 'Product or service',
  proof: 'Proof',
  proof_points: 'Proof points',
  proprietary_methodology_disclosure: 'Proprietary methodology disclosure',
  purchase_process_type: 'Purchase process type',
  required_sections: 'Required sections',
  target_audience: 'Target',
  target_duration_minutes: 'Target duration (minutes)',
  tone: 'Tone',
  unique_mechanism: 'Unique mechanism',
  website_goal: 'Website goal',
  awareness_priority: 'Awareness priority',
  angle_candidates: 'Angle candidates',
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
