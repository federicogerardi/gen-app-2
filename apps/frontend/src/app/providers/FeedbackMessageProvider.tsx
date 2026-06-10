import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { UI_CONFIG } from '../config/ui-config';
import type { FeedbackChannel } from '../runtime/feedback-channel-map';

export type { FeedbackChannel } from '../runtime/feedback-channel-map';
export type FeedbackSeverity = 'success' | 'info' | 'warning' | 'error';

export type GlobalFeedbackMessage = {
  id: string;
  channel: FeedbackChannel;
  severity: FeedbackSeverity;
  text: string;
  ttlMs: number;
  dedupeKey?: string;
  createdAt: number;
};

type PublishFeedbackOptions = {
  ttlMs?: number;
  dedupeKey?: string;
};

type FeedbackMessageContextValue = {
  messages: ReadonlyArray<GlobalFeedbackMessage>;
  publishSuccess: (text: string, options?: PublishFeedbackOptions) => void;
  publishInfo: (text: string, options?: PublishFeedbackOptions) => void;
  publishWarning: (text: string, options?: PublishFeedbackOptions) => void;
  publishError: (text: string, options?: PublishFeedbackOptions) => void;
  dismiss: (messageId: string) => void;
  dismissAll: () => void;
};

type FeedbackMessageState = {
  queue: GlobalFeedbackMessage[];
};

type FeedbackMessageAction =
  | {
      type: 'publish';
      message: GlobalFeedbackMessage;
    }
  | {
      type: 'dismiss';
      messageId: string;
    }
  | {
      type: 'dismissAll';
    };

const DEFAULT_TTL_BY_SEVERITY: Record<FeedbackSeverity, number> = UI_CONFIG.feedback.ttl;

const initialState: FeedbackMessageState = {
  queue: [],
};

let nextMessageSequence = 0;

const FeedbackMessageContext = createContext<FeedbackMessageContextValue | null>(null);

const feedbackMessageReducer = (
  state: FeedbackMessageState,
  action: FeedbackMessageAction,
): FeedbackMessageState => {
  switch (action.type) {
    case 'publish': {
      const hasDuplicate = Boolean(
        action.message.dedupeKey
          && state.queue.some((message) => message.dedupeKey === action.message.dedupeKey),
      );

      if (hasDuplicate) {
        return state;
      }

      return {
        ...state,
        queue: [...state.queue, action.message],
      };
    }
    case 'dismiss': {
      return {
        ...state,
        queue: state.queue.filter((message) => message.id !== action.messageId),
      };
    }
    case 'dismissAll': {
      return {
        ...state,
        queue: [],
      };
    }
    default: {
      return state;
    }
  }
};

const buildMessage = (
  severity: FeedbackSeverity,
  text: string,
  options?: PublishFeedbackOptions,
): GlobalFeedbackMessage => {
  nextMessageSequence += 1;

  const dedupeKeyField = options?.dedupeKey !== undefined
    ? { dedupeKey: options.dedupeKey }
    : {};

  return {
    id: `gfm-${nextMessageSequence}`,
    channel: 'global',
    severity,
    text,
    ttlMs: options?.ttlMs ?? DEFAULT_TTL_BY_SEVERITY[severity],
    createdAt: Date.now(),
    ...dedupeKeyField,
  };
};

export const FeedbackMessageProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(feedbackMessageReducer, initialState);

  const contextValue = useMemo<FeedbackMessageContextValue>(() => ({
    messages: state.queue,
    publishSuccess: (text, options) => {
      dispatch({
        type: 'publish',
        message: buildMessage('success', text, options),
      });
    },
    publishInfo: (text, options) => {
      dispatch({
        type: 'publish',
        message: buildMessage('info', text, options),
      });
    },
    publishWarning: (text, options) => {
      dispatch({
        type: 'publish',
        message: buildMessage('warning', text, options),
      });
    },
    publishError: (text, options) => {
      dispatch({
        type: 'publish',
        message: buildMessage('error', text, options),
      });
    },
    dismiss: (messageId) => {
      dispatch({ type: 'dismiss', messageId });
    },
    dismissAll: () => {
      dispatch({ type: 'dismissAll' });
    },
  }), [state.queue]);

  return (
    <FeedbackMessageContext.Provider value={contextValue}>
      {children}
    </FeedbackMessageContext.Provider>
  );
};

export const useFeedbackMessage = (): FeedbackMessageContextValue => {
  const context = useContext(FeedbackMessageContext);

  if (!context) {
    throw new Error('useFeedbackMessage must be used within FeedbackMessageProvider.');
  }

  return context;
};
