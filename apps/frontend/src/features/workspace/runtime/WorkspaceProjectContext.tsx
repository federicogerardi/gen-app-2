import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface WorkspaceProjectData {
  workspaceId: string;
  projectName: string;
  isArchived: boolean;
  isProjectLoading: boolean;
  projectError: string | null;
  refetchProject: () => void;
}

const WorkspaceProjectContext = createContext<WorkspaceProjectData | null>(null);

export const WorkspaceProjectProvider: React.FC<{
  value: WorkspaceProjectData;
  children: ReactNode;
}> = ({ value, children }) => {
  const contextValue = useMemo(() => value, [
    value.workspaceId, value.projectName, value.isArchived,
    value.isProjectLoading, value.projectError, value.refetchProject,
  ]);
  return (
    <WorkspaceProjectContext.Provider value={contextValue}>
      {children}
    </WorkspaceProjectContext.Provider>
  );
};

export const useWorkspaceProject = (): WorkspaceProjectData => {
  const ctx = useContext(WorkspaceProjectContext);
  if (!ctx) {
    throw new Error('useWorkspaceProject must be used within WorkspaceLayout');
  }
  return ctx;
};
