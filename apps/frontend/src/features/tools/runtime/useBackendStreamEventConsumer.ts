import type { GenerationArtifactsWorkspaceValue, GenerationStreamWorkspaceValue } from '../../generation/runtime/GenerationWorkspaceProvider';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';

export interface BackendStreamEventConsumerValue {
  readonly isStreamActive: boolean;
  readonly artifacts: GenerationArtifact[];
  readonly artifactsReloadError: string | null;
  readonly reloadArtifacts: () => void;
}

type UseBackendStreamEventConsumerArgs = {
  generationStream: GenerationStreamWorkspaceValue;
  generationArtifacts: GenerationArtifactsWorkspaceValue;
};

export const useBackendStreamEventConsumer = ({
  generationStream,
  generationArtifacts,
}: UseBackendStreamEventConsumerArgs): BackendStreamEventConsumerValue => {
  return {
    isStreamActive: generationStream.isStreamActive,
    artifacts: generationArtifacts.artifacts,
    artifactsReloadError: generationArtifacts.artifactsReloadError,
    reloadArtifacts: generationArtifacts.reloadArtifacts,
  };
};
