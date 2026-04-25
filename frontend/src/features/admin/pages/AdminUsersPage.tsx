import { useEffect, useState } from 'react';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { Surface, uiPrimitives } from '../../../app/ui/primitives';

type AdminUser = {
  id: string;
  email: string;
  role: string;
  status: string;
};

export const AdminUsersPage = () => {
  const auth = useAuthSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`${auth.apiBaseUrl}/admin/users`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(appCopy.ui.fallbackErrors.loadAdminUsersHttp(response.status));
        }

        const body = (await response.json()) as { users?: AdminUser[] } | AdminUser[];
        setUsers(Array.isArray(body) ? body : (body.users ?? []));
        setError(null);
      } catch (loadError) {
        setUsers([]);
        setError(loadError instanceof Error ? loadError.message : appCopy.ui.fallbackErrors.loadAdminUsers);
      }
    })();
  }, [auth.apiBaseUrl]);

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <h2>{appCopy.editorial.admin.usersTitle}</h2>
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
