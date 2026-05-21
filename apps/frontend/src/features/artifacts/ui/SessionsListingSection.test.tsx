import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionsListingSection } from './SessionsListingSection';

const mocks = vi.hoisted(() => ({
  authSession: {
    session: null,
    loading: false,
    error: null,
    apiBaseUrl: '',
    capabilities: {
      projects: false,
      models: false,
      artifacts: false,
      sessionsList: false,
      sessionsDetail: false,
      toolsUpload: false,
    },
  },
  sessions: [
    {
      sessionId: 'sess-angle',
      projectId: 'p-1',
      toolKey: 'angle_generator',
      status: 'completed' as const,
      artifactCount: 2,
      updatedAt: '2026-05-09T10:00:00.000Z',
    },
  ],
}));

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => mocks.authSession,
}));

vi.mock('../../../app/runtime/queries/useProjectsQuery', () => ({
  useProjectsQuery: () => ({
    data: [{ id: 'p-1', name: 'Project One', description: '', updatedAt: '2026-05-09T10:00:00.000Z' }],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock('../../../app/runtime/queries/useSessionsQuery', () => ({
  useSessionsQuery: () => ({
    data: mocks.sessions,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

describe('SessionsListingSection', () => {
  it('renders canonical Angle Generator label in Tool column instead of raw key', () => {
    render(
      <MemoryRouter>
        <SessionsListingSection title="Session archive" headingLevel="h2" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Angle Generator')).toBeInTheDocument();
    expect(screen.queryByText('angle_generator')).not.toBeInTheDocument();
  });
});
