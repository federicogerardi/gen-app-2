import { useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { PrimaryCtaButton, SoftCtaButton } from '../../../app/ui/CtaButtons';
import {
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
  Surface,
  TopBar,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { StatusBadge } from '../../../app/ui/StatusBadge';
import { useArtifactDetailQuery } from '../../../app/runtime/queries/useArtifactDetailQuery';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { isSessionSummaryId } from '../../sessionsummary/runtime/session-summary-domain';
import { getToolLabel } from '../../tools/runtime/tool-form-architecture';
import { normalizeToolKeyCandidate } from '@gen-app-2/contracts';
import { ArtifactContentPreview } from '../ui/ArtifactContentPreview';
import { DownloadFormatDropdown } from '../ui/DownloadFormatDropdown';
import { downloadArtifactFile, type DownloadFormat } from '../runtime/download-client';

const isDeleteEnabled = (import.meta.env.VITE_ARTIFACT_DELETE_ENABLED as string | undefined) === 'true';

export const isSessionSummaryRouteId = (id: string): boolean => isSessionSummaryId(id);

const normalizeToolFromWorkflowType = (workflowType: string | null | undefined): string | null => {
  if (typeof workflowType !== 'string') {
    return null;
  }

  const normalized = workflowType.trim();
  if (normalized.length === 0 || normalized === 'extraction') {
    return null;
  }

  if (normalized === 'youtube_long_form' || normalized === 'youtube-long-form') {
    return 'youtube-lf-script';
  }

  return normalizeToolKeyCandidate(normalized) ?? normalized;
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
  const { apiBaseUrl, capabilities } = useApiConfig();

  useEffect(() => {
    if (isSessionSummaryRouteId(artifactId)) {
      navigate('/workspaces', { replace: true });
    }
  }, [artifactId, navigate]);

  const artifactQuery = useArtifactDetailQuery({
    artifactId,
    apiBaseUrl,
    capabilities,
    localArtifacts: [],
    enabled: artifactId.length > 0,
  });

  const artifact = artifactQuery.data;
  const projectsQuery = useProjectsQuery({
    apiBaseUrl,
    capabilities,
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
        <Link to="/admin/artifacts" className={uiPrimitives.inlineLink}>
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
          <LoadingStateMessage>{appCopy.ui.states.loadingArtifact}</LoadingStateMessage>
        ) : null}
        {artifactQuery.error ? <ErrorStateMessage>{artifactQuery.error}</ErrorStateMessage> : null}
        {!artifactQuery.loading ? (
          <EmptyStateMessage>{appCopy.ui.states.noArtifactFound}</EmptyStateMessage>
        ) : null}
        <Link to="/admin/artifacts" className={uiPrimitives.inlineLink}>
          {appCopy.ui.actions.openArchive}
        </Link>
      </Surface>
    );
  }

  return <ArtifactView artifact={artifact} projectName={projectName} />;
};

const ArtifactView = ({
  artifact,
  projectName,
}: {
  artifact: NonNullable<ReturnType<typeof useArtifactDetailQuery>['data']>;
  projectName: string | null;
}) => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const stepTitle = useMemo(() => {
    const normalized = artifact.stepKey?.trim();
    if (!normalized) {
      return appCopy.ui.artifactDetail.stepUnavailable;
    }

    return normalized
      .split('-')
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(' ');
  }, [artifact.stepKey]);
  const modelLabel = artifact.model.trim().length > 0 ? artifact.model : '-';
  const completedAtRaw = artifact.completedAt ?? artifact.updatedAt;
  const completedAtHumanReadable = useMemo(() => toHumanReadableDate(completedAtRaw), [completedAtRaw]);
  const resolvedProjectName = projectName ?? `Project ${artifact.projectId}`;
  const sessionPath = useMemo(() => {
    const sessionId = artifact.sessionId?.trim();
    const projectId = artifact.projectId?.trim();
    return sessionId && projectId ? `/workspaces/${projectId}/sessions/${sessionId}` : null;
  }, [artifact.sessionId, artifact.projectId]);
  const resolvedToolKey = useMemo(() => resolveArtifactToolKey(artifact), [artifact]);
  const toolName = useMemo(
    () => (resolvedToolKey ? getToolLabel(resolvedToolKey) : appCopy.ui.artifactDetail.toolUnavailable),
    [resolvedToolKey],
  );

  const handleDownload = useCallback(
    (format: DownloadFormat) => {
      void downloadArtifactFile(artifact.artifactId, format, {
        apiBaseUrl,
        capabilities,
      }).catch((err: unknown) => {
        if (import.meta.env.DEV) {
          console.error('[artifact-download] failed', err);
        }
      });
    },
    [artifact.artifactId, apiBaseUrl, capabilities],
  );

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.artifacts.detailTitle}</h2>
        <Link to="/admin/artifacts" className={uiPrimitives.inlineLink}>
          {appCopy.ui.actions.openArchive}
        </Link>
      </TopBar>

      <div className="ui-artifact-page-layout" itemScope itemType="https://schema.org/DigitalDocument">
        <section className="ui-artifact-primary-panel" aria-label={appCopy.ui.artifactDetail.previewAriaLabel}>
          <ArtifactContentPreview content={artifact.content} />
        </section>

        <aside className="ui-artifact-secondary-panel" aria-label={appCopy.ui.artifactDetail.contextAriaLabel}>
          <section className="ui-artifact-overview" aria-label={appCopy.ui.artifactDetail.overviewAriaLabel}>
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
                  {appCopy.ui.toolPage.openSessionLabel}
                </PrimaryCtaButton>
              ) : (
                <PrimaryCtaButton type="button" disabled>
                  {appCopy.ui.session.unavailable}
                </PrimaryCtaButton>
              )}
              {capabilities.artifactDownload ? (
                <DownloadFormatDropdown onDownload={handleDownload} />
              ) : null}
              <SoftCtaButton type="button" disabled={!isDeleteEnabled}>
                {appCopy.ui.actions.deleteUiOnly}
              </SoftCtaButton>
            </div>
          </section>

          <details className="ui-artifact-accessory">
            <summary>{appCopy.ui.artifactDetail.technicalDetails}</summary>
            <dl className="ui-artifact-metadata">
              <dt>{appCopy.ui.meta.artifactId}</dt>
              <dd itemProp="identifier">{artifact.artifactId}</dd>
              <dt>{appCopy.ui.labels.model}</dt>
              <dd>{modelLabel}</dd>
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
