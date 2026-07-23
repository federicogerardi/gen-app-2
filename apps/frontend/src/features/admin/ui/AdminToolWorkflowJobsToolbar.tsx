import { Button as MuiButton } from '@mui/material';
import { appCopy } from '../../../app/copy/system';
import { cx, uiPrimitives } from '../../../app/ui/primitives';

type AdminToolWorkflowJobsToolbarProps = {
  isLoading: boolean;
  onReload: () => void;
};

const adminCopy = appCopy.ui.toolWorkflowJob.admin;

export const AdminToolWorkflowJobsToolbar = ({ isLoading, onReload }: AdminToolWorkflowJobsToolbarProps) => {
  return (
    <div className={cx(uiPrimitives.clusterRow, 'ui-admin-twjobs-toolbar')}>
      <p className={uiPrimitives.metaLine}>{adminCopy.toolbarDescription}</p>
      <div className={uiPrimitives.actions}>
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
