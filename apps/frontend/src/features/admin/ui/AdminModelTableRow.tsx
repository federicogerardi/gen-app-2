import { cx, uiPrimitives } from '../../../app/ui/primitives';
import { StatusBadge } from '../../../app/ui/StatusBadge';
import type { AdminLlmModelRow } from '../llm/LLMTable';
import { appCopy } from '../../../app/copy/system';

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
      <td><StatusBadge status={model.status} /></td>
      <td>{model.isDefault ? appCopy.ui.adminModels.defaultLabel : appCopy.ui.adminModels.noDefaultLabel}</td>
      <td>
        <div className={cx(uiPrimitives.clusterRow, 'ui-admin-user-table-actions')}>
          <button
            type="button"
            className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
            onClick={() => onSetDefault(model)}
            disabled={busyAction !== null || model.isDefault}
          >
            {appCopy.ui.actions.setAsDefault}
          </button>

          <button
            type="button"
            className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
            onClick={() => onToggleStatus(model)}
            disabled={busyAction !== null}
          >
            {model.status === 'enabled' ? appCopy.ui.actions.disable : appCopy.ui.actions.enable}
          </button>

          <button
            type="button"
            className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
            onClick={() => onDelete(model)}
            disabled={busyAction !== null}
          >
            {appCopy.ui.actions.delete}
          </button>
        </div>
      </td>
    </tr>
  );
};