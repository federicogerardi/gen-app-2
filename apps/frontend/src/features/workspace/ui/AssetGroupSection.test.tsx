import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AssetGroupSection } from './AssetGroupSection';

vi.mock('./AssetTypeIcon', () => ({
  AssetTypeIcon: ({ type }: { type: string }) => <span data-testid="type-icon">{type}</span>,
}));

vi.mock('./QualityScoreBadge', () => ({
  QualityScoreBadge: ({ score }: { score: number }) => <span data-testid="quality-badge">{score}</span>,
}));

vi.mock('./AssetSelectionList', () => ({
  AssetSelectionList: ({ assets }: { assets: unknown[] }) => (
    <div data-testid="selection-list">{assets.length} items</div>
  ),
}));

vi.mock('./CreateAssetPrompt', () => ({
  CreateAssetPrompt: () => <div data-testid="create-prompt">Create prompt</div>,
}));

vi.mock('../../../app/copy/system', () => ({
  appCopy: {
    ui: {
      workspace: {
        assetPanel: {
          groupRequiredLabel: 'Required',
          groupOptionalLabel: 'Optional',
          groupMissingRequired: 'Missing (Required)',
          groupMissingOptional: 'Missing (Optional)',
          selectedCount: 'selected',
          generateMoreAction: 'Generate More',
          createAssetAction: 'Create',
          staleLabel: 'Stale',
          selectAll: 'Select All',
          deselectAll: 'Deselect All',
          collapseGroup: 'Collapse group',
          expandGroup: 'Expand group',
        },
      },
    },
  },
}));

const baseProps = {
  assetType: 'angle',
  label: 'Angle',
  requiredness: 'optional-by-tool-setting' as const,
  assets: [
    { id: 'a1', assetType: 'angle', label: 'Angle 1', qualityScore: 100, status: 'active', staleUpstream: false },
    { id: 'a2', assetType: 'angle', label: 'Angle 2', qualityScore: 80, status: 'active', staleUpstream: true },
  ],
  isExpanded: true,
  selectedAssetIds: [],
  onToggleExpanded: vi.fn(),
  onAssetToggle: vi.fn(),
  onCreateAction: vi.fn(),
};

describe('AssetGroupSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders select mode with selection list', () => {
    render(
      <MemoryRouter>
        <AssetGroupSection {...baseProps} mode="select" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Angle (2)')).toBeInTheDocument();
    expect(screen.getByTestId('selection-list')).toBeInTheDocument();
    expect(screen.getByText('Select All')).toBeInTheDocument();
  });

  it('renders browse mode without selection controls', () => {
    render(
      <MemoryRouter>
        <AssetGroupSection {...baseProps} mode="browse" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Angle (2)')).toBeInTheDocument();
    expect(screen.queryByTestId('selection-list')).not.toBeInTheDocument();
    expect(screen.queryByText('Select All')).not.toBeInTheDocument();
  });

  it('browse mode shows asset labels and quality badges', () => {
    render(
      <MemoryRouter>
        <AssetGroupSection {...baseProps} mode="browse" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Angle 1')).toBeInTheDocument();
    expect(screen.getByText('Angle 2')).toBeInTheDocument();
    // Header badge + 2 browse-item badges = 3 total
    const badges = screen.getAllByTestId('quality-badge');
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it('browse mode shows stale indicator', () => {
    render(
      <MemoryRouter>
        <AssetGroupSection {...baseProps} mode="browse" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Stale')).toBeInTheDocument();
  });

  it('defaults to select mode when mode prop is omitted', () => {
    render(
      <MemoryRouter>
        <AssetGroupSection {...baseProps} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('selection-list')).toBeInTheDocument();
    expect(screen.getByText('Select All')).toBeInTheDocument();
  });

  it('shows create prompt when no assets', () => {
    render(
      <MemoryRouter>
        <AssetGroupSection {...baseProps} assets={[]} mode="browse" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('create-prompt')).toBeInTheDocument();
  });

  it('toggle expanded fires onToggleExpanded', () => {
    const onToggle = vi.fn();
    render(
      <MemoryRouter>
        <AssetGroupSection {...baseProps} isExpanded={false} onToggleExpanded={onToggle} mode="browse" />
      </MemoryRouter>,
    );

    // Click the expand button icon
    fireEvent.click(screen.getByRole('button', { name: /expand group/i }));
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
