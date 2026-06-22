import { Button as MuiButton } from '@mui/material';

import { appCopy } from '../../../app/copy/system';
import { cx, uiPrimitives } from '../../../app/ui/primitives';
import type { AdminUsersBusyAction } from '../runtime/useAdminUsersMutations';

type AdminUsersToolbarProps = {
  showCreateForm: boolean;
  busyAction: AdminUsersBusyAction;
  isLoading: boolean;
  onToggleCreateForm: () => void;
  onReload: () => void;
};

export const AdminUsersToolbar = ({
  showCreateForm,
  busyAction,
  isLoading,
  onToggleCreateForm,
  onReload,
}: AdminUsersToolbarProps) => {
  return (
    <div className={cx(uiPrimitives.clusterRow, 'ui-admin-users-toolbar')}>
      <p className={uiPrimitives.metaLine}>{appCopy.ui.adminUsers.toolbarDescription}</p>
      <div className={uiPrimitives.actions}>
        <MuiButton
          type="button"
          onClick={onToggleCreateForm}
          disabled={busyAction === 'create'}
          variant="outlined"
        >
          {showCreateForm ? appCopy.ui.adminUsers.toggleCreateHide : appCopy.ui.adminUsers.toggleCreateShow}
        </MuiButton>
        <MuiButton
          type="button"
          onClick={onReload}
          disabled={isLoading || busyAction !== null}
          variant="outlined"
        >
          {appCopy.ui.adminUsers.reloadTable}
        </MuiButton>
      </div>
    </div>
  );
};