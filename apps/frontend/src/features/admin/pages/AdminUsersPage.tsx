import { Fragment, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button as MuiButton, MenuItem, TextField } from '@mui/material';
import { Link } from 'react-router-dom';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useFeedbackMessage } from '../../../app/providers/FeedbackMessageProvider';
import {
  cx,
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

const adminUserFormSchema = z.object({
  email: z.string().email('Email non valida'),
  role: z.enum(['member', 'admin']),
  status: z.enum(['active', 'pending_password_reset', 'disabled']),
  password: z.string().optional(),
  monthlyQuota: z
    .string()
    .optional()
    .refine((value) => {
      if (!value || !value.trim()) return true;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0;
    }, 'La quota mensile deve essere un numero >= 0'),
});

type AdminUserFormValues = {
  email: string;
  role: AuthUserRole;
  status: AuthUserStatus;
  password: string;
  monthlyQuota: string;
};

const createEmptyUserForm = (): AdminUserFormValues => ({
  email: '',
  role: 'member',
  status: 'active',
  password: '',
  monthlyQuota: '',
});

const createEditUserForm = (user: AdminUser): AdminUserFormValues => ({
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
  const [busyAction, setBusyAction] = useState<'create' | `update:${string}` | `delete:${string}` | null>(null);
  const { publishSuccess, publishError } = useFeedbackMessage();

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

  const handleCreateSubmit = async (data: AdminUserFormValues) => {
    setBusyAction('create');

    try {
      const monthlyQuota = parseOptionalNumber(data.monthlyQuota);
      await createAdminUser({
        email: data.email.trim(),
        role: data.role,
        status: data.status,
        ...(data.password ? { password: data.password } : {}),
        ...(monthlyQuota !== undefined ? { monthlyQuota } : {}),
      }, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
      });

      resetCreateForm(createEmptyUserForm());
      publishSuccess(appCopy.ui.feedback.adminUsersCreated, { dedupeKey: 'admin-users:create:success' });
      usersQuery.reload();
    } catch {
      publishError(appCopy.ui.feedback.adminUsersCreateFailed, { dedupeKey: 'admin-users:create:error' });
    } finally {
      setBusyAction(null);
    }
  };

  const startEditingUser = (user: AdminUser) => {
    setEditingUserId(user.id);
    resetEditForm(createEditUserForm(user));
  };

  const handleUpdateSubmit = async (data: AdminUserFormValues, userId: string) => {
    setBusyAction(`update:${userId}`);

    try {
      const monthlyQuota = parseOptionalNumber(data.monthlyQuota);
      await updateAdminUser(userId, {
        email: data.email.trim(),
        role: data.role,
        status: data.status,
        ...(data.password ? { password: data.password } : {}),
        ...(monthlyQuota !== undefined ? { monthlyQuota } : {}),
      }, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
      });

      setEditingUserId(null);
      resetEditForm(createEmptyUserForm());
      publishSuccess(appCopy.ui.feedback.adminUsersUpdated, { dedupeKey: `admin-users:update:${userId}:success` });
      usersQuery.reload();
    } catch {
      publishError(appCopy.ui.feedback.adminUsersUpdateFailed, { dedupeKey: `admin-users:update:${userId}:error` });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setBusyAction(`delete:${userId}`);

    try {
      await deleteAdminUser(userId, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
      });

      if (editingUserId === userId) {
        setEditingUserId(null);
        resetEditForm(createEmptyUserForm());
      }
      publishSuccess(appCopy.ui.feedback.adminUsersDisabled, { dedupeKey: `admin-users:delete:${userId}:success` });
      usersQuery.reload();
    } catch {
      publishError(appCopy.ui.feedback.adminUsersDisableFailed, { dedupeKey: `admin-users:delete:${userId}:error` });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.admin.usersTitle}</h2>
        <p className={uiPrimitives.metaLine}>Gestione utenti in formato Data Table View.</p>
      </TopBar>

      <div className={cx(uiPrimitives.clusterRow, 'ui-admin-users-toolbar')}>
        <p className={uiPrimitives.metaLine}>Provisioning rapido, aggiornamento ruoli e disabilitazione account.</p>
        <div className={uiPrimitives.actions}>
          <MuiButton
            type="button"
            onClick={() => {
              setShowCreateForm((current) => !current);
            }}
            disabled={busyAction === 'create'}
            variant="outlined"
          >
            {showCreateForm ? 'Nascondi form' : 'Nuovo utente'}
          </MuiButton>
          <MuiButton
            type="button"
            onClick={() => usersQuery.reload()}
            disabled={usersQuery.loading || busyAction !== null}
            variant="outlined"
          >
            Aggiorna tabella
          </MuiButton>
          <Link to="/admin/models" className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}>
            Gestione modelli LLM
          </Link>
        </div>
      </div>

      {showCreateForm ? (
        <Surface as="form" className="ui-admin-user-form" onSubmit={handleCreateFormSubmit((data) => void handleCreateSubmit(data))}>
          <div className="ui-admin-user-form-headline">
            <h3>Nuovo utente</h3>
            <p className={uiPrimitives.metaLine}>Aggiungi un account con ruolo e quota iniziale.</p>
          </div>

          <div className="ui-admin-user-form-grid">
            <TextField
              label="Email"
              type="email"
              {...registerCreate('email')}
              error={!!createErrors.email}
              helperText={createErrors.email?.message}
              fullWidth
              required
            />

            <TextField
              select
              label="Role"
              defaultValue="member"
              {...registerCreate('role')}
              error={!!createErrors.role}
              helperText={createErrors.role?.message}
              fullWidth
            >
              {ADMIN_USER_ROLE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Status"
              defaultValue="active"
              {...registerCreate('status')}
              error={!!createErrors.status}
              helperText={createErrors.status?.message}
              fullWidth
            >
              {ADMIN_USER_STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Monthly quota"
              type="number"
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              {...registerCreate('monthlyQuota')}
              error={!!createErrors.monthlyQuota}
              helperText={createErrors.monthlyQuota?.message}
              fullWidth
            />
          </div>

          <TextField
            label="Password iniziale"
            type="password"
            {...registerCreate('password')}
            error={!!createErrors.password}
            helperText={createErrors.password?.message}
            fullWidth
          />

          <div className={uiPrimitives.actions}>
            <MuiButton type="submit" variant="contained" disabled={busyAction === 'create'}>
              {busyAction === 'create' ? 'Creazione...' : 'Crea utente'}
            </MuiButton>
            <MuiButton
              type="button"
              onClick={() => {
                resetCreateForm(createEmptyUserForm());
              }}
              disabled={busyAction === 'create'}
              variant="outlined"
            >
              {appCopy.ui.actions.reset}
            </MuiButton>
          </div>
        </Surface>
      ) : null}

      {usersQuery.loading ? <LoadingStateMessage>Caricamento utenti...</LoadingStateMessage> : null}
      {error ? <ErrorStateMessage>{error}</ErrorStateMessage> : null}

      {!error && !usersQuery.loading && users.length === 0 ? <EmptyStateMessage>Nessun utente disponibile.</EmptyStateMessage> : null}

      {!error && users.length > 0 ? (
        <div className={uiPrimitives.artifactTableWrap}>
          <table className={uiPrimitives.artifactTable}>
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Monthly quota</th>
                <th scope="col">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <Fragment key={user.id}>
                  <tr>
                    <td>
                      <strong>{user.email}</strong>
                      <p className={uiPrimitives.metaLine}>{user.id}</p>
                    </td>
                    <td>{formatMeta(appCopy.ui.meta.role, user.role)}</td>
                    <td>{formatMeta(appCopy.ui.meta.status, user.status)}</td>
                    <td>{typeof user.monthlyQuota === 'number' ? user.monthlyQuota : '-'}</td>
                    <td>
                      <div className={cx(uiPrimitives.clusterRow, 'ui-admin-user-table-actions')}>
                        <button
                          type="button"
                          className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
                          onClick={() => startEditingUser(user)}
                        >
                          Modifica
                        </button>
                        <button
                          type="button"
                          className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
                          onClick={() => void handleDeleteUser(user.id)}
                          disabled={busyAction === `delete:${user.id}` || user.status === 'disabled'}
                        >
                          {busyAction === `delete:${user.id}` ? 'Disabilitazione...' : 'Disabilita'}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {editingUserId === user.id ? (
                    <tr>
                      <td colSpan={5}>
                        <form className="ui-admin-user-form" onSubmit={handleEditFormSubmit((data) => void handleUpdateSubmit(data, user.id))}>
                          <div className="ui-admin-user-form-headline">
                            <h3>Modifica utente</h3>
                            <p className={uiPrimitives.metaLine}>{user.id}</p>
                          </div>

                          <div className="ui-admin-user-form-grid">
                            <TextField
                              label="Email"
                              type="email"
                              {...registerEdit('email')}
                              error={!!editErrors.email}
                              helperText={editErrors.email?.message}
                              fullWidth
                              required
                            />

                            <TextField
                              select
                              label="Role"
                              defaultValue="member"
                              {...registerEdit('role')}
                              error={!!editErrors.role}
                              helperText={editErrors.role?.message}
                              fullWidth
                            >
                              {ADMIN_USER_ROLE_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                              ))}
                            </TextField>

                            <TextField
                              select
                              label="Status"
                              defaultValue="active"
                              {...registerEdit('status')}
                              error={!!editErrors.status}
                              helperText={editErrors.status?.message}
                              fullWidth
                            >
                              {ADMIN_USER_STATUS_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                              ))}
                            </TextField>

                            <TextField
                              label="Monthly quota"
                              type="number"
                              slotProps={{ htmlInput: { min: 0, step: 1 } }}
                              {...registerEdit('monthlyQuota')}
                              error={!!editErrors.monthlyQuota}
                              helperText={editErrors.monthlyQuota?.message}
                              fullWidth
                            />
                          </div>

                          <TextField
                            label="Nuova password"
                            type="password"
                            {...registerEdit('password')}
                            error={!!editErrors.password}
                            helperText={editErrors.password?.message}
                            fullWidth
                          />

                          <div className={uiPrimitives.actions}>
                            <MuiButton type="submit" variant="contained" disabled={busyAction === `update:${user.id}`}>
                              {busyAction === `update:${user.id}` ? 'Salvataggio...' : 'Salva'}
                            </MuiButton>
                            <MuiButton
                              type="button"
                              disabled={busyAction === `update:${user.id}`}
                              variant="outlined"
                              onClick={() => {
                                setEditingUserId(null);
                                resetEditForm(createEmptyUserForm());
                              }}
                            >
                              {appCopy.ui.actions.cancel}
                            </MuiButton>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Surface>
  );
};
