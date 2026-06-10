import { Button as MuiButton } from '@mui/material';

import { appCopy } from '../../../app/copy/system';
import { cx, uiPrimitives } from '../../../app/ui/primitives';
import type { AdminApiServicesBusyAction } from '../runtime/useAdminApiServicesMutations';

type AdminApiServicesToolbarProps = {
  showCreateForm: boolean;
  busyAction: AdminApiServicesBusyAction;
  loading: boolean;
  onToggleCreateForm: () => void;
  onReload: () => void;
};

export const AdminApiServicesToolbar = ({
  showCreateForm,
  busyAction,
  loading,
  onToggleCreateForm,
  onReload,
}: AdminApiServicesToolbarProps) => {
  return (
    <div className={cx(uiPrimitives.clusterRow, 'ui-admin-api-services-toolbar')}>
      <p className={uiPrimitives.metaLine}>{appCopy.ui.adminApiServices.toolbarDescription}</p>
      <div className={uiPrimitives.actions}>
        <MuiButton type="button" onClick={onToggleCreateForm} disabled={busyAction === 'create'} variant="outlined">
          {showCreateForm ? appCopy.ui.adminApiServices.toggleCreateHide : appCopy.ui.adminApiServices.toggleCreateShow}
        </MuiButton>
        <MuiButton type="button" onClick={onReload} disabled={loading || busyAction !== null} variant="outlined">
          {appCopy.ui.adminApiServices.reloadTable}
        </MuiButton>
      </div>
    </div>
  );
};
