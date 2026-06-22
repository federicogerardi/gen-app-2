import { Link } from 'react-router-dom';

import { appCopy } from '../../../app/copy/system';
import { cx, uiPrimitives } from '../../../app/ui/primitives';

type AdminChangelogToolbarProps = {
  showArchived: boolean;
  loading: boolean;
  isPublishing: boolean;
  busyAction: string | null;
  onToggleArchived: () => void;
  onReload: () => void;
};

export const AdminChangelogToolbar = ({
  showArchived,
  loading,
  isPublishing,
  busyAction,
  onToggleArchived,
  onReload,
}: AdminChangelogToolbarProps) => {
  return (
    <div className={cx(uiPrimitives.clusterRow, 'ui-admin-users-toolbar')}>
      <p className={uiPrimitives.metaLine}>{appCopy.ui.adminChangelog.toolbarDescription}</p>
      <div className={uiPrimitives.actions}>
        <Link to="/admin/user-reports" className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}>
          {appCopy.ui.adminChangelog.inboxLink}
        </Link>
        <button
          type="button"
          className={uiPrimitives.button}
          onClick={onToggleArchived}
          disabled={loading}
        >
          {showArchived ? appCopy.ui.adminChangelog.toggleArchivedHide : appCopy.ui.adminChangelog.toggleArchivedShow}
        </button>
        <button
          type="button"
          className={uiPrimitives.button}
          onClick={onReload}
          disabled={loading || isPublishing || busyAction !== null}
        >
          {appCopy.ui.adminChangelog.reloadTable}
        </button>
      </div>
    </div>
  );
};