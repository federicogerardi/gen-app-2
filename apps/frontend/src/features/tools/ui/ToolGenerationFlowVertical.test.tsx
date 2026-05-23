import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  ToolGenerationFlowVertical,
  type ToolGenerationFlowVerticalProps,
} from './ToolGenerationFlowVertical';

const baseProps: ToolGenerationFlowVerticalProps = {
  canonicalState: 'draft-empty',
  projectName: null,
  errorMessage: null,
};

describe('ToolGenerationFlowVertical — DDD-084 single-bar model', () => {
  it('renders the region container', () => {
    render(<ToolGenerationFlowVertical {...baseProps} />);
    expect(screen.getByRole('region', { name: 'Generation flow' })).toBeInTheDocument();
  });

  it('renders extraction bar in idle stop state on draft-empty', () => {
    const { container } = render(<ToolGenerationFlowVertical {...baseProps} />);
    const bar = container.querySelector('.workflow-preload-bar');
    expect(bar).toHaveClass('is-idle');
    expect(bar).toHaveAttribute('role', 'progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Estrazione in attesa');
  });

  it('renders the project shell in draft-empty state', () => {
    render(<ToolGenerationFlowVertical {...baseProps} />);
    expect(screen.getByText('Nessun progetto selezionato')).toBeInTheDocument();
    expect(screen.getByText('Fase: Estrazione')).toBeInTheDocument();
    expect(screen.getByText('Step corrente: Estrazione briefing')).toBeInTheDocument();
    expect(screen.getByText('Estrazione briefing in attesa')).toBeInTheDocument();
    expect(screen.queryByText('Seleziona un progetto per visualizzare i file del contesto')).toBeNull();
    expect(screen.queryByText('Elaborazione briefing…')).toBeNull();
  });

  it('renders idle bar for draft-ready state', () => {
    const { container } = render(
      <ToolGenerationFlowVertical {...baseProps} canonicalState="draft-ready" />,
    );
    const bar = container.querySelector('.workflow-preload-bar');
    expect(bar).toHaveClass('is-idle');
    expect(bar).toHaveAttribute('role', 'progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Estrazione completata');
  });

  it('renders correct status text for draft-ready', () => {
    render(<ToolGenerationFlowVertical {...baseProps} canonicalState="draft-ready" />);
    expect(screen.getByText('Pronto per la generazione')).toBeInTheDocument();
  });

  it('renders active bar with progressbar role when running', () => {
    const { container } = render(
      <ToolGenerationFlowVertical {...baseProps} canonicalState="running" />,
    );
    const bar = container.querySelector('.workflow-preload-bar');
    expect(bar).toHaveClass('is-active');
    expect(bar).toHaveAttribute('role', 'progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Generazione in corso');
  });

  it('renders paused-with-checkpoint as stopped generation bar', () => {
    const { container } = render(
      <ToolGenerationFlowVertical {...baseProps} canonicalState="paused-with-checkpoint" />,
    );
    const bar = container.querySelector('.workflow-preload-bar');
    expect(bar).toHaveClass('is-idle');
    expect(bar).toHaveAttribute('aria-label', 'Generazione in pausa');
  });

  it('renders completed bar with aria-valuenow=100 when completed', () => {
    const { container } = render(
      <ToolGenerationFlowVertical {...baseProps} canonicalState="completed" />,
    );
    const bar = container.querySelector('.workflow-preload-bar');
    expect(bar).toHaveClass('is-completed');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  it('renders error message with role=alert', () => {
    render(
      <ToolGenerationFlowVertical
        {...baseProps}
        canonicalState="draft-ready"
        errorMessage="Qualcosa è andato storto"
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Qualcosa è andato storto');
  });

  it('does not render error element when errorMessage is null', () => {
    render(<ToolGenerationFlowVertical {...baseProps} canonicalState="running" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders processing-briefing status text', () => {
    const { container } = render(
      <ToolGenerationFlowVertical {...baseProps} canonicalState="processing-briefing" />,
    );
    const bar = container.querySelector('.workflow-preload-bar');
    expect(bar).toHaveClass('is-active');
    expect(bar).toHaveAttribute('aria-label', 'Estrazione in corso');
    expect(screen.getByText('Fase: Estrazione')).toBeInTheDocument();
    expect(screen.getByText('Step corrente: Estrazione briefing')).toBeInTheDocument();
    expect(screen.getByText('Estrazione briefing in corso')).toBeInTheDocument();
    expect(screen.getByText('Estrazione in corso…')).toBeInTheDocument();
  });

  it('renders dynamic extraction metrics and progress value during processing-briefing', () => {
    const { container } = render(
      <ToolGenerationFlowVertical
        {...baseProps}
        canonicalState="processing-briefing"
        generationProgress={{
          completedCount: 0,
          totalCount: 3,
          currentStepLabel: null,
          sessionId: null,
          extractionProgress: {
            completedCount: 2,
            totalCount: 3,
            currentStepLabel: 'Estrazione contesto',
            statusLabel: 'Estrazione contesto in corso',
          },
        }}
      />,
    );

    const bar = container.querySelector('.workflow-preload-bar');
    expect(bar).toHaveAttribute('aria-valuenow', '67');
    expect(screen.getByText('Step corrente: Estrazione contesto')).toBeInTheDocument();
    expect(screen.getByText('Estrazione contesto in corso')).toBeInTheDocument();
  });

  it('does not render session handoff in draft-ready even if sessionId exists', () => {
    render(
      <MemoryRouter>
        <ToolGenerationFlowVertical
          {...baseProps}
          canonicalState="draft-ready"
          generationProgress={{
            completedCount: 0,
            totalCount: 3,
            currentStepLabel: null,
            sessionId: 'session-123',
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Apri sessione →' })).toBeNull();
  });

  it('renders payload, progress metrics, and unified primary CTA for completed runs', () => {
    const onPrimaryAction = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <ToolGenerationFlowVertical
          {...baseProps}
          canonicalState="completed"
          projectName="Acme S.r.l."
          inputFilePayload={[
            {
              key: 'briefing-file',
              label: 'BriefingFile',
              requiredness: 'always-required',
              status: 'done',
              fileName: 'brief.md',
            },
            {
              key: 'angle-detector-file',
              label: 'AngleDetectorFile',
              requiredness: 'optional-by-tool-setting',
              status: 'done',
              fileName: 'angle-detector.md',
            },
          ]}
          generationProgress={{
            completedCount: 3,
            totalCount: 3,
            currentStepLabel: 'Landing Page',
            sessionId: 'session-123',
          }}
          primaryActionCta={{
            label: 'Apri sessione',
            disabled: false,
            onClick: onPrimaryAction,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Contesto caricato')).toBeInTheDocument();
    expect(screen.getByText('Progetto')).toBeInTheDocument();
    const projectIndicator = container.querySelector('.ui-fv-context-project');
    expect(projectIndicator?.classList.contains('is-done')).toBe(true);
    expect(screen.getByText('BriefingFile')).toBeInTheDocument();
    expect(screen.getByText('AngleDetectorFile')).toBeInTheDocument();
    expect(screen.getByText('richiesto')).toBeInTheDocument();
    expect(screen.getByText('opzionale')).toBeInTheDocument();
    expect(screen.getByText('3 / 3 step completati')).toBeInTheDocument();
    expect(screen.getByText('Step corrente: Landing Page')).toBeInTheDocument();
    const actionButton = screen.getByRole('button', { name: 'Apri sessione' });
    expect(actionButton).toHaveClass('ui-fv-session-button');
    expect(actionButton).toHaveClass('ui-button');
  });
});

