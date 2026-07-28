/**
 * ToolFeedbackPanel: Unified workflow feedback wrapper.
 *
 * Encapsulates the job-system vs legacy-flow branching that was previously
 * a ternary in ToolPageTemplate. Renders the appropriate panel based on
 * machine state and job availability.
 *
 * Phase 3-4: replaces the inline ternary; legacy flow deprecated but preserved
 * for non-job paths until full switchover.
 */

import { ToolWorkflowJobPanel } from './ToolWorkflowJobPanel';
import { ToolGenerationFlowVertical } from './ToolGenerationFlowVertical';
import type { ToolGenerationFlowVerticalProps } from './ToolGenerationFlowVertical';

type ToolFeedbackPanelProps = {
  /* Branching */
  useJobSystem: boolean;
  pendingJobId: string | null;

  /* Job system props (passthrough to ToolWorkflowJobPanel) */
  toolKey: Parameters<typeof ToolWorkflowJobPanel>[0]['toolKey'];
  stepItems: Parameters<typeof ToolWorkflowJobPanel>[0]['stepItems'];
  stepLabels: Parameters<typeof ToolWorkflowJobPanel>[0]['stepLabels'];
  currentRunningStep: Parameters<typeof ToolWorkflowJobPanel>[0]['currentRunningStep'];
  completedSteps: Parameters<typeof ToolWorkflowJobPanel>[0]['completedSteps'];
  errorMessage: Parameters<typeof ToolWorkflowJobPanel>[0]['errorMessage'];
  isStreamActive: Parameters<typeof ToolWorkflowJobPanel>[0]['isStreamActive'];
  workspaceName: Parameters<typeof ToolWorkflowJobPanel>[0]['workspaceName'];
  briefingFileName: Parameters<typeof ToolWorkflowJobPanel>[0]['briefingFileName'];
  isBriefingReady: Parameters<typeof ToolWorkflowJobPanel>[0]['isBriefingReady'];
  sessionId: Parameters<typeof ToolWorkflowJobPanel>[0]['sessionId'];
  onCancel: Parameters<typeof ToolWorkflowJobPanel>[0]['onCancel'];
  onRetry: Parameters<typeof ToolWorkflowJobPanel>[0]['onRetry'];

  /* Legacy flow props (passthrough to ToolGenerationFlowVertical) */
  canonicalState: ToolGenerationFlowVerticalProps['canonicalState'];
  generationProgress: ToolGenerationFlowVerticalProps['generationProgress'];
  primaryActionCta: ToolGenerationFlowVerticalProps['primaryActionCta'];
};

export const ToolFeedbackPanel = ({
  useJobSystem,
  pendingJobId,
  toolKey,
  stepItems,
  stepLabels,
  currentRunningStep,
  completedSteps,
  errorMessage,
  isStreamActive,
  workspaceName,
  briefingFileName,
  isBriefingReady,
  sessionId,
  onCancel,
  onRetry,
  canonicalState,
  generationProgress,
  primaryActionCta,
}: ToolFeedbackPanelProps) => {
  if (useJobSystem && pendingJobId) {
    return (
      <ToolWorkflowJobPanel
        jobId={pendingJobId}
        toolKey={toolKey}
        stepItems={stepItems}
        stepLabels={stepLabels}
        currentRunningStep={currentRunningStep}
        completedSteps={completedSteps}
        errorMessage={errorMessage}
        isStreamActive={isStreamActive}
        workspaceName={workspaceName}
        briefingFileName={briefingFileName}
        isBriefingReady={isBriefingReady}
        sessionId={sessionId}
        {...(onCancel ? { onCancel } : {})}
        {...(onRetry ? { onRetry } : {})}
      />
    );
  }

  // Legacy flow: preserved for non-job paths until full switchover
  return (
    <ToolGenerationFlowVertical
      canonicalState={canonicalState}
      errorMessage={errorMessage}
      {...(generationProgress ? { generationProgress } : {})}
      {...(primaryActionCta ? { primaryActionCta } : {})}
    />
  );
};