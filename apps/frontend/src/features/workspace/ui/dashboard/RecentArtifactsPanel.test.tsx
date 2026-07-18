import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecentArtifactsPanel } from './RecentArtifactsPanel';

vi.mock('../../runtime/useProjectArtifacts', () => ({
  useProjectArtifacts: vi.fn(),
}));

vi.mock('../../runtime/useWorkspaceContext', () => ({
  useWorkspaceContext: vi.fn(),
}));

vi.mock('../../../tools/runtime/tool-form-architecture', () => ({
  getToolLabel: (key: string | null) => {
    const labels: Record<string, string> = {
      'angle-generator': 'Angle Generator',
      'funnel-pages': 'Hotlead Funnel',
    };
    return key ? labels[key] ?? key : '—';
  },
}));

vi.mock('../../../sessionsummary/ui/PromoteAssetDialog', () => ({
  PromoteAssetDialog: ({ open, artifactId, onClose }: { open: boolean; artifactId: string; onClose: () => void }) => (
    open ? (
      <div data-testid="promote-dialog">
        <span>Promote dialog for {artifactId}</span>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
  ),
}));

import { useProjectArtifacts } from '../../runtime/useProjectArtifacts';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';

const mockUseProjectArtifacts = vi.mocked(useProjectArtifacts);
const mockUseWorkspaceContext = vi.mocked(useWorkspaceContext);

describe('RecentArtifactsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy', gaps: [],
      overallQualityScore: 0, groupedByType: {}, foundationTools: [],
      loading: false, error: null, refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);
  });

  it('renders loading skeleton', () => {
    mockUseProjectArtifacts.mockReturnValue({
      artifacts: [], loading: true, error: null, refetch: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter><RecentArtifactsPanel workspaceId="w1" /></MemoryRouter>,
    );
    expect(container.querySelector('.dashboard-panel')).toBeInTheDocument();
    expect(screen.getByText('Recent Artifacts')).toBeInTheDocument();
  });

  it('renders error state', () => {
    mockUseProjectArtifacts.mockReturnValue({
      artifacts: [], loading: false, error: 'Failed to load', refetch: vi.fn(),
    });

    render(
      <MemoryRouter><RecentArtifactsPanel workspaceId="w1" /></MemoryRouter>,
    );
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    mockUseProjectArtifacts.mockReturnValue({
      artifacts: [], loading: false, error: null, refetch: vi.fn(),
    });

    render(
      <MemoryRouter><RecentArtifactsPanel workspaceId="w1" /></MemoryRouter>,
    );
    expect(screen.getByText(/No recent artifacts/)).toBeInTheDocument();
  });

  it('renders artifact list', () => {
    mockUseProjectArtifacts.mockReturnValue({
      artifacts: [
        {
          artifactId: 'art-1', requestId: 'r1', projectId: 'w1',
          artifactType: 'content', status: 'completed', model: 'openrouter/auto',
          toolKey: 'angle-generator', workflowType: 'angle_generator',
          content: 'This is a test artifact content that is quite long and should be truncated',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          sourceRequest: {} as never,
        },
      ],
      loading: false, error: null, refetch: vi.fn(),
    });

    render(
      <MemoryRouter><RecentArtifactsPanel workspaceId="w1" /></MemoryRouter>,
    );

    expect(screen.getByText(/This is a test artifact content/)).toBeInTheDocument();
    expect(screen.getByText(/Angle Generator/)).toBeInTheDocument();
    expect(screen.getByText('Promote to Asset')).toBeInTheDocument();
  });

  it('shows promoted chip for already-promoted artifacts', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [
        { id: 'a1', assetType: 'angle', label: 'A1', qualityScore: 100, status: 'active', staleUpstream: false, sourceArtifactId: 'art-1' },
      ], qualityGateStatus: 'healthy', gaps: [],
      overallQualityScore: 0, groupedByType: {}, foundationTools: [],
      loading: false, error: null, refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    mockUseProjectArtifacts.mockReturnValue({
      artifacts: [
        {
          artifactId: 'art-1', requestId: 'r1', projectId: 'w1',
          artifactType: 'content', status: 'completed', model: 'openrouter/auto',
          toolKey: 'angle-generator', workflowType: 'angle_generator',
          content: 'Test content',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          sourceRequest: {} as never,
        },
      ],
      loading: false, error: null, refetch: vi.fn(),
    });

    render(
      <MemoryRouter><RecentArtifactsPanel workspaceId="w1" /></MemoryRouter>,
    );

    expect(screen.getByText('Asset ✓')).toBeInTheDocument();
    expect(screen.queryByText('Promote to Asset')).not.toBeInTheDocument();
  });

  it('opens promote dialog on button click', () => {
    mockUseProjectArtifacts.mockReturnValue({
      artifacts: [
        {
          artifactId: 'art-1', requestId: 'r1', projectId: 'w1',
          artifactType: 'content', status: 'completed', model: 'openrouter/auto',
          toolKey: 'angle-generator', workflowType: 'angle_generator',
          content: 'Test content',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          sourceRequest: {} as never,
        },
      ],
      loading: false, error: null, refetch: vi.fn(),
    });

    render(
      <MemoryRouter><RecentArtifactsPanel workspaceId="w1" /></MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Promote to Asset'));
    expect(screen.getByTestId('promote-dialog')).toBeInTheDocument();
    expect(screen.getByText('Promote dialog for art-1')).toBeInTheDocument();
  });
});
