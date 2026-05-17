import { cx, uiPrimitives } from '../../../app/ui/primitives';

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
            <tr key={model.id}>
              <td><code>{model.key}</code></td>
              <td>{model.label}</td>
              <td>{model.status}</td>
              <td>{model.isDefault ? 'default' : '-'}</td>
              <td>
                <div className={cx(uiPrimitives.clusterRow, 'ui-admin-user-table-actions')}>
                  <button
                    type="button"
                    className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
                    onClick={() => onSetDefault(model)}
                    disabled={busyAction !== null || model.isDefault}
                  >
                    Predefinito
                  </button>

                  <button
                    type="button"
                    className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
                    onClick={() => onToggleStatus(model)}
                    disabled={busyAction !== null}
                  >
                    {model.status === 'enabled' ? 'Disabilita' : 'Abilita'}
                  </button>

                  <button
                    type="button"
                    className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
                    onClick={() => onDelete(model)}
                    disabled={busyAction !== null}
                  >
                    Elimina
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};