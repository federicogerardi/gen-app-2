import { appCopy, formatMeta } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { Surface, uiPrimitives } from '../../../app/ui/primitives';
import { useAdminUsersQuery } from '../../../app/runtime/queries/useAdminUsersQuery';

export const AdminUsersPage = () => {
  const auth = useAuthSession();
  const usersQuery = useAdminUsersQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
  });

  const users = usersQuery.data;
  const error = usersQuery.error;

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <h2>{appCopy.editorial.admin.usersTitle}</h2>
      {usersQuery.loading ? <p className={uiPrimitives.metaLine}>Caricamento utenti...</p> : null}
      {error ? <p className={uiPrimitives.error}>{error}</p> : null}
      <ul className={uiPrimitives.listClean}>
        {users.map((user) => (
          <Surface as="li" key={user.id}>
            <p><strong>{user.email}</strong></p>
            <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.role, user.role)}</p>
            <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.status, user.status)}</p>
          </Surface>
        ))}
      </ul>
    </Surface>
  );
};
