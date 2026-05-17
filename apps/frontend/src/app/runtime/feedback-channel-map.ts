export type FeedbackEventType =
  | 'form-validation-failed'
  | 'tool-dispatch-failed'
  | 'tool-terminal-failed'
  | 'query-loading'
  | 'query-empty'
  | 'query-error'
  | 'mutation-success'
  | 'mutation-failed';

export type FeedbackChannel = 'inline-action' | 'page-state' | 'global';

const feedbackChannelByEventType: Record<FeedbackEventType, FeedbackChannel> = {
  'form-validation-failed': 'inline-action',
  'tool-dispatch-failed': 'inline-action',
  'tool-terminal-failed': 'inline-action',
  'query-loading': 'page-state',
  'query-empty': 'page-state',
  'query-error': 'page-state',
  'mutation-success': 'global',
  'mutation-failed': 'global',
};

export const resolveFeedbackChannel = (eventType: FeedbackEventType): FeedbackChannel => (
  feedbackChannelByEventType[eventType]
);
