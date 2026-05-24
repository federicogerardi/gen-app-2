import { createBrowserRouter, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import type { FC, LazyExoticComponent, ReactElement } from 'react';
import { AuthenticatedShell } from '../layouts/AuthenticatedShell';
import { PublicShell } from '../layouts/PublicShell';
import { useAuthSession } from '../providers/AuthSessionProvider';
import { isUserAdmin } from '../runtime/user-roles';
import { AdminGuard } from '../../features/admin/routing/admin-guard';
import { AdminPersistentNavigation } from '../../features/admin/ui/AdminPersistentNavigation';
import { isToolEnabled } from '../../features/tools/runtime/tool-form-architecture';
import type { SupportedTool } from '../../features/tools/machines/tool-flow.machine';
import { PageLoader } from '../ui/PageLoader';

// Lazy load page components for code splitting
const DashboardPage = lazy(() => import('../../features/dashboard/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ProjectsListPage = lazy(() => import('../../features/projects/pages/ProjectsListPage').then(m => ({ default: m.ProjectsListPage })));
const NewProjectPage = lazy(() => import('../../features/projects/pages/NewProjectPage').then(m => ({ default: m.NewProjectPage })));
const ProjectDetailPage = lazy(() => import('../../features/projects/pages/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })));
const ToolsHubPage = lazy(() => import('../../features/tools/pages/ToolsHubPage').then(m => ({ default: m.ToolsHubPage })));
const FunnelPagesToolPage = lazy(() => import('../../features/tools/funnel-pages/pages/FunnelPagesToolPage').then(m => ({ default: m.FunnelPagesToolPage })));
const NextlandToolPage = lazy(() => import('../../features/tools/nextland/pages/NextlandToolPage').then(m => ({ default: m.NextlandToolPage })));
const YoutubeLfScriptToolPage = lazy(() => import('../../features/tools/youtube-lf-script/pages/YoutubeLfScriptToolPage').then(m => ({ default: m.YoutubeLfScriptToolPage })));
const AngleGeneratorToolPage = lazy(() => import('../../features/tools/angle-generator/pages/AngleGeneratorToolPage').then(m => ({ default: m.AngleGeneratorToolPage })));
const ArtifactsPage = lazy(() => import('../../features/artifacts/pages/ArtifactsPage').then(m => ({ default: m.ArtifactsPage })));
const ArtifactDetailPage = lazy(() => import('../../features/artifacts/pages/ArtifactDetailPage').then(m => ({ default: m.ArtifactDetailPage })));
const SessionSummaryListPage = lazy(() => import('../../features/sessionsummary/pages/SessionSummaryListPage').then(m => ({ default: m.SessionSummaryListPage })));
const SessionSummaryDetailPage = lazy(() => import('../../features/sessionsummary/pages/SessionSummaryDetailPage').then(m => ({ default: m.SessionSummaryDetailPage })));
const AdminDashboardPage = lazy(() => import('../../features/admin/pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AdminUsersPage = lazy(() => import('../../features/admin/pages/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminModelsPage = lazy(() => import('../../features/admin/pages/AdminModelsPage').then(m => ({ default: m.AdminModelsPage })));
const AdminApiServicesPage = lazy(() => import('../../features/admin/pages/AdminApiServicesPage').then(m => ({ default: m.AdminApiServicesPage })));
const AdminActivityPage = lazy(() => import('../../features/admin/pages/AdminActivityPage').then(m => ({ default: m.AdminActivityPage })));
const AdminChangelogPage = lazy(() => import('../../features/admin/pages/AdminChangelogPage').then(m => ({ default: m.AdminChangelogPage })));
const AdminUserReportsPage = lazy(() => import('../../features/admin/pages/AdminUserReportsPage').then(m => ({ default: m.AdminUserReportsPage })));
// Lazy-loaded tool page components indexed by toolKey — used by TOOL_ROUTES below.
const toolPageComponents: Record<SupportedTool, LazyExoticComponent<FC>> = {
  'funnel-pages': FunnelPagesToolPage,
  nextland: NextlandToolPage,
  'youtube-lf-script': YoutubeLfScriptToolPage,
  'angle-generator': AngleGeneratorToolPage,
};

const toolRouteByKey: Record<SupportedTool, string> = {
  'funnel-pages': '/tools/funnel-pages',
  nextland: '/tools/nextland',
  'youtube-lf-script': '/tools/youtube-lf-script',
  'angle-generator': '/tools/angle-generator',
};

const ToolRouteGuard = ({ toolKey, children }: { toolKey: SupportedTool; children: ReactElement }) => {
  const auth = useAuthSession();
  const role = auth.session && isUserAdmin(auth.session.user.role) ? 'admin' : 'member';

  if (!isToolEnabled(toolKey, role)) {
    return <Navigate to="/tools" replace />;
  }

  return children;
};
const lighthouseAdminRouteTargets: Record<string, string> = {
  users: '/admin/users',
  models: '/admin/models',
  changelog: '/admin/changelog',
  'user-reports': '/admin/user-reports',
  activity: '/admin/activity',
};

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname !== '/admin') {
      return;
    }

    const params = new URLSearchParams(location.search);
    const requestedRoute = params.get('lh-route');

    if (!requestedRoute) {
      return;
    }

    const targetPath = lighthouseAdminRouteTargets[requestedRoute];

    if (!targetPath) {
      return;
    }

    navigate(targetPath, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return (
    <AdminGuard>
      <div className="ui-admin-route-layout">
        <AdminPersistentNavigation />
        <Outlet />
      </div>
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
        path: '/tools',
        element: <Suspense fallback={<PageLoader />}><ToolsHubPage /></Suspense>,
      },
      ...Object.keys(toolPageComponents).map((toolKey) => {
        const typedToolKey = toolKey as SupportedTool;
        const ToolPage = toolPageComponents[typedToolKey];

        return {
          path: toolRouteByKey[typedToolKey],
          element: (
            <ToolRouteGuard toolKey={typedToolKey}>
              <Suspense fallback={<PageLoader />}><ToolPage /></Suspense>
            </ToolRouteGuard>
          ),
        };
      }),
      {
        path: '/artifacts',
        element: <Suspense fallback={<PageLoader />}><ArtifactsPage /></Suspense>,
      },
      {
        path: '/artifacts/:artifactId',
        element: <Suspense fallback={<PageLoader />}><ArtifactDetailPage /></Suspense>,
      },
      {
        path: '/sessionsummary',
        element: <Suspense fallback={<PageLoader />}><SessionSummaryListPage /></Suspense>,
      },
      {
        path: '/sessionsummary/:sessionId',
        element: <Suspense fallback={<PageLoader />}><SessionSummaryDetailPage /></Suspense>,
      },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: <Suspense fallback={<PageLoader />}><AdminDashboardPage /></Suspense>,
          },
          {
            path: 'users',
            element: <Suspense fallback={<PageLoader />}><AdminUsersPage /></Suspense>,
          },
          {
            path: 'models',
            element: <Suspense fallback={<PageLoader />}><AdminModelsPage /></Suspense>,
          },
          {
            path: 'api-services',
            element: <Suspense fallback={<PageLoader />}><AdminApiServicesPage /></Suspense>,
          },
          {
            path: 'activity',
            element: <Suspense fallback={<PageLoader />}><AdminActivityPage /></Suspense>,
          },
          {
            path: 'changelog',
            element: <Suspense fallback={<PageLoader />}><AdminChangelogPage /></Suspense>,
          },
          {
            path: 'user-reports',
            element: <Suspense fallback={<PageLoader />}><AdminUserReportsPage /></Suspense>,
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
