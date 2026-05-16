import Alert from '@mui/material/Alert';
import Snackbar, { type SnackbarCloseReason } from '@mui/material/Snackbar';
import type { SyntheticEvent } from 'react';
import { useFeedbackMessage, type GlobalFeedbackMessage } from '../providers/FeedbackMessageProvider';

const baseOffsetPx = 20;
const stackGapPx = 76;

const getAriaLiveMode = (message: GlobalFeedbackMessage): 'polite' | 'assertive' => (
  message.severity === 'error' ? 'assertive' : 'polite'
);

const getAlertRole = (message: GlobalFeedbackMessage): 'status' | 'alert' => (
  message.severity === 'error' ? 'alert' : 'status'
);

export const GlobalFeedbackViewport = () => {
  const { messages, dismiss } = useFeedbackMessage();

  if (messages.length === 0) {
    return null;
  }

  const lastIndex = messages.length - 1;

  return (
    <div className="ui-global-feedback-viewport" aria-hidden="true">
      {messages.map((message, index) => {
        const handleClose = (event: Event | SyntheticEvent, reason?: SnackbarCloseReason) => {
          if (reason === 'clickaway') {
            return;
          }

          if (reason === 'escapeKeyDown' && index !== lastIndex) {
            event.preventDefault();
            return;
          }

          if (reason === 'escapeKeyDown') {
            event.preventDefault();
          }

          dismiss(message.id);
        };

        return (
          <Snackbar
            key={message.id}
            open
            autoHideDuration={message.ttlMs}
            onClose={handleClose}
            className="ui-global-feedback-snackbar"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            sx={{
              bottom: `${baseOffsetPx + index * stackGapPx}px !important`,
            }}
          >
            <Alert
              severity={message.severity}
              variant="filled"
              onClose={() => dismiss(message.id)}
              role={getAlertRole(message)}
              aria-live={getAriaLiveMode(message)}
              className="ui-global-feedback-alert"
            >
              {message.text}
            </Alert>
          </Snackbar>
        );
      })}
    </div>
  );
};
