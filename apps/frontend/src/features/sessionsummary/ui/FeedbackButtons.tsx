import { useState, useCallback, useEffect } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { appCopy } from '../../../app/copy/system';
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
        const body = await res.json();
        const data = body.data ?? body;
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
      const body = await response.json();
      const data = body.data ?? body;
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
    <div className="ui-feedback-buttons">
      <Tooltip title={userVote === 'positive' ? appCopy.ui.feedbackButtons.alreadyVotedPositive : appCopy.ui.feedbackButtons.goodExample}>
        <span>
          <IconButton
            size="small"
            onClick={() => handleVote('positive')}
            disabled={disabled || loading}
            color={loaded && userVote === 'positive' ? 'success' : 'default'}
            aria-label={appCopy.ui.feedbackButtons.votePositiveAria}
          >
            <ThumbsUp size={14} />
          </IconButton>
        </span>
      </Tooltip>
      <span className="ui-feedback-score">{positive}</span>

      <Tooltip title={userVote === 'negative' ? appCopy.ui.feedbackButtons.alreadyVotedNegative : appCopy.ui.feedbackButtons.poorExample}>
        <span>
          <IconButton
            size="small"
            onClick={() => handleVote('negative')}
            disabled={disabled || loading}
            color={loaded && userVote === 'negative' ? 'error' : 'default'}
            aria-label={appCopy.ui.feedbackButtons.voteNegativeAria}
          >
            <ThumbsDown size={14} />
          </IconButton>
        </span>
      </Tooltip>
      <span className="ui-feedback-score">{negative}</span>

      {netScore !== 0 && (
        <span
          className={`ui-feedback-score ${netScore > 0 ? 'ui-feedback-score--positive' : 'ui-feedback-score--negative'}`}
        >
          {netScore > 0 ? '+' : ''}{netScore}
        </span>
      )}
    </div>
  );
};
