import { NavLink, useParams, useResolvedPath, useMatch } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';

const SECTIONS = [
  { to: '',           labelKey: 'overview',  end: true },
  { to: 'assets',     labelKey: 'assets',    end: false },
  { to: 'sessions',   labelKey: 'sessions',  end: false },
];

const WorkspaceTab: React.FC<{ to: string; end: boolean; tabId: string; panelId: string; children: string }> = ({
  to, end, tabId, panelId, children,
}) => {
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end });
  const isActive = Boolean(match);

  return (
    <NavLink
      to={to}
      end={end}
      className={`workspace-section-nav__pill${isActive ? ' workspace-section-nav__pill--active' : ''}`}
      role="tab"
      id={tabId}
      aria-controls={panelId}
      aria-selected={isActive ? 'true' : 'false'}
    >
      {children}
    </NavLink>
  );
};

export const WorkspaceSectionNav: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const labels = appCopy.ui.workspace?.sectionNav;

  return (
    <nav className="workspace-section-nav" role="tablist" aria-label={labels?.label ?? 'Workspace sections'}>
      {SECTIONS.map(section => {
        const tabId = `workspace-tab-${section.labelKey}`;
        const panelId = `workspace-panel-${section.labelKey}`;

        return (
          <WorkspaceTab
            key={section.to}
            to={section.to
              ? `/workspaces/${workspaceId}/${section.to}`
              : `/workspaces/${workspaceId}`}
            end={section.end}
            tabId={tabId}
            panelId={panelId}
          >
            {labels?.[section.labelKey as keyof typeof labels] ?? section.labelKey}
          </WorkspaceTab>
        );
      })}
    </nav>
  );
};
