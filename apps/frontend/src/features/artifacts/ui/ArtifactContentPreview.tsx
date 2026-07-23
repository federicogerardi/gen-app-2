import { useRef, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';
import { appCopy } from '../../../app/copy/system';
import { uiPrimitives } from '../../../app/ui/primitives';
import { UI_CONFIG } from '../../../app/config/ui-config';
import type { DownloadFormat } from '../runtime/download-client';
import { DownloadFormatDropdown } from './DownloadFormatDropdown';

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

const stripCodeFences = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return text;
  const firstNewline = trimmed.indexOf('\n');
  if (firstNewline === -1) return text;
  if (!trimmed.endsWith('```')) return text;
  const inner = trimmed.slice(firstNewline + 1, trimmed.length - 3);
  return inner.endsWith('\n') ? inner.slice(0, -1) : inner;
};

export const ArtifactContentPreview = ({
  content,
  toolbarLabel = appCopy.ui.artifactPreview.toolbarLabel,
  panelLabel = appCopy.ui.artifactPreview.panelLabel,
  emptyContentLabel = appCopy.ui.artifactPreview.emptyContentLabel,
  downloadOptions,
}: ArtifactContentPreviewProps) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'markdown' | 'raw'>('markdown');
  const markdownRef = useRef<HTMLDivElement>(null);

  const resolvedContent = content ?? '';
  const sanitizedContent = useMemo(() => stripCodeFences(resolvedContent), [resolvedContent]);
  const setCopiedState = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), UI_CONFIG.delays.clipboardFeedbackMs);
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
            id="tab-markdown"
            className={`ui-view-tab${viewMode === 'markdown' ? ' is-active' : ''}`}
            role="tab"
            aria-selected={viewMode === 'markdown'}
            aria-controls="panel-markdown"
            onClick={() => setViewMode('markdown')}
          >
            {appCopy.ui.actions.viewMarkdown}
          </button>
          <button
            type="button"
            id="tab-raw"
            className={`ui-view-tab${viewMode === 'raw' ? ' is-active' : ''}`}
            role="tab"
            aria-selected={viewMode === 'raw'}
            aria-controls="panel-raw"
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
          <DownloadFormatDropdown
            triggerVariant="icon"
            disabled={!resolvedContent}
            onDownload={downloadOptions.onDownload}
          />
        ) : null}
      </div>

      {viewMode === 'markdown' ? (
        <div className="ui-artifact-markdown" ref={markdownRef} role="tabpanel" id="panel-markdown" aria-labelledby="tab-markdown" aria-label={panelLabel}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {sanitizedContent}
          </ReactMarkdown>
        </div>
      ) : (
        <pre className={uiPrimitives.artifactContent} role="tabpanel" id="panel-raw" aria-labelledby="tab-raw" aria-label={panelLabel}>
          {resolvedContent || emptyContentLabel}
        </pre>
      )}
    </div>
  );
};
