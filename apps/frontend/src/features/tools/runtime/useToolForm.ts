/**
 * Reusable hooks for tool form lifecycle
 * Extracted from FunnelPagesToolPage and NextlandToolPage
 */

import { useMemo, useState } from 'react';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import {
  getToolFormConfig,
  getAvailableSteps,
  type ToolFormState,
} from './tool-form-architecture';

/**
 * Hook: Initialize form with tool defaults
 */
export const useToolFormInit = (toolKey: SupportedTool, prefillProjectId?: string) => {
  const config = getToolFormConfig(toolKey);
  const [formState, setFormState] = useState<ToolFormState>({
    projectId: prefillProjectId ?? '',
    model: config.defaultModel,
    tone: 'Professional',
    campaignObjective: '',
    videoTitle: '',
    topic: '',
    baseQuery: '',
    language: 'it',
    country: 'google.it',
    brandName: '',
    keywords: '',
    ctaText: '',
    ctaLink: '',
    credentialsOrProof: '',
    chaptersWithTimestamps: '',
    socialLinks: '',
    hashtags: '',
    registrySnapshotRef: config.defaults.registrySnapshotRef,
    briefingFile: null,
    briefingFileName: null,
    briefingError: null,
    briefingStatus: 'idle',
    selectedSteps: new Set(),
    stepArtifactIds: {},
  });

  return {
    formState,
    setFormState,
    config,
  };
};

/**
 * Hook: Get available steps based on completed steps
 * Memoized to prevent unnecessary re-renders
 * 
 * @example
 * ```ts
 * const availableSteps = useAvailableSteps('funnel-pages', completedStepsSet);
 * // Returns: ['optin', 'quiz'] if optin is completed, [] if all completed
 * ```
 */
export const useAvailableSteps = (toolKey: SupportedTool, completedSteps: Set<ToolStep>): ToolStep[] => {
  return useMemo(() => {
    return getAvailableSteps(toolKey, completedSteps);
  }, [toolKey, completedSteps]);
};

// useToolUiState removed — test-only (not imported by any runtime component). Removed in Sprint 4 / TASK-013.
// Canonical UI state is derived by toolPageMachine.context.viewModel.
