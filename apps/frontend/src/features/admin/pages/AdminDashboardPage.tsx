import {
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
  Surface,
} from '../../../app/ui/primitives';
import { AdminPageContainer } from '../ui/AdminPageContainer';

type AdminKpiWidgetState = 'loading' | 'empty' | 'error' | 'ready';

type AdminKpiWidgetPreview = {
  key: string;
  title: string;
  hint: string;
  state: AdminKpiWidgetState;
  valuePreview?: string;
};

const adminKpiWidgetPreviews: readonly AdminKpiWidgetPreview[] = [
  {
    key: 'daily-quota-usage',
    title: 'Uso quota oggi',
    hint: 'Trend consume quota + utenti a rischio saturazione',
    state: 'loading',
  },
  {
    key: 'open-user-reports',
    title: 'UserReport aperti',
    hint: 'Coda issue/feature-request in attesa di triage',
    state: 'loading',
  },
  {
    key: 'llm-model-catalog-status',
    title: 'Stato catalogo LlmModel',
    hint: 'Modelli enabled/disabled e default attuale',
    state: 'loading',
  },
  {
    key: 'recent-admin-activity',
    title: 'Attivita admin recenti',
    hint: 'Mutazioni critiche eseguite nelle ultime 24h',
    state: 'loading',
  },
  {
    key: 'operational-error-rate',
    title: 'Error rate operativo',
    hint: 'Failure stream, retry dispatch e anomalie endpoint',
    state: 'loading',
  },
  {
    key: 'mean-resolution-time',
    title: 'Tempo medio risoluzione',
    hint: 'Tempo da apertura UserReport a chiusura/escalation',
    state: 'loading',
  },
] as const;

const AdminKpiWidgetStatePreview = ({ widget }: { widget: AdminKpiWidgetPreview }) => {
  if (widget.state === 'loading') {
    return (
      <div className="ui-admin-kpi-widget-state" aria-busy="true" aria-live="polite">
        <LoadingStateMessage>Caricamento KPI...</LoadingStateMessage>
        <div className="ui-admin-kpi-skeleton" aria-hidden="true">
          <span className="ui-admin-kpi-skeleton__line ui-admin-kpi-skeleton__line--value" />
          <span className="ui-admin-kpi-skeleton__line" />
          <span className="ui-admin-kpi-skeleton__line ui-admin-kpi-skeleton__line--short" />
        </div>
      </div>
    );
  }

  if (widget.state === 'empty') {
    return (
      <div className="ui-admin-kpi-widget-state">
        <EmptyStateMessage>Nessun dato disponibile.</EmptyStateMessage>
      </div>
    );
  }

  if (widget.state === 'error') {
    return (
      <div className="ui-admin-kpi-widget-state">
        <ErrorStateMessage>Errore caricamento widget.</ErrorStateMessage>
      </div>
    );
  }

  return (
    <div className="ui-admin-kpi-widget-state">
      <p className="ui-admin-kpi-widget-value">{widget.valuePreview ?? '--'}</p>
      <p className="ui-admin-kpi-widget-value-meta">Pronto per dato reale</p>
    </div>
  );
};

export const AdminDashboardPage = () => {
  return (
    <AdminPageContainer
      title="Dashboard admin"
      description=""
      showEyebrow={false}
    >
      <section className="ui-admin-kpi-placeholder-grid" aria-label="Widget KPI di sistema in preview">
        {adminKpiWidgetPreviews.map((widget) => (
          <Surface key={widget.key} className="ui-admin-kpi-placeholder-card ui-admin-kpi-widget-card">
            <p className="ui-admin-kpi-placeholder-label">Widget preview</p>
            <h3>{widget.title}</h3>
            <p>{widget.hint}</p>
            <AdminKpiWidgetStatePreview widget={widget} />
          </Surface>
        ))}
      </section>
    </AdminPageContainer>
  );
};