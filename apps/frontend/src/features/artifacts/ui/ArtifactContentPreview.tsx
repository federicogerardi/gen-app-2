import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';
import { appCopy } from '../../../app/copy/system';
import { uiPrimitives } from '../../../app/ui/primitives';

type ArtifactContentPreviewProps = {
  content: string | null | undefined;
  toolbarLabel?: string;
  panelLabel?: string;
  emptyContentLabel?: string;
};

export const ArtifactContentPreview = ({
  content,
  toolbarLabel = 'Modalita visualizzazione contenuto',
  panelLabel = 'Preview contenuto artifact',
  emptyContentLabel = 'Contenuto non disponibile.',
}: ArtifactContentPreviewProps) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'markdown' | 'raw'>('markdown');
  const markdownRef = useRef<HTMLDivElement>(null);

  const resolvedContent = content ?? '';

  const handleCopy = () => {
    if (viewMode === 'markdown' && markdownRef.current) {
      const html = markdownRef.current.innerHTML;
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([resolvedContent], { type: 'text/plain' }),
      });
      navigator.clipboard.write([item]).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        navigator.clipboard.writeText(resolvedContent).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }).catch(() => {});
      });
      return;
    }

    navigator.clipboard.writeText(resolvedContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="ui-artifact-content-wrapper">
      <div className="ui-artifact-toolbar">
        <div className="ui-artifact-toolbar-tabs" role="tablist" aria-label={toolbarLabel}>
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
          disabled={!resolvedContent}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>

      {viewMode === 'markdown' ? (
        <div className="ui-artifact-markdown" ref={markdownRef} role="tabpanel" aria-label={panelLabel}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {resolvedContent}
          </ReactMarkdown>
        </div>
      ) : (
        <pre className={uiPrimitives.artifactContent} role="tabpanel" aria-label={panelLabel}>
          {resolvedContent || emptyContentLabel}
        </pre>
      )}
    </div>
  );
};