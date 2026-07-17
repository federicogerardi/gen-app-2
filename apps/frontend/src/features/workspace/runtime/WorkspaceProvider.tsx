import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { WorkspaceContextData } from './useWorkspaceContext';

interface WorkspaceContextValue {
  workspace: WorkspaceContextData;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const WorkspaceProvider: React.FC<{
  value: WorkspaceContextData;
  children: ReactNode;
}> = ({ value, children }) => {
  const contextValue = useMemo(() => ({ workspace: value }), [value]);

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextValue => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return context;
};
