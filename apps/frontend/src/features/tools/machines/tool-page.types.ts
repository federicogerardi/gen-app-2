import type { ActorRefFrom } from 'xstate';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import type { briefingUploadMachine } from './briefing-upload.machine';
import type { HydrationResult, PendingHydration } from './hydration.machine';
import type { SupportedTool, ToolStep } from './tool-flow.machine';
import type { ReadinessSnapshot } from './tool-page-readiness';
import type { ToolPageProgressState } from './tool-page-progress';

export type ToolPageContext = {
  toolKey: SupportedTool;
  sessionId: string;
  projectId: string;
  model: string;
  campaignObjective: string;
  registrySnapshotRef: string;
  apiBaseUrl: string;
  capabilities: Partial<BackendCapabilities>;
  userId: string | null;
  briefingActorRef: ActorRefFrom<typeof briefingUploadMachine> | null;
  stepArtifactIds: Partial<Record<ToolStep, string>>;
  errorMessage: string | null;
  progress: ToolPageProgressState;
  readiness: ReadinessSnapshot;
  intent: 'new' | 'resume' | 'regenerate';
  runRequestPrefix: string | null;
  pendingStepStart: { step: ToolStep; runRequestPrefix: string } | null;
  hydrationResult: HydrationResult | null;
  pendingHydration: PendingHydration | null;
};

export type ToolPageInput = {
  toolKey: SupportedTool;
  sessionId?: string;
  projectId: string;
  model: string;
  campaignObjective?: string;
  registrySnapshotRef: string;
  apiBaseUrl: string;
  capabilities: Partial<BackendCapabilities>;
  userId: string | null;
};

export type ToolPageEvent =
  | { type: 'PROJECT_SELECTED'; projectId: string }
  | { type: 'MODEL_CHANGED'; model: string }
  | { type: 'CAMPAIGN_OBJECTIVE_CHANGED'; campaignObjective: string }
  | { type: 'STEP_ARTIFACT_UPDATED'; step: ToolStep; artifactId: string }
  | { type: 'BRIEFING_FILE_SELECTED'; file: File; sourceKey?: string }
  | { type: 'BRIEFING_EXTRACTION_REQUESTED' }
  | { type: 'BRIEFING_RESET' }
  | { type: 'REQUEST_STEP_START'; step: ToolStep; runRequestPrefix: string }
  | { type: 'STEP_REQUEST_DISPATCHED' }
  | { type: 'START_GENERATION' }
  | { type: 'CANCEL_GENERATION' }
  | { type: 'STEP_DONE'; step: ToolStep }
  | { type: 'STEP_FAILED'; step: ToolStep; message: string }
  | { type: 'RETRY_STEP' }
  | { type: 'RESET' }
  | {
      type: 'PROGRESS_SYNCED';
      artifacts: GenerationArtifact[];
      intent: 'new' | 'resume' | 'regenerate';
      sourceArtifact: GenerationArtifact | null;
      runRequestPrefix: string | null;
    }
  | {
      type: 'HYDRATE_REQUESTED';
      sourceArtifactId?: string | null;
      intent: 'new' | 'resume' | 'regenerate';
      resolvedBriefingId?: string | null;
      sourceExtractionArtifactId?: string | null;
      localArtifacts?: GenerationArtifact[];
    };
