/**
 * Centralized tool form configuration and contracts
 * Enables scalable, reusable form construction for multi-step tools
 */

import type { ToolStep, SupportedTool } from '../machines/tool-flow.machine';

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
 * Extracted briefing context from upload processor
 */
export type BriefingContext = {
  projectId: string;
  briefingId: string;
  extractionArtifactId: string;
  extractionPayload: Record<string, unknown>;
  normalizedText: string;
  parsedFormat: 'txt' | 'md' | 'docx';
  updatedAt: string;
};

/**
 * Tool form state that maps to step dependencies and generation
 */
export type ToolFormState = {
  projectId: string;
  model: string;
  registrySnapshotRef: string;
  prompt: string;
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
  registrySnapshotRef: string;
  prompt: string;
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
    displayName: 'Funnel Pages',
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
 * Get completed artifact for a step (navigation helper)
 */
export const getCompletedArtifactForStep = (
  artifacts: Array<{
    projectId: string;
    status: string;
    toolKey: string;
    metadata?: { step?: string };
  }>,
  projectId: string,
  toolKey: SupportedTool,
  step: ToolStep,
): string | null => {
  const artifact = artifacts.find(
    a =>
      a.projectId === projectId
      && a.status === 'completed'
      && a.toolKey === toolKey
      && a.metadata?.step === step,
  );
  return artifact?.metadata?.step === step ? 'found' : null; // Placeholder for actual extraction
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
    const deps = config.stepDependencies[step] ?? [];
    return deps.every(dep => completedSteps.has(dep));
  });
};

/**
 * Validation rules for form submission
 */
export const validateToolForm = (state: ToolFormState): ToolFormValidation => {
  const errors: Record<string, string> = {};

  if (!state.projectId.trim()) {
    errors.projectId = 'Project required';
  }

  if (!state.prompt.trim()) {
    errors.prompt = 'Prompt required';
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
