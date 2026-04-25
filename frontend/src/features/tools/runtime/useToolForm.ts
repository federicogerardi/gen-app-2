/**
 * Reusable hooks for tool form lifecycle
 * Extracted from FunnelPagesToolPage and NextlandToolPage
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { listProjects, type ProjectSummary } from '../../projects/runtime/projects-client';
import { runExtraction, uploadBrief } from './tools-client';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import {
  getToolFormConfig,
  isAllowedBriefingExtension,
  getAvailableSteps,
  validateToolForm,
  type ToolFormState,
} from './tool-form-architecture';
import {
  deriveCanonicalToolUiState,
  type CanonicalToolUiState,
  type PrimaryActionPolicy,
  type SecondaryActionFlags,
  type ToolUiDerivationOutput,
} from './tool-ux-state';

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
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'extracting' | 'ready'>('idle');

  const extractionContext = generation.getExtractionContext(projectId.trim());

  const handleFileSelected = async (selectedFile: File | null): Promise<void> => {
    if (!selectedFile) {
      setFile(null);
      setFileName(null);
      setUploadError(null);
      setStatus('idle');
      return;
    }

    if (!isAllowedBriefingExtension(selectedFile.name)) {
      setUploadError('Formato briefing non supportato. Usa .docx, .txt o .md');
      setFile(null);
      setFileName(null);
      setStatus('idle');
      return;
    }

    setFile(selectedFile);
    setStatus('uploading');
    setUploadError(null);

    if (!auth.session) {
      setStatus('idle');
      setUploadError('Sessione non disponibile');
      setFile(null);
      setFileName(null);
      return;
    }

    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      setStatus('idle');
      setUploadError('Project ID mancante');
      setFile(null);
      setFileName(null);
      return;
    }

    try {
      // Upload file
      const uploaded = await uploadBrief({
        projectId: normalizedProjectId,
        toolKey,
        file: selectedFile,
      }, {
        capabilities: { toolsUpload: auth.capabilities.toolsUpload ?? false },
        apiBaseUrl: auth.apiBaseUrl,
      });

      setFileName(uploaded.fileName);
      setStatus('extracting');

      // Run extraction
      const extraction = await runExtraction(
        {
          userId: auth.session.user.id,
          toolKey,
          projectId: normalizedProjectId,
          model: 'openrouter/auto',
          briefingId: uploaded.briefingId,
          briefingText: uploaded.normalizedText,
          registrySnapshotRef: 'snapshot:default',
        },
        {
          capabilities: { toolsUpload: auth.capabilities.toolsUpload ?? false },
          apiBaseUrl: auth.apiBaseUrl,
        },
      );

      generation.upsertExtractionContext({
        projectId: normalizedProjectId,
        briefingId: uploaded.briefingId,
        extractionArtifactId: extraction.artifactId,
        extractionPayload: extraction.payload,
        normalizedText: uploaded.normalizedText,
        parsedFormat: uploaded.parsedFormat,
        updatedAt: new Date().toISOString(),
      });

      setStatus('ready');
    } catch (error) {
      setStatus('idle');
      setUploadError(error instanceof Error ? error.message : 'Errore durante upload/extraction');
      setFile(null);
      setFileName(null);
    }
  };

  return {
    file,
    fileName,
    error: uploadError,
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
