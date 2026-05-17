import { Fragment } from 'react';

import { formatMeta } from '../../../app/copy/system';
import { cx, uiPrimitives } from '../../../app/ui/primitives';
import { StatusBadge } from '../../../app/ui/StatusBadge';
import type { AdminUser } from '../runtime/admin-client';
import type { AdminUserFormValues } from '../runtime/admin-user-form';
import type { AdminUsersBusyAction } from '../runtime/useAdminUsersMutations';
import { AdminUserEditForm } from './AdminUserEditForm';

type AdminUserTableRowProps = {
  user: AdminUser;
  isEditing: boolean;
  busyAction: AdminUsersBusyAction;
  onStartEdit: (user: AdminUser) => void;
  onDisable: (userId: string) => void;
  onEditSubmit: (userId: string, data: AdminUserFormValues) => void;
  onEditCancel: () => void;
  registerEdit: any;
  editErrors: any;
  handleEditSubmit: any;
};

export const AdminUserTableRow = ({
  user,
  isEditing,
  busyAction,
  onStartEdit,
  onDisable,
  onEditSubmit,
  onEditCancel,
  registerEdit,
  editErrors,
  handleEditSubmit,
}: AdminUserTableRowProps) => {
  return (
    <Fragment>
      <tr>
        <td>
          <strong>{user.email}</strong>
          <p className={uiPrimitives.metaLine}>{user.id}</p>
        </td>
        <td>{formatMeta('Role', user.role)}</td>
        <td><StatusBadge status={user.status} /></td>
        <td>{typeof user.monthlyQuota === 'number' ? user.monthlyQuota : '-'}</td>
        <td>
          <div className={cx(uiPrimitives.clusterRow, 'ui-admin-user-table-actions')}>
            <button
              type="button"
              className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
              onClick={() => onStartEdit(user)}
            >
              Modifica
            </button>
            <button
              type="button"
              className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
              onClick={() => void onDisable(user.id)}
              disabled={busyAction === `delete:${user.id}` || user.status === 'disabled'}
            >
              {busyAction === `delete:${user.id}` ? 'Disabilitazione...' : 'Disabilita'}
            </button>
          </div>
        </td>
      </tr>

      {isEditing ? (
        <tr>
          <td colSpan={5}>
            <AdminUserEditForm
              userId={user.id}
              busyAction={busyAction}
              register={registerEdit}
              errors={editErrors}
              handleSubmit={handleEditSubmit}
              onSubmit={(data) => onEditSubmit(user.id, data)}
              onCancel={onEditCancel}
              headline="Modifica utente"
              subheadline={user.id}
              roleDefaultValue={user.role}
              statusDefaultValue={user.status}
            />
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
};