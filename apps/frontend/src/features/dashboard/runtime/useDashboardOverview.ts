import { useMemo } from 'react';
import { type ToolKey } from '@gen-app-2/contracts';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { useSessionsQuery } from '../../../app/runtime/queries/useSessionsQuery';
import { useWorkspaceContext, type FoundationToolStatus } from '../../workspace/runtime/useWorkspaceContext';
import { useToolRecommendations, type ToolRecommendation } from '../../workspace/runtime/useToolRecommendations';
import { getToolLabel } from '../../tools/runtime/tool-form-architecture';
import type { SessionSummary } from '../../tools/runtime/session-client';
import { appCopy } from '../../../app/copy/system';

const MAX_SCANNED_WORKSPACES = 5;
const MAX_RECOMMENDATIONS = 5;
const MAX_RECENT_SESSIONS = 5;

const FOUNDATION_TOOL_LABELS: Record<string, string> = {
  'brief-generator': appCopy.ui.workspace.dashboard.foundationLabelBrief,
  'tov-generator': appCopy.ui.workspace.dashboard.foundationLabelBrandVoice,
  'personas-generator': appCopy.ui.workspace.dashboard.foundationLabelPersonas,
};

// UI-layer derivation, non-canonical — pattern per useWorkspaceContext.ts "Foundation Tool" comment
export interface WorkspaceToolRecommendation extends ToolRecommendation {
  workspaceId: string;
  workspaceName: string;
}

export interface DashboardOverviewData {
  loading: boolean;
  error: string | null;
  resumeCandidate: {
    workspaceId: string;
    workspaceName: string;
    toolKey: string;
    toolLabel: string;
    sessionId: string;
  } | null;
  foundationSummary: {
    toolKey: string;
    label: string;
    workspacesWithAsset: number;
    totalWorkspaces: number;
  }[];
  recommendations: WorkspaceToolRecommendation[];
  recentSessions: SessionSummary[];
  activeWorkspaces: {
    id: string;
    name: string;
    qualityGateStatus: 'healthy' | 'needs-attention' | 'blocked';
  }[];
  mostGappedWorkspaceId: string | null;
}

const FOUNDATION_TOOL_KEYS: ToolKey[] = ['brief-generator', 'tov-generator', 'personas-generator'];

export const useDashboardOverview = (): DashboardOverviewData => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const projectsQuery = useProjectsQuery({ apiBaseUrl, capabilities });
  const sessionsQuery = useSessionsQuery({ apiBaseUrl, capabilities });

  // Top K=5 active workspace IDs sorted by updatedAt desc
  const topWorkspaceIds = useMemo(() => {
    if (!projectsQuery.data) return [];
    return projectsQuery.data
      .filter(p => p.status !== 'archived')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, MAX_SCANNED_WORKSPACES)
      .map(p => p.id);
  }, [projectsQuery.data]);

  // Fixed 5-slot hook invocations (Rules of Hooks: no dynamic hook calls)
  const ws0 = useWorkspaceContext(topWorkspaceIds[0] ?? '');
  const ws1 = useWorkspaceContext(topWorkspaceIds[1] ?? '');
  const ws2 = useWorkspaceContext(topWorkspaceIds[2] ?? '');
  const ws3 = useWorkspaceContext(topWorkspaceIds[3] ?? '');
  const ws4 = useWorkspaceContext(topWorkspaceIds[4] ?? '');
  const workspaceContexts = [ws0, ws1, ws2, ws3, ws4];

  // Fixed 5-slot tool recommendation hooks
  const rec0 = useToolRecommendations(topWorkspaceIds[0] ?? '', 'member', 3);
  const rec1 = useToolRecommendations(topWorkspaceIds[1] ?? '', 'member', 3);
  const rec2 = useToolRecommendations(topWorkspaceIds[2] ?? '', 'member', 3);
  const rec3 = useToolRecommendations(topWorkspaceIds[3] ?? '', 'member', 3);
  const rec4 = useToolRecommendations(topWorkspaceIds[4] ?? '', 'member', 3);
  const recommendationSets = [rec0, rec1, rec2, rec3, rec4];

  // Project name map
  const projectNameById = useMemo(() => {
    return new Map((projectsQuery.data ?? []).map(p => [p.id, p.name]));
  }, [projectsQuery.data]);

  // Resume candidate: most recent session across all workspaces
  const resumeCandidate = useMemo(() => {
    const sessions = sessionsQuery.data ?? [];
    if (sessions.length === 0) return null;
    const sorted = [...sessions].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    const latest = sorted[0];
    if (!latest) return null;
    const project = projectsQuery.data?.find(p => p.id === latest.projectId);
    if (!project) return null;
    return {
      workspaceId: project.id,
      workspaceName: project.name,
      toolKey: latest.toolKey ?? '',
      toolLabel: getToolLabel(latest.toolKey),
      sessionId: latest.sessionId,
    };
  }, [sessionsQuery.data, projectsQuery.data]);

  // Foundation summary: aggregate across scanned workspaces
  const foundationSummary = useMemo(() => {
    const totalWorkspaces = topWorkspaceIds.length;
    return FOUNDATION_TOOL_KEYS.map(toolKey => {
      let workspacesWithAsset = 0;
      for (let i = 0; i < topWorkspaceIds.length; i++) {
        const ctx = workspaceContexts[i];
        if (!ctx || ctx.loading) continue;
        const found = ctx.foundationTools.find((f: FoundationToolStatus) => f.toolKey === toolKey);
        if (found?.hasAssets) workspacesWithAsset++;
      }
      return {
        toolKey,
        label: FOUNDATION_TOOL_LABELS[toolKey] ?? toolKey,
        workspacesWithAsset,
        totalWorkspaces,
      };
    });
  }, [topWorkspaceIds, workspaceContexts]);

  // Aggregated recommendations across all scanned workspaces
  const recommendations = useMemo(() => {
    const all: WorkspaceToolRecommendation[] = [];
    for (let i = 0; i < topWorkspaceIds.length; i++) {
      const wsId = topWorkspaceIds[i];
      if (!wsId) continue;
      const wsName = projectNameById.get(wsId) ?? wsId;
      const recs = recommendationSets[i];
      if (!recs) continue;
      for (const rec of recs) {
        all.push({
          ...rec,
          workspaceId: wsId,
          workspaceName: wsName,
        });
      }
    }
    return all
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, MAX_RECOMMENDATIONS);
  }, [topWorkspaceIds, recommendationSets, projectNameById]);

  // Recent sessions across all workspaces
  const recentSessions = useMemo(() => {
    return (sessionsQuery.data ?? [])
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, MAX_RECENT_SESSIONS);
  }, [sessionsQuery.data]);

  // Active workspaces with quality gate status
  const activeWorkspaces = useMemo(() => {
    return topWorkspaceIds.map((id, i) => {
      const ctx = workspaceContexts[i];
      return {
        id,
        name: projectNameById.get(id) ?? id,
        qualityGateStatus: ctx?.qualityGateStatus ?? 'healthy' as const,
      };
    });
  }, [topWorkspaceIds, workspaceContexts, projectNameById]);

  // Most gapped workspace (most Foundation gaps)
  const mostGappedWorkspaceId = useMemo(() => {
    let maxGaps = -1;
    let gappedId: string | null = null;
    for (let i = 0; i < topWorkspaceIds.length; i++) {
      const ctx = workspaceContexts[i];
      if (!ctx || ctx.loading) continue;
      const missingFoundation = FOUNDATION_TOOL_KEYS.filter(toolKey => {
        const found = ctx.foundationTools.find((f: FoundationToolStatus) => f.toolKey === toolKey);
        return !found?.hasAssets;
      });
      if (missingFoundation.length > maxGaps) {
        maxGaps = missingFoundation.length;
        gappedId = topWorkspaceIds[i] ?? null;
      }
    }
    return gappedId;
  }, [topWorkspaceIds, workspaceContexts]);

  // Aggregate loading/error
  const isLoading = projectsQuery.loading || sessionsQuery.loading;
  const error = projectsQuery.error || sessionsQuery.error || null;

  // Check if any scanned workspace is still loading
  const anyWorkspaceLoading = topWorkspaceIds.some((_, i) => workspaceContexts[i]?.loading);

  return {
    loading: isLoading || anyWorkspaceLoading,
    error,
    resumeCandidate,
    foundationSummary,
    recommendations,
    recentSessions,
    activeWorkspaces,
    mostGappedWorkspaceId,
  };
};
