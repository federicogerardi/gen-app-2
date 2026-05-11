import type { FrontendStreamStatus } from '../machines/frontend-stream.machine';
import { Button } from '@mui/material';
import { appCopy } from '../../../app/copy/system';
import { Surface, cx, uiPrimitives } from '../../../app/ui/primitives';

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
};

const STREAM_STATUS_LABEL: Record<FrontendStreamStatus, string> = {
  idle: 'In attesa',
  connecting: 'Connessione in corso...',
  streaming: 'Generazione in corso...',
  completed: 'Completato',
  failed: 'Si è verificato un errore',
  reconnecting: 'Riconnessione in corso...',
};

export const GenerationStreamPanel = ({
  status,
  content,
  artifactId,
  reconnectAttempts,
  errorCode,
  errorMessage,
  onRetry,
  onCancel,
  onReset,
  canRetry,
  canCancel,
}: GenerationStreamPanelProps) => {
  return (
    <Surface as="section" className={cx(uiPrimitives.streamPanel, `is-${status}`)}>
      <h2>{appCopy.editorial.generation.streamTitle}</h2>
      <p className={uiPrimitives.statusLine}>
        <strong>{STREAM_STATUS_LABEL[status]}</strong>
      </p>

      {artifactId ? (
        <p className={uiPrimitives.metaLine}>Artefatto: {artifactId}</p>
      ) : null}

      {reconnectAttempts > 0 ? (
        <p className={uiPrimitives.metaLine}>Tentativi di riconnessione: {reconnectAttempts}</p>
      ) : null}

      {errorMessage ? (
        <div className={uiPrimitives.error} role="alert">
          <p>Errore: {errorMessage}</p>
          {errorCode ? <p>Codice: {errorCode}</p> : null}
        </div>
      ) : null}

      <pre aria-live="polite">{content.length > 0 ? content : appCopy.ui.states.noChunkReceived}</pre>

      <div className={uiPrimitives.actions}>
        <Button type="button" variant="outlined" onClick={onRetry} disabled={!canRetry}>
          {appCopy.ui.actions.retry}
        </Button>
        <Button type="button" variant="outlined" onClick={onCancel} disabled={!canCancel}>
          {appCopy.ui.actions.cancel}
        </Button>
        <Button type="button" variant="contained" onClick={onReset}>
          {appCopy.ui.actions.reset}
        </Button>
      </div>
    </Surface>
  );
};
