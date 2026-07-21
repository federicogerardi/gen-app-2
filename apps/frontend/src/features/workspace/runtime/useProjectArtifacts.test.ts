import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProjectArtifacts } from './useProjectArtifacts';

const mockListArtifacts = vi.fn();

vi.mock('../../artifacts/runtime/artifacts-client', () => ({
  listArtifacts: (...args: unknown[]) => mockListArtifacts(...args),
}));

describe('useProjectArtifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns loading state initially', () => {
    mockListArtifacts.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useProjectArtifacts('proj-1'));
    expect(result.current.loading).toBe(true);
    expect(result.current.artifacts).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('returns artifacts on success', async () => {
    const fakeArtifacts = [
      { artifactId: 'art-1', content: 'Hello world', toolKey: 'angle-generator', updatedAt: new Date().toISOString() },
      { artifactId: 'art-2', content: 'Test content', toolKey: 'funnel-pages', updatedAt: new Date().toISOString() },
    ];
    mockListArtifacts.mockResolvedValue({ artifacts: fakeArtifacts, totalResults: 2 });

    const { result } = renderHook(() => useProjectArtifacts('proj-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.artifacts).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it('returns error on failure', async () => {
    mockListArtifacts.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useProjectArtifacts('proj-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Network error');
    expect(result.current.artifacts).toEqual([]);
  });

  it('returns empty array when no artifacts', async () => {
    mockListArtifacts.mockResolvedValue({ artifacts: [], totalResults: 0 });

    const { result } = renderHook(() => useProjectArtifacts('proj-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.artifacts).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('calls listArtifacts with correct filters', async () => {
    mockListArtifacts.mockResolvedValue({ artifacts: [], totalResults: 0 });

    renderHook(() => useProjectArtifacts('proj-1'));

    await waitFor(() => expect(mockListArtifacts).toHaveBeenCalled());
    expect(mockListArtifacts).toHaveBeenCalledWith({
      projectId: 'proj-1',
      status: 'completed',
      type: 'all',
      limit: 5,
    });
  });

  it('refetches when refetch is called', async () => {
    mockListArtifacts.mockResolvedValue({ artifacts: [], totalResults: 0 });

    const { result } = renderHook(() => useProjectArtifacts('proj-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockListArtifacts.mockResolvedValue({
      artifacts: [{ artifactId: 'art-new', content: 'New', toolKey: 'angle-generator', updatedAt: new Date().toISOString() }],
      totalResults: 1,
    });

    result.current.refetch();
    await waitFor(() => expect(result.current.artifacts).toHaveLength(1));
  });
});
