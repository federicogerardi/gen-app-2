import { createBrowserRouter, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import type { FC, LazyExoticComponent, ReactElement } from 'react';
import { AuthenticatedShell } from '../layouts/AuthenticatedShell';
import { PublicShell } from '../layouts/PublicShell';
import { useAuthState } from '../providers/AuthSessionProvider';
import { isUserAdmin } from '../runtime/user-roles';
import { AdminGuard } from '../../features/admin/routing/admin-guard';
import { AdminPersistentNavigation } from '../../features/admin/ui/AdminPersistentNavigation';
import { isToolEnabled, getToolRoute } from '../../features/tools/runtime/tool-form-architecture';
import type { SupportedTool } from '../../features/tools/machines/tool-flow.machine';
import { PageLoader } from '../ui/PageLoader';

// Lazy load page components for code splitting
const DashboardPage = lazy(() => import('../../features/dashboard/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const FunnelPagesToolPage = lazy(() => import('../../features/tools/funnel-pages/pages/FunnelPagesToolPage').then(m => ({ default: m.FunnelPagesToolPage })));
const NextlandToolPage = lazy(() => import('../../features/tools/nextland/pages/NextlandToolPage').then(m => ({ default: m.NextlandToolPage })));
const YoutubeLfScriptToolPage = lazy(() => import('../../features/tools/youtube-lf-script/pages/YoutubeLfScriptToolPage').then(m => ({ default: m.YoutubeLfScriptToolPage })));
const AngleGeneratorToolPage = lazy(() => import('../../features/tools/angle-generator/pages/AngleGeneratorToolPage').then(m => ({ default: m.AngleGeneratorToolPage })));
const MetaAdsToolPage = lazy(() => import('../../features/tools/meta-ads/pages/MetaAdsToolPage').then(m => ({ default: m.MetaAdsToolPage })));
const YoutubeDescriptionToolPage = lazy(() => import('../../features/tools/youtube-description/pages/YoutubeDescriptionToolPage').then(m => ({ default: m.YoutubeDescriptionToolPage })));
const GeometricToolPage = lazy(() => import('../../features/tools/geometric/pages/GeometricToolPage').then(m => ({ default: m.GeometricToolPage })));
const BlogArticleGeneratorToolPage = lazy(() => import('../../features/tools/blog-article-generator/pages/BlogArticleGeneratorToolPage').then(m => ({ default: m.BlogArticleGeneratorToolPage })));
const BriefGeneratorToolPage = lazy(() => import('../../features/tools/brief-generator/pages/BriefGeneratorToolPage').then(m => ({ default: m.BriefGeneratorToolPage })));
const TovGeneratorToolPage = lazy(() => import('../../features/tools/tov-generator/pages/TovGeneratorToolPage').then(m => ({ default: m.TovGeneratorToolPage })));
const PersonasGeneratorToolPage = lazy(() => import('../../features/tools/personas-generator/pages/PersonasGeneratorToolPage').then(m => ({ default: m.PersonasGeneratorToolPage })));
const SessionSummaryDetailPage = lazy(() => import('../../features/sessionsummary/pages/SessionSummaryDetailPage').then(m => ({ default: m.SessionSummaryDetailPage })));
const AdminDashboardPage = lazy(() => import('../../features/admin/pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AdminUsersPage = lazy(() => import('../../features/admin/pages/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminModelsPage = lazy(() => import('../../features/admin/pages/AdminModelsPage').then(m => ({ default: m.AdminModelsPage })));
const AdminApiServicesPage = lazy(() => import('../../features/admin/pages/AdminApiServicesPage').then(m => ({ default: m.AdminApiServicesPage })));
const AdminActivityPage = lazy(() => import('../../features/admin/pages/AdminActivityPage').then(m => ({ default: m.AdminActivityPage })));
const AdminChangelogPage = lazy(() => import('../../features/admin/pages/AdminChangelogPage').then(m => ({ default: m.AdminChangelogPage })));
const AdminUserReportsPage = lazy(() => import('../../features/admin/pages/AdminUserReportsPage').then(m => ({ default: m.AdminUserReportsPage })));
const AdminSessionsPage = lazy(() => import('../../features/admin/pages/AdminSessionsPage').then(m => ({ default: m.AdminSessionsPage })));
const AdminSessionDetailPage = lazy(() => import('../../features/admin/pages/AdminSessionDetailPage').then(m => ({ default: m.AdminSessionDetailPage })));
const AdminToolWorkflowJobsPage = lazy(() => import('../../features/admin/pages/AdminToolWorkflowJobsPage').then(m => ({ default: m.AdminToolWorkflowJobsPage })));
const WorkspacesListPage = lazy(() => import('../../features/workspace/pages/WorkspacesListPage').then(m => ({ default: m.WorkspacesListPage })));
const WorkspaceDashboard = lazy(() => import('../../features/workspace/pages/WorkspaceDashboard').then(m => ({ default: m.WorkspaceDashboard })));
const ProjectAssetsPage = lazy(() => import('../../features/workspace/pages/ProjectAssetsPage').then(m => ({ default: m.ProjectAssetsPage })));
const WorkspaceToolWrapper = lazy(() => import('../../features/workspace/ui/WorkspaceToolWrapper').then(m => ({ default: m.WorkspaceToolWrapper })));
const LegacyToolRedirect = lazy(() => import('../../features/workspace/ui/LegacyToolRedirect').then(m => ({ default: m.LegacyToolRedirect })));
const WorkspaceSessionsPage = lazy(() => import('../../features/workspace/pages/WorkspaceSessionsPage').then(m => ({ default: m.WorkspaceSessionsPage })));
const WorkspaceLayout = lazy(() => import('../../features/workspace/layouts/WorkspaceLayout').then(m => ({ default: m.WorkspaceLayout })));
// Lazy-loaded tool page components indexed by toolKey — used by TOOL_ROUTES below.
const toolPageComponents: Record<SupportedTool, LazyExoticComponent<FC>> = {
  'funnel-pages': FunnelPagesToolPage,
  nextland: NextlandToolPage,
  'youtube-lf-script': YoutubeLfScriptToolPage,
  'angle-generator': AngleGeneratorToolPage,
  'meta-ads': MetaAdsToolPage,
  'youtube-description': YoutubeDescriptionToolPage,
  'geometric': GeometricToolPage,
  'blog-article-generator': BlogArticleGeneratorToolPage,
  'brief-generator': BriefGeneratorToolPage,
  'tov-generator': TovGeneratorToolPage,
  'personas-generator': PersonasGeneratorToolPage,
};

const ToolRouteGuard = ({ toolKey, children }: { toolKey: SupportedTool; children: ReactElement }) => {
  const { session } = useAuthState();
  const role = session && isUserAdmin(session.user.role) ? 'admin' : 'member';

  if (!isToolEnabled(toolKey, role)) {
    return <Navigate to="/tools" replace />;
  }

  return children;
};

const ProjectRedirect = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/workspaces/${id}`} replace />;
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
        element: <Navigate to="/workspaces" replace />,
      },
      {
        path: '/dashboard/projects/new',
        element: <Navigate to="/workspaces" replace />,
      },
      {
        path: '/dashboard/projects/:id',
        element: <ProjectRedirect />,
      },
      {
        path: '/workspaces',
        children: [
          {
            index: true,
            element: <Suspense fallback={<PageLoader />}><WorkspacesListPage /></Suspense>,
          },
          {
            path: ':workspaceId',
            element: <Suspense fallback={<PageLoader />}><WorkspaceLayout /></Suspense>,
            children: [
              {
                index: true,
                element: <Suspense fallback={<PageLoader />}><WorkspaceDashboard /></Suspense>,
              },
              {
                path: 'assets',
                element: <Suspense fallback={<PageLoader />}><ProjectAssetsPage /></Suspense>,
              },
              {
                path: 'sessions',
                children: [
                  {
                    index: true,
                    element: <Suspense fallback={<PageLoader />}><WorkspaceSessionsPage /></Suspense>,
                  },
                  {
                    path: ':sessionId',
                    element: <Suspense fallback={<PageLoader />}><SessionSummaryDetailPage /></Suspense>,
                  },
                ],
              },
              {
                path: 'tools',
                children: Object.entries(toolPageComponents).map(([toolKey, Component]) => ({
                  path: toolKey,
                  element: (
                    <ToolRouteGuard toolKey={toolKey as SupportedTool}>
                      <Suspense fallback={<PageLoader />}>
                        <WorkspaceToolWrapper toolKey={toolKey as SupportedTool}>
                          <Component />
                        </WorkspaceToolWrapper>
                      </Suspense>
                    </ToolRouteGuard>
                  ),
                })),
              },
            ],
          },
        ],
      },
      {
        path: '/tools/:toolKey',
        element: <Suspense fallback={<PageLoader />}><LegacyToolRedirect /></Suspense>,
      },
      ...Object.keys(toolPageComponents).map((toolKey) => {
        const typedToolKey = toolKey as SupportedTool;
        const ToolPage = toolPageComponents[typedToolKey];
        const route = getToolRoute(typedToolKey) ?? `/tools/${typedToolKey}`;

        return {
          path: route,
          element: (
            <ToolRouteGuard toolKey={typedToolKey}>
              <Suspense fallback={<PageLoader />}><ToolPage /></Suspense>
            </ToolRouteGuard>
          ),
        };
      }),
      {
        path: '/sessionsummary',
        element: <Navigate to="/workspaces" replace />,
      },
      {
        path: '/sessionsummary/:sessionId',
        element: <Navigate to="/workspaces" replace />,
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
          {
            path: 'sessions',
            children: [
              { index: true, element: <Suspense fallback={<PageLoader />}><AdminSessionsPage /></Suspense> },
              { path: ':sessionId', element: <Suspense fallback={<PageLoader />}><AdminSessionDetailPage /></Suspense> },
            ],
          },
          {
            path: 'tool-jobs',
            element: <Suspense fallback={<PageLoader />}><AdminToolWorkflowJobsPage /></Suspense>,
          },
        ],
      },
      {
        path: '*',
        element: <Navigate to="/workspaces" replace />,
      },
    ],
  },
]);
