import { Link } from 'react-router-dom';
import { Skeleton } from '@mui/material';
import { appCopy } from '../../../app/copy/system';
import { uiPrimitives } from '../../../app/ui/primitives';
import type { DashboardOverviewData } from '../runtime/useDashboardOverview';

interface DashboardHeroPanelProps {
  resumeCandidate: DashboardOverviewData['resumeCandidate'];
  loading: boolean;
}

export const DashboardHeroPanel: React.FC<DashboardHeroPanelProps> = ({
  resumeCandidate,
  loading,
}) => {
  if (loading) {
    return (
      <div className="dashboard-hero" aria-busy="true">
        <Skeleton variant="text" width="40%" height={20} />
        <Skeleton variant="text" width="70%" height={36} />
        <Skeleton variant="text" width="55%" height={20} />
        <div className="dashboard-hero__cta">
          <Skeleton variant="rounded" width={180} height={40} />
        </div>
      </div>
    );
  }

  const isResume = resumeCandidate !== null;

  const headline = isResume
    ? appCopy.editorial.dashboard.heroHeadlineResume(resumeCandidate.toolLabel)
    : appCopy.editorial.dashboard.heroHeadlineChoose;

  const subtitle = isResume
    ? appCopy.editorial.dashboard.heroSubtitleResume(resumeCandidate.workspaceName)
    : appCopy.editorial.dashboard.heroSubtitleChoose;

  const ctaLabel = isResume
    ? appCopy.editorial.dashboard.heroCtaResume(resumeCandidate.toolLabel)
    : appCopy.editorial.dashboard.heroCtaChoose;

  const ctaRoute = isResume
    ? `/workspaces/${resumeCandidate.workspaceId}/tools/${resumeCandidate.toolKey}`
    : '/workspaces';

  return (
    <div className="dashboard-hero">
      <div role="status" aria-live="polite">
        <p className={uiPrimitives.metaLine}>{appCopy.editorial.dashboard.eyebrow}</p>
        <h2 className="dashboard-hero__headline">{headline}</h2>
        <p className="dashboard-hero__subtitle">{subtitle}</p>
      </div>
      <div className="dashboard-hero__cta">
        <Link to={ctaRoute} className={uiPrimitives.button}>
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
};
