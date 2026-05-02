/**
 * ToolGenerationFlow: Unified flow representation for tool generation
 * 
 * Replaces fragmented ToolStatusCard + ToolStepCard[] with a single,
 * coherent flow that represents the complete journey:
 * 
 * Phase 1: Input Requirements (Feedback informativo per procedere)
 *   - Project selection status
 *   - Briefing upload status
 *   - Prerequisites checklist
 * 
 * Phase 2: Generation Monitoring (Monitorare il processo)
 *   - Current step progress
 *   - Step-by-step artifacts
 *   - Completion status
 * 
 * This unified structure eliminates fragmentation and provides
 * consistent visual hierarchy and information architecture.
 */

import { Surface, uiPrimitives } from '../../../app/ui/primitives';
import type { CanonicalToolUiState } from '../runtime/tool-ux-state';
import type { ToolStep, SupportedTool } from '../machines/tool-flow.machine';

type FlowPhase = 'input-requirements' | 'generation-monitoring' | 'completion';

interface FlowPhaseIndicator {
  phase: FlowPhase;
  label: string;
  icon: string;
  isActive: boolean;
  isCompleted: boolean;
}

interface InputRequirement {
  id: string;
  label: string;
  status: 'todo' | 'active' | 'done' | 'error';
  detail?: string | undefined;
  errorMessage?: string | undefined;
}

interface StepProgress {
  step: ToolStep;
  displayName: string;
  description: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  previewContent?: string | null;
  artifactId?: string | null;
  isStreaming?: boolean;
  errorMessage?: string;
}

interface ToolGenerationFlowProps {
  toolKey: SupportedTool;
  canonicalState: CanonicalToolUiState;
  
  // Input phase data
  projectName: string | null;
  briefingFileName: string | null;
  briefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready';
  briefingError: string | null;
  
  // Generation phase data
  steps: StepProgress[];
  currentRunningStep: ToolStep | null;
  completedStepsCount: number;
  totalStepsCount: number;
  
  // Status messages
  statusMessage: string | null;
  errorMessage: string | null;
  
  // Actions
  onViewArtifact?: (artifactId: string) => void;
}

const getPhaseIcon = (phase: FlowPhase): string => {
  switch (phase) {
    case 'input-requirements':
      return '📋';
    case 'generation-monitoring':
      return '⚙️';
    case 'completion':
      return '✓';
  }
};

const getRequirementIcon = (status: InputRequirement['status']): string => {
  switch (status) {
    case 'todo':
      return '○';
    case 'active':
      return '◐';
    case 'done':
      return '✓';
    case 'error':
      return '✕';
  }
};

const getStepStatusIcon = (status: StepProgress['status']): string => {
  switch (status) {
    case 'idle':
      return '○';
    case 'running':
      return '⟳';
    case 'completed':
      return '✓';
    case 'error':
      return '✕';
  }
};

const getStepStatusBadge = (status: StepProgress['status']): { label: string; className: string } => {
  switch (status) {
    case 'idle':
      return { label: 'Pending', className: 'ui-badge-idle' };
    case 'running':
      return { label: 'Generating...', className: 'ui-badge-running' };
    case 'completed':
      return { label: 'Done', className: 'ui-badge-completed' };
    case 'error':
      return { label: 'Error', className: 'ui-badge-error' };
  }
};

/**
 * Derive which phase the flow is currently in
 */
const deriveFlowPhase = (canonicalState: CanonicalToolUiState): FlowPhase => {
  if (canonicalState === 'completed') {
    return 'completion';
  }
  if (
    canonicalState === 'running'
    || canonicalState === 'paused-with-checkpoint'
  ) {
    return 'generation-monitoring';
  }
  return 'input-requirements';
};

/**
 * Build input requirements checklist based on state
 */
const buildInputRequirements = (
  projectName: string | null,
  briefingFileName: string | null,
  briefingStatus: ToolGenerationFlowProps['briefingStatus'],
  briefingError: string | null,
  canonicalState: CanonicalToolUiState,
): InputRequirement[] => {
  return [
    {
      id: 'project',
      label: 'Project',
      status: projectName ? 'done' : 'todo',
      detail: projectName ?? 'Select a project',
    },
    {
      id: 'briefing',
      status: briefingError
        ? 'error'
        : briefingFileName
          ? 'done'
          : briefingStatus === 'uploading' || briefingStatus === 'extracting'
            ? 'active'
            : 'todo',
      label: 'Briefing',
      detail: briefingFileName ?? 'Upload briefing file',
      errorMessage: briefingError ?? undefined,
    },
    {
      id: 'readiness',
      label: 'Ready to Generate',
      status:
        canonicalState === 'draft-ready'
          ? 'done'
          : canonicalState === 'processing-briefing'
            ? 'active'
            : 'todo',
      detail:
        canonicalState === 'draft-ready'
          ? 'All prerequisites met'
          : 'Waiting for project and briefing',
    },
  ];
};

export const ToolGenerationFlow = ({
  toolKey: _toolKey,
  canonicalState,
  projectName,
  briefingFileName,
  briefingStatus,
  briefingError,
  steps,
  currentRunningStep: _currentRunningStep,
  completedStepsCount,
  totalStepsCount,
  statusMessage,
  errorMessage,
  onViewArtifact,
}: ToolGenerationFlowProps) => {
  const currentPhase = deriveFlowPhase(canonicalState);
  const inputRequirements = buildInputRequirements(
    projectName,
    briefingFileName,
    briefingStatus,
    briefingError,
    canonicalState,
  );

  // Phase indicators
  const phases: FlowPhaseIndicator[] = [
    {
      phase: 'input-requirements',
      label: 'Input Requirements',
      icon: getPhaseIcon('input-requirements'),
      isActive: currentPhase === 'input-requirements',
      isCompleted: currentPhase !== 'input-requirements',
    },
    {
      phase: 'generation-monitoring',
      label: 'Generation',
      icon: getPhaseIcon('generation-monitoring'),
      isActive: currentPhase === 'generation-monitoring',
      isCompleted: currentPhase === 'completion',
    },
    {
      phase: 'completion',
      label: 'Completed',
      icon: getPhaseIcon('completion'),
      isActive: currentPhase === 'completion',
      isCompleted: false,
    },
  ];

  return (
    <Surface className="ui-tool-generation-flow">
      {/* Flow header with phase indicators */}
      <div className="ui-flow-header">
        <h3>Generation Flow</h3>
        <div className="ui-flow-phases">
          {phases.map((p, idx) => (
            <div
              key={p.phase}
              className={`ui-flow-phase ${p.isActive ? 'is-active' : ''} ${p.isCompleted ? 'is-completed' : ''}`}
            >
              <span className="ui-flow-phase-icon">{p.icon}</span>
              <span className="ui-flow-phase-label">{p.label}</span>
              {idx < phases.length - 1 && <span className="ui-flow-phase-connector" />}
            </div>
          ))}
        </div>
      </div>

      {/* Global error/status message */}
      {errorMessage && (
        <div className={uiPrimitives.error} role="alert">
          {errorMessage}
        </div>
      )}

      {/* Phase 1: Input Requirements */}
      {currentPhase === 'input-requirements' && (
        <div className="ui-flow-phase-content ui-flow-phase-input-requirements">
          <h4>Prerequisites</h4>
          <p className={uiPrimitives.metaLine}>
            Provide the required information to start generation
          </p>

          <ul className="ui-flow-requirements-list">
            {inputRequirements.map((req) => (
              <li
                key={req.id}
                className={`ui-flow-requirement is-${req.status}`}
              >
                <span className="ui-flow-requirement-icon">
                  {getRequirementIcon(req.status)}
                </span>
                <div className="ui-flow-requirement-content">
                  <span className="ui-flow-requirement-label">{req.label}</span>
                  {req.detail && (
                    <span className={uiPrimitives.metaLine}>
                      {req.detail}
                    </span>
                  )}
                  {req.errorMessage && (
                    <span className={uiPrimitives.error}>
                      {req.errorMessage}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {statusMessage && (
            <p className={uiPrimitives.metaLine}>{statusMessage}</p>
          )}
        </div>
      )}

      {/* Phase 2: Generation Monitoring */}
      {currentPhase === 'generation-monitoring' && (
        <div className="ui-flow-phase-content ui-flow-phase-generation-monitoring">
          <h4>Generation Progress</h4>
          <p className={uiPrimitives.metaLine}>
            {completedStepsCount} of {totalStepsCount} steps completed
          </p>

          <div className="ui-flow-progress-bar">
            <div
              className="ui-flow-progress-fill"
              style={{
                width: `${(completedStepsCount / totalStepsCount) * 100}%`,
              }}
            />
          </div>

          <div className="ui-flow-steps-list">
            {steps.map((step) => (
              <div
                key={step.step}
                className={`ui-flow-step is-${step.status}`}
              >
                <div className="ui-flow-step-header">
                  <span className="ui-flow-step-icon">
                    {getStepStatusIcon(step.status)}
                  </span>
                  <div className="ui-flow-step-title-group">
                    <h5>{step.displayName}</h5>
                    <span
                      className={`ui-badge ${getStepStatusBadge(step.status).className}`}
                    >
                      {getStepStatusBadge(step.status).label}
                    </span>
                  </div>
                </div>

                <p className={uiPrimitives.metaLine}>{step.description}</p>

                {/* Preview area for running or completed steps */}
                {(step.status === 'running' || step.status === 'completed') &&
                  step.previewContent && (
                    <div className="ui-flow-step-preview">
                      <div className="ui-flow-step-preview-header">
                        {step.isStreaming && (
                          <span className="ui-badge ui-badge-streaming">
                            Streaming...
                          </span>
                        )}
                      </div>
                      <div className="ui-flow-step-preview-content">
                        {step.previewContent.slice(0, 300)}
                        {step.previewContent.length > 300 && '...'}
                      </div>
                    </div>
                  )}

                {/* Error message for failed steps */}
                {step.status === 'error' && step.errorMessage && (
                  <p className={uiPrimitives.error}>{step.errorMessage}</p>
                )}

                {/* View artifact button for completed steps */}
                {step.status === 'completed' && step.artifactId && onViewArtifact && (
                  <button
                    className={uiPrimitives.button}
                    onClick={() => onViewArtifact(step.artifactId!)}
                    title="Open the full artifact"
                  >
                    View Artifact
                  </button>
                )}
              </div>
            ))}
          </div>

          {statusMessage && (
            <p className={uiPrimitives.metaLine}>{statusMessage}</p>
          )}
        </div>
      )}

      {/* Phase 3: Completion */}
      {currentPhase === 'completion' && (
        <div className="ui-flow-phase-content ui-flow-phase-completion">
          <h4>Generation Complete</h4>
          <p className={uiPrimitives.metaLine}>
            All {totalStepsCount} steps have been completed successfully
          </p>

          <div className="ui-flow-completion-summary">
            <div className="ui-flow-completion-stat">
              <span className="ui-flow-completion-stat-value">
                {totalStepsCount}
              </span>
              <span className="ui-flow-completion-stat-label">
                Artifacts Generated
              </span>
            </div>
          </div>

          <div className="ui-flow-steps-list ui-flow-steps-list-completed">
            {steps.map((step) => (
              <div
                key={step.step}
                className="ui-flow-step is-completed"
              >
                <div className="ui-flow-step-header">
                  <span className="ui-flow-step-icon">✓</span>
                  <h5>{step.displayName}</h5>
                </div>

                {step.artifactId && onViewArtifact && (
                  <button
                    className={uiPrimitives.button}
                    onClick={() => onViewArtifact(step.artifactId!)}
                  >
                    View Artifact
                  </button>
                )}
              </div>
            ))}
          </div>

          {statusMessage && (
            <p className={uiPrimitives.metaLine}>{statusMessage}</p>
          )}
        </div>
      )}
    </Surface>
  );
};
