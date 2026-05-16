import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, Download } from 'lucide-react';
import { appCopy } from '../../../app/copy/system';
import { uiPrimitives } from '../../../app/ui/primitives';
import type { DownloadFormat } from '../runtime/download-client';

type DownloadOptions = {
  onDownload: (format: DownloadFormat) => void;
};

type ArtifactContentPreviewProps = {
  content: string | null | undefined;
  toolbarLabel?: string;
  panelLabel?: string;
  emptyContentLabel?: string;
  downloadOptions?: DownloadOptions;
};

export const ArtifactContentPreview = ({
  content,
  toolbarLabel = 'Modalita visualizzazione contenuto',
  panelLabel = 'Preview contenuto artifact',
  emptyContentLabel = 'Contenuto non disponibile.',
  downloadOptions,
}: ArtifactContentPreviewProps) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'markdown' | 'raw'>('markdown');
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const markdownRef = useRef<HTMLDivElement>(null);

  const resolvedContent = content ?? '';
  const setCopiedState = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyAsPlainText = () => {
    navigator.clipboard.writeText(resolvedContent).then(() => {
      setCopiedState();
    }).catch(() => {});
  };

  const handleCopy = () => {
    if (!navigator.clipboard) {
      return;
    }

    if (viewMode === 'markdown' && markdownRef.current) {
      if (typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard.write === 'function') {
        try {
          const html = markdownRef.current.innerHTML;
          const item = new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([resolvedContent], { type: 'text/plain' }),
          });
          navigator.clipboard.write([item]).then(() => {
            setCopiedState();
          }).catch(() => {
            copyAsPlainText();
          });
          return;
        } catch {
          if (import.meta.env.DEV) {
            console.debug('[artifact-copy] rich clipboard unavailable');
          }
          copyAsPlainText();
          return;
        }
      }
    }

    copyAsPlainText();
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
        {downloadOptions ? (
          <div className="ui-artifact-download-menu-wrapper">
            <button
              type="button"
              className="ui-view-tab ui-view-tab--icon"
              aria-label={appCopy.ui.actions.download}
              title={appCopy.ui.actions.download}
              aria-haspopup="menu"
              aria-expanded={downloadMenuOpen}
              onClick={() => setDownloadMenuOpen((prev) => !prev)}
              disabled={!resolvedContent}
            >
              <Download size={13} />
            </button>
            {downloadMenuOpen ? (
              <div className="ui-artifact-download-menu" role="menu" aria-label={appCopy.ui.actions.download}>
                {(['md', 'txt', 'docx'] as DownloadFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    role="menuitem"
                    className="ui-artifact-download-menu-item"
                    onClick={() => {
                      setDownloadMenuOpen(false);
                      downloadOptions.onDownload(fmt);
                    }}
                  >
                    {fmt === 'md'
                      ? appCopy.ui.actions.downloadAsMarkdown
                      : fmt === 'txt'
                        ? appCopy.ui.actions.downloadAsTxt
                        : appCopy.ui.actions.downloadAsDocx}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
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
