import { Link } from 'react-router-dom';
import { FileText, Mic, Users, AlertTriangle, CheckCircle, Archive, RefreshCw } from 'lucide-react';
import { useMemo, useCallback } from 'react';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useSessionsQuery } from '../../../app/runtime/queries/useSessionsQuery';
import { getToolLabel } from '../../tools/runtime/tool-form-architecture';
import { updateProject } from '../../projects/runtime/projects-client';
import { useFeedbackMessage } from '../../../app/providers/FeedbackMessageProvider';
import { formatRelativeTime } from '../../../app/ui/format-utils';
import { appCopy } from '../../../app/copy/system';
import { ErrorStateMessage } from '../../../app/ui/primitives';
import type { ProjectSummary } from '../../projects/runtime/projects-client';
import type { FoundationToolStatus } from '../runtime/useWorkspaceContext';

import './dashboard/dashboard-panels.css';

interface WorkspaceHubCardProps {
  project: ProjectSummary;
  onStatusChange: () => void;
}

const FOUNDATION_TOOL_LABELS: Record<string, string> = {
  'brief-generator': appCopy.ui.workspace.dashboard.foundationLabelBrief,
  'tov-generator': appCopy.ui.workspace.dashboard.foundationLabelBrandVoice,
  'personas-generator': appCopy.ui.workspace.dashboard.foundationLabelPersonas,
};

const FOUNDATION_TOOL_ICONS: Record<string, React.ReactNode> = {
  'brief-generator': <FileText size={16} />,
  'tov-generator': <Mic size={16} />,
  'personas-generator': <Users size={16} />,
};

const renderFoundationItem = (
  tool: FoundationToolStatus,
) => {
  const label = FOUNDATION_TOOL_LABELS[tool.toolKey] ?? tool.toolKey;
  const icon = FOUNDATION_TOOL_ICONS[tool.toolKey] ?? <FileText size={16} />;
  const count = tool.existingAssets.length;
  const copy = appCopy.ui.workspace.dashboard;

  return (
    <div key={tool.toolKey} className="foundation-status__item">
      <span className="foundation-status__icon">{icon}</span>
      <span className="foundation-status__label">{label}</span>
      {tool.hasAssets ? (
        <span className="foundation-status__indicator foundation-status__indicator--present">
          <CheckCircle size={14} />
          <span>{copy.foundationStatusPresent(count)}</span>
        </span>
      ) : (
        <span className="foundation-status__indicator foundation-status__indicator--missing">
          <AlertTriangle size={14} />
          <span>{copy.foundationStatusMissing}</span>
        </span>
      )}
    </div>
  );
};

export const WorkspaceHubCard: React.FC<WorkspaceHubCardProps> = ({ project, onStatusChange }) => {
  const ctx = useWorkspaceContext(project.id);
  const { apiBaseUrl, capabilities } = useApiConfig();
  const { publishSuccess, publishError } = useFeedbackMessage();
  const isArchived = project.status === 'archived';

  // Fetch recent sessions for activity hint
  const { data: sessions, loading: sessionsLoading } = useSessionsQuery({
    projectId: project.id,
    apiBaseUrl,
    capabilities,
  });

  const lastSession = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    // Sort by updatedAt descending and take the most recent
    const sorted = [...sessions].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return sorted[0] ?? null;
  }, [sessions]);

  const handleToggleStatus = useCallback(async () => {
    const newStatus = isArchived ? 'active' : 'archived';
    try {
      await updateProject(project.id, { status: newStatus });
      onStatusChange();
      publishSuccess(isArchived ? appCopy.ui.workspace.contextHeader.reactivateSuccess : appCopy.ui.workspace.contextHeader.archiveSuccess);
    } catch (err) {
      publishError(err instanceof Error ? err.message : appCopy.ui.workspace.contextHeader.archiveFailed);
    }
  }, [project.id, isArchived, onStatusChange, publishSuccess, publishError]);

  const copy = appCopy.ui.workspace.dashboard;

  // Compute stats
  const staleCount = ctx.assets.filter(a => a.staleUpstream).length;
  const assetTypesWithAssets = Object.keys(ctx.groupedByType)
    .filter(k => (ctx.groupedByType[k]?.length ?? 0) > 0).length;

  if (ctx.error) {
    return (
      <div className="workspace-hub-card">
        <div className="workspace-hub-card__header">
          <div className="workspace-hub-card__name-row">
            <span className="workspace-hub-card__name">{project.name}</span>
            {isArchived && (
              <span className="workspace-hub-card__archived-badge">{appCopy.ui.workspace.contextHeader.archivedBadge}</span>
            )}
          </div>
        </div>
        <div className="workspace-hub-card__stats">
          <ErrorStateMessage>{appCopy.ui.workspace.contextHeader.unableToLoadData}</ErrorStateMessage>
        </div>
        <div className="workspace-hub-card__actions">
          <Link to={`/workspaces/${project.id}`} className="ui-button">
            {appCopy.ui.actions.enterWorkspace}
          </Link>
          <button
            type="button"
            className="workspace-hub-card__menu-btn"
            onClick={handleToggleStatus}
            aria-label={isArchived ? appCopy.ui.workspace.contextHeader.reactivateAriaLabel : appCopy.ui.workspace.contextHeader.archiveAriaLabel}
          >
            {isArchived ? <RefreshCw size={16} /> : <Archive size={16} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`workspace-hub-card${ctx.loading ? ' workspace-hub-card--loading' : ''}`}>
      {/* Header: name + archived badge + description */}
      <div className="workspace-hub-card__header">
        <div className="workspace-hub-card__name-row">
          <span className="workspace-hub-card__name">{project.name}</span>
          {isArchived && (
              <span className="workspace-hub-card__archived-badge">{appCopy.ui.workspace.contextHeader.archivedBadge}</span>
            )}
        </div>
        {project.description && (
          <p className="workspace-hub-card__description">{project.description}</p>
        )}
      </div>

      <hr className="workspace-hub-card__divider" />

      {/* Foundation section: Brief + Brand Voice status */}
      <div className="workspace-hub-card__foundation">
        <div className="workspace-hub-card__foundation-label">
          {copy.workspaceOverviewFoundationLabel}
        </div>
        <div className="workspace-hub-card__foundation-row">
          {ctx.foundationTools.map(tool => renderFoundationItem(tool))}
        </div>
      </div>

      <hr className="workspace-hub-card__divider" />

      {/* Stats row */}
      <div className="workspace-hub-card__stats">
        {ctx.assets.length > 0 ? (
          <>
            <span className="workspace-hub-card__stat">
              {copy.workspaceOverviewStatsAssets(ctx.assets.length)}
            </span>
            <span className="workspace-hub-card__stat-sep">&middot;</span>
            <span className="workspace-hub-card__stat">
              {copy.workspaceOverviewStatsTypes(assetTypesWithAssets)}
            </span>
            {staleCount > 0 && (
              <>
                <span className="workspace-hub-card__stat-sep">&middot;</span>
                <span className="workspace-hub-card__stat workspace-hub-card__stat--warning">
                  {copy.workspaceOverviewStatsStale(staleCount)}
                </span>
              </>
            )}
            {ctx.overallQualityScore > 0 && (
              <>
                <span className="workspace-hub-card__stat-sep">&middot;</span>
                <span className="workspace-hub-card__stat">
                  {copy.workspaceOverviewQuality(ctx.overallQualityScore)}
                </span>
              </>
            )}
          </>
        ) : (
          <span className="workspace-hub-card__stat">
            {copy.workspaceOverviewStatsNone}
          </span>
        )}
      </div>

      <hr className="workspace-hub-card__divider" />

      {/* Activity hint: most recent session */}
      <div className="workspace-hub-card__activity">
        <span className="workspace-hub-card__activity-label">{copy.lastActivity}</span>
        {sessionsLoading ? (
          <span className="workspace-hub-card__activity-detail">{copy.loadingGeneric}</span>
        ) : lastSession ? (
          <span className="workspace-hub-card__activity-detail">
            {getToolLabel(lastSession.toolKey)}
            &nbsp;&middot;&nbsp;
            {formatRelativeTime(lastSession.updatedAt)}
            &nbsp;&middot;&nbsp;
            {copy.artifactCountLabel(lastSession.artifactCount)}
          </span>
        ) : (
          <span className="workspace-hub-card__activity-none">{copy.noSessionsYet}</span>
        )}
      </div>

      <hr className="workspace-hub-card__divider" />

      {/* Actions: Enter workspace + Archive/Reactivate */}
      <div className="workspace-hub-card__actions">
        <Link to={`/workspaces/${project.id}`} className="ui-button">
          {appCopy.ui.actions.enterWorkspace}
        </Link>
        <button
          type="button"
          className="workspace-hub-card__menu-btn"
          onClick={handleToggleStatus}
          aria-label={isArchived ? appCopy.ui.workspace.contextHeader.reactivateAriaLabel : appCopy.ui.workspace.contextHeader.archiveAriaLabel}
        >
          {isArchived ? <RefreshCw size={16} /> : <Archive size={16} />}
        </button>
      </div>
    </div>
  );
};
