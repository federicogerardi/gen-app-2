import { useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { PrimaryCtaButton, SecondaryCtaButton, SoftCtaButton } from '../../../app/ui/CtaButtons';
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
import { useArtifactDetailQuery } from '../../../app/runtime/queries/useArtifactDetailQuery';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { buildToolEntryPathFromArtifact } from '../../generation/ui/artifact-history';
import { isSessionSummaryId } from '../../sessionsummary/runtime/session-summary-domain';
import { ArtifactContentPreview } from '../ui/ArtifactContentPreview';
import { DownloadFormatDropdown } from '../ui/DownloadFormatDropdown';
import { downloadArtifactFile, type DownloadFormat } from '../runtime/download-client';

const isDeleteEnabled = (import.meta.env.VITE_ARTIFACT_DELETE_ENABLED as string | undefined) === 'true';

export const isSessionSummaryRouteId = (id: string): boolean => isSessionSummaryId(id);

const toolDisplayName = (toolKey: string | null): string => {
  if (!toolKey) return 'Tool non disponibile';
  if (toolKey === 'funnel-pages') return 'Hotlead Funnel';
  if (toolKey === 'nextland') return 'Nextland';
  if (toolKey === 'youtube-lf-script') return 'YouTube LF Script';
  return toolKey;
};

const normalizeToolFromWorkflowType = (workflowType: string | null | undefined): string | null => {
  if (typeof workflowType !== 'string') {
    return null;
  }

  const normalized = workflowType.trim();
  if (normalized.length === 0 || normalized === 'extraction') {
    return null;
  }

  if (normalized === 'funnel_pages') {
    return 'funnel-pages';
  }

  if (normalized === 'youtube_lf_script') {
    return 'youtube-lf-script';
  }

  if (normalized === 'youtube_long_form' || normalized === 'youtube-long-form') {
    return 'youtube-lf-script';
  }

  return normalized;
};

const resolveArtifactToolKey = (artifact: NonNullable<ReturnType<typeof useArtifactDetailQuery>['data']>): string | null => {
  const sourceRequestTool =
    typeof artifact.sourceRequest.toolKey === 'string' ? artifact.sourceRequest.toolKey.trim() : '';

  return (
    (typeof artifact.toolKey === 'string' && artifact.toolKey.trim().length > 0
      ? artifact.toolKey.trim()
      : null) ??
    (sourceRequestTool.length > 0 ? sourceRequestTool : null) ??
    normalizeToolFromWorkflowType(artifact.workflowType) ??
    normalizeToolFromWorkflowType(artifact.sourceRequest.workflowType)
  );
};

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

export const ArtifactDetailPage = () => {
  const { artifactId = '' } = useParams();
  const navigate = useNavigate();
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();

  useEffect(() => {
    if (isSessionSummaryRouteId(artifactId)) {
      navigate(`/sessionsummary/${artifactId}`, { replace: true });
    }
  }, [artifactId, navigate]);

  const artifactQuery = useArtifactDetailQuery({
    artifactId,
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    localArtifacts: generation.artifacts,
    enabled: artifactId.length > 0,
  });

  const artifact = artifactQuery.data;
  const projectsQuery = useProjectsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    enabled: artifactId.length > 0,
  });
  const projectName = useMemo(
    () => projectsQuery.data.find((project) => project.id === artifact?.projectId)?.name ?? null,
    [artifact?.projectId, projectsQuery.data],
  );

  if (!artifactId) {
    return (
      <Surface as="section" className={uiPrimitives.stack}>
        <h2>{appCopy.editorial.artifacts.detailTitle}</h2>
        <EmptyStateMessage>{appCopy.ui.states.noArtifactFound}</EmptyStateMessage>
        <Link to="/artifacts" className={uiPrimitives.inlineLink}>
          {appCopy.ui.actions.openArchive}
        </Link>
      </Surface>
    );
  }

  if (!artifact) {
    return (
      <Surface as="section" className={uiPrimitives.stack}>
        <h2>{appCopy.editorial.artifacts.detailTitle}</h2>
        {artifactQuery.loading ? (
          <LoadingStateMessage>Caricamento artifact...</LoadingStateMessage>
        ) : null}
        {artifactQuery.error ? <ErrorStateMessage>{artifactQuery.error}</ErrorStateMessage> : null}
        {!artifactQuery.loading ? (
          <EmptyStateMessage>{appCopy.ui.states.noArtifactFound}</EmptyStateMessage>
        ) : null}
        <Link to="/artifacts" className={uiPrimitives.inlineLink}>
          {appCopy.ui.actions.openArchive}
        </Link>
      </Surface>
    );
  }

  return <LegacyArtifactView artifact={artifact} projectName={projectName} auth={auth} />;
};

const LegacyArtifactView = ({
  artifact,
  projectName,
  auth,
}: {
  artifact: NonNullable<ReturnType<typeof useArtifactDetailQuery>['data']>;
  projectName: string | null;
  auth: ReturnType<typeof useAuthSession>;
}) => {
  const generation = useGenerationWorkspace();
  const restartPath = useMemo(
    () => buildToolEntryPathFromArtifact(artifact, 'regenerate'),
    [artifact],
  );
  const relaunchDisabled = useMemo(
    () => generation.isStreamActive || !restartPath,
    [generation.isStreamActive, restartPath],
  );
  const stepTitle = useMemo(() => {
    const normalized = artifact.stepKey?.trim();
    if (!normalized) {
      return 'Step non disponibile';
    }

    return normalized
      .split('-')
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(' ');
  }, [artifact.stepKey]);
  const modelLabel = artifact.model.trim().length > 0 ? artifact.model : '-';
  const completedAtRaw = artifact.completedAt ?? artifact.updatedAt;
  const completedAtHumanReadable = useMemo(() => toHumanReadableDate(completedAtRaw), [completedAtRaw]);
  const resolvedProjectName = projectName ?? `Progetto ${artifact.projectId}`;
  const sessionPath = useMemo(() => {
    const sessionId = artifact.sessionId?.trim();
    return sessionId ? `/sessionsummary/${sessionId}` : null;
  }, [artifact.sessionId]);
  const resolvedToolKey = useMemo(() => resolveArtifactToolKey(artifact), [artifact]);
  const toolName = useMemo(() => toolDisplayName(resolvedToolKey), [resolvedToolKey]);
  const toneLabel = useMemo(() => {
    const tone = artifact.sourceRequest.input?.tone;
    if (typeof tone !== 'string') {
      return '-';
    }

    const normalized = tone.trim();
    return normalized.length > 0 ? normalized : '-';
  }, [artifact.sourceRequest.input]);

  const handleDownload = useCallback(
    (format: DownloadFormat) => {
      void downloadArtifactFile(artifact.artifactId, format, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
      }).catch((err: unknown) => {
        if (import.meta.env.DEV) {
          console.error('[artifact-download] failed', err);
        }
      });
    },
    [artifact.artifactId, auth.apiBaseUrl, auth.capabilities],
  );

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.artifacts.detailTitle}</h2>
        <Link to="/artifacts" className={uiPrimitives.inlineLink}>
          {appCopy.ui.actions.openArchive}
        </Link>
      </TopBar>

      <div className="ui-artifact-page-layout" itemScope itemType="https://schema.org/DigitalDocument">
        <section className="ui-artifact-primary-panel" aria-label="Preview contenuto artifact">
          <ArtifactContentPreview content={artifact.content} />
        </section>

        <aside className="ui-artifact-secondary-panel" aria-label="Contesto e azioni artifact">
          <section className="ui-artifact-overview" aria-label="Panoramica artifact">
            <div className="ui-artifact-overview-main">
              <div className="ui-artifact-overview-heading-row">
                <h3 className="ui-artifact-overview-title">{stepTitle}</h3>
                <StatusBadge status={artifact.status} />
              </div>
              <p className={uiPrimitives.metaLine}>{`${toolName} - ${resolvedProjectName}`}</p>
              <p className={uiPrimitives.metaLine}>{completedAtHumanReadable}</p>
            </div>

            <div className="ui-artifact-overview-actions">
              {sessionPath ? (
                <PrimaryCtaButton component={Link} to={sessionPath}>
                  Apri sessione
                </PrimaryCtaButton>
              ) : (
                <PrimaryCtaButton type="button" disabled>
                  {appCopy.ui.session.unavailable}
                </PrimaryCtaButton>
              )}
              <SecondaryCtaButton
                component={Link}
                to={restartPath ?? '#'}
                disabled={relaunchDisabled}
              >
                {appCopy.ui.actions.relaunchPrimary}
              </SecondaryCtaButton>
              {auth.capabilities.artifactDownload ? (
                <DownloadFormatDropdown onDownload={handleDownload} />
              ) : null}
              <SoftCtaButton type="button" disabled={!isDeleteEnabled}>
                {appCopy.ui.actions.deleteUiOnly}
              </SoftCtaButton>
            </div>
          </section>

          <details className="ui-artifact-accessory">
            <summary>Dettagli tecnici</summary>
            {toneLabel !== '-' ? <meta itemProp="keywords" content={`tone:${toneLabel}`} /> : null}
            <dl className="ui-artifact-metadata">
              <dt>{appCopy.ui.meta.artifactId}</dt>
              <dd itemProp="identifier">{artifact.artifactId}</dd>
              <dt>{appCopy.ui.labels.model}</dt>
              <dd>{modelLabel}</dd>
              <dt>{appCopy.ui.labels.toneOptional}</dt>
              <dd>{toneLabel}</dd>
            </dl>
          </details>

          {!isDeleteEnabled ? (
            <p className={uiPrimitives.metaLine}>{appCopy.ui.states.artifactDeleteDisabled}</p>
          ) : null}
        </aside>
      </div>
    </Surface>
  );
};
