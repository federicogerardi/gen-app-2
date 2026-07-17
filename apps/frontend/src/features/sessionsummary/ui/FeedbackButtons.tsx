import { useState, useCallback, useEffect } from 'react';
import { IconButton, Tooltip, Typography } from '@mui/material';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useAuthState } from '../../../app/providers/AuthSessionProvider';

interface FeedbackButtonsProps {
  artifactId: string;
  disabled?: boolean;
}

export const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({
  artifactId,
  disabled = false,
}) => {
  const { session } = useAuthState();
  const [positive, setPositive] = useState(0);
  const [negative, setNegative] = useState(0);
  const [netScore, setNetScore] = useState(0);
  const [userVote, setUserVote] = useState<'positive' | 'negative' | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const fetchScore = async () => {
      try {
        const url = `/api/tools/feedback?artifactId=${encodeURIComponent(artifactId)}`;
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setPositive(data.positive ?? 0);
          setNegative(data.negative ?? 0);
          setNetScore(data.netScore ?? 0);
          setUserVote(data.userVote ?? null);
          setLoaded(true);
        }
      } catch {
        // Non-critical
      }
    };

    fetchScore();
    return () => { cancelled = true; };
  }, [artifactId, session]);

  const handleVote = useCallback(async (rating: 'positive' | 'negative') => {
    if (loading || disabled || !session) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/tools/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ artifactId, rating }),
      });
      if (!response.ok) return;
      const data = await response.json();
      setPositive(data.positive ?? positive);
      setNegative(data.negative ?? negative);
      setNetScore(data.netScore ?? 0);
      setUserVote(rating);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [artifactId, session, loading, disabled, positive, negative]);

  if (!session) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Tooltip title={userVote === 'positive' ? 'Già votato positivo' : 'Buon esempio'}>
        <span>
          <IconButton
            size="small"
            onClick={() => handleVote('positive')}
            disabled={disabled || loading}
            color={loaded && userVote === 'positive' ? 'success' : 'default'}
            aria-label="Voto positivo"
          >
            <ThumbsUp size={14} />
          </IconButton>
        </span>
      </Tooltip>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 16, textAlign: 'center' }}>
        {positive}
      </Typography>

      <Tooltip title={userVote === 'negative' ? 'Già votato negativo' : 'Esempio scarso'}>
        <span>
          <IconButton
            size="small"
            onClick={() => handleVote('negative')}
            disabled={disabled || loading}
            color={loaded && userVote === 'negative' ? 'error' : 'default'}
            aria-label="Voto negativo"
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
