import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import {
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
  Surface,
  TopBar,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { StatusBadge } from '../../../app/ui/StatusBadge';
import type { SessionArtifactGroup } from '../../tools/runtime/session-client';
import { SessionArtifactTabs } from '../../generation/ui/SessionArtifactTabs';
import { asSupportedTool } from '../../sessionsummary/runtime/session-summary-domain';
import { type DownloadFormat } from '../../artifacts/runtime/download-client';
import { DownloadFormatDropdown } from '../../artifacts/ui/DownloadFormatDropdown';
import { getToolLabel } from '../../tools/runtime/tool-form-architecture';
import {
  getAdminSessionArtifacts,
  downloadAdminSession,
} from '../runtime/admin-session-client';

const formatToolName = (toolKey: string | null): string => getToolLabel(toolKey);

const toHumanReadableDate = (isoLike: string): string => {
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) {
    return isoLike;
  }

  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

type PageState =
  | { phase: 'loading' }
  | { phase: 'session'; group: SessionArtifactGroup & { userId?: string | null; userEmail?: string | null } }
  | { phase: 'error'; message: string }
  | { phase: 'not-found' };

export const AdminSessionDetailPage = () => {
  const { sessionId = '' } = useParams();
  const { apiBaseUrl, capabilities } = useApiConfig();
  const sessionsBackPath = '/admin/sessions';
  const projectsQuery = useProjectsQuery({
    apiBaseUrl,
    capabilities,
    enabled: sessionId.length > 0,
  });
  const [pageState, setPageState] = useState<PageState>({ phase: 'loading' });

  const handleSessionDownload = useCallback(
    (format: DownloadFormat) => {
      if (pageState.phase !== 'session') return;

      void downloadAdminSession(
        pageState.group.sessionId,
        format,
        { apiBaseUrl },
      ).catch((err: unknown) => {
        if (import.meta.env.DEV) {
          console.error('[admin-session-download] failed', err);
        }
      });
    },
    [pageState, apiBaseUrl],
  );

  useEffect(() => {
    if (!sessionId) {
      setPageState({ phase: 'not-found' });
      return;
    }

    let cancelled = false;
    setPageState({ phase: 'loading' });

    void (async () => {
      try {
        const group = await getAdminSessionArtifacts(sessionId, {
          apiBaseUrl,
        });
        if (!cancelled) {
          setPageState({ phase: 'session', group });
        }
      } catch (sessionError) {
        if (cancelled) {
          return;
        }
        const message = sessionError instanceof Error ? sessionError.message : '';
        if (message === 'Session not found') {
          setPageState({ phase: 'not-found' });
          return;
        }
        setPageState({ phase: 'error', message: message || appCopy.ui.sessions.detail.loadFailed });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, apiBaseUrl]);

  if (pageState.phase === 'loading') {
    return (
      <Surface as="section" className={uiPrimitives.stack}>
        <h2>{appCopy.editorial.sessions.detailTitle}</h2>
        <LoadingStateMessage>{appCopy.editorial.sessions.loadingState}</LoadingStateMessage>
      </Surface>
    );
  }

  if (pageState.phase === 'not-found') {
    return (
      <Surface as="section" className={uiPrimitives.stack}>
        <h2>{appCopy.editorial.sessions.detailTitle}</h2>
        <EmptyStateMessage>{appCopy.editorial.sessions.notFound}</EmptyStateMessage>
        <Link to={sessionsBackPath} className={uiPrimitives.inlineLink}>
          {appCopy.ui.actions.openSessionArchive}
        </Link>
      </Surface>
    );
  }

  if (pageState.phase === 'error') {
    return (
      <Surface as="section" className={uiPrimitives.stack}>
        <h2>{appCopy.editorial.sessions.detailTitle}</h2>
        <ErrorStateMessage>{pageState.message}</ErrorStateMessage>
        <Link to={sessionsBackPath} className={uiPrimitives.inlineLink}>
          {appCopy.ui.actions.openSessionArchive}
        </Link>
      </Surface>
    );
  }

  const group = pageState.group;
  const effectiveToolKey = asSupportedTool(group.toolKey);
  const projectId = group.artifacts[0]?.projectId ?? null;
  const artifactTimestamps = group.artifacts
    .map((artifact) => Date.parse(artifact.updatedAt))
    .filter((timestamp) => !Number.isNaN(timestamp));
  const jobDate = artifactTimestamps.length > 0 ? new Date(Math.min(...artifactTimestamps)) : null;
  const lastUpdate = artifactTimestamps.length > 0 ? new Date(Math.max(...artifactTimestamps)) : null;
  const projectName = projectId
    ? projectsQuery.data.find((project) => project.id === projectId)?.name ?? `${appCopy.ui.sessions.detail.projectFallbackPrefix}${projectId}`
    : appCopy.ui.sessions.detail.projectFallback;
  const detailTitle = `${projectName} - ${formatToolName(group.toolKey)}`;
  const userEmail = (group as any).userEmail ?? null;

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <div className="ui-session-summary-topbar-main">
          <h2>{detailTitle}</h2>
          <StatusBadge status={group.status} />
        </div>
        <Link to={sessionsBackPath} className={uiPrimitives.inlineLink}>
          {appCopy.ui.actions.openSessionArchive}
        </Link>
      </TopBar>

      <div className="ui-artifact-page-layout">
        <section className="ui-artifact-primary-panel" aria-label={appCopy.ui.sessions.detail.primaryPanelAriaLabel}>
          <SessionArtifactTabs group={group} fallbackToolKey={effectiveToolKey} />
        </section>

        <aside className="ui-artifact-secondary-panel" aria-label={appCopy.ui.sessions.detail.secondaryPanelAriaLabel}>
          <section className="ui-artifact-overview" aria-label={appCopy.ui.sessions.detail.overviewAriaLabel}>
            <div className="ui-artifact-overview-actions">
              {capabilities.sessionDownload ? (
                <DownloadFormatDropdown onDownload={handleSessionDownload} />
              ) : null}
            </div>

            <details className="ui-artifact-accessory">
              <summary>{appCopy.ui.sessions.detail.detailsSummaryLabel}</summary>
              <dl className="ui-artifact-metadata ui-session-summary-details">
                <dt>{appCopy.ui.labels.user}</dt>
                <dd>{userEmail ?? appCopy.ui.states.userUnavailable}</dd>
                <dt>{appCopy.ui.labels.projectName}</dt>
                <dd>{projectName}</dd>
                <dt>{appCopy.ui.labels.toolKey}</dt>
                <dd>{formatToolName(group.toolKey)}</dd>
                <dt>{appCopy.ui.meta.jobDate}</dt>
                <dd>{jobDate ? toHumanReadableDate(jobDate.toISOString()) : appCopy.ui.feedbackCenter.unavailableDate}</dd>
                <dt>{appCopy.ui.meta.lastUpdate}</dt>
                <dd>{lastUpdate ? toHumanReadableDate(lastUpdate.toISOString()) : appCopy.ui.feedbackCenter.unavailableDate}</dd>
                <dt>{appCopy.ui.meta.artifactCount}</dt>
                <dd>{group.artifacts.length}</dd>
              </dl>
            </details>
          </section>
        </aside>
      </div>
    </Surface>
  );
};
