import { appCopy } from '../../../app/copy/system';
import { uiPrimitives } from '../../../app/ui/primitives';
import { AdminModelTableRow } from '../ui/AdminModelTableRow';

export type AdminLlmModelRow = {
  id: string;
  key: string;
  label: string;
  status: 'enabled' | 'disabled';
  isDefault: boolean;
  sortOrder: number | null;
};

type LLMTableProps = {
  models: AdminLlmModelRow[];
  busyAction: string | null;
  onSetDefault: (model: AdminLlmModelRow) => void;
  onToggleStatus: (model: AdminLlmModelRow) => void;
  onDelete: (model: AdminLlmModelRow) => void;
};

export const LLMTable = ({ models, busyAction, onSetDefault, onToggleStatus, onDelete }: LLMTableProps) => {
  return (
    <div className={uiPrimitives.artifactTableWrap}>
      <table className={uiPrimitives.artifactTable}>
        <thead>
          <tr>
            <th scope="col">{appCopy.ui.adminModels.tableHeaders.key}</th>
            <th scope="col">{appCopy.ui.adminModels.tableHeaders.label}</th>
            <th scope="col">{appCopy.ui.adminModels.tableHeaders.status}</th>
            <th scope="col">{appCopy.ui.adminModels.tableHeaders.default}</th>
            <th scope="col">{appCopy.ui.adminModels.tableHeaders.actions}</th>
          </tr>
        </thead>
        <tbody>
          {models.map((model) => (
            <AdminModelTableRow
              key={model.id}
              model={model}
              busyAction={busyAction}
              onSetDefault={onSetDefault}
              onToggleStatus={onToggleStatus}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};