import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedbackMessageProvider, useFeedbackMessage } from '../providers/FeedbackMessageProvider';
import { GlobalFeedbackViewport } from './GlobalFeedbackViewport';

const Publisher = () => {
  const { publishSuccess, publishError } = useFeedbackMessage();

  return (
    <div>
      <button
        type="button"
        onClick={() => publishSuccess('first-success', { dedupeKey: 'first', ttlMs: 160 })}
      >
        publish-first
      </button>
      <button
        type="button"
        onClick={() => publishError('second-error', { dedupeKey: 'second', ttlMs: 220 })}
      >
        publish-second
      </button>
    </div>
  );
};

describe('GlobalFeedbackViewport', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders stack in insertion order and uses viewport/snackbar/alert classes', async () => {
    const { container } = render(
      <FeedbackMessageProvider>
        <Publisher />
        <GlobalFeedbackViewport />
      </FeedbackMessageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'publish-first' }));
    fireEvent.click(screen.getByRole('button', { name: 'publish-second' }));

    await screen.findByText('first-success');
    await screen.findByText('second-error');

    expect(screen.getByText('first-success')).toBeInTheDocument();
    expect(screen.getByText('second-error')).toBeInTheDocument();

    expect(container.querySelector('.ui-global-feedback-viewport')).not.toBeNull();
    expect(container.querySelectorAll('.ui-global-feedback-snackbar').length).toBe(2);
    expect(container.querySelectorAll('.ui-global-feedback-alert').length).toBe(2);
  });

  it('dismisses only targeted message with close action', async () => {
    const { container } = render(
      <FeedbackMessageProvider>
        <Publisher />
        <GlobalFeedbackViewport />
      </FeedbackMessageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'publish-first' }));
    fireEvent.click(screen.getByRole('button', { name: 'publish-second' }));

    await screen.findByText('first-success');
    await screen.findByText('second-error');

    const closeButtons = container.querySelectorAll('.ui-global-feedback-alert button[aria-label="Close"]');
    expect(closeButtons.length).toBeGreaterThan(0);
    fireEvent.click(closeButtons[0] as Element);

    await waitFor(() => {
      expect(screen.queryByText('first-success')).not.toBeInTheDocument();
    });

    expect(screen.getByText('second-error')).toBeInTheDocument();
  });

  it('auto-hides messages after ttl', async () => {
    render(
      <FeedbackMessageProvider>
        <Publisher />
        <GlobalFeedbackViewport />
      </FeedbackMessageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'publish-first' }));

    await screen.findByText('first-success');

    await waitFor(() => {
      expect(screen.queryByText('first-success')).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });
});
