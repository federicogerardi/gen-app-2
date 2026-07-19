/**
 * Centralized tool form configuration and contracts
 * Enables scalable, reusable form construction for multi-step tools
 */

import {
  canRoleAccessToolKey,
  getToolAvailabilityPolicy,
  TOOL_STEP_DEPENDENCIES,
  TOOL_STEP_ORDER,
  type ToolAccessRole,
  type ToolAvailabilityPolicy,
  normalizeToolKeyCandidate,
} from '@gen-app-2/contracts';
import { appCopy } from '../../../app/copy/system';
import type { ToolStep, SupportedTool } from '../machines/tool-flow.machine';
import type { ExtractionFieldKey } from './extraction-field-matrix';

/**
 * Configuration for a tool page form
 * Declares what each tool needs without implementation coupling
 */
export type ToolFormConfig = {
  toolKey: SupportedTool;
  availabilityPolicy: ToolAvailabilityPolicy;
  displayName: string;
  
  // Tool-specific prompts
  defaultPrompt: string;
  defaultModel: string;
  
  // Step workflow definition
  steps: readonly ToolStep[];
  stepDependencies: Partial<Record<ToolStep, readonly ToolStep[]>>;
  
  // Default form values
  defaults: {
    registrySnapshotRef: string;
  };
};

export type ToolFileInstructionsConfig = {
  title: string;
  summary: string;
  inputFiles: readonly ToolInputFilePolicyEntry[];
  allowNoFiles?: boolean;
  apiAcquisitionInputs?: readonly ToolApiAcquisitionPolicyEntry[];
  // Deprecated alias retained for one deprecation cycle.
  requiredFiles: readonly string[];
  requiredFieldKeys: readonly ExtractionFieldKey[];
  // Deprecated alias retained for one deprecation cycle.
  requiredFields?: readonly string[];
  optionalFields: readonly string[];
  examples: readonly string[];
  notes: readonly string[];
  stepConstraints: readonly string[];
};

export type ToolInputFileRequiredness =
  | 'always-required'
  | 'required-by-tool-setting'
  | 'optional-by-tool-setting';

export type ToolInputSourceFamily =
  | 'direct-input'
  | 'tool-input-file'
  | 'api-acquisition'
  | 'project-asset';

export type ToolInputFilePolicyEntry = {
  key: string;
  label: string;
  accept: string;
  requiredness: ToolInputFileRequiredness;
};

export type ToolApiAcquisitionPolicyEntry = {
  key: string;
  label: string;
  requiredness: ToolInputFileRequiredness;
};

/**
 * F-001: Policy entry for project-asset input family (DDD-192).
 * Declares which AssetTypes a tool can consume as input.
 */
export type ToolProjectAssetPolicyEntry = {
  key: string;
  label: string;
  assetType: string;
  requiredness: ToolInputFileRequiredness;
};

/**
 * Tool form state that maps to step dependencies and generation
 */
export type ToolFormState = {
  projectId: string;
  model: string;
  tone: string;
  titolo: string;
  campaignObjective: string;
  copyLengthFormat: 'short-form' | 'medium-form' | 'long-form';
  videoTitle: string;
  topic: string;
  baseQuery: string;
  language: string;
  country: string;
  brandName: string;
  keywords: string;
  ctaText: string;
  ctaLink: string;
  credentialsOrProof: string;
  chaptersWithTimestamps: string;
  socialLinks: string;
  hashtags: string;
  registrySnapshotRef: string;
  briefingFile: File | null;
  briefingFileName: string | null;
  briefingError: string | null;
  briefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready';
  selectedSteps: Set<ToolStep>;
  stepArtifactIds: Partial<Record<ToolStep, string>>;
};

/**
 * Registry of all supported tool configurations
 * Add new tools by registering here
 */
export const toolFormRegistry: Record<SupportedTool, ToolFormConfig> = {
  'funnel-pages': {
    toolKey: 'funnel-pages',
    availabilityPolicy: getToolAvailabilityPolicy('funnel-pages'),
    displayName: 'Hotlead Funnel',
    defaultPrompt: 'Generate the requested Funnel step consistent with the extracted brief.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER['funnel-pages'],
    stepDependencies: TOOL_STEP_DEPENDENCIES['funnel-pages'],
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  nextland: {
    toolKey: 'nextland',
    availabilityPolicy: getToolAvailabilityPolicy('nextland'),
    displayName: 'Nextland',
    defaultPrompt: 'Generate the requested Nextland step consistent with the extracted brief.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER.nextland,
    stepDependencies: TOOL_STEP_DEPENDENCIES.nextland,
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  'youtube-lf-script': {
    toolKey: 'youtube-lf-script',
    availabilityPolicy: getToolAvailabilityPolicy('youtube-lf-script'),
    displayName: 'YouTube LF Script',
    defaultPrompt: 'Generate the requested YouTube LF Script step consistent with the extracted brief.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER['youtube-lf-script'],
    stepDependencies: TOOL_STEP_DEPENDENCIES['youtube-lf-script'],
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  'angle-generator': {
    toolKey: 'angle-generator',
    availabilityPolicy: getToolAvailabilityPolicy('angle-generator'),
    displayName: 'Angle Generator',
    defaultPrompt: 'Generate prioritized and actionable marketing angles from the extracted context.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER['angle-generator'],
    stepDependencies: TOOL_STEP_DEPENDENCIES['angle-generator'],
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  'meta-ads': {
    toolKey: 'meta-ads',
    availabilityPolicy: getToolAvailabilityPolicy('meta-ads'),
    displayName: 'MetaAds Generator',
    defaultPrompt: 'Generate Meta Ads copy with high strategic clarity from the extracted context.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER['meta-ads'],
    stepDependencies: TOOL_STEP_DEPENDENCIES['meta-ads'],
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  'youtube-description': {
    toolKey: 'youtube-description',
    availabilityPolicy: getToolAvailabilityPolicy('youtube-description'),
    displayName: 'YT Description Generator',
    defaultPrompt: 'Generate a highly readable YouTube description with an above-the-fold CTA and complete SEO structure.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER['youtube-description'],
    stepDependencies: TOOL_STEP_DEPENDENCIES['youtube-description'],
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  geometric: {
    toolKey: 'geometric',
    availabilityPolicy: getToolAvailabilityPolicy('geometric'),
    displayName: 'Geometric',
    defaultPrompt: 'Analyze SERP and competitors. Generate strategic report and unified report.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER.geometric,
    stepDependencies: TOOL_STEP_DEPENDENCIES.geometric,
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  'blog-article-generator': {
    toolKey: 'blog-article-generator',
    availabilityPolicy: getToolAvailabilityPolicy('blog-article-generator'),
    displayName: 'Blog Article Generator',
    defaultPrompt: 'Generate comprehensive blog articles with SEO optimization and in-depth research.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER['blog-article-generator'],
    stepDependencies: TOOL_STEP_DEPENDENCIES['blog-article-generator'],
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  'brief-generator': {
    toolKey: 'brief-generator',
    availabilityPolicy: getToolAvailabilityPolicy('brief-generator'),
    displayName: 'Brief Generator',
    defaultPrompt: 'Generate a complete structured brief from the data extracted from the document.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER['brief-generator'],
    stepDependencies: TOOL_STEP_DEPENDENCIES['brief-generator'],
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  'tov-generator': {
    toolKey: 'tov-generator',
    availabilityPolicy: getToolAvailabilityPolicy('tov-generator'),
    displayName: 'TOV Generator',
    defaultPrompt: 'Generate a structured Tone of Voice from the data extracted from the document.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER['tov-generator'],
    stepDependencies: TOOL_STEP_DEPENDENCIES['tov-generator'],
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  'personas-generator': {
    toolKey: 'personas-generator',
    availabilityPolicy: getToolAvailabilityPolicy('personas-generator'),
    displayName: 'Personas Generator',
    defaultPrompt: 'Genera una buyer persona strutturata a partire dai dati estratti dal documento.',
    defaultModel: 'openrouter/auto',
    steps: TOOL_STEP_ORDER['personas-generator'],
    stepDependencies: TOOL_STEP_DEPENDENCIES['personas-generator'],
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
};

export const toolFileInstructionsRegistry: Record<SupportedTool, ToolFileInstructionsConfig> = {
  'funnel-pages': {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Upload a single complete BriefingFile: the funnel is built from objective, target, and offer.',
    inputFiles: [
      {
        key: 'briefing-file',
        label: 'UPLOAD FILE',
        accept: '.docx,.txt,.md',
        requiredness: 'always-required',
      },
    ],
    requiredFiles: ['BriefingFile (.docx, .txt, .md)'],
    requiredFieldKeys: ['funnel_goal', 'target_audience', 'offer', 'proof', 'primary_cta'],
    optionalFields: ['Tone constraints', 'Visual references', 'Competitor examples', 'Notes on current funnel'],
    examples: [
      'Goal: generate qualified leads for the main product.',
      'Target: entrepreneurs and marketers looking for a high-conversion landing page.',
    ],
    notes: ['If a field is unavailable, write "unavailable" instead of omitting it.'],
    stepConstraints: ['The optin, quiz, and vsl steps must remain consistent with the same brief.'],
  },
  nextland: {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Use an organized and descriptive BriefingFile to define the site, sections, and expected outcome.',
    inputFiles: [
      {
        key: 'briefing-file',
        label: 'UPLOAD FILE',
        accept: '.docx,.txt,.md',
        requiredness: 'always-required',
      },
    ],
    requiredFiles: ['BriefingFile (.docx, .txt, .md)'],
    requiredFieldKeys: ['website_goal', 'brand_or_company', 'target_audience', 'offer_or_service', 'required_sections'],
    optionalFields: ['Tone of voice', 'Style references', 'Copy constraints', 'Existing materials'],
    examples: [
      'Goal: present the brand and drive users to the contact page.',
      'Required sections: hero, proof, services, final CTA.',
    ],
    notes: ['Clearly indicate which pages or blocks must be produced.', 'Avoid implicit requests: the page must be reconstructable from the brief alone.'],
    stepConstraints: ['The landing and thank_you steps must use the same information base from the BriefingFile.'],
  },
  'youtube-lf-script': {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Fill in the brief with the canonical fields required for extraction and long-form script generation.',
    inputFiles: [
      {
        key: 'briefing-file',
        label: 'UPLOAD FILE',
        accept: '.docx,.txt,.md',
        requiredness: 'always-required',
      },
    ],
    requiredFiles: ['BriefingFile (.docx, .txt, .md)'],
    requiredFieldKeys: [
      'knowledge_content',
      'avatar',
      'pain_point',
      'purchase_process_type',
      'offer',
      'proof',
      'target_duration_minutes',
      'proprietary_methodology_disclosure',
    ],
    optionalFields: ['Support links or references', 'Positioning notes', 'Editorial constraints'],
    examples: [
      'knowledge_content: key knowledge points to transform into script.',
      'target_duration_minutes: 12.',
    ],
    notes: ['Missing fields must be explicit and set to null in the extracted payload.', 'The brief tone does not replace the generation ToneProfile.'],
    stepConstraints: ['The canonical sequence is pre-script-analysis -> packaging -> intro-structure -> body-structure -> native-cta-embeds -> outro-structure.'],
  },
  'angle-generator': {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Generate prioritized, actionable marketing angles from a workspace Brief (required) and optionally a Persona or Competitor Analysis. No file upload required.',
    inputFiles: [],
    allowNoFiles: true,
    requiredFiles: [],
    requiredFieldKeys: [
      'goal',
      'product_or_service',
      'market',
      'target_audience',
      'pain_point',
      'offer',
      'proof',
      'creative_constraints',
    ],
    optionalFields: ['Tone of voice', 'Examples of previously used angles', 'Benchmarks or competitors', 'Strategic notes'],
    examples: [
      'A Brief describing the brand and product to position.',
      'A Persona or Competitor Analysis to cross-reference with the brief.',
    ],
    notes: ['Angles are compatible with meta-ads, funnel-pages, and other downstream tools.'],
    stepConstraints: ['The canonical sequence is context-and-angle-matrix -> angle-prioritization -> creative-activation.'],
  },
  'meta-ads': {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Upload a mandatory BriefingFile and, if available, an AngleDetectorFile with additional insights.',
    inputFiles: [
      {
        key: 'briefing-file',
        label: 'UPLOAD FILE',
        accept: '.docx,.txt,.md',
        requiredness: 'always-required',
      },
      {
        key: 'angle-detector-file',
        label: 'AngleDetectorFile',
        accept: '.docx,.txt,.md',
        requiredness: 'optional-by-tool-setting',
      },
    ],
    requiredFiles: ['BriefingFile (.docx, .txt, .md)'],
    requiredFieldKeys: [
      'product_or_service',
      'target_audience',
      'campaign_objective',
      'primary_offer',
      'proof_points',
      'dominant_pain_points',
      'objections',
    ],
    optionalFields: [
      'Budget context',
      'Awareness priority',
      'LF8 priority',
      'Unique mechanism',
      'Angle candidates',
      'Hook variants',
      'Legal or compliance constraints',
      'Blacklist claims',
      'Learned insights from previous campaigns',
    ],
    examples: [
      'Campaign objective: qualified lead acquisition with sustainable CPL target.',
      'Primary offer: consulting + free audit to activate the strategic call.',
    ],
    notes: ['The extraction format is markdown with canonical sections and unavailable fields explicitly indicated.', 'AngleDetectorFile remains optional: if absent, the pipeline remains operational.'],
    stepConstraints: ['The canonical sequence is context-generation -> ads-generation.'],
  },
  'youtube-description': {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Enter direct video fields: the context is built without file upload.',
    inputFiles: [],
    allowNoFiles: true,
    requiredFiles: [],
    requiredFieldKeys: [],
    requiredFields: [
      'Video title',
      'Topic',
      'Keywords',
      'CTA text',
      'CTA link',
      'Credentials or proof',
      'Chapters with timestamps',
    ],
    optionalFields: ['Social links', 'Hashtags', 'Contextual notes', 'Lexical constraints', 'Audience nuance'],
    examples: [
      'Keywords: youtube seo, youtube description, increase watch time.',
      'Chapters with timestamps: 0:00 Hook, 1:35 Method, 3:40 CTA.',
    ],
    notes: [
      'This tool uses direct-input only: no BriefingFile required.',
      'Accepted timestamps: m:ss, mm:ss, h:mm:ss.',
    ],
    stepConstraints: ['The canonical sequence is youtube-description-generation.'],
  },
  geometric: {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Enter query, language, and country for SERP analysis and competitive reporting.',
    inputFiles: [],
    allowNoFiles: true,
    requiredFiles: [],
    requiredFieldKeys: [],
    requiredFields: ['Base query', 'Language', 'Country'],
    optionalFields: ['Contextual notes', 'Lexical constraints', 'Audience nuance'],
    examples: [
      'Base query: best protein supplements for muscle mass',
      'Language: en-US',
      'Country: google.com',
    ],
    notes: [
      'This tool uses direct-input only: no BriefingFile required.',
      'SERP data is collected in real-time via crawling.',
    ],
    stepConstraints: ['The canonical sequence is serp-crawling -> competitor-scoring -> strategic-reporting -> unified-report.'],
  },
  'blog-article-generator': {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Enter the article title to generate.',
    inputFiles: [],
    allowNoFiles: true,
    requiredFiles: [],
    requiredFieldKeys: [],
    requiredFields: ['Title'],
    optionalFields: [],
    examples: [
      'Title: Advanced React patterns for performance optimization',
    ],
    notes: ['The title is the only required field to start generation.'],
    stepConstraints: ['The canonical sequence is blog_seo_structure -> blog_research -> blog_article.'],
  },
  'brief-generator': {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Upload a document with notes, bullet points, or descriptions. Brief Generator extracts relevant data and produces a structured brief ready for other tools.',
    inputFiles: [
      {
        key: 'briefing-file',
        label: 'UPLOAD FILE',
        accept: '.txt,.md,.docx',
        requiredness: 'always-required',
      },
    ],
    requiredFiles: ['BriefingFile (.txt, .md, .docx)'],
    requiredFieldKeys: ['product_or_service', 'target_audience', 'campaign_objective', 'primary_offer', 'tone'],
    optionalFields: [],
    examples: [
      'Scattered notes on product, target, and campaign objectives.',
      'Transcript of a sales call to structure into a formal brief.',
    ],
    notes: [
      'The output brief is compatible with funnel-pages, meta-ads, angle-generator, youtube-lf-script, and nextland.',
    ],
    stepConstraints: [],
  },
  'tov-generator': {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Upload a document with brand descriptions, company values, or existing communications. TOV Generator extracts relevant data and produces a structured Tone of Voice.',
    inputFiles: [
      {
        key: 'briefing-file',
        label: 'UPLOAD FILE',
        accept: '.txt,.md,.docx',
        requiredness: 'always-required',
      },
    ],
    requiredFiles: ['BriefingFile (.txt, .md, .docx)'],
    requiredFieldKeys: ['brand_or_company', 'target_audience', 'tone', 'product_or_service', 'market'],
    optionalFields: [],
    examples: [
      'Document with company mission, values, and brand description.',
      'Transcript of a brand positioning workshop.',
    ],
    notes: [
      'The TOV output is compatible with funnel-pages, meta-ads, angle-generator, youtube-lf-script, and other tools.',
    ],
    stepConstraints: [],
  },
  'personas-generator': {
    title: appCopy.ui.toolInstructions.title,
    summary: 'Generate a structured buyer persona from a workspace Brief (required) and optionally a Competitor Analysis. Personas Generator derives demographics, goals, behaviors, pain points, and objections from the selected assets — no file upload required.',
    inputFiles: [],
    allowNoFiles: true,
    requiredFiles: [],
    requiredFieldKeys: ['demographics', 'goals', 'pain_point', 'behaviors', 'objections'],
    optionalFields: [],
    examples: [
      'A Brief describing target market, offer, and positioning.',
      'A Competitor Analysis with audience overlaps and differentiation.',
    ],
    notes: [
      'The output persona is compatible with funnel-pages, nextland, youtube-lf-script, angle-generator, meta-ads and blog-article-generator.',
      'If a field is not available in the inputs, extraction marks it as "unavailable" and the persona states it explicitly.',
    ],
    stepConstraints: [],
  },
};

const validateToolInputFilePolicyRegistry = (
  registry: Record<SupportedTool, ToolFileInstructionsConfig>,
): void => {
  for (const [toolKey, instructions] of Object.entries(registry) as Array<[SupportedTool, ToolFileInstructionsConfig]>) {
    if (instructions.inputFiles.length === 0 && instructions.allowNoFiles !== true) {
      throw new Error(`[tool-form-architecture] ${toolKey}: inputFiles must include at least one file entry`);
    }

    if (instructions.inputFiles.length > 0 && instructions.inputFiles[0]?.requiredness !== 'always-required') {
      throw new Error(`[tool-form-architecture] ${toolKey}: inputFiles[0] must be always-required`);
    }

    const invalidFile = instructions.inputFiles.find((entry, index) => {
      if (!entry.requiredness) {
        return true;
      }

      if (!entry.key.trim() || !entry.label.trim() || !entry.accept.trim()) {
        return true;
      }

      if (index === 0) {
        return entry.requiredness !== 'always-required';
      }

      return entry.requiredness !== 'required-by-tool-setting' && entry.requiredness !== 'optional-by-tool-setting';
    });

    if (invalidFile) {
      throw new Error(`[tool-form-architecture] ${toolKey}: invalid inputFiles entry detected`);
    }
  }
};

validateToolInputFilePolicyRegistry(toolFileInstructionsRegistry);

export const getEnabledToolKeys = (role: ToolAccessRole = 'member'): SupportedTool[] => {
  return (Object.keys(toolFormRegistry) as SupportedTool[]).filter(
    (toolKey) => canRoleAccessToolKey(toolKey, role),
  );
};

export const getToolInputFilePolicy = (
  toolKey: SupportedTool,
): readonly ToolInputFilePolicyEntry[] => toolFileInstructionsRegistry[toolKey].inputFiles;

export const getRequiredToolInputFiles = (
  toolKey: SupportedTool,
): readonly ToolInputFilePolicyEntry[] => getToolInputFilePolicy(toolKey).filter((entry) => (
  entry.requiredness === 'always-required' || entry.requiredness === 'required-by-tool-setting'
));

export const getToolApiAcquisitionPolicy = (
  toolKey: SupportedTool,
): readonly ToolApiAcquisitionPolicyEntry[] => toolFileInstructionsRegistry[toolKey].apiAcquisitionInputs ?? [];

export const isToolEnabled = (
  toolKey: SupportedTool,
  role: ToolAccessRole = 'member',
): boolean => {
  return canRoleAccessToolKey(toolKey, role);
};

export type ToolNavigationItem = {
  toolKey: SupportedTool;
  to: string;
  label: string;
  description: string;
};

const toolNavigationLabelByKey: Record<SupportedTool, string> = {
  'funnel-pages': appCopy.ui.navigation.funnelPages,
  nextland: appCopy.ui.navigation.nextland,
  'youtube-lf-script': appCopy.ui.navigation.youtubeLfScript,
  'angle-generator': appCopy.ui.navigation.angleGenerator,
  'meta-ads': appCopy.ui.navigation.metaAds,
  'youtube-description': appCopy.ui.navigation.youtubeDescription,
  'geometric': appCopy.ui.navigation.geometric,
  'blog-article-generator': 'Blog Article Generator',
  'brief-generator': 'Brief Generator',
  'tov-generator': 'TOV Generator',
  'personas-generator': 'Personas Generator',
};

const toolNavigationDescriptionByKey: Record<SupportedTool, string> = {
  'funnel-pages': 'Create landing pages, quizzes, and VSLs for your acquisition pipeline.',
  nextland: 'Generate Nextland site pages from your project brief.',
  'youtube-lf-script': 'Produce long-form video scripts guided by a step-by-step structure.',
  'angle-generator': 'Prioritize actionable marketing angles from the extracted context.',
  'meta-ads': 'Produce Meta Ads assets consistent with context, campaign objective, and strategic priorities.',
  'youtube-description': 'Generate complete YouTube descriptions with initial CTA, chapters, and SEO blocks in a single step.',
  'geometric': 'Analyze SERP, competitive scoring, and unified strategic reporting.',
  'blog-article-generator': 'Generate blog articles with SEO optimization and in-depth research.',
  'brief-generator': 'Transform raw documents into structured briefs ready for generation with other tools.',
  'tov-generator': 'Generate a structured Tone of Voice from brand documents.',
  'personas-generator': 'Genera buyer personas strutturate a partire da documenti e ricerche di mercato.',
};

const toolRouteByKey: Record<SupportedTool, string> = {
  'funnel-pages': '/tools/funnel-pages',
  nextland: '/tools/nextland',
  'youtube-lf-script': '/tools/youtube-lf-script',
  'angle-generator': '/tools/angle-generator',
  'meta-ads': '/tools/meta-ads',
  'youtube-description': '/tools/youtube-description',
  'geometric': '/tools/geometric',
  'blog-article-generator': '/tools/blog-article-generator',
  'brief-generator': '/tools/brief-generator',
  'tov-generator': '/tools/tov-generator',
  'personas-generator': '/tools/personas-generator',
};

export const getToolLabel = (toolKey: string | null): string => {
  if (toolKey === null) {
    return '—';
  }

  const normalizedToolKey = normalizeToolKeyCandidate(toolKey);
  if (normalizedToolKey && normalizedToolKey in toolNavigationLabelByKey) {
    return toolNavigationLabelByKey[normalizedToolKey as SupportedTool];
  }

  if (toolKey in toolNavigationLabelByKey) {
    return toolNavigationLabelByKey[toolKey as SupportedTool];
  }

  return toolKey;
};

export const getToolRoute = (toolKey: string | null, workspaceId?: string): string | null => {
  if (toolKey === null) {
    return null;
  }

  const normalizedToolKey = normalizeToolKeyCandidate(toolKey);

  if (workspaceId) {
    const key = normalizedToolKey || toolKey;
    return `/workspaces/${workspaceId}/tools/${key}`;
  }

  if (normalizedToolKey && normalizedToolKey in toolRouteByKey) {
    return toolRouteByKey[normalizedToolKey as SupportedTool];
  }

  if (toolKey in toolRouteByKey) {
    return toolRouteByKey[toolKey as SupportedTool];
  }

  return null;
};

export const getEnabledToolNavigationItems = (
  role: ToolAccessRole = 'member',
  workspaceId?: string,
): ToolNavigationItem[] => (
  getEnabledToolKeys(role).map((toolKey) => ({
    toolKey,
    to: workspaceId
      ? `/workspaces/${workspaceId}/tools/${toolKey}`
      : toolRouteByKey[toolKey],
    label: toolNavigationLabelByKey[toolKey],
    description: toolNavigationDescriptionByKey[toolKey],
  }  ))
);

/**
 * Get config for a tool
 */
export const getToolFormConfig = (toolKey: SupportedTool): ToolFormConfig => {
  const config = toolFormRegistry[toolKey];
  if (!config) {
    throw new Error(`Unknown tool: ${toolKey}`);
  }
  return config;
};

/**
 * Calculate which steps can be generated based on dependencies
 */
export const getAvailableSteps = (
  toolKey: SupportedTool,
  completedSteps: Set<ToolStep>,
): ToolStep[] => {
  const config = getToolFormConfig(toolKey);
  return config.steps.filter(step => {
    if (completedSteps.has(step)) {
      return false;
    }

    const deps = config.stepDependencies[step] ?? [];
    return deps.every(dep => completedSteps.has(dep));
  });
};

/**
 * Step card metadata: description and expected output format per step
 * Used by ToolStepCard for rendering
 */
export type StepCardConfig = {
  displayName: string;
  description: string;
  expectedOutputFormat: string; // e.g., "Landing page HTML", "Quiz structure"
};

/**
 * Mapping of step metadata for UI rendering
 * Extend this record when adding new tools
 */
export const stepCardConfigRegistry: Record<
  SupportedTool,
  Partial<Record<ToolStep, StepCardConfig>>
> = {
  'funnel-pages': {
    optin: {
      displayName: 'Opt-In Page',
      description: 'Landing page to capture email addresses',
      expectedOutputFormat: 'HTML page with form',
    },
    quiz: {
      displayName: 'Quiz Page',
      description: 'Interactive quiz to segment leads',
      expectedOutputFormat: 'Multi-step quiz with logic',
    },
    vsl: {
      displayName: 'Video Sales Letter',
      description: 'Long-form video sales page',
      expectedOutputFormat: 'HTML with VSL embed placeholder',
    },
  },
  nextland: {
    landing: {
      displayName: 'Landing Page',
      description: 'Marketing landing page',
      expectedOutputFormat: 'Complete landing page HTML',
    },
    thank_you: {
      displayName: 'Thank You Page',
      description: 'Post-conversion thank you page',
      expectedOutputFormat: 'HTML thank you page',
    },
  },
  'youtube-lf-script': {
    'pre-script-analysis': {
      displayName: 'Pre-Script Analysis',
      description: 'Strategic business and positioning analysis before script drafting',
      expectedOutputFormat: 'Structured markdown analysis',
    },
    packaging: {
      displayName: 'Packaging',
      description: 'Title strategy and visual hooks aligned with positioning',
      expectedOutputFormat: 'Markdown with title candidates and recommended angle',
    },
    'intro-structure': {
      displayName: 'Intro Structure',
      description: 'Retention-first intro flow with trust and contrarian setup',
      expectedOutputFormat: 'Markdown intro checkpoint structure',
    },
    'body-structure': {
      displayName: 'Body Structure',
      description: 'Core narrative flow with value loops and rehook cadence',
      expectedOutputFormat: 'Markdown body block framework',
    },
    'native-cta-embeds': {
      displayName: 'Native CTA Embeds',
      description: 'Contextual CTA placements integrated into educational flow',
      expectedOutputFormat: 'Markdown CTA placement plan',
    },
    'outro-structure': {
      displayName: 'Outro Structure',
      description: 'Final recap, gap closure, and CTA finale',
      expectedOutputFormat: 'Markdown outro framework',
    },
  },
  'angle-generator': {
    'context-and-angle-matrix': {
      displayName: 'Context and Angle Matrix',
      description: 'Map context and build the relevant angle matrix',
      expectedOutputFormat: 'Markdown with structured angle matrix',
    },
    'angle-prioritization': {
      displayName: 'Angle Prioritization',
      description: 'Evaluate and prioritize angles based on impact and differentiation',
      expectedOutputFormat: 'Markdown with ranking and rationale',
    },
    'creative-activation': {
      displayName: 'Creative Activation',
      description: 'Transform priority angles into actionable creative assets',
      expectedOutputFormat: 'Markdown with headlines and creative activations',
    },
  },
  'meta-ads': {
    'context-generation': {
      displayName: 'Context Generation',
      description: 'Consolidate strategic context for Meta Ads asset production',
      expectedOutputFormat: 'Markdown with strategy, messaging, and activation priorities',
    },
    'ads-generation': {
      displayName: 'Ads Generation',
      description: 'Generate Meta Ads creative sets from the validated context',
      expectedOutputFormat: 'Markdown with ad sets, variants, and test plan',
    },
  },
  'youtube-description': {
    'youtube-description-generation': {
      displayName: 'YouTube Description Generation',
      description: 'Generate the final description with above-the-fold CTA, chapters, and SEO blocks.',
      expectedOutputFormat: 'Markdown with complete description and quality report',
    },
  },
  'geometric': {
    'serp-crawling': {
      displayName: 'SERP Crawling',
      description: 'Collect data from the Search Engine Results Page for the base query and related PAA.',
      expectedOutputFormat: 'JSON with AI Overview snippets, sources, and PAA queries',
    },
    'competitor-scoring': {
      displayName: 'Competitor Scoring',
      description: 'Analyze and score competitors based on domains and source types.',
      expectedOutputFormat: 'JSON with competitive ranking and tier assignment',
    },
    'strategic-reporting': {
      displayName: 'Strategic Reporting',
      description: 'Generate qualitative strategic report from the SERP landscape.',
      expectedOutputFormat: 'Markdown with strategic analysis and operational recommendations',
    },
    'unified-report': {
      displayName: 'Unified Report',
      description: 'Unified report combining strategic analysis and quantitative scoring.',
      expectedOutputFormat: 'Markdown with competitor tables, analysis, and recommendations',
    },
  },
  'blog-article-generator': {
    'blog_seo_structure': {
      displayName: 'SEO Structure',
      description: 'Generate SEO-optimized article structure with headings and subheadings.',
      expectedOutputFormat: 'Markdown with H1 title and H2 subheadings',
    },
    'blog_research': {
      displayName: 'Research',
      description: 'Conduct in-depth research on the topic with data and statistics.',
      expectedOutputFormat: 'Structured research data per section',
    },
    'blog_article': {
      displayName: 'Article Writing',
      description: 'Write the complete blog article with professional copywriting.',
      expectedOutputFormat: 'Full article in Markdown (~800 words)',
    },
  },
  'brief-generator': {
    'brief-generation': {
      displayName: 'Brief Generation',
      description: 'Transform extracted data into a structured, standardized creative brief ready for consumption by other tools.',
      expectedOutputFormat: 'Structured markdown with all canonical brief sections',
    },
  },
  'tov-generator': {
    'tov-generation': {
      displayName: 'TOV Generation',
      description: 'Transform extracted data into a complete, structured Tone of Voice ready for consumption by other tools.',
      expectedOutputFormat: 'Structured markdown with identity, values, voice, language, channels, and examples',
    },
  },
  'personas-generator': {
    'personas-generation': {
      displayName: 'Personas Generation',
      description: 'Trasforma i dati estratti in una buyer persona strutturata e completa pronta per il consumo da parte degli altri tool.',
      expectedOutputFormat: 'Markdown strutturato con demografia, obiettivi, pain point, comportamenti, obiezioni, messaggistica e trigger',
    },
  },
};

/**
 * Get step card metadata for rendering
 */
export const mapToolStepToCardConfig = (
  toolKey: SupportedTool,
  step: ToolStep,
): StepCardConfig => {
  const stepConfig = stepCardConfigRegistry[toolKey]?.[step];
  if (!stepConfig) {
    // Fallback for unmapped steps
    return {
      displayName: step,
      description: `Generate ${step}`,
      expectedOutputFormat: 'Generated content',
    };
  }
  return stepConfig;
};
