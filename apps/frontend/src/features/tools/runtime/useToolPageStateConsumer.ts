import { useMemo } from 'react';
import type { useNavigate } from 'react-router-dom';
import type { ToolPageViewModel, ReadinessSnapshot } from '../machines/tool-page.machine';
import type { ToolFormConfig, ToolFormState } from './tool-form-architecture';
import type { ToolStep } from '../machines/tool-flow.machine';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';

/**
 * DDD-158: ToolPageStateConsumer — canonical Frontend/UI hook for UI-only state
 * management per BCM Line 25 downstream consumer pattern.
 *
 * Returns `{ pageState, formState, navigationState }` — pure UI concerns with zero
 * domain logic. Replaces the UI-state subset previously scattered across the
 * monolithic `useToolPage` hook. Consumes the `toolPageMachine` snapshot (page
 * orchestrator), `useToolFormInit` (form state) and `useNavigate` (navigation)
 * without coordinating any domain boundaries.
 *
 * Sprint 4 Session 2 (Phase 1 Step 5): introduced as the fourth consumer hook
 * alongside DDD-159 (BackendStreamEvent), DDD-160 (AuthSession), DDD-161
 * (QuotaDisplay). The run controller (`useToolPageRunController`) is NOT part of
 * this consumer — it owns execution state (auto-chain, dispatch, race
 * idempotency). This split keeps the downstream consumer pattern explicit per
 * BCM Line 25 and prepares `useToolPage` for a façade refactor that composes
 * all four consumer hooks.
 *
 * Stability contract: the returned object is memoized so its reference is stable
 * across renders when the input derivation bag is referentially stable. This
 * matches React 19's compiler-friendly memoization model and prevents spurious
 * re-renders of consumers reading the page-level view model.
 */

export interface ToolPagePageStateValue {
  readonly machineViewModel: ToolPageViewModel;
  readonly isGenerating: boolean;
  readonly readinessSnapshot: ReadinessSnapshot;
  readonly completedStepsForFlow: Set<ToolStep>;
  readonly latestArtifactByStep: Partial<Record<ToolStep, GenerationArtifact>>;
  readonly completedArtifactsByStep: Partial<Record<ToolStep, string>>;
  readonly currentRunningStep: ToolStep | null;
  readonly streamingStep: ToolStep | null;
  readonly pausedCheckpointStep: ToolStep | null;
  readonly nextAvailableStep: ToolStep | null;
  readonly effectiveCanonicalState: ToolPageViewModel['canonicalState'] | 'processing-briefing';
  readonly sessionId: string;
}

export interface ToolPageFormStateValue {
  readonly toolConfig: ToolFormConfig;
  readonly formState: ToolFormState;
  readonly setFormState: React.Dispatch<React.SetStateAction<ToolFormState>>;
  readonly projects: Array<{ id: string; name: string }>;
  readonly projectsLoading: boolean;
  readonly currentProject: { id: string; name: string } | undefined;
  readonly briefingError: string | null;
  readonly briefingGuidance: string | null;
  readonly effectiveBriefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready';
  readonly effectiveBriefingFileName: string | null;
  readonly angleDetectorFileName: string | null;
}

export interface ToolPageNavigationStateValue {
  readonly navigate: ReturnType<typeof useNavigate>;
}

export interface ToolPageStateConsumerValue {
  readonly pageState: ToolPagePageStateValue;
  readonly formState: ToolPageFormStateValue;
  readonly navigationState: ToolPageNavigationStateValue;
}

type UseToolPageStateConsumerArgs = {
  toolConfig: ToolFormConfig;
  formState: ToolFormState;
  setFormState: React.Dispatch<React.SetStateAction<ToolFormState>>;
  projects: Array<{ id: string; name: string }>;
  projectsLoading: boolean;
  briefingError: string | null;
  briefingGuidance: string | null;
  effectiveBriefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready';
  effectiveBriefingFileName: string | null;
  angleDetectorFileName: string | null;
  machineViewModel: ToolPageViewModel;
  isGenerating: boolean;
  readinessSnapshot: ReadinessSnapshot;
  completedStepsForFlow: Set<ToolStep>;
  latestArtifactByStep: Partial<Record<ToolStep, GenerationArtifact>>;
  completedArtifactsByStep: Partial<Record<ToolStep, string>>;
  nextAvailableStep: ToolStep | null;
  currentRunningStep: ToolStep | null;
  streamingStep: ToolStep | null;
  pausedCheckpointStep: ToolStep | null;
  effectiveCanonicalState: ToolPageViewModel['canonicalState'] | 'processing-briefing';
  currentProject: { id: string; name: string } | undefined;
  navigate: ReturnType<typeof useNavigate>;
  sessionId: string;
};

export const useToolPageStateConsumer = (args: UseToolPageStateConsumerArgs): ToolPageStateConsumerValue => {
  return useMemo(() => ({
    pageState: {
      machineViewModel: args.machineViewModel,
      isGenerating: args.isGenerating,
      readinessSnapshot: args.readinessSnapshot,
      completedStepsForFlow: args.completedStepsForFlow,
      latestArtifactByStep: args.latestArtifactByStep,
      completedArtifactsByStep: args.completedArtifactsByStep,
      currentRunningStep: args.currentRunningStep,
      streamingStep: args.streamingStep,
      pausedCheckpointStep: args.pausedCheckpointStep,
      nextAvailableStep: args.nextAvailableStep,
      effectiveCanonicalState: args.effectiveCanonicalState,
      sessionId: args.sessionId,
    },
    formState: {
      toolConfig: args.toolConfig,
      formState: args.formState,
      setFormState: args.setFormState,
      projects: args.projects,
      projectsLoading: args.projectsLoading,
      currentProject: args.currentProject,
      briefingError: args.briefingError,
      briefingGuidance: args.briefingGuidance,
      effectiveBriefingStatus: args.effectiveBriefingStatus,
      effectiveBriefingFileName: args.effectiveBriefingFileName,
      angleDetectorFileName: args.angleDetectorFileName,
    },
    navigationState: {
      navigate: args.navigate,
    },
  }), [
    args.machineViewModel,
    args.isGenerating,
    args.readinessSnapshot,
    args.completedStepsForFlow,
    args.latestArtifactByStep,
    args.completedArtifactsByStep,
    args.currentRunningStep,
    args.streamingStep,
    args.pausedCheckpointStep,
    args.nextAvailableStep,
    args.effectiveCanonicalState,
    args.sessionId,
    args.toolConfig,
    args.formState,
    args.setFormState,
    args.projects,
    args.projectsLoading,
    args.currentProject,
    args.briefingError,
    args.briefingGuidance,
    args.effectiveBriefingStatus,
    args.effectiveBriefingFileName,
    args.angleDetectorFileName,
    args.navigate,
  ]);
};