import { useEffect, useState } from 'react';
import { Button } from '@mui/material';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import {
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
  Surface,
  TopBar,
  uiPrimitives,
} from '../../../app/ui/primitives';
import {
  getSessionArtifacts,
  type SessionArtifactGroup,
} from '../../tools/runtime/session-client';
import { SessionArtifactTabs } from '../../generation/ui/SessionArtifactTabs';
import { asSupportedTool } from '../runtime/session-summary-domain';

const formatToolName = (toolKey: string | null): string => {
  if (toolKey === 'funnel-pages') return appCopy.ui.navigation.funnelPages;
  if (toolKey === 'nextland') return appCopy.ui.navigation.nextland;
  if (toolKey === 'youtube-lf-script') return appCopy.ui.navigation.youtubeLfScript;
  return toolKey ?? 'Tool non disponibile';
};

type PageState =
  | { phase: 'loading' }
  | { phase: 'session'; group: SessionArtifactGroup }
  | { phase: 'error'; message: string }
  | { phase: 'not-found' };

export const SessionSummaryDetailPage = () => {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const auth = useAuthSession();
  const projectsQuery = useProjectsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    enabled: sessionId.length > 0,
  });
  const [pageState, setPageState] = useState<PageState>({ phase: 'loading' });

  useEffect(() => {
    if (!sessionId) {
      setPageState({ phase: 'not-found' });
      return;
    }

    let cancelled = false;
    setPageState({ phase: 'loading' });

    void (async () => {
      try {
        const group = await getSessionArtifacts(sessionId, {
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: auth.capabilities,
        });
        if (!cancelled) {
          setPageState({ phase: 'session', group });
        }
      } catch (sessionError) {
        if (cancelled) {
          return;
        }
        const message = sessionError instanceof Error ? sessionError.message : '';
        if (message === 'Unauthorized session access') {
          navigate('/');
          return;
        }
        if (message === 'Session not found') {
          setPageState({ phase: 'not-found' });
          return;
        }
        setPageState({ phase: 'error', message: message || 'Unable to load session' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, auth.apiBaseUrl, auth.capabilities, navigate]);

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
        <Link to="/sessionsummary" className={uiPrimitives.inlineLink}>
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
        <Link to="/sessionsummary" className={uiPrimitives.inlineLink}>
          {appCopy.ui.actions.openSessionArchive}
        </Link>
      </Surface>
    );
  }

  const group = pageState.group;
  const effectiveToolKey = asSupportedTool(group.toolKey);
  const projectId = group.artifacts[0]?.projectId ?? null;
  const projectName = projectId
    ? projectsQuery.data.find((project) => project.id === projectId)?.name ?? `Project ${projectId}`
    : 'Project non disponibile';
  const detailTitle = `${projectName} - ${formatToolName(group.toolKey)}`;

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{detailTitle}</h2>
        <Link to="/sessionsummary" className={uiPrimitives.inlineLink}>
          {appCopy.ui.actions.openSessionArchive}
        </Link>
      </TopBar>

      <div className="ui-artifact-page-layout">
        <section className="ui-artifact-primary-panel" aria-label="Preview contenuto sessione">
          <SessionArtifactTabs group={group} fallbackToolKey={effectiveToolKey} />
        </section>

        <aside className="ui-artifact-secondary-panel" aria-label="Contesto sessione">
          <section className="ui-artifact-overview" aria-label="Panoramica sessione">
            <div className="ui-artifact-overview-main">
              <div className="ui-artifact-overview-heading-row">
                <h3 className="ui-artifact-overview-title">{detailTitle}</h3>
                <span className={`ui-runtime-badge ui-artifact-status-tag is-${group.status}`}>{group.status}</span>
              </div>
              <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.sessionId, group.sessionId)}</p>
              <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.status, group.status)}</p>
            </div>

            <div className="ui-artifact-overview-actions">
              <Button component={Link} to="/sessionsummary" variant="contained">
                {appCopy.ui.actions.openSessionArchive}
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </Surface>
  );
};
