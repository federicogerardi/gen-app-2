import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CrossToolWorkflowPanel } from './CrossToolWorkflowPanel';

vi.mock('../runtime/useWorkspaceContext', () => ({
  useWorkspaceContext: vi.fn(),
}));

vi.mock('../runtime/useToolRecommendations', () => ({
  useToolRecommendations: vi.fn(() => []),
}));

vi.mock('../../tools/runtime/tool-form-architecture', () => ({
  getToolLabel: (key: string) => {
    const labels: Record<string, string> = {
      geometric: 'Geometric',
      'angle-generator': 'Angle Generator',
      'meta-ads': 'MetaAds Generator',
      'funnel-pages': 'Hotlead Funnel',
      nextland: 'Nextland',
      'youtube-lf-script': 'YouTube LF Script',
      'youtube-description': 'YT Description Generator',
      'blog-article-generator': 'Blog Article Generator',
    };
    return labels[key] || key;
  },
}));

import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { useToolRecommendations } from '../runtime/useToolRecommendations';

const mockUseWorkspaceContext = vi.mocked(useWorkspaceContext);
const mockUseToolRecommendations = vi.mocked(useToolRecommendations);

describe('CrossToolWorkflowPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when loading', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy', gaps: [],
      overallQualityScore: 0, loading: true, error: null, refetch: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter><CrossToolWorkflowPanel workspaceId="w1" /></MemoryRouter>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when no workflowPosition', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy', gaps: [],
      overallQualityScore: 0, loading: false, error: null, refetch: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter><CrossToolWorkflowPanel workspaceId="w1" /></MemoryRouter>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders pipeline with all tools', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy',
      workflowPosition: { currentStep: '0 tools completed', totalSteps: 8, completedSteps: [], estimatedCompletion: 0 },
      gaps: [], overallQualityScore: 0, loading: false, error: null, refetch: vi.fn(),
    });
    mockUseToolRecommendations.mockReturnValue([]);

    render(
      <MemoryRouter><CrossToolWorkflowPanel workspaceId="w1" /></MemoryRouter>,
    );

    expect(screen.getByText('Cross-Tool Workflow')).toBeInTheDocument();
    expect(screen.getByText('Geometric')).toBeInTheDocument();
    expect(screen.getByText('Angle Generator')).toBeInTheDocument();
    expect(screen.getByText('MetaAds Generator')).toBeInTheDocument();
  });

  it('highlights current tool', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy',
      workflowPosition: { currentStep: '0 tools completed', totalSteps: 8, completedSteps: [], estimatedCompletion: 0 },
      gaps: [], overallQualityScore: 0, loading: false, error: null, refetch: vi.fn(),
    });
    mockUseToolRecommendations.mockReturnValue([]);

    render(
      <MemoryRouter><CrossToolWorkflowPanel workspaceId="w1" currentToolKey="meta-ads" /></MemoryRouter>,
    );

    const metaAdsLink = screen.getByText('MetaAds Generator').closest('a');
    expect(metaAdsLink?.className).toContain('current');
  });

  it('shows suggested next tools', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1', assets: [], qualityGateStatus: 'healthy',
      workflowPosition: { currentStep: '0 tools completed', totalSteps: 8, completedSteps: [], estimatedCompletion: 0 },
      gaps: [], overallQualityScore: 0, loading: false, error: null, refetch: vi.fn(),
    });
    mockUseToolRecommendations.mockReturnValue([
      { toolKey: 'angle-generator', label: 'Angle Generator', description: '', to: '', readinessScore: 100, impactScore: 30, priorityScore: 80, reason: '', missingAssets: [], fillableGaps: [] },
    ]);

    render(
      <MemoryRouter><CrossToolWorkflowPanel workspaceId="w1" /></MemoryRouter>,
    );

    expect(screen.getByText(/Suggested next: Angle Generator/)).toBeInTheDocument();
  });
});
