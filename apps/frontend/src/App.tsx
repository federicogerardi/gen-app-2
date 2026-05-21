import { RouterProvider } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AuthSessionProvider } from './app/providers/AuthSessionProvider';
import { FeedbackMessageProvider } from './app/providers/FeedbackMessageProvider';
import { createAppRouter } from './app/routing/app-router';
import { GenerationWorkspaceProvider } from './features/generation/runtime/GenerationWorkspaceProvider';
import theme from './theme/theme';

export const App = () => {
  const router = createAppRouter();

  return (
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline />
      <AuthSessionProvider>
        <GenerationWorkspaceProvider>
          <FeedbackMessageProvider>
            <RouterProvider router={router} />
          </FeedbackMessageProvider>
        </GenerationWorkspaceProvider>
      </AuthSessionProvider>
    </ThemeProvider>
  );
};
