import { useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { Copy, Check } from 'lucide-react';
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
import {
  buildToolEntryPathFromArtifact,
} from '../../generation/ui/artifact-history';

const isDeleteEnabled = (import.meta.env.VITE_ARTIFACT_DELETE_ENABLED as string | undefined) === 'true';

export const ArtifactDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const artifactQuery = useArtifactDetailQuery({
    artifactId: id,
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    localArtifacts: generation.artifacts,
    enabled: id.length > 0,
  });

  const artifact = artifactQuery.data;
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'markdown' | 'raw'>('markdown');
  const markdownRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    const rawText = artifact?.content ?? '';
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
        // fallback to plain text
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

  const resumePath = useMemo(
    () => (artifact ? buildToolEntryPathFromArtifact(artifact, 'resume') : null),
    [artifact],
  );
  const regeneratePath = useMemo(
    () => (artifact ? buildToolEntryPathFromArtifact(artifact, 'regenerate') : null),
    [artifact],
  );
  const relaunchDisabled = useMemo(
    () => generation.isStreamActive || !artifact || !resumePath || !regeneratePath,
    [artifact, generation.isStreamActive, regeneratePath, resumePath],
  );

  if (!artifact) {
    return (
      <Surface as="section" className={uiPrimitives.stack}>
        <h2>{appCopy.editorial.artifacts.detailTitle}</h2>
        {artifactQuery.loading ? <LoadingStateMessage>Caricamento artifact...</LoadingStateMessage> : null}
        {artifactQuery.error ? <ErrorStateMessage>{artifactQuery.error}</ErrorStateMessage> : null}
        <EmptyStateMessage>{appCopy.ui.states.noArtifactFound}</EmptyStateMessage>
        <Link to="/artifacts" className={uiPrimitives.inlineLink}>{appCopy.ui.actions.openArchive}</Link>
      </Surface>
    );
  }

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.artifacts.detailTitle}</h2>
        <Link to="/artifacts" className={uiPrimitives.inlineLink}>{appCopy.ui.actions.openArchive}</Link>
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
            if (resumePath) {
              navigate(resumePath);
            }
          }}
          disabled={relaunchDisabled}
        >
          {appCopy.ui.actions.relaunchPrimary}
        </Button>
        <Button
          type="button"
          onClick={() => {
            if (regeneratePath) {
              navigate(regeneratePath);
            }
          }}
          disabled={relaunchDisabled}
        >
          {appCopy.ui.actions.relaunchSecondary}
        </Button>
        <Button type="button" disabled={!isDeleteEnabled}>
          {appCopy.ui.actions.deleteUiOnly}
        </Button>
      </div>

      {!isDeleteEnabled ? <p className={uiPrimitives.metaLine}>{appCopy.ui.states.artifactDeleteDisabled}</p> : null}
    </Surface>
  );
};
