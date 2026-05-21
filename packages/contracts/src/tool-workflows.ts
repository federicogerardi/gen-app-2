export const TOOL_WORKFLOW_DEFINITIONS = {
  'funnel-pages': {
    toolKey: 'funnel-pages',
    workflowType: 'funnel_pages',
    steps: [
      { key: 'optin', dependencies: [] },
      { key: 'quiz', dependencies: ['optin'] },
      { key: 'vsl', dependencies: ['optin', 'quiz'] },
    ],
  },
  nextland: {
    toolKey: 'nextland',
    workflowType: 'nextland',
    steps: [
      { key: 'landing', dependencies: [] },
      { key: 'thank_you', dependencies: ['landing'] },
    ],
  },
  'youtube-lf-script': {
    toolKey: 'youtube-lf-script',
    workflowType: 'youtube_lf_script',
    steps: [
      { key: 'pre-script-analysis', dependencies: [] },
      { key: 'packaging', dependencies: ['pre-script-analysis'] },
      { key: 'intro-structure', dependencies: ['packaging'] },
      { key: 'body-structure', dependencies: ['intro-structure'] },
      { key: 'native-cta-embeds', dependencies: ['body-structure'] },
      { key: 'outro-structure', dependencies: ['native-cta-embeds'] },
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
export type ToolWorkflowDefinition = {
  toolKey: ToolKey;
  workflowType: ToolWorkflowType;
  steps: ToolWorkflowStepDefinition[];
};
export type ToolWorkflowStepOrder = { [K in ToolKey]: ToolStep[] };
export type ToolWorkflowStepDependencyMap = {
  [K in ToolKey]: Partial<Record<ToolStep, ToolStep[]>>;
};

export const TOOL_KEYS = Object.keys(TOOL_WORKFLOW_DEFINITIONS) as ToolKey[];
export const GENERATION_ROUTE_TOOL_KEY = 'extraction' as const;
export type GenerationRouteToolKey = typeof GENERATION_ROUTE_TOOL_KEY;
export type GenerationRequestToolKey = ToolKey | GenerationRouteToolKey;
export type GenerationWorkflowType = ToolWorkflowType | 'extraction';

export const TOOL_WORKFLOW_BY_TOOL_KEY: Record<ToolKey, ToolWorkflowDefinition> =
  Object.fromEntries(
    TOOL_KEYS.map((toolKey) => {
      const definition = TOOL_WORKFLOW_DEFINITIONS[toolKey];
      return [
        toolKey,
        {
          toolKey,
          workflowType: definition.workflowType,
          steps: definition.steps.map((step) => ({
            key: step.key,
            dependencies: [...step.dependencies],
          })),
        } satisfies ToolWorkflowDefinition,
      ];
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
