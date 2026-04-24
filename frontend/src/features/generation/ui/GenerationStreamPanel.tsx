import type { FrontendStreamStatus } from '../machines/frontend-stream.machine';

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
}: GenerationStreamPanelProps) => {
  return (
    <section className="panel stream-panel">
      <h2>Stream output</h2>
      <p className="status-line">
        Stato: <strong>{status}</strong>
      </p>
      <p className="meta-line">requestId: {requestId ?? '-'}</p>
      <p className="meta-line">artifactId: {artifactId ?? '-'}</p>
      <p className="meta-line">reconnect attempts: {reconnectAttempts}</p>

      {errorMessage ? (
        <div className="error-box" role="alert">
          <p>Errore: {errorMessage}</p>
          {errorCode ? <p>Codice: {errorCode}</p> : null}
        </div>
      ) : null}

      <pre aria-live="polite">{content.length > 0 ? content : 'Nessun chunk ricevuto'}</pre>

      <div className="actions">
        <button type="button" onClick={onRetry} disabled={!canRetry}>
          Riprova
        </button>
        <button type="button" onClick={onCancel} disabled={!canCancel}>
          Cancella
        </button>
        <button type="button" onClick={onReset}>
          Reset
        </button>
      </div>
    </section>
  );
};
