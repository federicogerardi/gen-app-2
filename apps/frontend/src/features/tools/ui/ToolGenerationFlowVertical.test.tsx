import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolGenerationFlowVertical, type ToolGenerationFlowVerticalProps } from './ToolGenerationFlowVertical';

const baseProps: ToolGenerationFlowVerticalProps = {
  canonicalState: 'draft-empty',
  projectName: null,
  briefingFileName: null,
  briefingStatus: 'idle',
  readinessReasonCodes: [],
  briefingError: null,
  briefingGuidance: null,
  steps: [],
  completedStepsCount: 0,
  totalStepsCount: 3,
  errorMessage: null,
};

describe('ToolGenerationFlowVertical readiness reason mapping', () => {
  it('maps missing_project to deterministic readiness detail', () => {
    render(
      <ToolGenerationFlowVertical
        {...baseProps}
        readinessReasonCodes={['missing_project']}
      />,
    );

    expect(screen.getByText('Pronto per la generazione')).toBeInTheDocument();
    expect(screen.getByText('Seleziona un progetto')).toBeInTheDocument();
  });

  it('maps missing_extraction_context to deterministic readiness detail', () => {
    render(
      <ToolGenerationFlowVertical
        {...baseProps}
        projectName="Project 001"
        readinessReasonCodes={['missing_extraction_context']}
      />,
    );

    expect(screen.getByText('Pronto per la generazione')).toBeInTheDocument();
    expect(screen.getByText('Carica o recupera un brief')).toBeInTheDocument();
  });

  it('maps missing_primary_target_step to deterministic waiting detail', () => {
    render(
      <ToolGenerationFlowVertical
        {...baseProps}
        projectName="Project 001"
        briefingStatus="ready"
        readinessReasonCodes={['missing_primary_target_step']}
      />,
    );

    expect(screen.getByText('Pronto per la generazione')).toBeInTheDocument();
    expect(screen.getByText('In attesa dello step disponibile')).toBeInTheDocument();
    expect(screen.getByText('In attesa')).toBeInTheDocument();
  });

  it('uses deterministic priority fallback when multiple reason codes are present', () => {
    render(
      <ToolGenerationFlowVertical
        {...baseProps}
        projectName="Project 001"
        briefingStatus="ready"
        readinessReasonCodes={['missing_primary_target_step', 'missing_project']}
      />,
    );

    expect(screen.getByText('Pronto per la generazione')).toBeInTheDocument();
    expect(screen.getByText('Seleziona un progetto')).toBeInTheDocument();
  });

  it('renders neutral angle-generator guidance without error styling when awaiting the second file', () => {
    render(
      <ToolGenerationFlowVertical
        {...baseProps}
        projectName="Project 001"
        briefingStatus="ready"
        briefingGuidance="Brief pronto. Carica Angle Detector File per continuare."
      />,
    );

    expect(screen.getByText('Brief pronto. Carica Angle Detector File per continuare.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
