import type { ToolCheckpoint } from '../../generation/ui/tool-checkpoints';
import { uiPrimitives } from '../../../app/ui/primitives';

type ActivityLogTableProps = {
  rows: ToolCheckpoint[];
};

export const ActivityLogTable = ({ rows }: ActivityLogTableProps) => {
  return (
    <div className={uiPrimitives.artifactTableWrap}>
      <table className={uiPrimitives.artifactTable}>
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col">Artifact</th>
            <th scope="col">Status</th>
            <th scope="col">Aggiornato</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.artifactId}>
              <td><strong>{item.projectId}</strong></td>
              <td><span className={uiPrimitives.metaLine}>{item.artifactId}</span></td>
              <td><span className={uiPrimitives.metaLine}>{item.status}</span></td>
              <td><span className={uiPrimitives.metaLine}>{new Date(item.updatedAt).toLocaleString()}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};