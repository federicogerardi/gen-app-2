import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  ToolGenerationFlowVertical,
  type ToolGenerationFlowVerticalProps,
} from './ToolGenerationFlowVertical';

const baseProps: ToolGenerationFlowVerticalProps = {
  canonicalState: 'draft-empty',
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
    expect(bar).toHaveAttribute('aria-label', 'Context generation waiting');
  });

  it('renders idle bar for draft-ready state', () => {
    const { container } = render(
      <ToolGenerationFlowVertical {...baseProps} canonicalState="draft-ready" />,
    );
    const bar = container.querySelector('.workflow-preload-bar');
    expect(bar).toHaveClass('is-idle');
    expect(bar).toHaveAttribute('role', 'progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Context generation completed');
  });

  it('renders correct status text for draft-ready', () => {
    render(<ToolGenerationFlowVertical {...baseProps} canonicalState="draft-ready" />);
    expect(screen.getByText('Ready for generation')).toBeInTheDocument();
  });

  it('renders active bar with progressbar role when running', () => {
    const { container } = render(
      <ToolGenerationFlowVertical {...baseProps} canonicalState="running" />,
    );
    const bar = container.querySelector('.workflow-preload-bar');
    expect(bar).toHaveClass('is-active');
    expect(bar).toHaveAttribute('role', 'progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Generation in progress');
  });

  it('renders paused-with-checkpoint as stopped generation bar', () => {
    const { container } = render(
      <ToolGenerationFlowVertical {...baseProps} canonicalState="paused-with-checkpoint" />,
    );
    const bar = container.querySelector('.workflow-preload-bar');
    expect(bar).toHaveClass('is-idle');
    expect(bar).toHaveAttribute('aria-label', 'Generation paused');
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
        errorMessage="Something went wrong"
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Something went wrong');
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
    expect(bar).toHaveAttribute('aria-label', 'Context generation in progress');
    expect(screen.getByText('Phase: Context generation')).toBeInTheDocument();
    expect(screen.getByText('Current step: Preparing context')).toBeInTheDocument();
    expect(screen.getByText('Generating context')).toBeInTheDocument();
    expect(screen.getByText('Generating context…')).toBeInTheDocument();
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
            currentStepLabel: 'Extracting context',
            statusLabel: 'Extracting context',
          },
        }}
      />,
    );

    const bar = container.querySelector('.workflow-preload-bar');
    expect(bar).toHaveAttribute('aria-valuenow', '67');
    expect(screen.getByText('Current step: Extracting context')).toBeInTheDocument();
    expect(screen.getByText('Extracting context')).toBeInTheDocument();
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

    expect(screen.queryByRole('link', { name: 'Open session' })).toBeNull();
  });

  it('renders progress metrics and unified primary CTA for completed runs', () => {
    const onPrimaryAction = vi.fn();
    render(
      <MemoryRouter>
        <ToolGenerationFlowVertical
          {...baseProps}
          canonicalState="completed"
          generationProgress={{
            completedCount: 3,
            totalCount: 3,
            currentStepLabel: 'Landing Page',
            sessionId: 'session-123',
          }}
          primaryActionCta={{
            label: 'Open session',
            disabled: false,
            onClick: onPrimaryAction,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('3 / 3 steps completed')).toBeInTheDocument();
    expect(screen.getByText('Current step: Landing Page')).toBeInTheDocument();
    const actionButton = screen.getByRole('button', { name: 'Open session' });
    expect(actionButton).toHaveClass('ui-fv-session-button');
    expect(actionButton).toHaveClass('ui-button');
  });

});

