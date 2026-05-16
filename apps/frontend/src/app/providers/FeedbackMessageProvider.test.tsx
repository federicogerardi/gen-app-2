import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedbackMessageProvider, useFeedbackMessage } from './FeedbackMessageProvider';
import { GlobalFeedbackViewport } from '../ui/GlobalFeedbackViewport';

const Probe = () => {
  const { messages, publishSuccess, publishError, dismiss, dismissAll } = useFeedbackMessage();

  return (
    <div>
      <button
        type="button"
        onClick={() => publishSuccess('success-message', { dedupeKey: 'success', ttlMs: 120 })}
      >
        publish-success
      </button>
      <button
        type="button"
        onClick={() => publishSuccess('success-message-duplicate', { dedupeKey: 'success', ttlMs: 120 })}
      >
        publish-success-duplicate
      </button>
      <button
        type="button"
        onClick={() => publishError('error-message', { dedupeKey: 'error', ttlMs: 180 })}
      >
        publish-error
      </button>
      <button type="button" onClick={() => dismissAll()}>dismiss-all</button>
      <button
        type="button"
        onClick={() => {
          const first = messages[0];
          if (first) {
            dismiss(first.id);
          }
        }}
      >
        dismiss-first
      </button>

      <ul>
        {messages.map((message) => (
          <li key={message.id}>{message.text}</li>
        ))}
      </ul>
    </div>
  );
};

describe('FeedbackMessageProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles queue insertion, dedupe, dismiss and dismissAll', () => {
    render(
      <FeedbackMessageProvider>
        <Probe />
      </FeedbackMessageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'publish-success' }));
    fireEvent.click(screen.getByRole('button', { name: 'publish-success-duplicate' }));

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('success-message')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'publish-error' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'dismiss-first' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('error-message')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'dismiss-all' }));
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('auto-expires messages from provider queue through viewport onClose', async () => {
    vi.useFakeTimers();

    render(
      <FeedbackMessageProvider>
        <Probe />
        <GlobalFeedbackViewport />
      </FeedbackMessageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'publish-success' }));
    fireEvent.click(screen.getByRole('button', { name: 'publish-error' }));

    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});
