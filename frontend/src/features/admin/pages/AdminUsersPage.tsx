import { useEffect, useState } from 'react';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';

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
          throw new Error(`Unable to load admin users (HTTP ${response.status})`);
        }

        const body = (await response.json()) as { users?: AdminUser[] } | AdminUser[];
        setUsers(Array.isArray(body) ? body : (body.users ?? []));
        setError(null);
      } catch (loadError) {
        setUsers([]);
        setError(loadError instanceof Error ? loadError.message : 'Admin users load failed');
      }
    })();
  }, [auth.apiBaseUrl]);

  return (
    <section className="panel page-stack">
      <h2>Admin users</h2>
      {error ? <p className="error-message">{error}</p> : null}
      <ul className="list-clean">
        {users.map((user) => (
          <li key={user.id} className="panel">
            <p><strong>{user.email}</strong></p>
            <p className="meta-line">role: {user.role}</p>
            <p className="meta-line">status: {user.status}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};
