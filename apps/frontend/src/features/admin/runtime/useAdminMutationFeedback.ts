import { useFeedbackMessage } from '../../../app/providers/FeedbackMessageProvider';

export const useAdminMutationFeedback = () => {
  const { publishSuccess, publishError } = useFeedbackMessage();

  return {
    publishSuccess: (message: string, dedupeKey: string) => {
      publishSuccess(message, { dedupeKey });
    },
    publishError: (message: string, dedupeKey: string) => {
      publishError(message, { dedupeKey });
    },
  };
};