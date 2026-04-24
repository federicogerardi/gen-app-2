import { RouterProvider } from 'react-router-dom';
import { AuthSessionProvider } from './app/providers/AuthSessionProvider';
import { createAppRouter } from './app/routing/app-router';
import { GenerationWorkspaceProvider } from './features/generation/runtime/GenerationWorkspaceProvider';

export const App = () => {
  const router = createAppRouter();

  return (
    <AuthSessionProvider>
      <GenerationWorkspaceProvider>
        <RouterProvider router={router} />
      </GenerationWorkspaceProvider>
    </AuthSessionProvider>
  );
};
