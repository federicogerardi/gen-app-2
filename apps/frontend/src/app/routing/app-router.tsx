import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import type { FC, LazyExoticComponent } from 'react';
import { AuthenticatedShell } from '../layouts/AuthenticatedShell';
import { PublicShell } from '../layouts/PublicShell';
import { AdminGuard } from '../../features/admin/routing/admin-guard';
import { toolFormRegistry } from '../../features/tools/runtime/tool-form-architecture';
import type { SupportedTool } from '../../features/tools/machines/tool-flow.machine';

// Lazy load page components for code splitting
const DashboardPage = lazy(() => import('../../features/dashboard/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ProjectsListPage = lazy(() => import('../../features/projects/pages/ProjectsListPage').then(m => ({ default: m.ProjectsListPage })));
const NewProjectPage = lazy(() => import('../../features/projects/pages/NewProjectPage').then(m => ({ default: m.NewProjectPage })));
const ProjectDetailPage = lazy(() => import('../../features/projects/pages/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })));
const FunnelPagesToolPage = lazy(() => import('../../features/tools/funnel-pages/pages/FunnelPagesToolPage').then(m => ({ default: m.FunnelPagesToolPage })));
const NextlandToolPage = lazy(() => import('../../features/tools/nextland/pages/NextlandToolPage').then(m => ({ default: m.NextlandToolPage })));
const YoutubeToolPage = lazy(() => import('../../features/tools/youtube-long-form/pages/YoutubeToolPage').then(m => ({ default: m.YoutubeToolPage })));
const ArtifactsPage = lazy(() => import('../../features/artifacts/pages/ArtifactsPage').then(m => ({ default: m.ArtifactsPage })));
const ArtifactDetailPage = lazy(() => import('../../features/artifacts/pages/ArtifactDetailPage').then(m => ({ default: m.ArtifactDetailPage })));
const AdminUsersPage = lazy(() => import('../../features/admin/pages/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminModelsPage = lazy(() => import('../../features/admin/pages/AdminModelsPage').then(m => ({ default: m.AdminModelsPage })));
const AdminActivityPage = lazy(() => import('../../features/admin/pages/AdminActivityPage').then(m => ({ default: m.AdminActivityPage })));
const GenerationConsolePage = lazy(() => import('../../features/generation/pages/GenerationConsolePage').then(m => ({ default: m.GenerationConsolePage })));

// Lazy-loaded tool page components indexed by toolKey — used by TOOL_ROUTES below.
const toolPageComponents: Record<SupportedTool, LazyExoticComponent<FC>> = {
  'funnel-pages': FunnelPagesToolPage,
  nextland: NextlandToolPage,
  'youtube-long-form': YoutubeToolPage,
};

/**
 * Data-driven route table for tool pages.
 * Adding a new SupportedTool only requires entries in toolFormRegistry and toolPageComponents.
 */
const TOOL_ROUTES = (Object.keys(toolFormRegistry) as SupportedTool[]).map((toolKey) => ({
  toolKey,
  path: `/tools/${toolKey}`,
  component: toolPageComponents[toolKey],
}));
const PageLoader = () => (
  <div className="route-loader" role="status" aria-live="polite" aria-label="Caricamento pagina">
    <div className="route-loader__panel">
      <div className="route-loader__pulse" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="route-loader__eyebrow">Workspace in sync</p>
      <h2 className="route-loader__title">Sto preparando la prossima schermata</h2>
      <p className="route-loader__body">
        Caricamento modulo, stato e contenuti essenziali in corso.
      </p>
    </div>
  </div>
);

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
      ...TOOL_ROUTES.map(({ path, component: ToolPage }) => ({
        path,
        element: <Suspense fallback={<PageLoader />}><ToolPage /></Suspense>,
      })),
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
