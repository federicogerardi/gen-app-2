import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { appCopy, formatMeta } from '../../../app/copy/system';
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
import { buildToolEntryPathFromArtifact } from '../../generation/ui/artifact-history';
import { Copy, Check } from 'lucide-react';

const isDeleteEnabled = (import.meta.env.VITE_ARTIFACT_DELETE_ENABLED as string | undefined) === 'true';

export const isLegacySessionRouteId = (id: string): boolean => /^sess_[A-Za-z0-9_-]+$/.test(id);

export const ArtifactDetailPage = () => {
  const { artifactId = '' } = useParams();
  const navigate = useNavigate();
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();

  useEffect(() => {
    if (isLegacySessionRouteId(artifactId)) {
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

  return <LegacyArtifactView artifact={artifact} />;
};

const LegacyArtifactView = ({
  artifact,
}: {
  artifact: NonNullable<ReturnType<typeof useArtifactDetailQuery>['data']>;
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

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.artifacts.detailTitle}</h2>
        <Link to="/artifacts" className={uiPrimitives.inlineLink}>
          {appCopy.ui.actions.openArchive}
        </Link>
      </TopBar>

      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.artifactId, artifact.artifactId)}</p>
      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.projectId, artifact.projectId)}</p>
      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.status, artifact.status)}</p>
      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.type, artifact.artifactType)}</p>

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

      {!isDeleteEnabled ? (
        <p className={uiPrimitives.metaLine}>{appCopy.ui.states.artifactDeleteDisabled}</p>
      ) : null}
    </Surface>
  );
};
