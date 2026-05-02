import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolGenerationFlowVertical, type ToolGenerationFlowVerticalProps } from './ToolGenerationFlowVertical';

const baseProps: ToolGenerationFlowVerticalProps = {
  toolKey: 'funnel-pages',
  canonicalState: 'draft-empty',
  projectName: null,
  briefingFileName: null,
  briefingStatus: 'idle',
  readinessReasonCodes: [],
  briefingError: null,
  steps: [],
  currentRunningStep: null,
  completedStepsCount: 0,
  totalStepsCount: 3,
  statusMessage: null,
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
});
