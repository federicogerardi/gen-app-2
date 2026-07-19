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
    'personas-generator': { displayName: 'Personas Generator', defaultPrompt: 'Genera una buyer persona strutturata.' },
  },
}));

import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';

const mockUseWorkspaceContext = vi.mocked(useWorkspaceContext);

describe('FoundationToolsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeletons', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy', gaps: [],
      overallQualityScore: 0, groupedByType: {}, foundationTools: [],
      loading: true, error: null, refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    const { container } = render(
      <MemoryRouter><FoundationToolsPanel workspaceId="w1" /></MemoryRouter>,
    );
    expect(container.querySelector('.foundation-status')).toBeInTheDocument();
    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
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
    expect(container.querySelector('.foundation-status')).not.toBeInTheDocument();
  });

  it('renders foundation status items', () => {
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
    expect(screen.getByText('Brief')).toBeInTheDocument();
    expect(screen.getByText('Brand Voice')).toBeInTheDocument();
  });

  it('renders personas-generator foundation status item', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy', gaps: [],
      overallQualityScore: 0, groupedByType: {}, foundationTools: [
        {
          toolKey: 'personas-generator',
          producedAssetType: 'persona',
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
    expect(screen.getByText('Personas')).toBeInTheDocument();
  });

  it('shows missing status when no assets', () => {
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

    expect(screen.getByText('Missing — generate to unlock tools')).toBeInTheDocument();
  });

  it('shows present status with asset count', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy', gaps: [],
      overallQualityScore: 0, groupedByType: {}, foundationTools: [
        {
          toolKey: 'brief-generator',
          producedAssetType: 'brief',
          existingAssets: [
            { id: 'a1', assetType: 'brief', label: 'Brief 1', qualityScore: 100, status: 'active', staleUpstream: false, createdAt: '2025-01-01T00:00:00Z' },
          ],
          hasAssets: true,
        },
      ],
      loading: false, error: null, refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    render(
      <MemoryRouter><FoundationToolsPanel workspaceId="w1" /></MemoryRouter>,
    );

    expect(screen.getByText('1 asset')).toBeInTheDocument();
  });
});
