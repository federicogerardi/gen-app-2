import { appCopy } from '../../../app/copy/system';
import type { ToolCheckpoint } from '../../generation/ui/tool-checkpoints';
import { uiPrimitives } from '../../../app/ui/primitives';
import { StatusBadge } from '../../../app/ui/StatusBadge';
import { formatAdminDateTime } from '../runtime/admin-date-format';

type ActivityLogTableProps = {
  rows: ToolCheckpoint[];
};

export const ActivityLogTable = ({ rows }: ActivityLogTableProps) => {
  return (
    <div className={uiPrimitives.artifactTableWrap}>
      <table className={uiPrimitives.artifactTable}>
        <thead>
          <tr>
            <th scope="col">{appCopy.ui.adminActivity.tableHeaders.project}</th>
            <th scope="col">{appCopy.ui.adminActivity.tableHeaders.artifact}</th>
            <th scope="col">{appCopy.ui.adminActivity.tableHeaders.status}</th>
            <th scope="col">{appCopy.ui.adminActivity.tableHeaders.updated}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.artifactId}>
              <td><strong>{item.projectId}</strong></td>
              <td><span className={uiPrimitives.metaLine}>{item.artifactId}</span></td>
              <td><StatusBadge status={item.status} /></td>
              <td><span className={uiPrimitives.metaLine}>{formatAdminDateTime(item.updatedAt)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};