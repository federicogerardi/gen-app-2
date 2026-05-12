import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useArtifactDetailQuery } from '../../../app/runtime/queries/useArtifactDetailQuery';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { SecondaryCtaButton } from '../../../app/ui/CtaButtons';
import {
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
  Surface,
  TopBar,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { buildToolEntryPathFromArtifact } from '../../generation/ui/artifact-history';
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

const resolveRelaunchSourceArtifactId = (group: SessionArtifactGroup): string | null => {
  const finalizedArtifacts = group.artifacts.filter((artifact) => artifact.artifactRole === 'final');
  const candidateArtifacts = finalizedArtifacts.length > 0 ? finalizedArtifacts : group.artifacts;

  const latestArtifact = [...candidateArtifacts].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  )[0];

  return latestArtifact?.artifactId ?? null;
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
  const generation = useGenerationWorkspace();
  const projectsQuery = useProjectsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    enabled: sessionId.length > 0,
  });
  const [pageState, setPageState] = useState<PageState>({ phase: 'loading' });
  const sessionGroup = pageState.phase === 'session' ? pageState.group : null;
  const relaunchSourceArtifactId = useMemo(
    () => (sessionGroup ? resolveRelaunchSourceArtifactId(sessionGroup) : null),
    [sessionGroup],
  );
  const relaunchArtifactQuery = useArtifactDetailQuery({
    artifactId: relaunchSourceArtifactId ?? '',
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    localArtifacts: generation.artifacts,
    enabled: sessionGroup !== null && relaunchSourceArtifactId !== null,
  });
  const relaunchPath = useMemo(
    () => (relaunchArtifactQuery.data ? buildToolEntryPathFromArtifact(relaunchArtifactQuery.data, 'regenerate') : null),
    [relaunchArtifactQuery.data],
  );
  const relaunchDisabled = generation.isStreamActive || relaunchArtifactQuery.loading || !relaunchPath;

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
              <SecondaryCtaButton component={Link} to={relaunchPath ?? '#'} disabled={relaunchDisabled}>
                Rilancia
              </SecondaryCtaButton>
            </div>
          </section>
        </aside>
      </div>
    </Surface>
  );
};
