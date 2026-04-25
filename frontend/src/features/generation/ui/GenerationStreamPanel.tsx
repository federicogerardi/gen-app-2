import type { FrontendStreamStatus } from '../machines/frontend-stream.machine';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { Button, Surface, cx, uiPrimitives } from '../../../app/ui/primitives';
import type {
  CanonicalToolUiState,
  PrimaryActionPolicy,
} from './tool-ux-state';

type GenerationStreamPanelProps = {
  status: FrontendStreamStatus;
  content: string;
  requestId: string | null;
  artifactId: string | null;
  reconnectAttempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  onRetry: () => void;
  onCancel: () => void;
  onReset: () => void;
  canRetry: boolean;
  canCancel: boolean;
  canonicalState: CanonicalToolUiState;
  primaryActionPolicy: PrimaryActionPolicy;
};

export const GenerationStreamPanel = ({
  status,
  content,
  requestId,
  artifactId,
  reconnectAttempts,
  errorCode,
  errorMessage,
  onRetry,
  onCancel,
  onReset,
  canRetry,
  canCancel,
  canonicalState,
  primaryActionPolicy,
}: GenerationStreamPanelProps) => {
  return (
    <Surface as="section" className={cx(uiPrimitives.streamPanel, `is-${status}`)}>
      <h2>{appCopy.editorial.generation.streamTitle}</h2>
      <p className={uiPrimitives.statusLine}>
        {appCopy.ui.meta.state}: <strong>{status}</strong>
      </p>
      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.uiState, canonicalState)}</p>
      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.primaryAction, primaryActionPolicy)}</p>
      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.requestId, requestId ?? '-')}</p>
      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.artifactId, artifactId ?? '-')}</p>
      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.reconnectAttempts, reconnectAttempts)}</p>

      {errorMessage ? (
        <div className={uiPrimitives.error} role="alert">
          <p>Errore: {errorMessage}</p>
          {errorCode ? <p>Codice: {errorCode}</p> : null}
        </div>
      ) : null}

      <pre aria-live="polite">{content.length > 0 ? content : appCopy.ui.states.noChunkReceived}</pre>

      <div className={uiPrimitives.actions}>
        <Button type="button" onClick={onRetry} disabled={!canRetry}>
          {appCopy.ui.actions.retry}
        </Button>
        <Button type="button" onClick={onCancel} disabled={!canCancel}>
          {appCopy.ui.actions.cancel}
        </Button>
        <Button type="button" onClick={onReset}>
          {appCopy.ui.actions.reset}
        </Button>
      </div>
    </Surface>
  );
};
