import { Button, Typography } from '@mui/material';
import { Plus } from 'lucide-react';

interface CreateAssetPromptProps {
  assetType: string;
  label: string;
  producerTool?: string | null;
  isRequired: boolean;
  onCreateAction: () => void;
}

export const CreateAssetPrompt: React.FC<CreateAssetPromptProps> = ({
  label,
  producerTool,
  isRequired,
  onCreateAction,
}) => {
  return (
    <div className="create-asset-prompt">
      <Typography variant="body2" color="text.secondary">
        {isRequired
          ? `${label} assets are required for optimal generation.`
          : `${label} assets would improve generation quality.`
        }
      </Typography>

      {producerTool ? (
        <Button
          variant="contained"
          size="small"
          startIcon={<Plus size={14} />}
          onClick={onCreateAction}
          className="create-asset-prompt__button"
        >
          Generate with {producerTool}
        </Button>
      ) : (
        <Typography variant="caption" color="text.disabled">
          No tool available to generate {label}
        </Typography>
      )}
    </div>
  );
};
