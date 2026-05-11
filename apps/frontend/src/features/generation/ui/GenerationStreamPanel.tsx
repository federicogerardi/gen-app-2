import type { FrontendStreamStatus } from '../machines/frontend-stream.machine';
import { appCopy } from '../../../app/copy/system';
import { PrimaryCtaButton, SecondaryCtaButton } from '../../../app/ui/CtaButtons';
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
        <SecondaryCtaButton type="button" onClick={onRetry} disabled={!canRetry}>
          {appCopy.ui.actions.retry}
        </SecondaryCtaButton>
        <SecondaryCtaButton type="button" onClick={onCancel} disabled={!canCancel}>
          {appCopy.ui.actions.cancel}
        </SecondaryCtaButton>
        <PrimaryCtaButton type="button" onClick={onReset}>
          {appCopy.ui.actions.reset}
        </PrimaryCtaButton>
      </div>
    </Surface>
  );
};
