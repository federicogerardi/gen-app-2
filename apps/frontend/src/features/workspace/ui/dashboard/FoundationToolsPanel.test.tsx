import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FoundationToolsPanel } from './FoundationToolsPanel';

vi.mock('../../runtime/useWorkspaceContext', () => ({
  useWorkspaceContext: vi.fn(),
}));

vi.mock('../../../tools/runtime/tool-form-architecture', () => ({
  toolFormRegistry: {
    'brief-generator': { displayName: 'Brief Generator', defaultPrompt: 'Trasforma documenti in brief strutturati.' },
    'tov-generator': { displayName: 'TOV Generator', defaultPrompt: 'Genera un Tone of Voice strutturato.' },
  },
}));

import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';

const mockUseWorkspaceContext = vi.mocked(useWorkspaceContext);

describe('FoundationToolsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy', gaps: [],
      overallQualityScore: 0, groupedByType: {}, foundationTools: [],
      loading: true, error: null, refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    const { container } = render(
      <MemoryRouter><FoundationToolsPanel workspaceId="w1" /></MemoryRouter>,
    );
    expect(container.querySelector('.foundation-tools')).toBeInTheDocument();
  });

  it('renders nothing when no foundation tools', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy', gaps: [],
      overallQualityScore: 0, groupedByType: {}, foundationTools: [],
      loading: false, error: null, refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    const { container } = render(
      <MemoryRouter><FoundationToolsPanel workspaceId="w1" /></MemoryRouter>,
    );
    expect(container.querySelector('.foundation-tools')).not.toBeInTheDocument();
  });

  it('renders foundation tool cards', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy', gaps: [],
      overallQualityScore: 0, groupedByType: {}, foundationTools: [
        {
          toolKey: 'brief-generator',
          producedAssetType: 'brief',
          existingAssets: [],
          hasAssets: false,
        },
        {
          toolKey: 'tov-generator',
          producedAssetType: 'brand-voice',
          existingAssets: [],
          hasAssets: false,
        },
      ],
      loading: false, error: null, refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    render(
      <MemoryRouter><FoundationToolsPanel workspaceId="w1" /></MemoryRouter>,
    );

    expect(screen.getByText('Foundation')).toBeInTheDocument();
    expect(screen.getByText('Brief Generator')).toBeInTheDocument();
    expect(screen.getByText('TOV Generator')).toBeInTheDocument();
  });

  it('shows empty state CTA when no assets', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy', gaps: [],
      overallQualityScore: 0, groupedByType: {}, foundationTools: [
        {
          toolKey: 'brief-generator',
          producedAssetType: 'brief',
          existingAssets: [],
          hasAssets: false,
        },
      ],
      loading: false, error: null, refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    render(
      <MemoryRouter><FoundationToolsPanel workspaceId="w1" /></MemoryRouter>,
    );

    expect(screen.getByText('No brief yet')).toBeInTheDocument();
    expect(screen.getByText('Generate brief')).toBeInTheDocument();
  });

  it('shows has-assets state with count and regenerate', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy', gaps: [],
      overallQualityScore: 0, groupedByType: {}, foundationTools: [
        {
          toolKey: 'brief-generator',
          producedAssetType: 'brief',
          existingAssets: [
            { id: 'a1', assetType: 'brief', label: 'Brief 1', qualityScore: 100, status: 'active', staleUpstream: false },
          ],
          hasAssets: true,
        },
      ],
      loading: false, error: null, refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    render(
      <MemoryRouter><FoundationToolsPanel workspaceId="w1" /></MemoryRouter>,
    );

    expect(screen.getAllByText('1 asset').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Regenerate')).toBeInTheDocument();
  });
});
