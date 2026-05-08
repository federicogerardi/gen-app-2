import { appCopy } from '../../../app/copy/system';
import { Surface, uiPrimitives } from '../../../app/ui/primitives';
import { SessionsListingSection } from '../../artifacts/ui/SessionsListingSection';

export const SessionSummaryListPage = () => {
  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <SessionsListingSection title={appCopy.editorial.sessions.archiveTitle} headingLevel="h2" />
    </Surface>
  );
};
