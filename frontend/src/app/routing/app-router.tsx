import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthenticatedShell } from '../layouts/AuthenticatedShell';
import { PublicShell } from '../layouts/PublicShell';
import { AdminGuard } from '../../features/admin/routing/admin-guard';

// Lazy load page components for code splitting
const DashboardPage = lazy(() => import('../../features/dashboard/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ProjectsListPage = lazy(() => import('../../features/projects/pages/ProjectsListPage').then(m => ({ default: m.ProjectsListPage })));
const NewProjectPage = lazy(() => import('../../features/projects/pages/NewProjectPage').then(m => ({ default: m.NewProjectPage })));
const ProjectDetailPage = lazy(() => import('../../features/projects/pages/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })));
const FunnelPagesToolPage = lazy(() => import('../../features/tools/funnel-pages/pages/FunnelPagesToolPage').then(m => ({ default: m.FunnelPagesToolPage })));
const NextlandToolPage = lazy(() => import('../../features/tools/nextland/pages/NextlandToolPage').then(m => ({ default: m.NextlandToolPage })));
const ArtifactsPage = lazy(() => import('../../features/artifacts/pages/ArtifactsPage').then(m => ({ default: m.ArtifactsPage })));
const ArtifactDetailPage = lazy(() => import('../../features/artifacts/pages/ArtifactDetailPage').then(m => ({ default: m.ArtifactDetailPage })));
const AdminUsersPage = lazy(() => import('../../features/admin/pages/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminModelsPage = lazy(() => import('../../features/admin/pages/AdminModelsPage').then(m => ({ default: m.AdminModelsPage })));
const AdminActivityPage = lazy(() => import('../../features/admin/pages/AdminActivityPage').then(m => ({ default: m.AdminActivityPage })));
const GenerationConsolePage = lazy(() => import('../../features/generation/pages/GenerationConsolePage').then(m => ({ default: m.GenerationConsolePage })));

// Loading fallback component
const PageLoader = () => <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;

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
        element: <Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>,
      },
      {
        path: '/dashboard/projects',
        element: <Suspense fallback={<PageLoader />}><ProjectsListPage /></Suspense>,
      },
      {
        path: '/dashboard/projects/new',
        element: <Suspense fallback={<PageLoader />}><NewProjectPage /></Suspense>,
      },
      {
        path: '/dashboard/projects/:id',
        element: <Suspense fallback={<PageLoader />}><ProjectDetailPage /></Suspense>,
      },
      {
        path: '/tools/funnel-pages',
        element: <Suspense fallback={<PageLoader />}><FunnelPagesToolPage /></Suspense>,
      },
      {
        path: '/tools/nextland',
        element: <Suspense fallback={<PageLoader />}><NextlandToolPage /></Suspense>,
      },
      {
        path: '/tools/console',
        element: <Suspense fallback={<PageLoader />}><GenerationConsolePage /></Suspense>,
      },
      {
        path: '/artifacts',
        element: <Suspense fallback={<PageLoader />}><ArtifactsPage /></Suspense>,
      },
      {
        path: '/artifacts/:id',
        element: <Suspense fallback={<PageLoader />}><ArtifactDetailPage /></Suspense>,
      },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: <Suspense fallback={<PageLoader />}><AdminUsersPage /></Suspense>,
          },
          {
            path: '/admin/models',
            element: <Suspense fallback={<PageLoader />}><AdminModelsPage /></Suspense>,
          },
          {
            path: '/admin/activity',
            element: <Suspense fallback={<PageLoader />}><AdminActivityPage /></Suspense>,
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
