import { cx, uiPrimitives } from '../../../app/ui/primitives';
import type { AdminLlmModelRow } from '../llm/LLMTable';

type AdminModelTableRowProps = {
  model: AdminLlmModelRow;
  busyAction: string | null;
  onSetDefault: (model: AdminLlmModelRow) => void;
  onToggleStatus: (model: AdminLlmModelRow) => void;
  onDelete: (model: AdminLlmModelRow) => void;
};

export const AdminModelTableRow = ({
  model,
  busyAction,
  onSetDefault,
  onToggleStatus,
  onDelete,
}: AdminModelTableRowProps) => {
  return (
    <tr>
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
  );
};