import { Link } from 'react-router-dom';
import { MenuItem, TextField } from '@mui/material';

import { cx, uiPrimitives } from '../../../app/ui/primitives';
import {
  USER_REPORT_CATEGORY_FILTER_OPTIONS,
  USER_REPORT_STATUS_FILTER_OPTIONS,
} from '../runtime/admin-user-reports-constants';
import type { UserReportCategory, UserReportStatus } from '../../feedback-center/contracts/feedback-center-contract';
import type { AdminUserReportsBusyAction } from '../runtime/useAdminUserReportsMutations';

type AdminUserReportsToolbarProps = {
  statusFilter: UserReportStatus | 'all';
  categoryFilter: UserReportCategory | 'all';
  loading: boolean;
  busyAction: AdminUserReportsBusyAction;
  onStatusFilterChange: (value: UserReportStatus | 'all') => void;
  onCategoryFilterChange: (value: UserReportCategory | 'all') => void;
  onReload: () => void;
};

export const AdminUserReportsToolbar = ({
  statusFilter,
  categoryFilter,
  loading,
  busyAction,
  onStatusFilterChange,
  onCategoryFilterChange,
  onReload,
}: AdminUserReportsToolbarProps) => {
  return (
    <div className={cx(uiPrimitives.clusterRow, 'ui-admin-users-toolbar')}>
      <div className={uiPrimitives.actions}>
        <TextField
          select
          label="Filtro stato"
          size="small"
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as UserReportStatus | 'all')}
          sx={{ minWidth: 210 }}
        >
          {USER_REPORT_STATUS_FILTER_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Filtro categoria"
          size="small"
          value={categoryFilter}
          onChange={(event) => onCategoryFilterChange(event.target.value as UserReportCategory | 'all')}
          sx={{ minWidth: 230 }}
        >
          {USER_REPORT_CATEGORY_FILTER_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>

        <button
          type="button"
          className={uiPrimitives.button}
          onClick={onReload}
          disabled={loading || busyAction !== null}
        >
          Aggiorna tabella
        </button>

        <Link to="/admin/changelog" className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}>
          Changelog admin
        </Link>
      </div>
    </div>
  );
};