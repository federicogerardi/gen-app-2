import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

  it('hides the bar in draft-empty state', () => {
    const { container } = render(<ToolGenerationFlowVertical {...baseProps} />);
    const bar = container.querySelector('.workflow-preload-bar');
    expect(bar).toHaveClass('is-hidden');
    expect(bar).not.toHaveAttribute('role');
  });

  it('renders the project shell in draft-empty state', () => {
    render(<ToolGenerationFlowVertical {...baseProps} />);
    expect(screen.getByText('Nessun progetto selezionato')).toBeInTheDocument();
    expect(screen.queryByText('Elaborazione briefing…')).toBeNull();
  });

  it('renders idle bar for draft-ready state', () => {
    const { container } = render(
      <ToolGenerationFlowVertical {...baseProps} canonicalState="draft-ready" />,
    );
    const bar = container.querySelector('.workflow-preload-bar');
    expect(bar).toHaveClass('is-idle');
    expect(bar).toHaveAttribute('role', 'progressbar');
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

  it('renders paused bar when paused-with-checkpoint', () => {
    const { container } = render(
      <ToolGenerationFlowVertical {...baseProps} canonicalState="paused-with-checkpoint" />,
    );
    const bar = container.querySelector('.workflow-preload-bar');
    expect(bar).toHaveClass('is-paused');
    expect(bar).toHaveAttribute('aria-label', 'Generazione in pausa');
  });

  it('renders done bar with aria-valuenow=100 when completed', () => {
    const { container } = render(
      <ToolGenerationFlowVertical {...baseProps} canonicalState="completed" />,
    );
    const bar = container.querySelector('.workflow-preload-bar');
    expect(bar).toHaveClass('is-done');
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
    render(
      <ToolGenerationFlowVertical {...baseProps} canonicalState="processing-briefing" />,
    );
    expect(screen.getByText('Elaborazione briefing…')).toBeInTheDocument();
  });
});

