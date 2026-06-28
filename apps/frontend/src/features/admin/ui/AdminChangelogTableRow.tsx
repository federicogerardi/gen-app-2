import { appCopy } from '../../../app/copy/system';
import { cx, uiPrimitives } from '../../../app/ui/primitives';
import type { ProductChangelogDto } from '../../feedback-center/contracts/feedback-center-contract';

type AdminChangelogTableRowProps = {
  row: ProductChangelogDto;
  busyAction: string | null;
  onArchive: (changelogId: string) => void;
};

export const AdminChangelogTableRow = ({ row, busyAction, onArchive }: AdminChangelogTableRowProps) => {
  return (
    <div className={cx(uiPrimitives.clusterRow, 'ui-admin-user-table-actions')}>
      <button
        type="button"
        className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
        onClick={() => onArchive(row.id)}
        disabled={busyAction !== null || row.status !== 'published'}
      >
        {appCopy.ui.adminChangelog.archiveAction}
      </button>
    </div>
  );
};