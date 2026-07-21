import { Link } from 'react-router-dom';
import { FileText, Mic, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { DashboardPanel } from '../../workspace/ui/dashboard/DashboardPanel';
import { appCopy } from '../../../app/copy/system';
import { uiPrimitives } from '../../../app/ui/primitives';
import type { DashboardOverviewData } from '../runtime/useDashboardOverview';

interface DashboardFoundationSummaryPanelProps {
  foundationSummary: DashboardOverviewData['foundationSummary'];
  mostGappedWorkspaceId: string | null;
  loading: boolean;
  error: string | null;
}

const FOUNDATION_ICONS: Record<string, React.ReactNode> = {
  'brief-generator': <FileText size={16} />,
  'tov-generator': <Mic size={16} />,
  'personas-generator': <Users size={16} />,
};

export const DashboardFoundationSummaryPanel: React.FC<DashboardFoundationSummaryPanelProps> = ({
  foundationSummary,
  mostGappedWorkspaceId,
  loading,
  error,
}) => {
  const footer = mostGappedWorkspaceId ? (
    <Link
      to={`/workspaces/${mostGappedWorkspaceId}`}
      className={uiPrimitives.inlineLink}
    >
      {appCopy.ui.dashboard.foundationSummaryFooterLink}
    </Link>
  ) : undefined;

  if (loading) {
    return (
      <DashboardPanel
        title={appCopy.ui.dashboard.foundationSummaryTitle}
        loading
        footer={footer}
      />
    );
  }

  if (error) {
    return (
      <DashboardPanel
        title={appCopy.ui.dashboard.foundationSummaryTitle}
        error={error}
        footer={footer}
      />
    );
  }

  if (foundationSummary.every(f => f.totalWorkspaces === 0)) {
    return (
      <DashboardPanel
        title={appCopy.ui.dashboard.foundationSummaryTitle}
        empty="No workspaces to summarize."
        footer={footer}
      />
    );
  }

  return (
    <DashboardPanel
      title={appCopy.ui.dashboard.foundationSummaryTitle}
      footer={footer}
    >
      <div className="dashboard-foundation-summary__row">
        {foundationSummary.map(item => (
          <div key={item.toolKey} className="foundation-status__item">
            <span className="foundation-status__icon">
              {FOUNDATION_ICONS[item.toolKey] ?? <FileText size={16} />}
            </span>
            <span className="foundation-status__label">{item.label}</span>
            <span
              className={`foundation-status__indicator ${
                item.workspacesWithAsset > 0
                  ? 'foundation-status__indicator--present'
                  : 'foundation-status__indicator--missing'
              }`}
            >
              {item.workspacesWithAsset > 0 ? (
                <CheckCircle size={14} />
              ) : (
                <AlertTriangle size={14} />
              )}
              <span>
                {appCopy.ui.dashboard.foundationSummaryFraction(
                  item.workspacesWithAsset,
                  item.totalWorkspaces,
                )}
              </span>
            </span>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
};
