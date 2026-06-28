import { appCopy } from '../../../app/copy/system';
import {
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
  Surface,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { Link } from 'react-router-dom';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { AdminPageContainer } from '../ui/AdminPageContainer';
import { useAdminModelsQuery } from '../../../app/runtime/queries/useAdminModelsQuery';
import { useAdminUserReportsQuery } from '../runtime/useAdminUserReportsQuery';

type AdminKpiWidgetState = 'loading' | 'empty' | 'error' | 'ready';

type AdminKpiWidgetPreview = {
  key: string;
  title: string;
  hint: string;
  state: AdminKpiWidgetState;
  valuePreview?: string;
  valueMeta?: string;
};

const adminKpiWidgetPreviews: readonly AdminKpiWidgetPreview[] = [
  {
    key: 'daily-quota-usage',
    title: appCopy.ui.adminDashboard.kpi.dailyQuotaUsageTitle,
    hint: appCopy.ui.adminDashboard.kpi.dailyQuotaUsageHint,
    state: 'loading',
  },
  {
    key: 'recent-admin-activity',
    title: appCopy.ui.adminDashboard.kpi.recentAdminActivityTitle,
    hint: appCopy.ui.adminDashboard.kpi.recentAdminActivityHint,
    state: 'loading',
  },
  {
    key: 'operational-error-rate',
    title: appCopy.ui.adminDashboard.kpi.operationalErrorRateTitle,
    hint: appCopy.ui.adminDashboard.kpi.operationalErrorRateHint,
    state: 'loading',
  },
  {
    key: 'mean-resolution-time',
    title: appCopy.ui.adminDashboard.kpi.meanResolutionTimeTitle,
    hint: appCopy.ui.adminDashboard.kpi.meanResolutionTimeHint,
    state: 'loading',
  },
] as const;

const AdminKpiWidgetStatePreview = ({ widget }: { widget: AdminKpiWidgetPreview }) => {
  if (widget.state === 'loading') {
    return (
      <div className="ui-admin-kpi-widget-state" aria-busy="true" aria-live="polite">
        <LoadingStateMessage>{appCopy.ui.states.loadingKpi}</LoadingStateMessage>
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
        <EmptyStateMessage>{appCopy.ui.states.noDataAvailable}</EmptyStateMessage>
      </div>
    );
  }

  if (widget.state === 'error') {
    return (
      <div className="ui-admin-kpi-widget-state">
        <ErrorStateMessage>{appCopy.ui.states.widgetLoadError}</ErrorStateMessage>
      </div>
    );
  }

  return (
    <div className="ui-admin-kpi-widget-state">
      <p className="ui-kpi-value">{widget.valuePreview ?? '--'}</p>
      <p className="ui-kpi-meta">{widget.valueMeta ?? appCopy.ui.states.readyForRealData}</p>
    </div>
  );
};

export const AdminDashboardPage = () => {
  const auth = useAuthSession();
  const modelsQuery = useAdminModelsQuery({ apiBaseUrl: auth.apiBaseUrl, capabilities: auth.capabilities });
  const userReportsQuery = useAdminUserReportsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    statusFilter: 'all',
    categoryFilter: 'all',
  });

  const openUserReportsCount = userReportsQuery.data.filter((report) => report.status !== 'closed').length;

  const openUserReportsWidget: AdminKpiWidgetPreview = {
    key: 'open-user-reports',
    title: appCopy.ui.adminDashboard.kpi.openUserReportsTitle,
    hint: appCopy.ui.adminDashboard.kpi.openUserReportsHint,
    state: userReportsQuery.loading
      ? 'loading'
      : userReportsQuery.error
        ? 'error'
        : openUserReportsCount === 0
          ? 'empty'
          : 'ready',
    valuePreview: String(openUserReportsCount),
  };

  const enabledModelsCount = modelsQuery.data.filter((model) => model.status === 'enabled').length;
  const defaultModel = modelsQuery.data.find((model) => model.isDefault);

  const llmModelCatalogWidget: AdminKpiWidgetPreview = {
    key: 'llm-model-catalog-status',
    title: appCopy.ui.adminDashboard.kpi.llmCatalogStatusTitle,
    hint: appCopy.ui.adminDashboard.kpi.llmCatalogStatusHint,
    state: modelsQuery.loading
      ? 'loading'
      : modelsQuery.error
        ? 'error'
        : modelsQuery.data.length === 0
          ? 'empty'
          : 'ready',
    valuePreview: `${enabledModelsCount}/${modelsQuery.data.length}`,
    valueMeta: defaultModel ? `Default: ${defaultModel.key}` : appCopy.ui.states.noDefaultSet,
  };

  const dashboardWidgets: readonly AdminKpiWidgetPreview[] = [
    ...(adminKpiWidgetPreviews[0] ? [adminKpiWidgetPreviews[0]] : []),
    openUserReportsWidget,
    llmModelCatalogWidget,
    ...adminKpiWidgetPreviews.slice(1),
  ];

  return (
    <AdminPageContainer
      title={appCopy.ui.adminDashboard.title}
      description=""
      showEyebrow={false}
      actions={(
        <Link to="/admin/user-reports" className={uiPrimitives.inlineLink}>
          {appCopy.ui.adminDashboard.openUserReportQueue}
        </Link>
      )}
    >
      <section className="ui-admin-kpi-placeholder-grid" aria-label="Widget KPI di sistema in preview">
        {dashboardWidgets.map((widget) => (
          <Surface key={widget.key} className="ui-admin-kpi-placeholder-card ui-admin-kpi-widget-card">
            <p className="ui-admin-kpi-placeholder-label">{appCopy.ui.adminDashboard.widgetPreviewLabel}</p>
            <h3>{widget.title}</h3>
            <p>{widget.hint}</p>
            <AdminKpiWidgetStatePreview widget={widget} />
          </Surface>
        ))}
      </section>
    </AdminPageContainer>
  );
};