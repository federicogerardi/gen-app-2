import type { ReactNode } from 'react';
import { LoadingStateMessage, EmptyStateMessage, ErrorStateMessage } from '../../../../app/ui/primitives';
import { appCopy } from '../../../../app/copy/system';

interface DashboardPanelProps {
  title: string;
  loading?: boolean;
  error?: string | null;
  empty?: string | undefined;
  children?: ReactNode;
  footer?: ReactNode;
}

export const DashboardPanel: React.FC<DashboardPanelProps> = ({
  title,
  loading = false,
  error = null,
  empty,
  children,
  footer,
}) => {
  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel__header">
        <span className="dashboard-panel__title">{title}</span>
      </div>
      <div className="dashboard-panel__content">
        {loading && <LoadingStateMessage>{appCopy.ui.workspace.dashboard.loadingGeneric}</LoadingStateMessage>}
        {error && <ErrorStateMessage>{error}</ErrorStateMessage>}
        {!loading && !error && empty && <EmptyStateMessage>{empty}</EmptyStateMessage>}
        {!loading && !error && !empty && children}
      </div>
      {footer && <div className="dashboard-panel__footer">{footer}</div>}
    </div>
  );
};
