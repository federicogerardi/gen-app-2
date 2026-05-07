import { appCopy } from '../../../app/copy/system';
import { Surface, uiPrimitives } from '../../../app/ui/primitives';
import { ArtifactsListingSection } from '../ui/ArtifactsListingSection';

export const ArtifactsPage = () => {
  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <ArtifactsListingSection title={appCopy.editorial.artifacts.archiveTitle} headingLevel="h2" />
    </Surface>
  );
};
