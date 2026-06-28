export const TOOL_WORKFLOW_DEFINITIONS = {
  'funnel-pages': {
    toolKey: 'funnel-pages',
    workflowType: 'funnel_pages',
    creditCost: 1,
    steps: [
      { key: 'optin', dependencies: [] },
      { key: 'quiz', dependencies: ['optin'] },
      { key: 'vsl', dependencies: ['optin', 'quiz'] },
    ],
  },
  nextland: {
    toolKey: 'nextland',
    workflowType: 'nextland',
    creditCost: 1,
    steps: [
      { key: 'landing', dependencies: [] },
      { key: 'thank_you', dependencies: ['landing'] },
    ],
  },
  'youtube-lf-script': {
    toolKey: 'youtube-lf-script',
    workflowType: 'youtube_lf_script',
    creditCost: 1,
    steps: [
      { key: 'pre-script-analysis', dependencies: [] },
      { key: 'packaging', dependencies: ['pre-script-analysis'] },
      { key: 'intro-structure', dependencies: ['packaging'] },
      { key: 'body-structure', dependencies: ['intro-structure'] },
      { key: 'native-cta-embeds', dependencies: ['body-structure'] },
      { key: 'outro-structure', dependencies: ['native-cta-embeds'] },
    ],
  },
  'angle-generator': {
    toolKey: 'angle-generator',
    workflowType: 'angle_generator',
    creditCost: 1,
    steps: [
      { key: 'context-and-angle-matrix', dependencies: [] },
      { key: 'angle-prioritization', dependencies: ['context-and-angle-matrix'] },
      { key: 'creative-activation', dependencies: ['angle-prioritization'] },
    ],
  },
  'meta-ads': {
    toolKey: 'meta-ads',
    workflowType: 'meta_ads_generator',
    creditCost: 1,
    steps: [
      { key: 'context-generation', dependencies: [] },
      { key: 'ads-generation', dependencies: ['context-generation'] },
    ],
    copyLengthOptions: ['short-form', 'medium-form', 'long-form'] as const,
    defaultCopyLength: 'medium-form' as const,
  },
  'youtube-description': {
    toolKey: 'youtube-description',
    workflowType: 'youtube_description',
    creditCost: 1,
    steps: [
      { key: 'youtube-description-generation', dependencies: [] },
    ],
  },
  'geometric': {
    toolKey: 'geometric',
    workflowType: 'geometric_analysis',
    creditCost: 1,
    steps: [
      { key: 'serp-crawling', dependencies: [] },
      { key: 'competitor-scoring', dependencies: ['serp-crawling'] },
      { key: 'strategic-reporting', dependencies: ['serp-crawling', 'competitor-scoring'] },
      { key: 'unified-report', dependencies: ['strategic-reporting', 'competitor-scoring'] },
    ],
  },
} as const;

export type ToolKey = keyof typeof TOOL_WORKFLOW_DEFINITIONS;
export type ToolWorkflowType =
  (typeof TOOL_WORKFLOW_DEFINITIONS)[ToolKey]['workflowType'];
export type ToolStep =
  (typeof TOOL_WORKFLOW_DEFINITIONS)[ToolKey]['steps'][number]['key'];
export type ToolWorkflowStepDefinition = {
  key: ToolStep;
  dependencies: ToolStep[];
};
export type CopyLengthFormat = 'short-form' | 'medium-form' | 'long-form';

export type ToolWorkflowDefinition = {
  toolKey: ToolKey;
  workflowType: ToolWorkflowType;
  creditCost: number;
  steps: ToolWorkflowStepDefinition[];
  copyLengthOptions?: readonly CopyLengthFormat[];
  defaultCopyLength?: CopyLengthFormat;
};
export type ToolWorkflowStepOrder = { [K in ToolKey]: ToolStep[] };
export type ToolWorkflowStepDependencyMap = {
  [K in ToolKey]: Partial<Record<ToolStep, ToolStep[]>>;
};
export type ToolAvailabilityPolicy =
  | 'enabled-for-all'
  | 'disabled-for-all'
  | 'enabled-for-admin-only';
export type ToolAccessRole = 'admin' | 'member';

export const TOOL_KEYS = Object.keys(TOOL_WORKFLOW_DEFINITIONS) as ToolKey[];
export const TOOL_AVAILABILITY_POLICY_BY_TOOL_KEY: Record<ToolKey, ToolAvailabilityPolicy> = {
  'funnel-pages': 'enabled-for-all',
  'nextland': 'enabled-for-admin-only',
  'youtube-lf-script': 'enabled-for-all',
  'angle-generator': 'enabled-for-all',
  'meta-ads': 'enabled-for-all',
  'youtube-description': 'enabled-for-all',
  'geometric': 'enabled-for-all',
};
export const GENERATION_ROUTE_TOOL_KEY = 'extraction' as const;
export type GenerationRouteToolKey = typeof GENERATION_ROUTE_TOOL_KEY;
export type GenerationRequestToolKey = ToolKey | GenerationRouteToolKey;
export type GenerationWorkflowType = ToolWorkflowType | 'extraction';

export const TOOL_WORKFLOW_BY_TOOL_KEY: Record<ToolKey, ToolWorkflowDefinition> =
  Object.fromEntries(
    TOOL_KEYS.map((toolKey) => {
      const definition = TOOL_WORKFLOW_DEFINITIONS[toolKey];
      const base = {
        toolKey,
        workflowType: definition.workflowType,
        creditCost: definition.creditCost,
        steps: definition.steps.map((step) => ({
          key: step.key,
          dependencies: [...step.dependencies],
        })),
      };

      if ('copyLengthOptions' in definition && 'defaultCopyLength' in definition) {
        return [
          toolKey,
          {
            ...base,
            copyLengthOptions: definition.copyLengthOptions,
            defaultCopyLength: definition.defaultCopyLength,
          } satisfies ToolWorkflowDefinition,
        ];
      }

      return [toolKey, base satisfies ToolWorkflowDefinition];
    }),
  ) as Record<ToolKey, ToolWorkflowDefinition>;

export const TOOL_STEP_ORDER: ToolWorkflowStepOrder = Object.fromEntries(
  TOOL_KEYS.map((toolKey) => [
    toolKey,
    TOOL_WORKFLOW_BY_TOOL_KEY[toolKey].steps.map((step) => step.key),
  ]),
) as ToolWorkflowStepOrder;

export const TOOL_STEP_DEPENDENCIES: ToolWorkflowStepDependencyMap = Object.fromEntries(
  TOOL_KEYS.map((toolKey) => [
    toolKey,
    Object.fromEntries(
      TOOL_WORKFLOW_BY_TOOL_KEY[toolKey].steps.map((step) => [step.key, [...step.dependencies]]),
    ),
  ]),
) as ToolWorkflowStepDependencyMap;

export const TOOL_KEY_BY_WORKFLOW_TYPE: Record<ToolWorkflowType, ToolKey> = Object.fromEntries(
  TOOL_KEYS.map((toolKey) => [TOOL_WORKFLOW_BY_TOOL_KEY[toolKey].workflowType, toolKey]),
) as Record<ToolWorkflowType, ToolKey>;

export const isToolKey = (value: string): value is ToolKey =>
  Object.prototype.hasOwnProperty.call(TOOL_WORKFLOW_DEFINITIONS, value);

export const isGenerationRouteToolKey = (
  value: string,
): value is GenerationRouteToolKey => value === GENERATION_ROUTE_TOOL_KEY;

export const isGenerationRequestToolKey = (
  value: string,
): value is GenerationRequestToolKey => isToolKey(value) || isGenerationRouteToolKey(value);

export const isToolWorkflowType = (value: string): value is ToolWorkflowType =>
  Object.prototype.hasOwnProperty.call(TOOL_KEY_BY_WORKFLOW_TYPE, value);

export const isToolAccessRole = (value: string): value is ToolAccessRole =>
  value === 'admin' || value === 'member';

export const canRoleAccessToolKey = (
  toolKey: ToolKey,
  role: ToolAccessRole,
): boolean => {
  const policy = TOOL_AVAILABILITY_POLICY_BY_TOOL_KEY[toolKey];
  if (policy === 'enabled-for-all') {
    return true;
  }

  if (policy === 'disabled-for-all') {
    return false;
  }

  return role === 'admin';
};

const normalizeStringCandidate = (
  value: string | null | undefined,
): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

export const normalizeToolKeyCandidate = (
  value: string | null | undefined,
): ToolKey | null => {
  const normalized = normalizeStringCandidate(value);
  if (!normalized) {
    return null;
  }

  if (normalized === 'funnel_pages' || normalized === 'hl_funnel' || normalized === 'funnelpages') {
    return 'funnel-pages';
  }

  if (
    normalized === 'youtube_lf_script'
    || normalized === 'youtube-long-form'
    || normalized === 'youtube_long_form'
  ) {
    return 'youtube-lf-script';
  }

  if (
    normalized === 'youtube_description'
    || normalized === 'youtubedescription'
    || normalized === 'youtube-description-generator'
  ) {
    return 'youtube-description';
  }

  if (normalized === 'angle_generator' || normalized === 'anglegenerator') {
    return 'angle-generator';
  }

  if (
    normalized === 'meta_ads'
    || normalized === 'meta_ads_generator'
    || normalized === 'metaads'
    || normalized === 'meta-adsgenerator'
  ) {
    return 'meta-ads';
  }

  if (
    normalized === 'geometric_analysis'
    || normalized === 'geometric-analysis'
    || normalized === 'geometricanalysis'
  ) {
    return 'geometric';
  }

  return isToolKey(normalized) ? normalized : null;
};

export const resolveGenerationWorkflowTypeCandidate = (
  value: string | null | undefined,
): GenerationWorkflowType | null => {
  const normalized = normalizeStringCandidate(value);
  if (!normalized) {
    return null;
  }

  if (normalized === 'extraction') {
    return 'extraction';
  }

  const normalizedToolKey = normalizeToolKeyCandidate(normalized);
  if (normalizedToolKey) {
    return resolveToolWorkflowType(normalizedToolKey);
  }

  return isToolWorkflowType(normalized) ? normalized : null;
};

export const resolveToolWorkflowType = (toolKey: ToolKey): ToolWorkflowType =>
  TOOL_WORKFLOW_BY_TOOL_KEY[toolKey].workflowType;

export const resolveToolKeyFromWorkflowType = (
  workflowType: ToolWorkflowType,
): ToolKey => TOOL_KEY_BY_WORKFLOW_TYPE[workflowType];

export const getToolAvailabilityPolicy = (
  toolKey: ToolKey,
): ToolAvailabilityPolicy => TOOL_AVAILABILITY_POLICY_BY_TOOL_KEY[toolKey];
