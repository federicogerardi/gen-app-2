import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AuthSessionProvider } from './app/providers/AuthSessionProvider';
import { uiRolloutMode } from './app/runtime/ui-rollout';
import { createAppRouter } from './app/routing/app-router';
import { GenerationWorkspaceProvider } from './features/generation/runtime/GenerationWorkspaceProvider';
import theme from './theme/theme';

export const App = () => {
  const router = createAppRouter();

  useEffect(() => {
    document.documentElement.dataset.uiRolloutMode = uiRolloutMode;
  }, []);

  return (
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline />
      <AuthSessionProvider>
        <GenerationWorkspaceProvider>
          <RouterProvider router={router} />
        </GenerationWorkspaceProvider>
      </AuthSessionProvider>
    </ThemeProvider>
  );
};
