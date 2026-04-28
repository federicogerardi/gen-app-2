import { FormEvent, useState } from 'react';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import {
  Button,
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
  Surface,
  TopBar,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { useAdminUsersQuery } from '../../../app/runtime/queries/useAdminUsersQuery';
import {
  createAdminUser,
  deleteAdminUser,
  updateAdminUser,
  type AdminUser,
} from '../runtime/admin-client';
import type { AuthUserRole, AuthUserStatus } from '../../auth/runtime/auth-client';

const ADMIN_USER_ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
] as const;

const ADMIN_USER_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'pending_password_reset', label: 'Pending password reset' },
  { value: 'disabled', label: 'Disabled' },
] as const;

type AdminUserFormState = {
  email: string;
  role: AuthUserRole;
  status: AuthUserStatus;
  password: string;
  monthlyQuota: string;
};

const createEmptyUserForm = (): AdminUserFormState => ({
  email: '',
  role: 'member',
  status: 'active',
  password: '',
  monthlyQuota: '',
});

const createEditUserForm = (user: AdminUser): AdminUserFormState => ({
  email: user.email,
  role: user.role,
  status: user.status,
  password: '',
  monthlyQuota: typeof user.monthlyQuota === 'number' ? String(user.monthlyQuota) : '',
});

const parseOptionalNumber = (value: string): number | undefined => {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseRoleInput = (value: string): AuthUserRole => {
  return value === 'admin' ? 'admin' : 'member';
};

const parseStatusInput = (value: string): AuthUserStatus => {
  if (value === 'disabled' || value === 'pending_password_reset') {
    return value;
  }

  return 'active';
};

export const AdminUsersPage = () => {
  const auth = useAuthSession();
  const usersQuery = useAdminUsersQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
  });

  const users = usersQuery.data;
  const error = usersQuery.error;
  const [createForm, setCreateForm] = useState<AdminUserFormState>(() => createEmptyUserForm());
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AdminUserFormState>(() => createEmptyUserForm());
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'create' | `update:${string}` | `delete:${string}` | null>(null);

  const resetFeedback = () => {
    setMutationError(null);
    setFeedbackMessage(null);
  };

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    setBusyAction('create');

    try {
      const monthlyQuota = parseOptionalNumber(createForm.monthlyQuota);
      await createAdminUser({
        email: createForm.email.trim(),
        role: createForm.role,
        status: createForm.status,
        ...(createForm.password ? { password: createForm.password } : {}),
        ...(monthlyQuota !== undefined ? { monthlyQuota } : {}),
      }, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
      });

      setCreateForm(createEmptyUserForm());
      setFeedbackMessage('Utente creato.');
      usersQuery.reload();
    } catch (createError) {
      setMutationError(createError instanceof Error ? createError.message : 'Impossibile creare utente');
    } finally {
      setBusyAction(null);
    }
  };

  const startEditingUser = (user: AdminUser) => {
    resetFeedback();
    setEditingUserId(user.id);
    setEditForm(createEditUserForm(user));
  };

  const handleUpdateSubmit = async (event: FormEvent<HTMLFormElement>, userId: string) => {
    event.preventDefault();
    resetFeedback();
    setBusyAction(`update:${userId}`);

    try {
      const monthlyQuota = parseOptionalNumber(editForm.monthlyQuota);
      await updateAdminUser(userId, {
        email: editForm.email.trim(),
        role: editForm.role,
        status: editForm.status,
        ...(editForm.password ? { password: editForm.password } : {}),
        ...(monthlyQuota !== undefined ? { monthlyQuota } : {}),
      }, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
      });

      setEditingUserId(null);
      setEditForm(createEmptyUserForm());
      setFeedbackMessage('Utente aggiornato.');
      usersQuery.reload();
    } catch (updateError) {
      setMutationError(updateError instanceof Error ? updateError.message : 'Impossibile aggiornare utente');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    resetFeedback();
    setBusyAction(`delete:${userId}`);

    try {
      await deleteAdminUser(userId, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
      });

      if (editingUserId === userId) {
        setEditingUserId(null);
        setEditForm(createEmptyUserForm());
      }
      setFeedbackMessage('Utente disabilitato.');
      usersQuery.reload();
    } catch (deleteError) {
      setMutationError(deleteError instanceof Error ? deleteError.message : 'Impossibile disabilitare utente');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.admin.usersTitle}</h2>
        <p className={uiPrimitives.metaLine}>Create, aggiorna e disabilita account workspace.</p>
      </TopBar>

      <Surface as="form" className="ui-admin-user-form" onSubmit={handleCreateSubmit}>
        <div className="ui-admin-user-form-headline">
          <h3>Nuovo utente</h3>
          <p className={uiPrimitives.metaLine}>Provisioning rapido per accessi admin e member.</p>
        </div>

        <div className="ui-admin-user-form-grid">
          <label>
            Email
            <input
              name="email"
              type="email"
              value={createForm.email}
              onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </label>

          <label>
            Role
            <select
              name="role"
              value={createForm.role}
              onChange={(event) => setCreateForm((current) => ({ ...current, role: parseRoleInput(event.target.value) }))}
            >
              {ADMIN_USER_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select
              name="status"
              value={createForm.status}
              onChange={(event) => setCreateForm((current) => ({ ...current, status: parseStatusInput(event.target.value) }))}
            >
              {ADMIN_USER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            Monthly quota
            <input
              name="monthlyQuota"
              type="number"
              min="0"
              step="1"
              value={createForm.monthlyQuota}
              onChange={(event) => setCreateForm((current) => ({ ...current, monthlyQuota: event.target.value }))}
            />
          </label>
        </div>

        <label>
          Password iniziale
          <input
            name="password"
            type="password"
            value={createForm.password}
            onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
          />
        </label>

        <div className={uiPrimitives.actions}>
          <Button type="submit" disabled={busyAction === 'create'}>
            {busyAction === 'create' ? 'Creazione...' : 'Crea utente'}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setCreateForm(createEmptyUserForm());
              resetFeedback();
            }}
            disabled={busyAction === 'create'}
          >
            {appCopy.ui.actions.reset}
          </Button>
        </div>
      </Surface>

      {usersQuery.loading ? <LoadingStateMessage>Caricamento utenti...</LoadingStateMessage> : null}
      {error ? <ErrorStateMessage>{error}</ErrorStateMessage> : null}
      {mutationError ? <ErrorStateMessage>{mutationError}</ErrorStateMessage> : null}
      {feedbackMessage ? <LoadingStateMessage>{feedbackMessage}</LoadingStateMessage> : null}
      {!error && !usersQuery.loading && users.length === 0 ? <EmptyStateMessage>Nessun utente disponibile.</EmptyStateMessage> : null}
      <ul className={uiPrimitives.listClean}>
        {users.map((user) => (
          <Surface as="li" key={user.id} className="ui-admin-user-card">
            {editingUserId === user.id ? (
              <form className="ui-admin-user-form" onSubmit={(event) => handleUpdateSubmit(event, user.id)}>
                <div className="ui-admin-user-form-headline">
                  <h3>Modifica utente</h3>
                  <p className={uiPrimitives.metaLine}>{user.id}</p>
                </div>

                <div className="ui-admin-user-form-grid">
                  <label>
                    Email
                    <input
                      name={`email-${user.id}`}
                      type="email"
                      value={editForm.email}
                      onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
                      required
                    />
                  </label>

                  <label>
                    Role
                    <select
                      name={`role-${user.id}`}
                      value={editForm.role}
                      onChange={(event) => setEditForm((current) => ({ ...current, role: parseRoleInput(event.target.value) }))}
                    >
                      {ADMIN_USER_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Status
                    <select
                      name={`status-${user.id}`}
                      value={editForm.status}
                      onChange={(event) => setEditForm((current) => ({ ...current, status: parseStatusInput(event.target.value) }))}
                    >
                      {ADMIN_USER_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Monthly quota
                    <input
                      name={`quota-${user.id}`}
                      type="number"
                      min="0"
                      step="1"
                      value={editForm.monthlyQuota}
                      onChange={(event) => setEditForm((current) => ({ ...current, monthlyQuota: event.target.value }))}
                    />
                  </label>
                </div>

                <label>
                  Nuova password
                  <input
                    name={`password-${user.id}`}
                    type="password"
                    value={editForm.password}
                    onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))}
                  />
                </label>

                <div className={uiPrimitives.actions}>
                  <Button type="submit" disabled={busyAction === `update:${user.id}`}>
                    {busyAction === `update:${user.id}` ? 'Salvataggio...' : 'Salva'}
                  </Button>
                  <Button
                    type="button"
                    disabled={busyAction === `update:${user.id}`}
                    onClick={() => {
                      setEditingUserId(null);
                      setEditForm(createEmptyUserForm());
                    }}
                  >
                    {appCopy.ui.actions.cancel}
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <div className="ui-admin-user-summary">
                  <div>
                    <p><strong>{user.email}</strong></p>
                    <p className={uiPrimitives.metaLine}>{user.id}</p>
                  </div>
                  <div className="ui-admin-user-kpis">
                    <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.role, user.role)}</p>
                    <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.status, user.status)}</p>
                    {typeof user.monthlyQuota === 'number'
                      ? <p className={uiPrimitives.metaLine}>{formatMeta('quota', user.monthlyQuota)}</p>
                      : null}
                  </div>
                </div>

                <div className={uiPrimitives.actions}>
                  <Button type="button" onClick={() => startEditingUser(user)}>
                    Modifica
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleDeleteUser(user.id)}
                    disabled={busyAction === `delete:${user.id}` || user.status === 'disabled'}
                  >
                    {busyAction === `delete:${user.id}` ? 'Disabilitazione...' : 'Disabilita'}
                  </Button>
                </div>
              </>
            )}
          </Surface>
        ))}
      </ul>
    </Surface>
  );
};
