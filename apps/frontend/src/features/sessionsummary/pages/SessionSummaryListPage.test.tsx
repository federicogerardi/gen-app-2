import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { appCopy } from '../../../app/copy/system';

const mocks = vi.hoisted(() => ({
  sessionsListingSection: vi.fn((_: { title: string; headingLevel: 'h2' | 'h3' }) => <div data-testid="sessions-listing-section" />),
}));

vi.mock('../../artifacts/ui/SessionsListingSection', () => ({
  SessionsListingSection: (props: { title: string; headingLevel: 'h2' | 'h3' }) => mocks.sessionsListingSection(props),
}));

describe('SessionSummaryListPage', () => {
  it('renders sessions archive section with canonical title and h2 heading level', async () => {
    const { SessionSummaryListPage } = await import('./SessionSummaryListPage');

    render(<SessionSummaryListPage />);

    expect(screen.getByTestId('sessions-listing-section')).toBeInTheDocument();
    expect(mocks.sessionsListingSection).toHaveBeenCalledWith({
      title: appCopy.editorial.sessions.archiveTitle,
      headingLevel: 'h2',
    });
  });
});
