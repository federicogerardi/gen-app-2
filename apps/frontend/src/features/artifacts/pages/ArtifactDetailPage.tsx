import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import {
  Button,
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
  Surface,
  TopBar,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { useArtifactDetailQuery } from '../../../app/runtime/queries/useArtifactDetailQuery';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { buildToolEntryPathFromArtifact } from '../../generation/ui/artifact-history';
import { Copy, Check } from 'lucide-react';
import { isSessionSummaryId } from '../../sessionsummary/runtime/session-summary-domain';

const isDeleteEnabled = (import.meta.env.VITE_ARTIFACT_DELETE_ENABLED as string | undefined) === 'true';

export const isSessionSummaryRouteId = (id: string): boolean => isSessionSummaryId(id);

const toolDisplayName = (toolKey: string | null): string => {
  if (!toolKey) return 'Tool non disponibile';
  if (toolKey === 'funnel-pages') return 'Funnel Pages';
  if (toolKey === 'nextland') return 'Nextland';
  if (toolKey === 'youtube-lf-script') return 'YouTube LF Script';
  return toolKey;
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

  return <LegacyArtifactView artifact={artifact} projectName={projectName} />;
};

const LegacyArtifactView = ({
  artifact,
  projectName,
}: {
  artifact: NonNullable<ReturnType<typeof useArtifactDetailQuery>['data']>;
  projectName: string | null;
}) => {
  const navigate = useNavigate();
  const generation = useGenerationWorkspace();
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'markdown' | 'raw'>('markdown');
  const markdownRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    const rawText = artifact.content ?? '';
    if (viewMode === 'markdown' && markdownRef.current) {
      const html = markdownRef.current.innerHTML;
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([rawText], { type: 'text/plain' }),
      });
      navigator.clipboard.write([item]).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        navigator.clipboard.writeText(rawText).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }).catch(() => {});
      });
    } else {
      navigator.clipboard.writeText(rawText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  const restartPath = useMemo(
    () => buildToolEntryPathFromArtifact(artifact, 'regenerate'),
    [artifact],
  );
  const relaunchDisabled = useMemo(
    () => generation.isStreamActive || !restartPath,
    [generation.isStreamActive, restartPath],
  );
  const artifactTypeLabel = useMemo(
    () => appCopy.ui.options.artifactTypes.find((option) => option.value === artifact.artifactType)?.label ?? artifact.artifactType,
    [artifact.artifactType],
  );
  const artifactStatusLabel = useMemo(
    () => appCopy.ui.options.artifactStatuses.find((option) => option.value === artifact.status)?.label ?? artifact.status,
    [artifact.status],
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
  const toolName = useMemo(() => toolDisplayName(artifact.toolKey), [artifact.toolKey]);
  const toolLabel = artifact.toolKey ?? '-';

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.artifacts.detailTitle}</h2>
        <Link to="/artifacts" className={uiPrimitives.inlineLink}>
          {appCopy.ui.actions.openArchive}
        </Link>
      </TopBar>

      <section className="ui-artifact-overview" aria-label="Panoramica artifact">
        <div className="ui-artifact-overview-main">
          <h3 className="ui-artifact-overview-title">{stepTitle}</h3>
          <p className={uiPrimitives.metaLine}>{toolName}</p>
          <p className={uiPrimitives.metaLine}>
            {resolvedProjectName} · {artifactTypeLabel} · {artifactStatusLabel}
          </p>
          <p className={uiPrimitives.metaLine}>{completedAtHumanReadable}</p>
          <Link to={`/dashboard/projects/${artifact.projectId}`} className={uiPrimitives.inlineLink}>
            {appCopy.ui.actions.openContextProject}
          </Link>
        </div>

        <div className={uiPrimitives.actions}>
          <Button
            type="button"
            onClick={() => {
              if (restartPath) {
                navigate(restartPath);
              }
            }}
            disabled={relaunchDisabled}
          >
            {appCopy.ui.actions.relaunchPrimary}
          </Button>
          <Button type="button" disabled={!isDeleteEnabled}>
            {appCopy.ui.actions.deleteUiOnly}
          </Button>
        </div>
      </section>

      <div className="ui-artifact-content-wrapper">
        <div className="ui-artifact-toolbar">
          <div className="ui-artifact-toolbar-tabs">
            <button
              type="button"
              className={`ui-view-tab${viewMode === 'markdown' ? ' is-active' : ''}`}
              onClick={() => setViewMode('markdown')}
            >
              {appCopy.ui.actions.viewMarkdown}
            </button>
            <button
              type="button"
              className={`ui-view-tab${viewMode === 'raw' ? ' is-active' : ''}`}
              onClick={() => setViewMode('raw')}
            >
              {appCopy.ui.actions.viewRaw}
            </button>
          </div>
          <button
            type="button"
            className={`ui-view-tab ui-view-tab--icon${copied ? ' is-active' : ''}`}
            onClick={handleCopy}
            aria-label={copied ? appCopy.ui.actions.copied : appCopy.ui.actions.copyContent}
            title={copied ? appCopy.ui.actions.copied : appCopy.ui.actions.copyContent}
            disabled={!artifact.content}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
        {viewMode === 'markdown' ? (
          <div className="ui-artifact-markdown" ref={markdownRef}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {artifact.content || ''}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className={uiPrimitives.artifactContent}>{artifact.content || 'Contenuto non disponibile.'}</pre>
        )}
      </div>

      <details className="ui-artifact-accessory" itemScope itemType="https://schema.org/DigitalDocument">
        <summary>Dettagli tecnici</summary>
        <dl className="ui-artifact-metadata">
          <dt>{appCopy.ui.labels.projectId}</dt>
          <dd itemProp="identifier">{artifact.projectId}</dd>
          <dt>{appCopy.ui.meta.artifactId}</dt>
          <dd>{artifact.artifactId}</dd>
          <dt>{appCopy.ui.labels.model}</dt>
          <dd>{modelLabel}</dd>
          <dt>{appCopy.ui.labels.toolKey}</dt>
          <dd>{toolLabel}</dd>
        </dl>
      </details>

      {!isDeleteEnabled ? (
        <p className={uiPrimitives.metaLine}>{appCopy.ui.states.artifactDeleteDisabled}</p>
      ) : null}
    </Surface>
  );
};
