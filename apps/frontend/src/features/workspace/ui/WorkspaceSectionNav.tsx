import { NavLink, useParams } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';

const SECTIONS = [
  { to: '',           labelKey: 'overview',  end: true },
  { to: 'assets',     labelKey: 'assets',    end: false },
  { to: 'sessions',   labelKey: 'sessions',  end: false },
];

export const WorkspaceSectionNav: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const labels = appCopy.ui.workspace?.sectionNav;

  return (
    <nav className="workspace-section-nav" role="tablist" aria-label={labels?.label ?? 'Workspace sections'}>
      {SECTIONS.map(section => (
        <NavLink
          key={section.to}
          to={section.to
            ? `/workspaces/${workspaceId}/${section.to}`
            : `/workspaces/${workspaceId}`}
          end={section.end}
          className={({ isActive }) =>
            `workspace-section-nav__pill${isActive ? ' workspace-section-nav__pill--active' : ''}`
          }
          role="tab"
        >
          {labels?.[section.labelKey as keyof typeof labels] ?? section.labelKey}
        </NavLink>
      ))}
    </nav>
  );
};
