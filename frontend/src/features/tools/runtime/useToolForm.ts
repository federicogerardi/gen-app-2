/**
 * Reusable hooks for tool form lifecycle
 * Extracted from FunnelPagesToolPage and NextlandToolPage
 */

import { useMachine } from '@xstate/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { listArtifacts } from '../../artifacts/runtime/artifacts-client';
import { listProjects, type ProjectSummary } from '../../projects/runtime/projects-client';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import { briefingUploadMachine } from '../machines/briefing-upload.machine';
import {
  getToolFormConfig,
  getAvailableSteps,
  validateToolForm,
  type ToolFormState,
} from './tool-form-architecture';
import {
  deriveCanonicalToolUiState,
  type ToolUiDerivationOutput,
} from './tool-ux-state';

const areCapabilitiesEqual = (
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (left[key] !== right[key]) {
      return false;
    }
  }

  return true;
};

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
 * Hook: Manage briefing file upload lifecycle
 * Handles extraction and artifact caching
 */
export const useBriefingUpload = (toolKey: SupportedTool, projectId: string) => {
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const [snapshot, send] = useMachine(briefingUploadMachine, {
    input: {
      toolKey,
      projectId,
      apiBaseUrl: auth.apiBaseUrl,
      capabilities: auth.capabilities,
      userId: auth.session?.user.id ?? null,
    },
  });
  const previousProjectIdRef = useRef(projectId.trim());

  useEffect(() => {
    const normalizedProjectId = projectId.trim();
    const previousProjectId = previousProjectIdRef.current;
    const nextUserId = auth.session?.user.id ?? null;
    const capabilitiesChanged = !areCapabilitiesEqual(
      snapshot.context.capabilities as Record<string, unknown>,
      auth.capabilities as Record<string, unknown>,
    );
    const shouldSync = (
      snapshot.context.projectId !== normalizedProjectId
      || snapshot.context.apiBaseUrl !== auth.apiBaseUrl
      || snapshot.context.userId !== nextUserId
      || capabilitiesChanged
    );

    if (shouldSync) {
      send({
        type: 'INPUT_SYNCED',
        projectId: normalizedProjectId,
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
        userId: nextUserId,
      });
    }

    if (previousProjectId !== normalizedProjectId) {
      send({ type: 'RESET' });
    }

    previousProjectIdRef.current = normalizedProjectId;
  }, [auth.apiBaseUrl, auth.capabilities, auth.session?.user.id, projectId, send]);

  const extractionContext = generation.getExtractionContext(projectId.trim());

  const handleFileSelected = async (selectedFile: File | null): Promise<void> => {
    if (!selectedFile) {
      send({ type: 'RESET' });
      return;
    }

    send({ type: 'FILE_SELECTED', file: selectedFile });
  };

  useEffect(() => {
    if (!snapshot.matches('ready')) {
      return;
    }

    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      return;
    }

    const briefingId = snapshot.context.briefingId;
    const extractionArtifactId = snapshot.context.extractionArtifactId;
    const extractionPayload = snapshot.context.extractionPayload;
    const normalizedText = snapshot.context.normalizedText;
    const parsedFormat = snapshot.context.parsedFormat;

    if (!briefingId || !extractionArtifactId || !extractionPayload || !normalizedText || !parsedFormat) {
      return;
    }

    const existingContext = generation.getExtractionContext(normalizedProjectId);
    if (
      existingContext?.briefingId === briefingId
      && existingContext.extractionArtifactId === extractionArtifactId
      && existingContext.normalizedText === normalizedText
      && existingContext.parsedFormat === parsedFormat
    ) {
      return;
    }

    generation.upsertExtractionContext({
      projectId: normalizedProjectId,
      briefingId,
      extractionArtifactId,
      extractionPayload,
      normalizedText,
      parsedFormat,
      updatedAt: new Date().toISOString(),
    });
  }, [generation, projectId, snapshot]);

  useEffect(() => {
    if (!snapshot.matches('extracting')) {
      return;
    }

    const normalizedProjectId = projectId.trim();
    const briefingId = snapshot.context.briefingId;
    const normalizedText = snapshot.context.normalizedText;
    const parsedFormat = snapshot.context.parsedFormat;

    if (!normalizedProjectId || !briefingId || !normalizedText || !parsedFormat) {
      return;
    }

    let cancelled = false;

    const tryRecoverExtraction = async (): Promise<boolean> => {
      const artifacts = await listArtifacts(
        {
          type: 'extraction',
          status: 'completed',
          projectId: normalizedProjectId,
        },
        {
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: auth.capabilities,
          localArtifacts: generation.artifacts,
        },
      );

      if (cancelled) {
        return false;
      }

      const recoveredArtifact = artifacts
        .filter((artifact) => {
          const artifactBriefingId = artifact.sourceRequest.input?.briefingId;
          const artifactToolKey = artifact.sourceRequest.input?.toolKey;
          return artifactBriefingId === briefingId && artifactToolKey === toolKey;
        })
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];

      if (!recoveredArtifact) {
        return false;
      }

      let payload: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(recoveredArtifact.content) as unknown;
        if (parsed && typeof parsed === 'object') {
          payload = parsed as Record<string, unknown>;
        }
      } catch {
        payload = {};
      }

      generation.upsertExtractionContext({
        projectId: normalizedProjectId,
        briefingId,
        extractionArtifactId: recoveredArtifact.artifactId,
        extractionPayload: payload,
        normalizedText,
        parsedFormat,
        updatedAt: recoveredArtifact.updatedAt,
      });

      send({
        type: 'EXTRACTION_RECOVERED',
        artifactId: recoveredArtifact.artifactId,
        payload,
      });

      return true;
    };

    void tryRecoverExtraction();
    const timerId = window.setInterval(() => {
      void tryRecoverExtraction().then((recovered) => {
        if (recovered && !cancelled) {
          window.clearInterval(timerId);
        }
      });
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [
    auth.apiBaseUrl,
    auth.capabilities,
    generation,
    generation.artifacts,
    projectId,
    send,
    snapshot,
    toolKey,
  ]);

  const status: 'idle' | 'uploading' | 'extracting' | 'ready' = snapshot.matches('uploading')
    ? 'uploading'
    : snapshot.matches('extracting')
      ? 'extracting'
      : snapshot.matches('ready')
        ? 'ready'
        : 'idle';

  return {
    file: snapshot.context.file,
    fileName: snapshot.context.fileName,
    error: snapshot.context.error,
    status,
    extractionContext,
    handleFileSelected,
  };
};

/**
 * Hook: Manage step selection and dependencies
 */
export const useStepSelection = (toolKey: SupportedTool, artifacts: any[]) => {
  const [selectedSteps, setSelectedSteps] = useState<Set<ToolStep>>(new Set());
  const [stepArtifactIds, setStepArtifactIds] = useState<Partial<Record<ToolStep, string>>>({});

  const config = getToolFormConfig(toolKey);

  const completedSteps = useMemo(() => {
    return new Set(
      artifacts
        .filter(a => a.toolKey === toolKey)
        .map(a => a.metadata?.step)
        .filter((step): step is ToolStep => !!step),
    );
  }, [toolKey, artifacts]);

  const availableSteps = useMemo(() => {
    return getAvailableSteps(toolKey, completedSteps);
  }, [toolKey, completedSteps]);

  const toggleStep = (step: ToolStep): void => {
    const next = new Set(selectedSteps);
    if (next.has(step)) {
      next.delete(step);
    } else {
      next.add(step);
    }
    setSelectedSteps(next);
  };

  return {
    selectedSteps,
    stepArtifactIds,
    setStepArtifactIds,
    completedSteps,
    availableSteps,
    config,
    toggleStep,
  };
};

/**
 * Hook: Initialize form with tool defaults
 */
export const useToolFormInit = (toolKey: SupportedTool, prefillProjectId?: string) => {
  const config = getToolFormConfig(toolKey);
  const [formState, setFormState] = useState<ToolFormState>({
    projectId: prefillProjectId ?? '',
    model: config.defaultModel,
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

/**
 * Hook: Derive canonical UI state for ToolPageTemplate
 * Maps form state + runtime generation state to unified UI state
 * 
 * @example
 * ```ts
 * const uiState = useToolUiState('funnel-pages', {
 *   formState: { projectId: 'p1', briefingStatus: 'ready', ... },
 *   isGenerationStreamActive: false,
 *   completedSteps: new Set(['optin']),
 *   currentRunningStep: null,
 *   hasCompletedPreviousGeneration: true,
 *   lastCheckpointStep: 'optin',
 *   nextAvailableStep: 'quiz',
 *   generationError: null,
 * });
 * // Returns complete UI derivation output with canonical state, CTA policy, etc.
 * ```
 */
export const useToolUiState = (
  toolKey: SupportedTool,
  runtimeInput: {
    formState: ToolFormState;
    isGenerationStreamActive: boolean;
    completedSteps: Set<ToolStep>;
    currentRunningStep: ToolStep | null;
    hasCompletedPreviousGeneration: boolean;
    lastCheckpointStep: ToolStep | null;
    nextAvailableStep: ToolStep | null;
    generationError: string | null;
  },
): ToolUiDerivationOutput => {
  return useMemo(() => {
    return deriveCanonicalToolUiState({
      toolKey,
      projectId: runtimeInput.formState.projectId,
      briefingFile: runtimeInput.formState.briefingFile,
      briefingStatus: runtimeInput.formState.briefingStatus,
      isGenerationStreamActive: runtimeInput.isGenerationStreamActive,
      completedSteps: runtimeInput.completedSteps,
      currentRunningStep: runtimeInput.currentRunningStep,
      hasCompletedPreviousGeneration: runtimeInput.hasCompletedPreviousGeneration,
      lastCheckpointStep: runtimeInput.lastCheckpointStep,
      nextAvailableStep: runtimeInput.nextAvailableStep,
      generationError: runtimeInput.generationError,
    });
  }, [toolKey, runtimeInput]);
};
