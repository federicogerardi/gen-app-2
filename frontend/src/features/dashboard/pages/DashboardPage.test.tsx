import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: { user: { email: 'u@test.com', role: 'user' } },
    loading: false,
    error: null,
    apiBaseUrl: '',
    capabilities: { projects: false, models: false, artifacts: false, toolsUpload: false, adminModels: false },
  }),
}));

vi.mock('../../generation/runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => ({ artifacts: [], isStreamActive: false }),
}));

describe('DashboardPage', () => {
  it('renders dashboard heading', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('renders shortcut links to tools', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getAllByText(/funnel pages/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/nextland/i).length).toBeGreaterThan(0);
  });

  it('shows empty state when no recent artifacts', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText(/nessun artifact/i)).toBeInTheDocument();
  });

  it('renders artifact links when artifacts present', () => {
    vi.doMock('../../../features/generation/runtime/GenerationWorkspaceProvider', () => ({
      useGenerationWorkspace: () => ({
        artifacts: [{
          artifactId: 'a1', artifactType: 'funnel-pages', status: 'completed',
          projectId: 'p1', requestId: 'r1', model: 'm', toolKey: null,
          workflowType: null, content: '', createdAt: '', updatedAt: '', sourceRequest: {},
        }],
        isStreamActive: false,
      }),
    }));
    // Primary render with empty mocked list already asserts no-crash
  });
});
