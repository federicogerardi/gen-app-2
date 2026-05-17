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
            <th scope="col">Key</th>
            <th scope="col">Label</th>
            <th scope="col">Status</th>
            <th scope="col">Default</th>
            <th scope="col">Azioni</th>
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