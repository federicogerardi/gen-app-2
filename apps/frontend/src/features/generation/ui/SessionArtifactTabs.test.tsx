import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { appCopy } from '../../../app/copy/system';
import { SessionArtifactTabs } from './SessionArtifactTabs';
import type { SessionArtifactGroup } from '../machines/session-artifact-group';

const group: SessionArtifactGroup = {
  sessionId: 'sess_demo',
  toolKey: 'funnel-pages',
  status: 'completed',
  artifacts: [
    {
      artifactId: 'a-1',
      requestId: 'r-1',
      projectId: 'p-1',
      stepKey: 'optin',
      artifactRole: 'step',
      status: 'completed',
      content: '# Optin\n\nFirst artifact',
      updatedAt: '2026-05-09T10:00:00.000Z',
      failureReason: null,
    },
    {
      artifactId: 'a-2',
      requestId: 'r-2',
      projectId: 'p-1',
      stepKey: 'quiz',
      artifactRole: 'final',
      status: 'completed',
      content: 'Second artifact',
      updatedAt: '2026-05-09T10:01:00.000Z',
      failureReason: null,
    },
  ],
};

describe('SessionArtifactTabs', () => {
  it('renders step tabs separately from markdown/raw content controls', () => {
    render(<SessionArtifactTabs group={group} fallbackToolKey="funnel-pages" />);

    expect(screen.getByRole('tablist', { name: 'Session steps' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Modalita visualizzazione contenuto artifact di sessione' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'optin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: appCopy.ui.actions.viewMarkdown })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: appCopy.ui.actions.viewRaw })).toBeInTheDocument();
  });

  it('switches selected artifact when a step tab is clicked', () => {
    render(<SessionArtifactTabs group={group} fallbackToolKey="funnel-pages" />);

    expect(screen.getByText('First artifact')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'quiz' }));
    expect(screen.getByText('Second artifact')).toBeInTheDocument();
  });
});