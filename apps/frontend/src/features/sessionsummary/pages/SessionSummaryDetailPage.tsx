import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
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
import { StatusBadge } from '../../../app/ui/StatusBadge';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { buildToolEntryPathFromArtifact } from '../../generation/ui/artifact-history';
import {
  getSessionArtifacts,
  type SessionArtifactGroup,
} from '../../tools/runtime/session-client';
import { SessionArtifactTabs } from '../../generation/ui/SessionArtifactTabs';
import { getIncludedSteps } from '../../tools/runtime/tool-step-display-config';
import { asSupportedTool } from '../runtime/session-summary-domain';
import { downloadSessionFile, type DownloadFormat } from '../../artifacts/runtime/download-client';
import { DownloadFormatDropdown } from '../../artifacts/ui/DownloadFormatDropdown';
import { getToolLabel } from '../../tools/runtime/tool-form-architecture';

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

const resolveRelaunchSourceArtifactId = (group: SessionArtifactGroup): string | null => {
  const finalizedArtifacts = group.artifacts.filter((artifact) => artifact.artifactRole === 'final');
  const steppedArtifacts = group.artifacts.filter((artifact) => {
    const stepKey = artifact.stepKey?.trim();
    return typeof stepKey === 'string' && stepKey.length > 0;
  });
  const candidateArtifacts = finalizedArtifacts.length > 0
    ? finalizedArtifacts
    : steppedArtifacts.length > 0
      ? steppedArtifacts
      : group.artifacts;

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
  const { apiBaseUrl, capabilities } = useApiConfig();
  const generation = useGenerationWorkspace();
  const projectsQuery = useProjectsQuery({
    apiBaseUrl,
    capabilities,
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
    apiBaseUrl,
    capabilities,
    localArtifacts: generation.artifacts,
    enabled: sessionGroup !== null && relaunchSourceArtifactId !== null,
  });
  const relaunchPath = useMemo(
    () => (relaunchArtifactQuery.data ? buildToolEntryPathFromArtifact(relaunchArtifactQuery.data, 'regenerate') : null),
    [relaunchArtifactQuery.data],
  );
  const relaunchDisabled = generation.isStreamActive || relaunchArtifactQuery.loading || !relaunchPath;

  const handleSessionDownload = useCallback(
    (format: DownloadFormat) => {
      if (pageState.phase !== 'session') return;
      const toolKey = pageState.group.toolKey;
      const allSteps = pageState.group.artifacts.map((a) => a.stepKey).filter((s): s is string => s != null);
      const includedSteps = getIncludedSteps(toolKey);
      const excludedSteps = allSteps.filter(
        (step) => !(includedSteps as readonly string[]).includes(step),
      );

      void downloadSessionFile(pageState.group.sessionId, format, {
        apiBaseUrl,
        capabilities,
      }, excludedSteps.length > 0 ? { excludeSteps: excludedSteps } : undefined).catch((err: unknown) => {
        if (import.meta.env.DEV) {
          console.error('[session-download] failed', err);
        }
      });
    },
    [pageState, apiBaseUrl, capabilities],
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
        const group = await getSessionArtifacts(sessionId, {
          apiBaseUrl,
          capabilities,
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
        setPageState({ phase: 'error', message: message || appCopy.ui.sessions.detail.loadFailed });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, apiBaseUrl, capabilities, navigate]);

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
  const artifactTimestamps = group.artifacts
    .map((artifact) => Date.parse(artifact.updatedAt))
    .filter((timestamp) => !Number.isNaN(timestamp));
  const jobDate = artifactTimestamps.length > 0 ? new Date(Math.min(...artifactTimestamps)) : null;
  const lastUpdate = artifactTimestamps.length > 0 ? new Date(Math.max(...artifactTimestamps)) : null;
  const projectName = projectId
    ? projectsQuery.data.find((project) => project.id === projectId)?.name ?? `${appCopy.ui.sessions.detail.projectFallbackPrefix}${projectId}`
    : appCopy.ui.sessions.detail.projectFallback;
  const detailTitle = `${projectName} - ${formatToolName(group.toolKey)}`;

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <div className="ui-session-summary-topbar-main">
          <h2>{detailTitle}</h2>
          <StatusBadge status={group.status} />
        </div>
        <Link to="/sessionsummary" className={uiPrimitives.inlineLink}>
          {appCopy.ui.actions.openSessionArchive}
        </Link>
      </TopBar>

      <div className="ui-artifact-page-layout">
        <section className="ui-artifact-primary-panel" aria-label={appCopy.ui.sessions.detail.panelAriaLabel}>
          <SessionArtifactTabs group={group} fallbackToolKey={effectiveToolKey} />
        </section>

        <aside className="ui-artifact-secondary-panel" aria-label={appCopy.ui.sessions.detail.panelAriaLabel}>
          <section className="ui-artifact-overview" aria-label={appCopy.ui.sessions.detail.overviewAriaLabel}>
            <div className="ui-artifact-overview-actions">
              <SecondaryCtaButton component={Link} to={relaunchPath ?? '#'} disabled={relaunchDisabled}>
                {appCopy.ui.actions.relaunchPrimary}
              </SecondaryCtaButton>
              {capabilities.sessionDownload ? (
                <DownloadFormatDropdown onDownload={handleSessionDownload} />
              ) : null}
            </div>

            <details className="ui-artifact-accessory">
              <summary>{appCopy.ui.sessions.detail.detailsSummaryLabel}</summary>
              <dl className="ui-artifact-metadata ui-session-summary-details">
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
