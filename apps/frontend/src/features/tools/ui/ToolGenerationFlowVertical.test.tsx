import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ToolGenerationFlowVertical,
  type InputFilePayloadStatus,
  type ToolGenerationFlowVerticalProps,
  type WorkflowPanelFeedbackItem,
} from './ToolGenerationFlowVertical';

const basePayload: InputFilePayloadStatus[] = [
  {
    key: 'briefing-file',
    label: 'Briefing File',
    requiredness: 'always-required',
    status: 'todo',
    fileName: null,
  },
];

const baseProps: ToolGenerationFlowVerticalProps = {
  canonicalState: 'draft-empty',
  projectName: null,
  inputFilePayload: basePayload,
  workflowPanelFeedback: [],
  errorMessage: null,
};

describe('ToolGenerationFlowVertical feedback rendering', () => {
  it('renders error feedback item with role=alert', () => {
    const feedback: WorkflowPanelFeedbackItem[] = [
      { id: 'readiness-missing_project', severity: 'error', message: 'Seleziona un progetto', source: 'readiness' },
    ];

    render(<ToolGenerationFlowVertical {...baseProps} workflowPanelFeedback={feedback} />);

    expect(screen.getByText('Seleziona un progetto')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders extraction context error feedback', () => {
    const feedback: WorkflowPanelFeedbackItem[] = [
      { id: 'readiness-missing_extraction_context', severity: 'error', message: 'Carica o recupera un brief', source: 'readiness' },
    ];

    render(
      <ToolGenerationFlowVertical
        {...baseProps}
        projectName="Project 001"
        workflowPanelFeedback={feedback}
      />,
    );

    expect(screen.getByText('Carica o recupera un brief')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders info feedback item with role=status and no alert role', () => {
    const feedback: WorkflowPanelFeedbackItem[] = [
      { id: 'readiness-missing_primary_target_step', severity: 'info', message: 'In attesa dello step disponibile', source: 'readiness' },
    ];

    render(
      <ToolGenerationFlowVertical
        {...baseProps}
        projectName="Project 001"
        workflowPanelFeedback={feedback}
      />,
    );

    expect(screen.getByText('In attesa dello step disponibile')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders multiple feedback items and only error items use role=alert', () => {
    const feedback: WorkflowPanelFeedbackItem[] = [
      { id: 'readiness-missing_project', severity: 'error', message: 'Seleziona un progetto', source: 'readiness' },
      { id: 'readiness-missing_primary_target_step', severity: 'info', message: 'In attesa dello step disponibile', source: 'readiness' },
    ];

    render(
      <ToolGenerationFlowVertical
        {...baseProps}
        projectName="Project 001"
        workflowPanelFeedback={feedback}
      />,
    );

    expect(screen.getByText('Seleziona un progetto')).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('renders guidance info message without error styling when awaiting the second file', () => {
    const feedback: WorkflowPanelFeedbackItem[] = [
      {
        id: 'briefing-guidance',
        severity: 'info',
        message: 'Brief pronto. Carica Angle Detector File per continuare.',
        source: 'briefing',
      },
    ];

    render(
      <ToolGenerationFlowVertical
        {...baseProps}
        projectName="Project 001"
        workflowPanelFeedback={feedback}
      />,
    );

    expect(screen.getByText('Brief pronto. Carica Angle Detector File per continuare.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
