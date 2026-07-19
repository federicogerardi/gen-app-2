import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AssetLibraryAccordion } from './AssetLibraryAccordion';

vi.mock('../../runtime/useWorkspaceContext', () => ({
  useWorkspaceContext: vi.fn(),
}));

vi.mock('../../runtime/toolAssetRegistry', () => ({
  ASSET_TYPE_LABELS: {
    angle: 'Angle',
    persona: 'Persona',
    'brand-voice': 'Brand Voice',
    hook: 'Hook',
  },
  getProducerToolsForAsset: vi.fn(() => []),
}));

vi.mock('../AssetGroupSection', () => ({
  AssetGroupSection: ({ label, assets, mode }: { label: string; assets: unknown[]; mode: string }) => (
    <div data-testid={`group-${label}`} data-mode={mode}>
      <span>{label}</span>
      <span>{assets.length} assets</span>
    </div>
  ),
}));

import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';

const mockUseWorkspaceContext = vi.mocked(useWorkspaceContext);

describe('AssetLibraryAccordion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no assets and no gaps', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy', gaps: [],
      overallQualityScore: 0, groupedByType: {}, foundationTools: [],
      loading: false, error: null, refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    render(
      <MemoryRouter><AssetLibraryAccordion workspaceId="w1" /></MemoryRouter>,
    );

    expect(screen.getByText('Asset Library')).toBeInTheDocument();
    expect(screen.getByText(/No assets yet/)).toBeInTheDocument();
  });

  it('renders asset groups for types with assets', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy', gaps: [],
      overallQualityScore: 0, groupedByType: {
        angle: [{ id: 'a1', assetType: 'angle', label: 'A1', qualityScore: 100, status: 'active', staleUpstream: false }],
        persona: [],
      }, foundationTools: [],
      loading: false, error: null, refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    render(
      <MemoryRouter><AssetLibraryAccordion workspaceId="w1" /></MemoryRouter>,
    );

    expect(screen.getByTestId('group-Angle')).toBeInTheDocument();
    expect(screen.getByTestId('group-Persona')).toBeInTheDocument();
  });

  it('renders in browse mode', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy', gaps: [],
      overallQualityScore: 0, groupedByType: {
        angle: [{ id: 'a1', assetType: 'angle', label: 'A1', qualityScore: 100, status: 'active', staleUpstream: false }],
      }, foundationTools: [],
      loading: false, error: null, refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    render(
      <MemoryRouter><AssetLibraryAccordion workspaceId="w1" /></MemoryRouter>,
    );

    const groupEl = screen.getByTestId('group-Angle');
    expect(groupEl).toHaveAttribute('data-mode', 'browse');
  });

  it('includes gap-only asset types', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy',
      gaps: [{ assetType: 'hook', canBeProducedBy: ['angle-generator'] }],
      overallQualityScore: 0, groupedByType: {}, foundationTools: [],
      loading: false, error: null, refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    render(
      <MemoryRouter><AssetLibraryAccordion workspaceId="w1" /></MemoryRouter>,
    );

    expect(screen.getByText(/hook/i)).toBeInTheDocument();
  });
});
