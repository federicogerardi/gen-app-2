import type { JSX } from 'react';
import { Button as MuiButton, TextField, MenuItem } from '@mui/material';
import { appCopy } from '../../../app/copy/system';
import { cx, uiPrimitives } from '../../../app/ui/primitives';
import type { AdminToolWorkflowJobsFilters } from '../runtime/useAdminToolWorkflowJobsQuery';

const adminCopy = appCopy.ui.toolWorkflowJob.admin;

const STATUS_OPTIONS = [
  { value: '', label: adminCopy.filterAll },
  { value: 'queued', label: appCopy.ui.toolWorkflowJob.status.queued },
  { value: 'running', label: appCopy.ui.toolWorkflowJob.status.running },
  { value: 'completed', label: appCopy.ui.toolWorkflowJob.status.completed },
  { value: 'failed', label: appCopy.ui.toolWorkflowJob.status.failed },
  { value: 'cancelled', label: appCopy.ui.toolWorkflowJob.status.cancelled },
];

const TOOL_OPTIONS = [
  { value: '', label: adminCopy.filterAll },
  { value: 'funnel-pages', label: 'Funnel Pages' },
  { value: 'nextland', label: 'Nextland' },
  { value: 'youtube-lf-script', label: 'YouTube LF Script' },
  { value: 'geometric', label: 'Geometric' },
  { value: 'angle-generator', label: 'Angle Generator' },
  { value: 'meta-ads', label: 'Meta Ads' },
  { value: 'youtube-description', label: 'YouTube Description' },
  { value: 'personas-generator', label: 'Personas Generator' },
];

type AdminToolWorkflowJobsToolbarProps = {
  isLoading: boolean;
  onReload: () => void;
  filters: AdminToolWorkflowJobsFilters;
  onStatusChange: (status: string) => void;
  onToolKeyChange: (toolKey: string) => void;
};

export const AdminToolWorkflowJobsToolbar = ({
  isLoading,
  onReload,
  filters,
  onStatusChange,
  onToolKeyChange,
}: AdminToolWorkflowJobsToolbarProps): JSX.Element => {
  return (
    <div className={cx(uiPrimitives.clusterRow, 'ui-admin-twjobs-toolbar')}>
      <p className={uiPrimitives.metaLine}>{adminCopy.toolbarDescription}</p>
      <div className={uiPrimitives.actions}>
        <TextField
          select
          size="small"
          label={adminCopy.filterStatus}
          value={filters.status}
          onChange={(e) => onStatusChange(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={adminCopy.filterTool}
          value={filters.toolKey}
          onChange={(e) => onToolKeyChange(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          {TOOL_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>
        <MuiButton
          type="button"
          onClick={onReload}
          disabled={isLoading}
          variant="outlined"
        >
          {adminCopy.reloadTable}
        </MuiButton>
      </div>
    </div>
  );
};
