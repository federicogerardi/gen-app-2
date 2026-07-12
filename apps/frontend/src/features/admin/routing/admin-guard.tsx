import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthState } from '../../../app/providers/AuthSessionProvider';

export const AdminGuard = ({ children }: { children: ReactElement }) => {
  const { session } = useAuthState();

  if (!session || session.user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
