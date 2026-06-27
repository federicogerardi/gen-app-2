import { appCopy } from '../../../app/copy/system';
import { uiPrimitives } from '../../../app/ui/primitives';
import type { AdminUser } from '../runtime/admin-client';
import type { AdminUserFormValues } from '../runtime/admin-user-form';
import type { AdminUsersBusyAction } from '../runtime/useAdminUsersMutations';
import { AdminUserTableRow } from './AdminUserTableRow';

type AdminUsersTableProps = {
  users: AdminUser[];
  editingUserId: string | null;
  busyAction: AdminUsersBusyAction;
  onStartEdit: (user: AdminUser) => void;
  onDisable: (userId: string) => void;
  onEditSubmit: (userId: string, data: AdminUserFormValues) => void;
  onEditCancel: () => void;
  registerEdit: any;
  editErrors: any;
  handleEditSubmit: any;
};

export const AdminUsersTable = ({
  users,
  editingUserId,
  busyAction,
  onStartEdit,
  onDisable,
  onEditSubmit,
  onEditCancel,
  registerEdit,
  editErrors,
  handleEditSubmit,
}: AdminUsersTableProps) => {
  return (
    <div className={uiPrimitives.artifactTableWrap}>
      <table className={uiPrimitives.artifactTable}>
        <thead>
          <tr>
            <th scope="col">{appCopy.ui.adminUsers.tableHeaders.email}</th>
            <th scope="col">{appCopy.ui.adminUsers.tableHeaders.role}</th>
            <th scope="col">{appCopy.ui.adminUsers.tableHeaders.status}</th>
            <th scope="col">{appCopy.ui.adminUsers.tableHeaders.monthlyQuota}</th>
            <th scope="col">{appCopy.ui.adminUsers.tableHeaders.monthlyArtifactLimit}</th>
            <th scope="col">{appCopy.ui.adminUsers.tableHeaders.actions}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <AdminUserTableRow
              key={user.id}
              user={user}
              isEditing={editingUserId === user.id}
              busyAction={busyAction}
              onStartEdit={onStartEdit}
              onDisable={onDisable}
              onEditSubmit={onEditSubmit}
              onEditCancel={onEditCancel}
              registerEdit={registerEdit}
              editErrors={editErrors}
              handleEditSubmit={handleEditSubmit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};