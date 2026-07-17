import { useParams, Link } from 'react-router-dom';
import { Surface, uiPrimitives } from '../../../app/ui/primitives';

export const ProjectAssetsPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <h2>Project Assets</h2>
      <p>Workspace ID: {workspaceId}</p>
      <p>Asset management will be implemented in a later phase.</p>

      <Link to={`/workspaces/${workspaceId}`} className={uiPrimitives.inlineLink}>
        Back to Workspace
      </Link>
    </Surface>
  );
};
