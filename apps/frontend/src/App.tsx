import { RouterProvider } from 'react-router-dom';
import { AuthSessionProvider } from './app/providers/AuthSessionProvider';
import { ThemeProvider } from './app/providers/ThemeProvider';
import { createAppRouter } from './app/routing/app-router';
import { GenerationWorkspaceProvider } from './features/generation/runtime/GenerationWorkspaceProvider';

export const App = () => {
  const router = createAppRouter();

  return (
    <ThemeProvider>
      <AuthSessionProvider>
        <GenerationWorkspaceProvider>
          <RouterProvider router={router} />
        </GenerationWorkspaceProvider>
      </AuthSessionProvider>
    </ThemeProvider>
  );
};
