import { useState, useCallback } from 'react';
import { IconButton, Tooltip, Typography } from '@mui/material';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useAuthState } from '../../../app/providers/AuthSessionProvider';

interface FeedbackButtonsProps {
  artifactId: string;
  initialPositive?: number;
  initialNegative?: number;
  disabled?: boolean;
}

export const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({
  artifactId,
  initialPositive = 0,
  initialNegative = 0,
  disabled = false,
}) => {
  const { apiBaseUrl } = useApiConfig();
  const { session } = useAuthState();
  const [positive, setPositive] = useState(initialPositive);
  const [negative, setNegative] = useState(initialNegative);
  const [userVote, setUserVote] = useState<'positive' | 'negative' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVote = useCallback(async (rating: 'positive' | 'negative') => {
    if (loading || disabled || !session) return;
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/tools/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ artifactId, rating }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to record feedback');
      }
      const data = await response.json();
      setPositive(data.positive ?? positive);
      setNegative(data.negative ?? negative);
      setUserVote(rating);
    } catch {
      // Silently fail — feedback is non-critical
    } finally {
      setLoading(false);
    }
  }, [artifactId, apiBaseUrl, session, loading, disabled, positive, negative]);

  if (!session) return null;

  const netScore = positive * 10 - negative * 5;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Tooltip title={userVote === 'positive' ? 'Voted' : 'Good example'}>
        <span>
          <IconButton
            size="small"
            onClick={() => handleVote('positive')}
            disabled={disabled || loading}
            color={userVote === 'positive' ? 'success' : 'default'}
            aria-label="Positive feedback"
          >
            <ThumbsUp size={14} />
          </IconButton>
        </span>
      </Tooltip>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 16, textAlign: 'center' }}>
        {positive}
      </Typography>

      <Tooltip title={userVote === 'negative' ? 'Voted' : 'Poor example'}>
        <span>
          <IconButton
            size="small"
            onClick={() => handleVote('negative')}
            disabled={disabled || loading}
            color={userVote === 'negative' ? 'error' : 'default'}
            aria-label="Negative feedback"
          >
            <ThumbsDown size={14} />
          </IconButton>
        </span>
      </Tooltip>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 16, textAlign: 'center' }}>
        {negative}
      </Typography>

      {netScore !== 0 && (
        <Typography
          variant="caption"
          color={netScore > 0 ? 'success.main' : 'error.main'}
          sx={{ ml: 0.5, fontWeight: 500 }}
        >
          {netScore > 0 ? '+' : ''}{netScore}
        </Typography>
      )}
    </div>
  );
};
