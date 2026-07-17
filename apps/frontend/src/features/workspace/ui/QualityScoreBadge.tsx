import { Chip } from '@mui/material';

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
  label = 'quality',
}) => {
  const color = getQualityColor(score);

  return (
    <Chip
      label={score > 0 ? `${score}% ${label}` : `No ${label}`}
      color={color}
      size={size}
      variant="outlined"
    />
  );
};
