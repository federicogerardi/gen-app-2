import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useToolRecommendations } from './useToolRecommendations';

vi.mock('./useWorkspaceContext', () => ({
  useWorkspaceContext: vi.fn(),
}));

vi.mock('../../tools/runtime/tool-form-architecture', () => ({
  getEnabledToolNavigationItems: vi.fn(() => [
    { toolKey: 'funnel-pages', to: '/w/1/tools/funnel-pages', label: 'Hotlead Funnel', description: 'Create funnel' },
    { toolKey: 'angle-generator', to: '/w/1/tools/angle-generator', label: 'Angle Generator', description: 'Generate angles' },
    { toolKey: 'meta-ads', to: '/w/1/tools/meta-ads', label: 'MetaAds', description: 'Create ads' },
    { toolKey: 'geometric', to: '/w/1/tools/geometric', label: 'Geometric', description: 'Competitor analysis' },
  ]),
}));

import { useWorkspaceContext } from './useWorkspaceContext';

const mockUseWorkspaceContext = vi.mocked(useWorkspaceContext);

describe('useToolRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when workspaceId is missing', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: '',
      assets: [],
      qualityGateStatus: 'healthy',
      gaps: [],
      overallQualityScore: 0,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    const { result } = renderHook(() => useToolRecommendations(undefined));
    expect(result.current).toEqual([]);
  });

  it('returns empty array when loading', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1',
      assets: [],
      qualityGateStatus: 'healthy',
      workflowPosition: { currentStep: '0 tools completed', totalSteps: 8, completedSteps: [], estimatedCompletion: 0 },
      gaps: [],
      overallQualityScore: 0,
      loading: true,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    const { result } = renderHook(() => useToolRecommendations('w1'));
    expect(result.current).toEqual([]);
  });

  it('ranks tools by readiness when inputs are available', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1',
      assets: [
        { id: 'a1', assetType: 'persona', label: 'P1', qualityScore: 100, status: 'active', staleUpstream: false },
        { id: 'a2', assetType: 'brand-voice', label: 'BV1', qualityScore: 100, status: 'active', staleUpstream: false },
      ],
      qualityGateStatus: 'healthy',
      workflowPosition: { currentStep: '0 tools completed', totalSteps: 8, completedSteps: [], estimatedCompletion: 0 },
      gaps: [],
      overallQualityScore: 100,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    const { result } = renderHook(() => useToolRecommendations('w1'));
    expect(result.current.length).toBeGreaterThan(0);
    // funnel-pages consumes persona + brand-voice, both available → high readiness
    const funnelRec = result.current.find(r => r.toolKey === 'funnel-pages');
    expect(funnelRec).toBeDefined();
    expect(funnelRec!.readinessScore).toBe(100);
  });

  it('excludes completed tools', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1',
      assets: [],
      qualityGateStatus: 'healthy',
      workflowPosition: {
        currentStep: '1 tool completed',
        totalSteps: 8,
        completedSteps: ['geometric'],
        estimatedCompletion: 12,
      },
      gaps: [],
      overallQualityScore: 0,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    const { result } = renderHook(() => useToolRecommendations('w1'));
    expect(result.current.find(r => r.toolKey === 'geometric')).toBeUndefined();
  });

  it('limits results to specified limit', () => {
    mockUseWorkspaceContext.mockReturnValue({
      id: 'w1',
      assets: [],
      qualityGateStatus: 'healthy',
      workflowPosition: { currentStep: '0 tools completed', totalSteps: 8, completedSteps: [], estimatedCompletion: 0 },
      gaps: [],
      overallQualityScore: 0,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useWorkspaceContext>);

    const { result } = renderHook(() => useToolRecommendations('w1', 'member', 2));
    expect(result.current.length).toBeLessThanOrEqual(2);
  });
});
