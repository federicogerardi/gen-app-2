import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { appCopy } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import {
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
} from '../../../app/ui/primitives';
import { useAdminUsersQuery } from '../../../app/runtime/queries/useAdminUsersQuery';
import { type AdminUser } from '../runtime/admin-client';
import {
  adminUserFormSchema,
  createEditUserForm,
  createEmptyUserForm,
  type AdminUserFormValues,
} from '../runtime/admin-user-form';
import { useAdminUsersMutations } from '../runtime/useAdminUsersMutations';
import { AdminUserCreateForm } from '../ui/AdminUserCreateForm';
import { AdminPageContainer } from '../ui/AdminPageContainer';
import { AdminUsersToolbar } from '../ui/AdminUsersToolbar';
import { AdminUsersTable } from '../ui/AdminUsersTable';

export const AdminUsersPage = () => {
  const auth = useAuthSession();
  const usersQuery = useAdminUsersQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
  });

  const users = usersQuery.data;
  const error = usersQuery.error;
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const {
    register: registerCreate,
    handleSubmit: handleCreateFormSubmit,
    reset: resetCreateForm,
    formState: { errors: createErrors },
  } = useForm<AdminUserFormValues>({
    resolver: zodResolver(adminUserFormSchema) as any,
    defaultValues: createEmptyUserForm(),
  });

  const {
    register: registerEdit,
    handleSubmit: handleEditFormSubmit,
    reset: resetEditForm,
    formState: { errors: editErrors },
  } = useForm<AdminUserFormValues>({
    resolver: zodResolver(adminUserFormSchema) as any,
    defaultValues: createEmptyUserForm(),
  });

  const closeEditForm = () => {
    setEditingUserId(null);
    resetEditForm(createEmptyUserForm());
  };

  const { busyAction, createUser, updateUser, disableUser } = useAdminUsersMutations({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    editingUserId,
    reloadUsers: usersQuery.reload,
    onCreateReset: () => resetCreateForm(createEmptyUserForm()),
    onEditClosed: closeEditForm,
  });

  const startEditingUser = (user: AdminUser) => {
    setEditingUserId(user.id);
    resetEditForm(createEditUserForm(user));
  };

  return (
    <AdminPageContainer
      title={appCopy.editorial.admin.usersTitle}
      description="Provisioning rapido, aggiornamento ruoli e disabilitazione account in una vista tabellare coerente."
    >

      <AdminUsersToolbar
        showCreateForm={showCreateForm}
        busyAction={busyAction}
        isLoading={usersQuery.loading}
        onToggleCreateForm={() => {
          setShowCreateForm((current) => !current);
        }}
        onReload={usersQuery.reload}
      />

      {showCreateForm ? (
        <AdminUserCreateForm
          busyAction={busyAction}
          register={registerCreate}
          errors={createErrors}
          handleSubmit={handleCreateFormSubmit}
          onSubmit={(data) => void createUser(data)}
          reset={resetCreateForm}
        />
      ) : null}

      {usersQuery.loading ? <LoadingStateMessage>{appCopy.ui.states.loadingUsers}</LoadingStateMessage> : null}
      {error ? <ErrorStateMessage>{error}</ErrorStateMessage> : null}

      {!error && !usersQuery.loading && users.length === 0 ? <EmptyStateMessage>Nessun utente disponibile.</EmptyStateMessage> : null}

      {!error && users.length > 0 ? (
        <AdminUsersTable
          users={users}
          editingUserId={editingUserId}
          busyAction={busyAction}
          onStartEdit={startEditingUser}
          onDisable={(userId) => void disableUser(userId)}
          onEditSubmit={(userId, data) => void updateUser(userId, data)}
          onEditCancel={closeEditForm}
          registerEdit={registerEdit}
          editErrors={editErrors}
          handleEditSubmit={handleEditFormSubmit}
        />
      ) : null}
    </AdminPageContainer>
  );
};
