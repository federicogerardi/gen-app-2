import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AuthenticatedShell } from '../layouts/AuthenticatedShell';
import { PublicShell } from '../layouts/PublicShell';
import { DashboardPage } from '../../features/dashboard/pages/DashboardPage';
import { ProjectsListPage } from '../../features/projects/pages/ProjectsListPage';
import { NewProjectPage } from '../../features/projects/pages/NewProjectPage';
import { ProjectDetailPage } from '../../features/projects/pages/ProjectDetailPage';
import { FunnelPagesToolPage } from '../../features/tools/funnel-pages/pages/FunnelPagesToolPage';
import { NextlandToolPage } from '../../features/tools/nextland/pages/NextlandToolPage';
import { ArtifactsPage } from '../../features/artifacts/pages/ArtifactsPage';
import { ArtifactDetailPage } from '../../features/artifacts/pages/ArtifactDetailPage';
import { AdminUsersPage } from '../../features/admin/pages/AdminUsersPage';
import { AdminModelsPage } from '../../features/admin/pages/AdminModelsPage';
import { AdminActivityPage } from '../../features/admin/pages/AdminActivityPage';
import { AdminGuard } from '../../features/admin/routing/admin-guard';
import { GenerationConsolePage } from '../../features/generation/pages/GenerationConsolePage';

const AdminLayout = () => {
  return (
    <AdminGuard>
      <Outlet />
    </AdminGuard>
  );
};

export const createAppRouter = () => createBrowserRouter([
  {
    path: '/',
    element: <PublicShell />,
  },
  {
    path: '/',
    element: <AuthenticatedShell />,
    children: [
      {
        path: '/dashboard',
        element: <DashboardPage />,
      },
      {
        path: '/dashboard/projects',
        element: <ProjectsListPage />,
      },
      {
        path: '/dashboard/projects/new',
        element: <NewProjectPage />,
      },
      {
        path: '/dashboard/projects/:id',
        element: <ProjectDetailPage />,
      },
      {
        path: '/tools/funnel-pages',
        element: <FunnelPagesToolPage />,
      },
      {
        path: '/tools/nextland',
        element: <NextlandToolPage />,
      },
      {
        path: '/tools/console',
        element: <GenerationConsolePage />,
      },
      {
        path: '/artifacts',
        element: <ArtifactsPage />,
      },
      {
        path: '/artifacts/:id',
        element: <ArtifactDetailPage />,
      },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: <AdminUsersPage />,
          },
          {
            path: '/admin/models',
            element: <AdminModelsPage />,
          },
          {
            path: '/admin/activity',
            element: <AdminActivityPage />,
          },
        ],
      },
      {
        path: '*',
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
]);
