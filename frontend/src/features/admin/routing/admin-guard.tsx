import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';

export const AdminGuard = ({ children }: { children: ReactElement }) => {
  const auth = useAuthSession();

  if (!auth.session || auth.session.user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
