/**
 * Centralized tool form configuration and contracts
 * Enables scalable, reusable form construction for multi-step tools
 */

import type { ToolStep, SupportedTool } from '../machines/tool-flow.machine';
import type { ExtractionContext } from '../../generation/machines/frontend-stream.machine';

/**
 * Configuration for a tool page form
 * Declares what each tool needs without implementation coupling
 */
export type ToolFormConfig = {
  toolKey: SupportedTool;
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

/**
 * Project loading state shared across all tools
 */
export type ProjectsLoadingState = {
  projects: Array<{ id: string; name: string }>;
  loading: boolean;
  error: string | null;
};

/**
 * Briefing upload state shared across all tools
 */
export type BriefingUploadState = {
  file: File | null;
  fileName: string | null;
  error: string | null;
  status: 'idle' | 'uploading' | 'extracting' | 'ready';
};

/**
 * Tool form state that maps to step dependencies and generation
 */
export type ToolFormState = {
  projectId: string;
  model: string;
  tone: string;
  registrySnapshotRef: string;
  briefingFile: File | null;
  briefingFileName: string | null;
  briefingError: string | null;
  briefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready';
  selectedSteps: Set<ToolStep>;
  stepArtifactIds: Partial<Record<ToolStep, string>>;
};

/**
 * Validation result for form submission
 */
export type ToolFormValidation = {
  isValid: boolean;
  errors: Record<string, string>;
};

/**
 * Submit handler receives normalized form data
 */
export type ToolFormSubmitData = {
  projectId: string;
  model: string;
  tone: string;
  registrySnapshotRef: string;
  briefingId: string;
  briefingFileName: string;
  extractionArtifactId: string;
  extractionPayload: Record<string, unknown>;
  selectedSteps: ToolStep[];
  stepArtifactIds: Partial<Record<ToolStep, string>>;
};

/**
 * Registry of all supported tool configurations
 * Add new tools by registering here
 */
export const toolFormRegistry: Record<SupportedTool, ToolFormConfig> = {
  'funnel-pages': {
    toolKey: 'funnel-pages',
    displayName: 'Hotlead Funnel',
    defaultPrompt: 'Genera lo step Funnel richiesto con coerenza al brief estratto.',
    defaultModel: 'openrouter/auto',
    steps: ['optin', 'quiz', 'vsl'] as const,
    stepDependencies: {
      optin: [],
      quiz: ['optin'],
      vsl: ['optin', 'quiz'],
    },
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  nextland: {
    toolKey: 'nextland',
    displayName: 'Nextland',
    defaultPrompt: 'Genera lo step Nextland richiesto con coerenza al brief estratto.',
    defaultModel: 'openrouter/auto',
    steps: ['landing', 'thank_you'] as const,
    stepDependencies: {
      landing: [],
      thank_you: ['landing'],
    },
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
  'youtube-lf-script': {
    toolKey: 'youtube-lf-script',
    displayName: 'YouTube LF Script',
    defaultPrompt: 'Genera lo step YouTube LF Script richiesto con coerenza al brief estratto.',
    defaultModel: 'openrouter/auto',
    steps: [
      'pre-script-analysis',
      'packaging',
      'intro-structure',
      'body-structure',
      'native-cta-embeds',
      'outro-structure',
    ] as const,
    stepDependencies: {
      'pre-script-analysis': [],
      packaging: ['pre-script-analysis'],
      'intro-structure': ['packaging'],
      'body-structure': ['intro-structure'],
      'native-cta-embeds': ['body-structure'],
      'outro-structure': ['native-cta-embeds'],
    },
    defaults: {
      registrySnapshotRef: 'snapshot:default',
    },
  },
};

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
 * Validate briefing file extension
 */
export const isAllowedBriefingExtension = (fileName: string): boolean => {
  const normalized = fileName.toLowerCase();
  return normalized.endsWith('.docx') || normalized.endsWith('.txt') || normalized.endsWith('.md');
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

/**
 * Validation rules for form submission
 */
export const validateToolForm = (state: ToolFormState): ToolFormValidation => {
  const errors: Record<string, string> = {};

  if (!state.projectId.trim()) {
    errors.projectId = 'Project required';
  }

  if (!state.briefingFileName) {
    errors.briefing = 'Briefing file required';
  }

  if (state.selectedSteps.size === 0) {
    errors.steps = 'Select at least one step';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
