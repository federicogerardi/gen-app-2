import { Chip } from '@mui/material';
import { appCopy } from '../../../app/copy/system';

interface QualityScoreBadgeProps {
  score: number;
  size?: 'small' | 'medium';
  label?: string;
}

const getQualityColor = (score: number): 'success' | 'warning' | 'error' | 'default' => {
  if (score >= 70) return 'success';
  if (score >= 40) return 'warning';
  if (score > 0) return 'error';
  return 'default';
};

export const QualityScoreBadge: React.FC<QualityScoreBadgeProps> = ({
  score,
  size = 'small',
  label,
}) => {
  const color = getQualityColor(score);
  const qualityLabel = label ?? appCopy.ui.workspace.contextHeader.qualityLabel;
  const noQualityLabel = appCopy.ui.workspace.contextHeader.noQuality;

  return (
    <Chip
      label={score > 0 ? `${score}% ${qualityLabel}` : noQualityLabel}
      color={color}
      size={size}
      variant="outlined"
    />
  );
};
