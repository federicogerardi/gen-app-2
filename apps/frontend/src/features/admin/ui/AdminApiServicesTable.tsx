import { cx, uiPrimitives } from '../../../app/ui/primitives';
import { appCopy } from '../../../app/copy/system';
import { StatusBadge } from '../../../app/ui/StatusBadge';
import type { ApiService } from '../runtime/admin-client';
import type { AdminApiServicesBusyAction } from '../runtime/useAdminApiServicesMutations';

type AdminApiServicesTableProps = {
  apiServices: ApiService[];
  selectedApiServiceId: string | null;
  editingApiServiceId: string | null;
  busyAction: AdminApiServicesBusyAction;
  onStartEdit: (apiService: ApiService) => void;
  onDelete: (apiServiceId: string) => void;
  onSelectBindings: (apiService: ApiService) => void;
};

export const AdminApiServicesTable = ({
  apiServices,
  selectedApiServiceId,
  editingApiServiceId,
  busyAction,
  onStartEdit,
  onDelete,
  onSelectBindings,
}: AdminApiServicesTableProps) => {
  return (
    <div className={uiPrimitives.artifactTableWrap}>
      <table className={uiPrimitives.artifactTable}>
        <thead>
          <tr>
            <th scope="col">{appCopy.ui.adminApiServices.tableHeaders.key}</th>
            <th scope="col">{appCopy.ui.adminApiServices.tableHeaders.label}</th>
            <th scope="col">{appCopy.ui.adminApiServices.tableHeaders.accessMode}</th>
            <th scope="col">{appCopy.ui.adminApiServices.tableHeaders.requestMethod}</th>
            <th scope="col">{appCopy.ui.adminApiServices.tableHeaders.status}</th>
            <th scope="col">{appCopy.ui.adminApiServices.tableHeaders.token}</th>
            <th scope="col">{appCopy.ui.adminApiServices.tableHeaders.actions}</th>
          </tr>
        </thead>
        <tbody>
          {apiServices.map((apiService) => {
            const rowSelected = selectedApiServiceId === apiService.id;

            return (
              <tr key={apiService.id} className={rowSelected ? uiPrimitives.artifactRowSelected : undefined}>
                <td><code>{apiService.key}</code></td>
                <td>{apiService.label}</td>
                <td>{apiService.accessMode}</td>
                <td>{apiService.requestMethod}</td>
                <td><StatusBadge status={apiService.status} /></td>
                <td>{apiService.tokenConfigured ? appCopy.ui.adminApiServices.tokenConfigured : appCopy.ui.adminApiServices.tokenNotConfigured}</td>
                <td>
                  <div className={cx(uiPrimitives.clusterRow, 'ui-admin-api-service-row-actions')}>
                    <button
                      type="button"
                      className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
                      onClick={() => onStartEdit(apiService)}
                      disabled={busyAction !== null}
                    >
                      {appCopy.ui.actions.edit}
                    </button>
                    <button
                      type="button"
                      className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
                      onClick={() => onSelectBindings(apiService)}
                      disabled={busyAction !== null}
                    >
                      {appCopy.ui.adminApiServices.openBindingsAction}
                    </button>
                    <button
                      type="button"
                      className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
                      onClick={() => onDelete(apiService.id)}
                      disabled={busyAction !== null || editingApiServiceId === apiService.id}
                    >
                      {appCopy.ui.actions.delete}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
