/**
 * Reusable hooks for tool form lifecycle
 * Extracted from FunnelPagesToolPage and NextlandToolPage
 */

import { useMemo, useState, useEffect } from 'react';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { listProjects, type ProjectSummary } from '../../projects/runtime/projects-client';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import {
  getToolFormConfig,
  getAvailableSteps,
  validateToolForm,
  type ToolFormState,
} from './tool-form-architecture';


/**
 * Hook: Load projects for the authenticated user
 * Shared across all tool pages
 */
export const useProjectsLoader = () => {
  const auth = useAuthSession();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.session || !auth.capabilities.projects) {
      setProjects([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const nextProjects = await listProjects({
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: auth.capabilities,
        });

        if (cancelled) return;

        setProjects(nextProjects);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;

        setProjects([]);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load projects');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.apiBaseUrl, auth.capabilities, auth.session]);

  return { projects, loading, error };
};

/**
 * Hook: Initialize form with tool defaults
 */
export const useToolFormInit = (toolKey: SupportedTool, prefillProjectId?: string) => {
  const config = getToolFormConfig(toolKey);
  const [formState, setFormState] = useState<ToolFormState>({
    projectId: prefillProjectId ?? '',
    model: config.defaultModel,
    tone: 'Professional',
    registrySnapshotRef: config.defaults.registrySnapshotRef,
    briefingFile: null,
    briefingFileName: null,
    briefingError: null,
    briefingStatus: 'idle',
    selectedSteps: new Set(),
    stepArtifactIds: {},
  });

  const validation = validateToolForm(formState);

  return {
    formState,
    setFormState,
    config,
    validation,
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
