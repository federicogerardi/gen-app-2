---
status: active
version: 1.2
date_created: 2026-07-22
last-reviewed: 2026-07-23
next-review-date: 2026-08-23
owner: ai-execution-engine
tags: [workspace, ux, transformation, ai-executable, frontend]
type: ai-executable-implementation-plan
goal: AI-executable task decomposition for workspace-centric UX transformation
execution_model: atomic_tasks_with_validation
---

# Workspace-Centric UX Transformation - AI Executable Plan

## 🤖 **AI Execution Overview**

**Plan Type**: Atomic task execution with deterministic validation
**Total Tasks**: 47 atomic tasks across 5 phases
**Execution Mode**: Sequential with explicit parallelization markers
**Validation**: Each task has automated success criteria
**Rollback**: Each task includes rollback instructions

### **Execution Rules**
1. **One Task at a Time**: Execute only one task, then validate before proceeding
2. **Explicit Dependencies**: Never start a task until dependencies are confirmed complete
3. **Validation Required**: Every task must pass validation before marking complete
4. **Rollback on Failure**: If task fails, execute rollback, report failure reason
5. **File-Level Atomicity**: Each task operates on specific files with exact changes

---

## 📋 **PHASE 1: Foundation Infrastructure (8 Tasks)** ✅ COMPLETED 2026-07-17

**Phase Dependency**: None (can start immediately)
**Phase Output**: Workspace routing, copy updates, context infrastructure ready

### **TASK P1.1A: Update app-router.tsx - Add Workspace Routes**

**Priority**: CRITICAL
**Dependencies**: None
**Estimated Time**: 45 minutes

**Input Requirements**:
- File exists: `apps/frontend/src/app/routing/app-router.tsx`
- Current routing structure is tool-first

**Atomic Operations**:
1. **Read Current File**: 
   ```bash
   CURRENT_CONTENT=$(cat apps/frontend/src/app/routing/app-router.tsx)
   ```

2. **Locate Insertion Point**:
   - Find line containing `const router = createBrowserRouter([`
   - Insert new workspace routes AFTER existing routes, BEFORE tool routes

3. **Insert Workspace Routes Structure**:
   ```typescript
   // INSERT AFTER existing routes array entries
   {
     path: '/workspaces',
     children: [
       { 
         index: true, 
         element: <WorkspacesListPage /> 
       },
       {
         path: ':workspaceId',
         children: [
           { 
             index: true, 
             element: <WorkspaceDashboard /> 
           },
           { 
             path: 'assets', 
             element: <ProjectAssetsPage /> 
           },
           {
             path: 'tools',
             children: Object.entries(toolPageComponents).map(([toolKey, Component]) => ({
               path: toolKey,
               element: (
                 <ToolRouteGuard toolKey={toolKey as SupportedTool}>
                   <WorkspaceToolWrapper toolKey={toolKey as SupportedTool}>
                     <Component />
                   </WorkspaceToolWrapper>
                 </ToolRouteGuard>
               )
             }))
           }
         ]
       }
     ]
   },
   ```

4. **Add Legacy Redirects**:
   ```typescript
   // INSERT AFTER workspace routes
   { 
     path: '/tools', 
     element: <Navigate to="/workspaces" replace /> 
   },
   {
     path: '/tools/:toolKey',
     element: <LegacyToolRedirect />
   }
   ```

5. **Add Required Imports**:
   ```typescript
   // ADD to existing lazy imports section
   const WorkspacesListPage = lazy(() => import('../../features/workspace/pages/WorkspacesListPage').then(m => ({ default: m.WorkspacesListPage })));
   const WorkspaceDashboard = lazy(() => import('../../features/workspace/pages/WorkspaceDashboard').then(m => ({ default: m.WorkspaceDashboard })));
   const WorkspaceToolWrapper = lazy(() => import('../../features/workspace/ui/WorkspaceToolWrapper').then(m => ({ default: m.WorkspaceToolWrapper })));
   const LegacyToolRedirect = lazy(() => import('../../features/workspace/ui/LegacyToolRedirect').then(m => ({ default: m.LegacyToolRedirect })));
   ```

**Validation Criteria**:
```bash
# Must pass ALL of these checks:
1. File compiles: npm --workspace apps/frontend run typecheck
2. No syntax errors: node -c apps/frontend/src/app/routing/app-router.tsx  
3. Route structure valid: grep -q "path: '/workspaces'" apps/frontend/src/app/routing/app-router.tsx
4. Legacy redirects present: grep -q "LegacyToolRedirect" apps/frontend/src/app/routing/app-router.tsx
5. All imports added: grep -q "WorkspaceToolWrapper" apps/frontend/src/app/routing/app-router.tsx
```

**Success Criteria**: All 5 validation checks pass
**Output**: `apps/frontend/src/app/routing/app-router.tsx` updated with workspace routes

**Rollback Instructions**:
```bash
# If task fails, restore original file:
git checkout HEAD -- apps/frontend/src/app/routing/app-router.tsx
```

---

### **TASK P1.1B: Create LegacyToolRedirect Component**

**Priority**: HIGH
**Dependencies**: None (parallel with P1.1A)
**Estimated Time**: 30 minutes

**Input Requirements**:
- Directory exists: `apps/frontend/src/features/workspace/ui/`
- React and routing libraries available

**Atomic Operations**:
1. **Create Directory Structure**:
   ```bash
   mkdir -p apps/frontend/src/features/workspace/ui
   mkdir -p apps/frontend/src/features/workspace/runtime
   mkdir -p apps/frontend/src/features/workspace/pages
   ```

2. **Create LegacyToolRedirect.tsx**:
   ```typescript
   // FILE: apps/frontend/src/features/workspace/ui/LegacyToolRedirect.tsx
   import { useEffect } from 'react';
   import { useParams, useNavigate } from 'react-router-dom';
   import { useGenerationProjectWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
   import { LoadingStateMessage } from '../../../app/ui/primitives';
   
   export const LegacyToolRedirect: React.FC = () => {
     const { toolKey } = useParams<{ toolKey: string }>();
     const navigate = useNavigate();
     const { focusedProjectId } = useGenerationProjectWorkspace();
     
     useEffect(() => {
       if (toolKey && focusedProjectId) {
         // Redirect to workspace-tool route
         navigate(`/workspaces/${focusedProjectId}/tools/${toolKey}`, { replace: true });
       } else if (toolKey) {
         // No workspace context, go to workspace selection
         navigate(`/workspaces?tool=${toolKey}`, { replace: true });
       } else {
         // Fallback to workspaces list
         navigate('/workspaces', { replace: true });
       }
     }, [toolKey, focusedProjectId, navigate]);
     
     return <LoadingStateMessage>Redirecting to workspace...</LoadingStateMessage>;
   };
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. File exists: test -f apps/frontend/src/features/workspace/ui/LegacyToolRedirect.tsx
2. Valid TypeScript: npx tsc --noEmit apps/frontend/src/features/workspace/ui/LegacyToolRedirect.tsx
3. Contains redirect logic: grep -q "navigate.*workspaces.*tools" apps/frontend/src/features/workspace/ui/LegacyToolRedirect.tsx
4. Proper imports: grep -q "useGenerationProjectWorkspace" apps/frontend/src/features/workspace/ui/LegacyToolRedirect.tsx
```

**Success Criteria**: All 4 validation checks pass
**Output**: New file `LegacyToolRedirect.tsx` created and validated

**Rollback Instructions**:
```bash
# Remove created files:
rm -f apps/frontend/src/features/workspace/ui/LegacyToolRedirect.tsx
```

---

### **TASK P1.1C: Update tool-form-architecture.ts - Workspace Routes**

**Priority**: HIGH  
**Dependencies**: P1.1A complete
**Estimated Time**: 30 minutes

**Input Requirements**:
- File exists: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`
- Workspace routes added to app-router.tsx (P1.1A complete)

**Atomic Operations**:
1. **Locate getToolRoute Function**:
   ```bash
   grep -n "getToolRoute" apps/frontend/src/features/tools/runtime/tool-form-architecture.ts
   ```

2. **Update getToolRoute Function**:
   ```typescript
   // REPLACE existing getToolRoute function with:
   export const getToolRoute = (toolKey: SupportedTool, workspaceId?: string): string => {
     if (workspaceId) {
       return `/workspaces/${workspaceId}/tools/${toolKey}`;
     }
     // Legacy fallback
     return `/tools/${toolKey}`;
   };
   ```

3. **Update getEnabledToolNavigationItems Function**:
   ```typescript
   // REPLACE existing function signature and add workspaceId parameter:
   export const getEnabledToolNavigationItems = (
     role: UserRole, 
     workspaceId?: string
   ): ToolNavigationItem[] => {
     return getSupportedTools(role).map(toolKey => {
       const config = toolFormRegistry[toolKey];
       return {
         toolKey,
         label: config.displayName,
         description: getToolDescription(toolKey),
         to: getToolRoute(toolKey, workspaceId),
         isEnabled: isToolEnabled(toolKey, role),
         readinessScore: workspaceId ? calculateToolReadiness(toolKey, workspaceId) : 0
       };
     });
   };
   ```

4. **Add calculateToolReadiness Stub**:
   ```typescript
   // ADD new function (temporary implementation):
   const calculateToolReadiness = (toolKey: SupportedTool, workspaceId: string): number => {
     // TODO: Implement actual readiness calculation in Phase 2B
     return 0;
   };
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. File compiles: npm --workspace apps/frontend run typecheck
2. getToolRoute updated: grep -q "workspaceId.*workspaces.*tools" apps/frontend/src/features/tools/runtime/tool-form-architecture.ts
3. Function signature updated: grep -q "workspaceId?: string" apps/frontend/src/features/tools/runtime/tool-form-architecture.ts
4. calculateToolReadiness exists: grep -q "calculateToolReadiness" apps/frontend/src/features/tools/runtime/tool-form-architecture.ts
```

**Success Criteria**: All 4 validation checks pass
**Output**: Updated tool-form-architecture.ts with workspace-aware routing

**Rollback Instructions**:
```bash
git checkout HEAD -- apps/frontend/src/features/tools/runtime/tool-form-architecture.ts
```

---

### **TASK P1.2A: Update system.ts - Navigation Copy**

**Priority**: MEDIUM
**Dependencies**: None (parallel)
**Estimated Time**: 20 minutes

**Input Requirements**:
- File exists: `apps/frontend/src/app/copy/system.ts`
- Current navigation section exists

**Atomic Operations**:
1. **Update Navigation Section**:
   ```typescript
   // FIND navigation object (around line 49-64) and UPDATE:
   navigation: {
     dashboard: 'Dashboard',
     workspaces: 'Workspaces', // CHANGED from 'tools: Tools'
     projects: 'Projects',
     // Keep existing tool names for internal reference
     funnelPages: 'Hotlead Funnel',
     nextland: 'Nextland',
     // ... rest unchanged
   },
   ```

2. **Update Actions Section**:
   ```typescript
   // ADD to actions object (around line 65-100):
   actions: {
     // ... existing actions
     openWorkspace: 'Apri workspace',
     enterWorkspaceTool: 'Usa nel workspace', 
     createWorkspace: 'Crea workspace',
     switchWorkspace: 'Cambia workspace',
     // UPDATE existing:
     openToolWorkspace: 'Apri nel workspace', // Modified from existing
     // ... rest unchanged
   },
   ```

3. **Add Workspace-Specific Copy Section**:
   ```typescript
   // ADD new workspace section AFTER existing sections:
   workspace: {
     contextHeader: {
       breadcrumbWorkspaces: 'Workspaces',
       assetCountLabel: 'asset disponibili',
       qualityStatusHealthy: 'Ready',
       qualityStatusNeedsAttention: 'Needs Review', 
       qualityStatusBlocked: 'Blocked',
       workflowProgressLabel: 'Workflow Progress',
       suggestedNextLabel: 'Next:',
     },
     dashboard: {
       title: 'Workspace Dashboard',
       knowledgeOverviewTitle: 'Knowledge Status',
       suggestedActionsTitle: 'Suggested Next Actions',
       availableToolsTitle: 'Available Tools',
       assetLibraryTitle: 'Asset Library',
       recentActivityTitle: 'Recent Activity',
     },
     assetPanel: {
       title: 'Workspace Knowledge',
       metricsAssets: 'assets',
       metricsQuality: 'quality',
       groupRequiredLabel: 'Required',
       groupOptionalLabel: 'Optional',
       groupMissingRequired: 'Missing (Required)',
       groupMissingOptional: 'Missing (Optional)', 
       selectedCount: 'selected',
       generateMoreAction: 'Generate More',
       createAssetAction: 'Create',
     }
   }
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. File compiles: npm --workspace apps/frontend run typecheck
2. Navigation updated: grep -q "workspaces.*Workspaces" apps/frontend/src/app/copy/system.ts
3. Actions added: grep -q "openWorkspace.*Apri workspace" apps/frontend/src/app/copy/system.ts
4. Workspace section added: grep -q "workspace:" apps/frontend/src/app/copy/system.ts
5. Asset panel copy added: grep -q "assetPanel:" apps/frontend/src/app/copy/system.ts
```

**Success Criteria**: All 5 validation checks pass
**Output**: Updated system.ts with workspace terminology

**Rollback Instructions**:
```bash
git checkout HEAD -- apps/frontend/src/app/copy/system.ts
```

---

### **TASK P1.3A: Create useWorkspaceContext Hook**

**Priority**: CRITICAL
**Dependencies**: None
**Estimated Time**: 90 minutes

**Input Requirements**:
- Directory exists: `apps/frontend/src/features/workspace/runtime/`
- Asset contracts available (from previous implementation)
- React hooks available

**Atomic Operations**:
1. **Create useWorkspaceContext.ts File**:
   ```typescript
   // FILE: apps/frontend/src/features/workspace/runtime/useWorkspaceContext.ts
   import { useMemo } from 'react';
   import type { SupportedTool } from '../../tools/machines/tool-flow.machine';
   import { useProjectDetailQuery } from '../../../app/runtime/queries/useProjectDetailQuery';
   import { useAssetSuggestions } from '../../assets/runtime/useAssetSuggestions';
   
   // Type definitions based on Asset Domain Model (DDD-188 → DDD-207)
   interface WorkspaceAsset {
     id: string;
     assetType: string;
     label: string;
     qualityScore: number;
     sourceToolKey?: SupportedTool;
     staleUpstream?: boolean;
   }
   
   interface AssetCompatibilityEntry {
     assetType: string;
     requiredness: 'always-required' | 'optional-by-tool-setting' | 'never-required';
   }
   
   interface AssetGap {
     assetType: string;
     canBeProducedBy: SupportedTool[];
   }
   
   interface WorkflowPosition {
     currentStep: string;
     totalSteps: number;
     completedSteps: string[];
     suggestedNext?: SupportedTool[];
     estimatedCompletion?: number; // percentage
   }
   
   interface WorkspaceContextData {
     id: string;
     name: string;
     description?: string;
     assets: WorkspaceAsset[];
     qualityGateStatus: 'healthy' | 'needs-attention' | 'blocked';
     workflowPosition?: WorkflowPosition;
     compatibilityMatrix: AssetCompatibilityEntry[];
     gaps: AssetGap[];
     overallQualityScore: number;
     lastActivity?: Date;
   }
   
   export const useWorkspaceContext = (workspaceId?: string): WorkspaceContextData & {
     loading: boolean;
     error: string | null;
     refetch: () => void;
   } => {
     // Project data (workspace = project in current architecture)
     const projectQuery = useProjectDetailQuery({ 
       projectId: workspaceId,
       enabled: !!workspaceId 
     });
     
     // Asset suggestions with compatibility matrix
     const assetsQuery = useAssetSuggestions(workspaceId || '', null);
     
     // Calculate quality gate status
     const qualityGateStatus = useMemo((): 'healthy' | 'needs-attention' | 'blocked' => {
       const assets = assetsQuery.data?.assets || [];
       if (assets.length === 0) return 'healthy';
       
       const criticalLowQuality = assets.filter(a => a.qualityScore < 40).length;
       const moderateLowQuality = assets.filter(a => a.qualityScore >= 40 && a.qualityScore < 70).length;
       
       if (criticalLowQuality > 0) return 'blocked';
       if (moderateLowQuality > 0) return 'needs-attention';
       return 'healthy';
     }, [assetsQuery.data?.assets]);
   
     // Calculate overall quality score
     const overallQualityScore = useMemo(() => {
       const assets = assetsQuery.data?.assets || [];
       if (assets.length === 0) return 0;
       
       const totalScore = assets.reduce((sum, asset) => sum + asset.qualityScore, 0);
       return Math.round(totalScore / assets.length);
     }, [assetsQuery.data?.assets]);
   
     // Calculate workflow position (simplified for Phase 1)
     const workflowPosition = useMemo((): WorkflowPosition | undefined => {
       const assets = assetsQuery.data?.assets || [];
       if (assets.length === 0) return undefined;
       
       // Determine completed tools based on available assets
       const completedTools = new Set<SupportedTool>();
       assets.forEach(asset => {
         if (asset.sourceToolKey) {
           completedTools.add(asset.sourceToolKey);
         }
       });
       
       // Calculate suggested next tools based on gaps (simplified)
       const gaps = assetsQuery.data?.gaps || [];
       const suggestedNext = gaps
         .flatMap(gap => gap.canBeProducedBy)
         .slice(0, 3);
       
       return {
         currentStep: `${completedTools.size} tools completed`,
         totalSteps: 8, // Number of available tools
         completedSteps: Array.from(completedTools),
         suggestedNext,
         estimatedCompletion: Math.round((completedTools.size / 8) * 100)
       };
     }, [assetsQuery.data?.assets, assetsQuery.data?.gaps]);
   
     return {
       id: workspaceId || '',
       name: projectQuery.data?.name || '',
       description: projectQuery.data?.description || '',
       assets: assetsQuery.data?.assets || [],
       qualityGateStatus,
       workflowPosition,
       compatibilityMatrix: assetsQuery.data?.compatibilityMatrix || [],
       gaps: assetsQuery.data?.gaps || [],
       overallQualityScore,
       lastActivity: projectQuery.data?.updatedAt ? new Date(projectQuery.data.updatedAt) : undefined,
       loading: projectQuery.loading || assetsQuery.loading,
       error: projectQuery.error || assetsQuery.error,
       refetch: () => {
         projectQuery.refetch();
         assetsQuery.refetch();
       }
     };
   };
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. File exists: test -f apps/frontend/src/features/workspace/runtime/useWorkspaceContext.ts
2. TypeScript valid: npx tsc --noEmit apps/frontend/src/features/workspace/runtime/useWorkspaceContext.ts
3. Hook exports: grep -q "export const useWorkspaceContext" apps/frontend/src/features/workspace/runtime/useWorkspaceContext.ts
4. Asset types defined: grep -q "WorkspaceAsset" apps/frontend/src/features/workspace/runtime/useWorkspaceContext.ts
5. Quality calculation: grep -q "qualityGateStatus.*useMemo" apps/frontend/src/features/workspace/runtime/useWorkspaceContext.ts
```

**Success Criteria**: All 5 validation checks pass
**Output**: New hook file created with workspace context management

**Rollback Instructions**:
```bash
rm -f apps/frontend/src/features/workspace/runtime/useWorkspaceContext.ts
```

---

### **TASK P1.3B: Create WorkspaceProvider Context**

**Priority**: HIGH
**Dependencies**: P1.3A complete
**Estimated Time**: 30 minutes

**Input Requirements**:
- useWorkspaceContext hook created (P1.3A complete)
- React context libraries available

**Atomic Operations**:
1. **Create WorkspaceProvider.tsx**:
   ```typescript
   // FILE: apps/frontend/src/features/workspace/runtime/WorkspaceProvider.tsx
   import { createContext, useContext, useMemo, type ReactNode } from 'react';
   
   interface WorkspaceContextData {
     id: string;
     name: string;
     description?: string;
     assets: any[]; // Import proper type from useWorkspaceContext
     qualityGateStatus: 'healthy' | 'needs-attention' | 'blocked';
     workflowPosition?: any;
     compatibilityMatrix: any[];
     gaps: any[];
     overallQualityScore: number;
     lastActivity?: Date;
   }
   
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
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. File exists: test -f apps/frontend/src/features/workspace/runtime/WorkspaceProvider.tsx
2. Valid TypeScript: npx tsc --noEmit apps/frontend/src/features/workspace/runtime/WorkspaceProvider.tsx
3. Provider exported: grep -q "export const WorkspaceProvider" apps/frontend/src/features/workspace/runtime/WorkspaceProvider.tsx
4. Hook exported: grep -q "export const useWorkspace" apps/frontend/src/features/workspace/runtime/WorkspaceProvider.tsx
5. Context created: grep -q "createContext.*WorkspaceContextValue" apps/frontend/src/features/workspace/runtime/WorkspaceProvider.tsx
```

**Success Criteria**: All 5 validation checks pass
**Output**: WorkspaceProvider context created and validated

**Rollback Instructions**:
```bash
rm -f apps/frontend/src/features/workspace/runtime/WorkspaceProvider.tsx
```

---

### **TASK P1.3C: Create WorkspaceToolWrapper Component**

**Priority**: HIGH
**Dependencies**: P1.3A, P1.3B complete
**Estimated Time**: 45 minutes

**Input Requirements**:
- useWorkspaceContext hook created (P1.3A complete)
- WorkspaceProvider created (P1.3B complete)

**Atomic Operations**:
1. **Create WorkspaceToolWrapper.tsx**:
   ```typescript
   // FILE: apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx
   import { type ReactNode } from 'react';
   import { useParams, Navigate } from 'react-router-dom';
   import type { SupportedTool } from '../../tools/machines/tool-flow.machine';
   import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
   import { WorkspaceProvider } from '../runtime/WorkspaceProvider';
   import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
   
   interface WorkspaceToolWrapperProps {
     toolKey: SupportedTool;
     children: ReactNode;
   }
   
   export const WorkspaceToolWrapper: React.FC<WorkspaceToolWrapperProps> = ({
     toolKey,
     children
   }) => {
     const { workspaceId } = useParams<{ workspaceId: string }>();
     const workspaceContext = useWorkspaceContext(workspaceId);
     
     // Handle loading states
     if (workspaceContext.loading) {
       return <LoadingStateMessage>Loading workspace context...</LoadingStateMessage>;
     }
     
     // Handle error states  
     if (workspaceContext.error) {
       return <ErrorStateMessage>Error loading workspace: {workspaceContext.error}</ErrorStateMessage>;
     }
     
     // Handle missing workspace
     if (!workspaceId || !workspaceContext.name) {
       return <Navigate to="/workspaces" replace />;
     }
     
     return (
       <div className="workspace-tool-wrapper">
         {/* WorkspaceContextHeader will be added in Phase 2A */}
         <WorkspaceProvider value={workspaceContext}>
           {children}
         </WorkspaceProvider>
       </div>
     );
   };
   ```

2. **Add Basic CSS**:
   ```css
   /* FILE: apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.css */
   .workspace-tool-wrapper {
     display: flex;
     flex-direction: column;
     min-height: 100vh;
   }
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. Component file exists: test -f apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx
2. CSS file exists: test -f apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.css
3. Valid TypeScript: npx tsc --noEmit apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx
4. Uses workspace context: grep -q "useWorkspaceContext" apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx
5. Renders provider: grep -q "WorkspaceProvider" apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx
```

**Success Criteria**: All 5 validation checks pass
**Output**: WorkspaceToolWrapper component created with error handling

**Rollback Instructions**:
```bash
rm -f apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx
rm -f apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.css
```

---

### **TASK P1.4A: Phase 1 Integration Test**

**Priority**: CRITICAL
**Dependencies**: P1.1A, P1.1B, P1.1C, P1.2A, P1.3A, P1.3B, P1.3C complete
**Estimated Time**: 30 minutes

**Input Requirements**:
- All Phase 1 tasks completed successfully
- Frontend can compile and typecheck

**Atomic Operations**:
1. **Run Full TypeScript Compilation**:
   ```bash
   npm --workspace apps/frontend run typecheck
   ```

2. **Run Build Test**:
   ```bash
   npm --workspace apps/frontend run build
   ```

3. **Verify Route Structure**:
   ```bash
   # Check workspace routes exist
   grep -q "/workspaces" apps/frontend/src/app/routing/app-router.tsx
   # Check legacy redirects exist  
   grep -q "LegacyToolRedirect" apps/frontend/src/app/routing/app-router.tsx
   ```

4. **Verify Component Structure**:
   ```bash
   # Check all components exist
   test -f apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx
   test -f apps/frontend/src/features/workspace/ui/LegacyToolRedirect.tsx
   test -f apps/frontend/src/features/workspace/runtime/useWorkspaceContext.ts
   test -f apps/frontend/src/features/workspace/runtime/WorkspaceProvider.tsx
   ```

5. **Test Import Resolution**:
   ```bash
   # Verify no missing imports
   npm --workspace apps/frontend run typecheck 2>&1 | grep -v "error TS" || echo "No TypeScript errors"
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. TypeScript compilation: npm --workspace apps/frontend run typecheck (exit code 0)
2. Build succeeds: npm --workspace apps/frontend run build (exit code 0) 
3. All components exist: find apps/frontend/src/features/workspace -name "*.tsx" -o -name "*.ts" | wc -l >= 4
4. No TypeScript errors: npm --workspace apps/frontend run typecheck 2>&1 | grep -c "error TS" = 0
5. Route structure valid: grep -c "/workspaces" apps/frontend/src/app/routing/app-router.tsx >= 1
```

**Success Criteria**: All 5 validation checks pass + build succeeds
**Output**: Phase 1 foundation infrastructure is complete and validated

**Rollback Instructions**:
```bash
# Full Phase 1 rollback:
git checkout HEAD -- apps/frontend/src/app/routing/app-router.tsx
git checkout HEAD -- apps/frontend/src/features/tools/runtime/tool-form-architecture.ts  
git checkout HEAD -- apps/frontend/src/app/copy/system.ts
rm -rf apps/frontend/src/features/workspace/
npm --workspace apps/frontend run typecheck
```

---

## 📋 **PHASE 2A: Workspace Context (4 Tasks)** ✅ COMPLETED 2026-07-17

**Phase Dependency**: PHASE 1 complete
**Phase Output**: WorkspaceContextHeader component integrated and functional

### **TASK P2A.1A: Create WorkspaceContextHeader Component**

**Priority**: HIGH
**Dependencies**: P1 complete
**Estimated Time**: 60 minutes

**Input Requirements**:
- Phase 1 complete and validated
- MUI components available
- Lucide icons available

**Atomic Operations**:
1. **Create WorkspaceContextHeader.tsx**:
   ```typescript
   // FILE: apps/frontend/src/features/workspace/ui/WorkspaceContextHeader.tsx
   import { Breadcrumbs, Chip, LinearProgress, Typography } from '@mui/material';
   import { ChevronRight, Folder, FolderOpen, Database, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
   import { Link } from 'react-router-dom';
   import type { SupportedTool } from '../../tools/machines/tool-flow.machine';
   import { toolFormRegistry } from '../../tools/runtime/tool-form-architecture';
   import { appCopy } from '../../../app/copy/system';
   
   interface WorkflowPosition {
     currentStep: string;
     totalSteps: number;
     completedSteps: string[];
     suggestedNext?: SupportedTool[];
     estimatedCompletion?: number;
   }
   
   interface WorkspaceContextHeaderProps {
     workspaceId: string;
     workspaceName: string;
     currentTool: SupportedTool;
     assetCount: number;
     qualityGateStatus: 'healthy' | 'needs-attention' | 'blocked';
     crossToolPosition?: WorkflowPosition;
   }
   
   const QUALITY_GATE_CONFIG = {
     healthy: { icon: CheckCircle, color: 'success' as const, label: 'Ready' },
     'needs-attention': { icon: AlertTriangle, color: 'warning' as const, label: 'Needs Review' },
     blocked: { icon: XCircle, color: 'error' as const, label: 'Blocked' }
   };
   
   export const WorkspaceContextHeader: React.FC<WorkspaceContextHeaderProps> = ({
     workspaceId,
     workspaceName,
     currentTool,
     assetCount,
     qualityGateStatus,
     crossToolPosition
   }) => {
     const qualityConfig = QUALITY_GATE_CONFIG[qualityGateStatus];
     const QualityIcon = qualityConfig.icon;
     
     return (
       <div className="workspace-context-header">
         <div className="workspace-context-header__breadcrumb">
           <Breadcrumbs separator={<ChevronRight size={14} />} className="workspace-context-header__breadcrumbs">
             <Link 
               to="/workspaces" 
               className="workspace-context-header__breadcrumb-link"
             >
               <Folder size={16} />
               {appCopy.workspace?.contextHeader?.breadcrumbWorkspaces || 'Workspaces'}
             </Link>
             <Link 
               to={`/workspaces/${workspaceId}`} 
               className="workspace-context-header__breadcrumb-link"
             >
               <FolderOpen size={16} />
               {workspaceName}
             </Link>
             <Typography variant="body2" color="text.primary">
               {toolFormRegistry[currentTool]?.displayName || currentTool}
             </Typography>
           </Breadcrumbs>
         </div>
         
         <div className="workspace-context-header__status">
           <Chip 
             icon={<Database size={14} />}
             label={`${assetCount} ${appCopy.workspace?.contextHeader?.assetCountLabel || 'assets'}`}
             variant="outlined"
             size="small"
             className="workspace-context-header__asset-chip"
           />
           
           <Chip 
             icon={<QualityIcon size={14} />}
             label={qualityConfig.label}
             color={qualityConfig.color}
             size="small"
             className="workspace-context-header__quality-chip"
           />
           
           {crossToolPosition && (
             <div className="workspace-context-header__workflow">
               <Typography variant="caption" className="workspace-context-header__workflow-text">
                 {crossToolPosition.currentStep} ({crossToolPosition.estimatedCompletion || 0}%)
               </Typography>
               
               <LinearProgress 
                 variant="determinate" 
                 value={crossToolPosition.estimatedCompletion || 0}
                 className="workspace-context-header__progress"
                 color={qualityConfig.color}
               />
               
               {crossToolPosition.suggestedNext && crossToolPosition.suggestedNext.length > 0 && (
                 <div className="workspace-context-header__next-tools">
                   <Typography variant="caption">
                     {appCopy.workspace?.contextHeader?.suggestedNextLabel || 'Next:'}
                   </Typography>
                   {crossToolPosition.suggestedNext.slice(0, 2).map(toolKey => (
                     <Chip 
                       key={toolKey}
                       label={toolFormRegistry[toolKey]?.displayName || toolKey}
                       size="small"
                       variant="outlined"
                       clickable
                       component={Link}
                       to={`/workspaces/${workspaceId}/tools/${toolKey}`}
                       className="workspace-context-header__next-tool-chip"
                     />
                   ))}
                 </div>
               )}
             </div>
           )}
         </div>
       </div>
     );
   };
   ```

2. **Create CSS Styles**:
   ```css
   /* FILE: apps/frontend/src/features/workspace/ui/WorkspaceContextHeader.css */
   .workspace-context-header {
     display: flex;
     justify-content: space-between;
     align-items: center;
     padding: 12px 16px;
     border-bottom: 1px solid var(--mui-palette-divider);
     background-color: var(--mui-palette-background-paper);
     min-height: 64px;
     position: sticky;
     top: 0;
     z-index: 100;
   }
   
   .workspace-context-header__breadcrumb {
     flex: 1;
     min-width: 0;
   }
   
   .workspace-context-header__breadcrumb-link {
     display: flex;
     align-items: center;
     gap: 6px;
     text-decoration: none;
     color: var(--mui-palette-text-secondary);
     transition: color 0.2s ease;
   }
   
   .workspace-context-header__breadcrumb-link:hover {
     color: var(--mui-palette-text-primary);
   }
   
   .workspace-context-header__status {
     display: flex;
     align-items: center;
     gap: 8px;
     flex-wrap: wrap;
   }
   
   .workspace-context-header__workflow {
     display: flex;
     flex-direction: column;
     align-items: flex-end;
     gap: 4px;
     min-width: 120px;
   }
   
   .workspace-context-header__progress {
     width: 100%;
     height: 4px;
     border-radius: 2px;
   }
   
   .workspace-context-header__next-tools {
     display: flex;
     align-items: center;
     gap: 4px;
     flex-wrap: wrap;
     justify-content: flex-end;
   }
   
   @media (max-width: 768px) {
     .workspace-context-header {
       flex-direction: column;
       align-items: stretch;
       gap: 12px;
       padding: 12px;
       min-height: auto;
     }
     
     .workspace-context-header__status {
       justify-content: space-between;
       flex-wrap: nowrap;
       overflow-x: auto;
     }
   }
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. Component exists: test -f apps/frontend/src/features/workspace/ui/WorkspaceContextHeader.tsx
2. CSS exists: test -f apps/frontend/src/features/workspace/ui/WorkspaceContextHeader.css
3. Valid TypeScript: npx tsc --noEmit apps/frontend/src/features/workspace/ui/WorkspaceContextHeader.tsx
4. Uses MUI components: grep -q "Breadcrumbs.*Chip" apps/frontend/src/features/workspace/ui/WorkspaceContextHeader.tsx
5. Has breadcrumb navigation: grep -q "breadcrumb-link" apps/frontend/src/features/workspace/ui/WorkspaceContextHeader.tsx
```

**Success Criteria**: All 5 validation checks pass
**Output**: WorkspaceContextHeader component created with responsive design

**Rollback Instructions**:
```bash
rm -f apps/frontend/src/features/workspace/ui/WorkspaceContextHeader.tsx
rm -f apps/frontend/src/features/workspace/ui/WorkspaceContextHeader.css
```

---

### **TASK P2A.1B: Update WorkspaceToolWrapper - Add Header**

**Priority**: HIGH
**Dependencies**: P2A.1A complete
**Estimated Time**: 15 minutes

**Input Requirements**:
- WorkspaceContextHeader component created (P2A.1A complete)
- WorkspaceToolWrapper exists from Phase 1

**Atomic Operations**:
1. **Update WorkspaceToolWrapper.tsx**:
   ```typescript
   // REPLACE the return statement in WorkspaceToolWrapper.tsx:
   import { WorkspaceContextHeader } from './WorkspaceContextHeader';
   import './WorkspaceContextHeader.css';
   
   // ... existing imports and component logic ...
   
   return (
     <div className="workspace-tool-wrapper">
       <WorkspaceContextHeader
         workspaceId={workspaceId}
         workspaceName={workspaceContext.name}
         currentTool={toolKey}
         assetCount={workspaceContext.assets.length}
         qualityGateStatus={workspaceContext.qualityGateStatus}
         crossToolPosition={workspaceContext.workflowPosition}
       />
       
       <WorkspaceProvider value={workspaceContext}>
         {children}
       </WorkspaceProvider>
     </div>
   );
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. File updated: grep -q "WorkspaceContextHeader" apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx
2. Import added: grep -q "import.*WorkspaceContextHeader" apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx
3. CSS import added: grep -q "WorkspaceContextHeader.css" apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx
4. Component renders: grep -q "<WorkspaceContextHeader" apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx
5. TypeScript valid: npx tsc --noEmit apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx
```

**Success Criteria**: All 5 validation checks pass
**Output**: WorkspaceToolWrapper now renders header with context

**Rollback Instructions**:
```bash
git checkout HEAD -- apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx
```

---

### **TASK P2A.2A: Create Placeholder Pages**

**Priority**: MEDIUM
**Dependencies**: P1 complete
**Estimated Time**: 30 minutes

**Input Requirements**:
- Phase 1 workspace infrastructure complete
- React routing available

**Atomic Operations**:
1. **Create WorkspacesListPage.tsx**:
   ```typescript
   // FILE: apps/frontend/src/features/workspace/pages/WorkspacesListPage.tsx
   import { Link } from 'react-router-dom';
   import { Surface, uiPrimitives } from '../../../app/ui/primitives';
   
   export const WorkspacesListPage: React.FC = () => {
     return (
       <Surface as="section" className={uiPrimitives.stack}>
         <h2>Workspaces</h2>
         <p>Workspace-centric navigation is active. This page will be fully implemented in Phase 3.</p>
         
         {/* Temporary navigation back to projects */}
         <Link to="/projects" className={uiPrimitives.inlineLink}>
           ← Back to Projects (temporary)
         </Link>
       </Surface>
     );
   };
   ```

2. **Create WorkspaceDashboard.tsx**:
   ```typescript
   // FILE: apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx
   import { useParams, Link } from 'react-router-dom';
   import { Surface, uiPrimitives } from '../../../app/ui/primitives';
   
   export const WorkspaceDashboard: React.FC = () => {
     const { workspaceId } = useParams<{ workspaceId: string }>();
     
     return (
       <Surface as="section" className={uiPrimitives.stack}>
         <h2>Workspace Dashboard</h2>
         <p>Workspace ID: {workspaceId}</p>
         <p>Dashboard functionality will be implemented in Phase 3.</p>
         
         {/* Temporary navigation */}
         <Link to="/workspaces" className={uiPrimitives.inlineLink}>
           ← Back to Workspaces
         </Link>
       </Surface>
     );
   };
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. List page exists: test -f apps/frontend/src/features/workspace/pages/WorkspacesListPage.tsx
2. Dashboard exists: test -f apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx
3. List page valid: npx tsc --noEmit apps/frontend/src/features/workspace/pages/WorkspacesListPage.tsx
4. Dashboard valid: npx tsc --noEmit apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx
5. Exports correct: grep -q "export const WorkspacesListPage" apps/frontend/src/features/workspace/pages/WorkspacesListPage.tsx
```

**Success Criteria**: All 5 validation checks pass
**Output**: Placeholder pages created for workspace navigation

**Rollback Instructions**:
```bash
rm -f apps/frontend/src/features/workspace/pages/WorkspacesListPage.tsx
rm -f apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx
```

---

### **TASK P2A.3A: Phase 2A Integration Test**

**Priority**: HIGH
**Dependencies**: P2A.1A, P2A.1B, P2A.2A complete
**Estimated Time**: 20 minutes

**Input Requirements**:
- All Phase 2A tasks completed
- Phase 1 foundation in place

**Atomic Operations**:
1. **Full Compilation Test**:
   ```bash
   npm --workspace apps/frontend run typecheck
   ```

2. **Verify Header Integration**:
   ```bash
   # Check WorkspaceContextHeader is imported in wrapper
   grep -q "WorkspaceContextHeader" apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx
   # Check component has required props
   grep -q "workspaceId.*workspaceName.*currentTool" apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx
   ```

3. **Verify Page Structure**:
   ```bash
   # Check placeholder pages exist and export correctly
   test -f apps/frontend/src/features/workspace/pages/WorkspacesListPage.tsx
   test -f apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx
   ```

4. **Check Import Chain**:
   ```bash
   # Verify app-router can import new pages
   grep -q "WorkspacesListPage.*WorkspaceDashboard" apps/frontend/src/app/routing/app-router.tsx
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. TypeScript compilation: npm --workspace apps/frontend run typecheck (exit code 0)
2. Header integrated: grep -c "WorkspaceContextHeader" apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx >= 2
3. Pages exist: ls apps/frontend/src/features/workspace/pages/*.tsx | wc -l >= 2
4. No import errors: npm --workspace apps/frontend run typecheck 2>&1 | grep -c "Cannot find module" = 0
5. Router updated: grep -q "WorkspacesListPage\|WorkspaceDashboard" apps/frontend/src/app/routing/app-router.tsx
```

**Success Criteria**: All 5 validation checks pass
**Output**: Phase 2A workspace context infrastructure complete

**Rollback Instructions**:
```bash
# Rollback Phase 2A changes:
git checkout HEAD -- apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx
rm -f apps/frontend/src/features/workspace/ui/WorkspaceContextHeader.tsx
rm -f apps/frontend/src/features/workspace/ui/WorkspaceContextHeader.css
rm -f apps/frontend/src/features/workspace/pages/WorkspacesListPage.tsx
rm -f apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx
```

---

## 📋 **PHASE 2B: Asset Knowledge Panel (6 Tasks)** ✅ COMPLETED 2026-07-17

**Phase Dependency**: PHASE 1 complete (can run parallel with 2A)
**Phase Output**: AssetKnowledgePanel integrated in ToolPageTemplate

### **TASK P2B.1A: Create Asset Support Components**

**Priority**: MEDIUM
**Dependencies**: P1 complete
**Estimated Time**: 45 minutes

**Input Requirements**:
- Phase 1 workspace infrastructure complete
- Asset types from contracts available

**Atomic Operations**:
1. **Create QualityScoreBadge.tsx**:
   ```typescript
   // FILE: apps/frontend/src/features/workspace/ui/QualityScoreBadge.tsx
   import { Chip } from '@mui/material';
   
   interface QualityScoreBadgeProps {
     score: number;
     size?: 'small' | 'medium';
     label?: string;
   }
   
   const getQualityColor = (score: number): 'success' | 'warning' | 'error' | 'default' => {
     if (score >= 70) return 'success';
     if (score >= 40) return 'warning';
     if (score > 0) return 'error';
     return 'default';
   };
   
   export const QualityScoreBadge: React.FC<QualityScoreBadgeProps> = ({
     score,
     size = 'small',
     label = 'quality'
   }) => {
     const color = getQualityColor(score);
     
     return (
       <Chip
         label={score > 0 ? `${score}% ${label}` : `No ${label}`}
         color={color}
         size={size}
         variant="outlined"
       />
     );
   };
   ```

2. **Create AssetTypeIcon.tsx**:
   ```typescript
   // FILE: apps/frontend/src/features/workspace/ui/AssetTypeIcon.tsx
   import { 
     Target, User, MessageSquare, Zap, BarChart3, FileText, 
     PenTool, Globe, List, Newspaper, Video, FileImage 
   } from 'lucide-react';
   
   export const ASSET_TYPE_ICONS = {
     angle: Target,
     persona: User,
     'brand-voice': MessageSquare,
     hook: Zap,
     'competitor-analysis': BarChart3,
     'creative-brief': FileText,
     'ad-copy': PenTool,
     'landing-page': Globe,
     'article-outline': List,
     article: Newspaper,
     script: Video,
     description: FileImage,
   } as const;
   
   interface AssetTypeIconProps {
     type: string;
     size?: number;
     className?: string;
   }
   
   export const AssetTypeIcon: React.FC<AssetTypeIconProps> = ({
     type,
     size = 18,
     className
   }) => {
     const Icon = ASSET_TYPE_ICONS[type as keyof typeof ASSET_TYPE_ICONS] || FileText;
     return <Icon size={size} className={className} />;
   };
   ```

3. **Create CreateAssetPrompt.tsx**:
   ```typescript
   // FILE: apps/frontend/src/features/workspace/ui/CreateAssetPrompt.tsx
   import { Button, Typography } from '@mui/material';
   import { Plus } from 'lucide-react';
   import type { SupportedTool } from '../../tools/machines/tool-flow.machine';
   
   interface CreateAssetPromptProps {
     assetType: string;
     label: string;
     producerTool?: SupportedTool | null;
     isRequired: boolean;
     onCreateAction: () => void;
   }
   
   export const CreateAssetPrompt: React.FC<CreateAssetPromptProps> = ({
     assetType,
     label,
     producerTool,
     isRequired,
     onCreateAction
   }) => {
     return (
       <div className="create-asset-prompt">
         <Typography variant="body2" color="text.secondary">
           {isRequired 
             ? `${label} assets are required for optimal generation.`
             : `${label} assets would improve generation quality.`
           }
         </Typography>
         
         {producerTool ? (
           <Button
             variant="contained"
             size="small"
             startIcon={<Plus size={14} />}
             onClick={onCreateAction}
             className="create-asset-prompt__button"
           >
             Generate with {producerTool}
           </Button>
         ) : (
           <Typography variant="caption" color="text.disabled">
             No tool available to generate {label}
           </Typography>
         )}
       </div>
     );
   };
   ```

4. **Add CSS for components**:
   ```css
   /* FILE: apps/frontend/src/features/workspace/ui/asset-components.css */
   .create-asset-prompt {
     padding: 16px;
     text-align: center;
     background-color: var(--mui-palette-action-hover);
     border-radius: 8px;
     margin: 8px 0;
   }
   
   .create-asset-prompt__button {
     margin-top: 8px;
   }
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. QualityScoreBadge exists: test -f apps/frontend/src/features/workspace/ui/QualityScoreBadge.tsx
2. AssetTypeIcon exists: test -f apps/frontend/src/features/workspace/ui/AssetTypeIcon.tsx
3. CreateAssetPrompt exists: test -f apps/frontend/src/features/workspace/ui/CreateAssetPrompt.tsx
4. CSS exists: test -f apps/frontend/src/features/workspace/ui/asset-components.css
5. All components valid: npx tsc --noEmit apps/frontend/src/features/workspace/ui/QualityScoreBadge.tsx apps/frontend/src/features/workspace/ui/AssetTypeIcon.tsx apps/frontend/src/features/workspace/ui/CreateAssetPrompt.tsx
```

**Success Criteria**: All 5 validation checks pass
**Output**: Asset support components created and validated

**Rollback Instructions**:
```bash
rm -f apps/frontend/src/features/workspace/ui/QualityScoreBadge.tsx
rm -f apps/frontend/src/features/workspace/ui/AssetTypeIcon.tsx
rm -f apps/frontend/src/features/workspace/ui/CreateAssetPrompt.tsx
rm -f apps/frontend/src/features/workspace/ui/asset-components.css
```

---

### **TASK P2B.1B: Create AssetSelectionList Component**

**Priority**: MEDIUM  
**Dependencies**: P2B.1A complete
**Estimated Time**: 30 minutes

**Input Requirements**:
- Asset support components created (P2B.1A complete)
- Asset type definitions available

**Atomic Operations**:
1. **Create AssetSelectionList.tsx**:
   ```typescript
   // FILE: apps/frontend/src/features/workspace/ui/AssetSelectionList.tsx
   import { Checkbox, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
   import { AssetTypeIcon } from './AssetTypeIcon';
   import { QualityScoreBadge } from './QualityScoreBadge';
   
   interface WorkspaceAsset {
     id: string;
     assetType: string;
     label: string;
     qualityScore: number;
     sourceToolKey?: string;
     staleUpstream?: boolean;
   }
   
   interface AssetSelectionListProps {
     assets: WorkspaceAsset[];
     selectedAssetIds: string[];
     onAssetToggle: (assetId: string, checked: boolean) => void;
   }
   
   export const AssetSelectionList: React.FC<AssetSelectionListProps> = ({
     assets,
     selectedAssetIds,
     onAssetToggle
   }) => {
     return (
       <List dense className="asset-selection-list">
         {assets.map((asset) => {
           const isSelected = selectedAssetIds.includes(asset.id);
           
           return (
             <ListItem key={asset.id} disablePadding>
               <ListItemButton
                 onClick={() => onAssetToggle(asset.id, !isSelected)}
                 dense
               >
                 <ListItemIcon>
                   <Checkbox
                     checked={isSelected}
                     tabIndex={-1}
                     disableRipple
                   />
                 </ListItemIcon>
                 
                 <AssetTypeIcon 
                   type={asset.assetType} 
                   size={16} 
                   style={{ marginRight: 8 }}
                 />
                 
                 <ListItemText
                   primary={asset.label}
                   secondary={
                     <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                       <QualityScoreBadge score={asset.qualityScore} size="small" />
                       {asset.staleUpstream && (
                         <span style={{ fontSize: '0.75rem', color: 'orange' }}>
                           Needs Update
                         </span>
                       )}
                     </div>
                   }
                 />
               </ListItemButton>
             </ListItem>
           );
         })}
       </List>
     );
   };
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. Component exists: test -f apps/frontend/src/features/workspace/ui/AssetSelectionList.tsx
2. Valid TypeScript: npx tsc --noEmit apps/frontend/src/features/workspace/ui/AssetSelectionList.tsx
3. Uses MUI components: grep -q "List.*ListItem.*Checkbox" apps/frontend/src/features/workspace/ui/AssetSelectionList.tsx
4. Imports support components: grep -q "AssetTypeIcon.*QualityScoreBadge" apps/frontend/src/features/workspace/ui/AssetSelectionList.tsx
5. Has toggle functionality: grep -q "onAssetToggle" apps/frontend/src/features/workspace/ui/AssetSelectionList.tsx
```

**Success Criteria**: All 5 validation checks pass
**Output**: AssetSelectionList component for asset checkbox lists

**Rollback Instructions**:
```bash
rm -f apps/frontend/src/features/workspace/ui/AssetSelectionList.tsx
```

---

### **TASK P2B.2A: Create AssetGroupSection Component**

**Priority**: HIGH
**Dependencies**: P2B.1A, P2B.1B complete  
**Estimated Time**: 75 minutes

**Input Requirements**:
- Asset support components created (P2B.1A complete)
- AssetSelectionList component created (P2B.1B complete)

**Atomic Operations**:
1. **Create AssetGroupSection.tsx**:
   ```typescript
   // FILE: apps/frontend/src/features/workspace/ui/AssetGroupSection.tsx
   import { useCallback, useMemo } from 'react';
   import { 
     Button, Chip, Collapse, IconButton, Typography 
   } from '@mui/material';
   import { ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react';
   import type { SupportedTool } from '../../tools/machines/tool-flow.machine';
   import { AssetTypeIcon } from './AssetTypeIcon';
   import { QualityScoreBadge } from './QualityScoreBadge';
   import { AssetSelectionList } from './AssetSelectionList';
   import { CreateAssetPrompt } from './CreateAssetPrompt';
   import { appCopy } from '../../../app/copy/system';
   
   interface WorkspaceAsset {
     id: string;
     assetType: string;
     label: string;
     qualityScore: number;
     sourceToolKey?: string;
     staleUpstream?: boolean;
   }
   
   interface AssetCompatibilityEntry {
     assetType: string;
     requiredness: 'always-required' | 'optional-by-tool-setting' | 'never-required';
   }
   
   interface AssetGroupSectionProps {
     assetType: string;
     label: string;
     requiredness: 'always-required' | 'optional-by-tool-setting' | 'never-required';
     assets: WorkspaceAsset[];
     compatibility?: AssetCompatibilityEntry;
     isExpanded: boolean;
     selectedAssetIds: string[];
     producerTool?: SupportedTool | null;
     onToggleExpanded: (expanded: boolean) => void;
     onAssetToggle: (assetId: string, checked: boolean) => void;
     onCreateAction: () => void;
   }
   
   export const AssetGroupSection: React.FC<AssetGroupSectionProps> = ({
     assetType,
     label,
     requiredness,
     assets,
     isExpanded,
     selectedAssetIds,
     producerTool,
     onToggleExpanded,
     onAssetToggle,
     onCreateAction
   }) => {
     const hasAssets = assets.length > 0;
     const isRequired = requiredness === 'always-required';
     
     // Calculate group quality score
     const groupQualityScore = useMemo(() => {
       if (!hasAssets) return 0;
       const totalScore = assets.reduce((sum, asset) => sum + asset.qualityScore, 0);
       return Math.round(totalScore / assets.length);
     }, [assets, hasAssets]);
   
     const selectedAssetsInGroup = useMemo(() => 
       assets.filter(asset => selectedAssetIds.includes(asset.id)).length,
       [assets, selectedAssetIds]
     );
     
     const handleHeaderClick = useCallback((e: React.MouseEvent) => {
       // Prevent toggle when clicking on interactive elements
       if ((e.target as Element).closest('button, .MuiChip-root')) {
         return;
       }
       onToggleExpanded(!isExpanded);
     }, [isExpanded, onToggleExpanded]);
   
     const handleSelectAllInGroup = useCallback(() => {
       const allAssetIds = assets.map(a => a.id);
       const allSelected = allAssetIds.every(id => selectedAssetIds.includes(id));
       
       if (allSelected) {
         // Deselect all in group
         allAssetIds.forEach(id => onAssetToggle(id, false));
       } else {
         // Select all in group  
         allAssetIds.forEach(id => {
           if (!selectedAssetIds.includes(id)) {
             onAssetToggle(id, true);
           }
         });
       }
     }, [assets, selectedAssetIds, onAssetToggle]);
   
     return (
       <div className={`asset-group-section asset-group-section--${assetType}`}>
         <div 
           className="asset-group-section__header"
           onClick={handleHeaderClick}
           role="button"
           tabIndex={0}
           onKeyDown={(e) => {
             if (e.key === 'Enter' || e.key === ' ') {
               e.preventDefault();
               onToggleExpanded(!isExpanded);
             }
           }}
         >
           <div className="asset-group-section__header-left">
             <IconButton 
               size="small" 
               className="asset-group-section__expand-button"
               aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
             >
               {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
             </IconButton>
             
             <AssetTypeIcon size={18} type={assetType} className="asset-group-section__type-icon" />
             
             <Typography variant="subtitle2" className="asset-group-section__title">
               {label} ({assets.length})
             </Typography>
             
             {isRequired && (
               <Chip 
                 label={appCopy.workspace?.assetPanel?.groupRequiredLabel || 'Required'}
                 size="small" 
                 color="error" 
                 variant="outlined"
               />
             )}
           </div>
           
           <div className="asset-group-section__header-right">
             {hasAssets ? (
               <>
                 <QualityScoreBadge score={groupQualityScore} size="small" />
                 {selectedAssetsInGroup > 0 && (
                   <Chip 
                     label={`${selectedAssetsInGroup} ${appCopy.workspace?.assetPanel?.selectedCount || 'selected'}`}
                     size="small"
                     color="primary"
                   />
                 )}
               </>
             ) : (
               <Chip 
                 label={isRequired 
                   ? (appCopy.workspace?.assetPanel?.groupMissingRequired || 'Missing (Required)') 
                   : (appCopy.workspace?.assetPanel?.groupMissingOptional || 'Missing (Optional)')
                 }
                 size="small"
                 color={isRequired ? "error" : "default"}
                 variant="outlined"
               />
             )}
           </div>
         </div>
   
         <Collapse in={isExpanded}>
           <div className="asset-group-section__content">
             {hasAssets ? (
               <>
                 <div className="asset-group-section__controls">
                   <Button
                     size="small"
                     variant="text"
                     onClick={handleSelectAllInGroup}
                     startIcon={selectedAssetsInGroup === assets.length ? <Minus size={14} /> : <Plus size={14} />}
                   >
                     {selectedAssetsInGroup === assets.length ? 'Deselect All' : 'Select All'}
                   </Button>
                 </div>
                 
                 <AssetSelectionList 
                   assets={assets}
                   selectedAssetIds={selectedAssetIds}
                   onAssetToggle={onAssetToggle}
                 />
               </>
             ) : (
               <CreateAssetPrompt 
                 assetType={assetType}
                 label={label}
                 producerTool={producerTool}
                 isRequired={isRequired}
                 onCreateAction={onCreateAction}
               />
             )}
             
             {hasAssets && producerTool && (
               <div className="asset-group-section__actions">
                 <Button
                   size="small"
                   variant="outlined"
                   startIcon={<Plus size={14} />}
                   onClick={onCreateAction}
                   className="asset-group-section__generate-more-button"
                 >
                   {appCopy.workspace?.assetPanel?.generateMoreAction || 'Generate More'} {label}
                 </Button>
               </div>
             )}
           </div>
         </Collapse>
       </div>
     );
   };
   ```

2. **Add CSS for AssetGroupSection**:
   ```css
   /* FILE: apps/frontend/src/features/workspace/ui/AssetGroupSection.css */
   .asset-group-section {
     border: 1px solid var(--mui-palette-divider);
     border-radius: 8px;
     margin-bottom: 8px;
     overflow: hidden;
   }
   
   .asset-group-section__header {
     display: flex;
     justify-content: space-between;
     align-items: center;
     padding: 12px 16px;
     background-color: var(--mui-palette-action-hover);
     cursor: pointer;
     transition: background-color 0.2s ease;
   }
   
   .asset-group-section__header:hover {
     background-color: var(--mui-palette-action-selected);
   }
   
   .asset-group-section__header-left {
     display: flex;
     align-items: center;
     gap: 8px;
   }
   
   .asset-group-section__header-right {
     display: flex;
     align-items: center;
     gap: 8px;
   }
   
   .asset-group-section__content {
     padding: 16px;
   }
   
   .asset-group-section__controls {
     display: flex;
     justify-content: flex-end;
     margin-bottom: 8px;
   }
   
   .asset-group-section__actions {
     margin-top: 12px;
     text-align: center;
   }
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. Component exists: test -f apps/frontend/src/features/workspace/ui/AssetGroupSection.tsx
2. CSS exists: test -f apps/frontend/src/features/workspace/ui/AssetGroupSection.css
3. Valid TypeScript: npx tsc --noEmit apps/frontend/src/features/workspace/ui/AssetGroupSection.tsx
4. Uses all support components: grep -q "AssetSelectionList.*CreateAssetPrompt.*QualityScoreBadge" apps/frontend/src/features/workspace/ui/AssetGroupSection.tsx
5. Has expand/collapse: grep -q "Collapse.*isExpanded" apps/frontend/src/features/workspace/ui/AssetGroupSection.tsx
```

**Success Criteria**: All 5 validation checks pass
**Output**: AssetGroupSection component with expand/collapse and selection

**Rollback Instructions**:
```bash
rm -f apps/frontend/src/features/workspace/ui/AssetGroupSection.tsx
rm -f apps/frontend/src/features/workspace/ui/AssetGroupSection.css
```

---

### **TASK P2B.3A: Create AssetKnowledgePanel Main Component**

**Priority**: CRITICAL
**Dependencies**: P2B.1A, P2B.1B, P2B.2A complete
**Estimated Time**: 90 minutes

**Input Requirements**:
- All asset support components created (P2B.1A, P2B.1B, P2B.2A complete)
- Asset contracts and types available

**Atomic Operations**:
1. **Create AssetKnowledgePanel.tsx**:
   ```typescript
   // FILE: apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.tsx
   import { useState, useCallback, useMemo, useEffect } from 'react';
   import { Typography, Chip } from '@mui/material';
   import { Database } from 'lucide-react';
   import type { SupportedTool } from '../../tools/machines/tool-flow.machine';
   import { AssetGroupSection } from './AssetGroupSection';
   import { QualityScoreBadge } from './QualityScoreBadge';
   import { appCopy } from '../../../app/copy/system';
   import './AssetKnowledgePanel.css';
   import './AssetGroupSection.css';
   import './asset-components.css';
   
   // Type definitions (should match useWorkspaceContext)
   interface WorkspaceAsset {
     id: string;
     assetType: string;
     label: string;
     qualityScore: number;
     sourceToolKey?: SupportedTool;
     staleUpstream?: boolean;
   }
   
   interface AssetCompatibilityEntry {
     assetType: string;
     requiredness: 'always-required' | 'optional-by-tool-setting' | 'never-required';
   }
   
   interface ToolProjectAssetPolicyEntry {
     assetType: string;
     label: string;
     requiredness: 'always-required' | 'optional-by-tool-setting' | 'never-required';
   }
   
   interface AssetKnowledgePanelProps {
     workspaceAssets: WorkspaceAsset[];
     compatibilityMatrix: AssetCompatibilityEntry[];
     toolAssetInputs: ToolProjectAssetPolicyEntry[];
     onAssetSelect: (assetIds: string[]) => void;
     onCreateAssetAction: (assetType: string, sourceToolKey?: SupportedTool) => void;
   }
   
   // Utility function to group arrays by key
   const groupBy = <T extends Record<string, any>>(array: T[], key: keyof T): Record<string, T[]> => {
     return array.reduce((groups, item) => {
       const groupKey = String(item[key]);
       if (!groups[groupKey]) {
         groups[groupKey] = [];
       }
       groups[groupKey].push(item);
       return groups;
     }, {} as Record<string, T[]>);
   };
   
   // Mock TOOL_ASSET_CONTRACTS for producer tool lookup
   const MOCK_TOOL_ASSET_CONTRACTS: Record<string, { produces: string[] }> = {
     'angle-generator': { produces: ['angle'] },
     'meta-ads': { produces: ['ad-copy', 'hook'] },
     'blog-article-generator': { produces: ['article', 'article-outline'] },
     'youtube-description': { produces: ['description'] },
     'funnel-pages': { produces: ['landing-page'] },
     'nextland': { produces: ['creative-brief'] },
     'youtube-lf-script': { produces: ['script'] },
     'geometric': { produces: ['competitor-analysis'] },
   };
   
   export const AssetKnowledgePanel: React.FC<AssetKnowledgePanelProps> = ({
     workspaceAssets,
     compatibilityMatrix,
     toolAssetInputs,
     onAssetSelect,
     onCreateAssetAction
   }) => {
     const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
     const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
       () => new Set(toolAssetInputs.filter(input => 
         input.requiredness === 'always-required'
       ).map(input => input.assetType))
     );
   
     // Group assets by type for display
     const groupedAssets = useMemo(() => {
       return groupBy(workspaceAssets, 'assetType');
     }, [workspaceAssets]);
   
     // Calculate overall workspace quality
     const overallQualityScore = useMemo(() => {
       if (workspaceAssets.length === 0) return 0;
       const totalScore = workspaceAssets.reduce((sum, asset) => sum + asset.qualityScore, 0);
       return Math.round(totalScore / workspaceAssets.length);
     }, [workspaceAssets]);
   
     // Calculate readiness for current tool (simplified)
     const toolReadinessScore = useMemo(() => {
       let totalWeight = 0;
       let achievedWeight = 0;
       
       toolAssetInputs.forEach(input => {
         const weight = input.requiredness === 'always-required' ? 3 : 1;
         totalWeight += weight;
         
         const assets = groupedAssets[input.assetType] || [];
         if (assets.length > 0) {
           const avgQuality = assets.reduce((sum, a) => sum + a.qualityScore, 0) / assets.length;
           achievedWeight += (avgQuality / 100) * weight;
         }
       });
       
       return totalWeight > 0 ? Math.round((achievedWeight / totalWeight) * 100) : 0;
     }, [toolAssetInputs, groupedAssets]);
   
     const handleAssetToggle = useCallback((assetId: string, checked: boolean) => {
       setSelectedAssetIds(prev => {
         const newSelection = checked 
           ? [...prev, assetId]
           : prev.filter(id => id !== assetId);
         
         onAssetSelect(newSelection);
         return newSelection;
       });
     }, [onAssetSelect]);
   
     const handleGroupToggle = useCallback((assetType: string, expanded: boolean) => {
       setExpandedGroups(prev => {
         const newSet = new Set(prev);
         if (expanded) {
           newSet.add(assetType);
         } else {
           newSet.delete(assetType);
         }
         return newSet;
       });
     }, []);
   
     const getProducerTool = useCallback((assetType: string): SupportedTool | null => {
       for (const [toolKey, contract] of Object.entries(MOCK_TOOL_ASSET_CONTRACTS)) {
         if (contract.produces.includes(assetType)) {
           return toolKey as SupportedTool;
         }
       }
       return null;
     }, []);
   
     // Auto-expand required groups with missing assets
     useEffect(() => {
       const requiredMissingTypes = toolAssetInputs
         .filter(input => input.requiredness === 'always-required')
         .filter(input => (groupedAssets[input.assetType] || []).length === 0)
         .map(input => input.assetType);
       
       if (requiredMissingTypes.length > 0) {
         setExpandedGroups(prev => new Set([...prev, ...requiredMissingTypes]));
       }
     }, [toolAssetInputs, groupedAssets]);
   
     return (
       <div className="asset-knowledge-panel">
         <div className="asset-knowledge-panel__header">
           <div className="asset-knowledge-panel__title">
             <Database size={20} />
             <Typography variant="h6">
               {appCopy.workspace?.assetPanel?.title || 'Workspace Knowledge'}
             </Typography>
           </div>
           
           <div className="asset-knowledge-panel__metrics">
             <Chip 
               label={`${workspaceAssets.length} ${appCopy.workspace?.assetPanel?.metricsAssets || 'assets'}`}
               size="small"
               color={workspaceAssets.length > 0 ? "primary" : "default"}
             />
             <QualityScoreBadge 
               score={overallQualityScore}
               label={appCopy.workspace?.assetPanel?.metricsQuality || 'quality'}
             />
             <Chip
               label={`${toolReadinessScore}% ready`}
               size="small"
               color={toolReadinessScore >= 70 ? "success" : toolReadinessScore >= 40 ? "warning" : "error"}
             />
           </div>
         </div>
   
         <div className="asset-knowledge-panel__groups">
           {toolAssetInputs.map(input => {
             const assets = groupedAssets[input.assetType] || [];
             const compatibility = compatibilityMatrix.find(c => c.assetType === input.assetType);
             const isExpanded = expandedGroups.has(input.assetType);
             const producerTool = getProducerTool(input.assetType);
             
             return (
               <AssetGroupSection
                 key={input.assetType}
                 assetType={input.assetType}
                 label={input.label}
                 requiredness={input.requiredness}
                 assets={assets}
                 compatibility={compatibility}
                 isExpanded={isExpanded}
                 selectedAssetIds={selectedAssetIds}
                 producerTool={producerTool}
                 onToggleExpanded={(expanded) => handleGroupToggle(input.assetType, expanded)}
                 onAssetToggle={handleAssetToggle}
                 onCreateAction={() => onCreateAssetAction(input.assetType, producerTool)}
               />
             );
           })}
         </div>
         
         {selectedAssetIds.length > 0 && (
           <div className="asset-knowledge-panel__selection-summary">
             <Typography variant="body2" color="text.secondary">
               {selectedAssetIds.length} asset{selectedAssetIds.length === 1 ? '' : 's'} selected for generation
             </Typography>
           </div>
         )}
       </div>
     );
   };
   ```

2. **Add CSS for AssetKnowledgePanel**:
   ```css
   /* FILE: apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.css */
   .asset-knowledge-panel {
     border: 1px solid var(--mui-palette-divider);
     border-radius: 12px;
     background-color: var(--mui-palette-background-paper);
     margin-bottom: 24px;
   }
   
   .asset-knowledge-panel__header {
     display: flex;
     justify-content: space-between;
     align-items: center;
     padding: 16px 20px;
     border-bottom: 1px solid var(--mui-palette-divider);
   }
   
   .asset-knowledge-panel__title {
     display: flex;
     align-items: center;
     gap: 8px;
   }
   
   .asset-knowledge-panel__metrics {
     display: flex;
     align-items: center;
     gap: 8px;
     flex-wrap: wrap;
   }
   
   .asset-knowledge-panel__groups {
     padding: 16px 20px;
   }
   
   .asset-knowledge-panel__selection-summary {
     padding: 12px 20px;
     border-top: 1px solid var(--mui-palette-divider);
     background-color: var(--mui-palette-action-hover);
     text-align: center;
   }
   
   @media (max-width: 768px) {
     .asset-knowledge-panel__header {
       flex-direction: column;
       align-items: stretch;
       gap: 12px;
     }
     
     .asset-knowledge-panel__metrics {
       justify-content: center;
     }
   }
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. Component exists: test -f apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.tsx
2. CSS exists: test -f apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.css
3. Valid TypeScript: npx tsc --noEmit apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.tsx
4. Imports all dependencies: grep -q "AssetGroupSection.*QualityScoreBadge" apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.tsx
5. Has asset selection logic: grep -q "selectedAssetIds.*handleAssetToggle" apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.tsx
```

**Success Criteria**: All 5 validation checks pass
**Output**: Complete AssetKnowledgePanel component with all functionality

**Rollback Instructions**:
```bash
rm -f apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.tsx
rm -f apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.css
```

---

### **TASK P2B.4A: Update ToolPageTemplate Integration**

**Priority**: CRITICAL  
**Dependencies**: P2B.3A complete, P1 complete
**Estimated Time**: 60 minutes

**Input Requirements**:
- AssetKnowledgePanel component created (P2B.3A complete)
- ToolPageTemplate exists and is functional

**Atomic Operations**:
1. **Backup ToolPageTemplate.tsx**:
   ```bash
   cp apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx.backup
   ```

2. **Add Imports to ToolPageTemplate.tsx**:
   ```typescript
   // ADD these imports at the top of the file (after existing imports):
   import { AssetKnowledgePanel } from '../../workspace/ui/AssetKnowledgePanel';
   import { useWorkspace } from '../../workspace/runtime/WorkspaceProvider';
   import type { SupportedTool } from '../machines/tool-flow.machine';
   ```

3. **Add State and Logic to Component**:
   ```typescript
   // ADD these hooks and state inside ToolPageTemplate component (after existing useState calls):
   
   // Workspace context
   const { workspace } = useWorkspace();
   
   // Asset selection state
   const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
   
   // Get tool asset inputs from registry (stub implementation)
   const assetInputs = useMemo(() => {
     // TODO: Get from toolFormRegistry[toolKey].assetInputs in final implementation
     // For now, return sample inputs for testing
     return [
       { assetType: 'angle', label: 'Angle', requiredness: 'optional-by-tool-setting' as const },
       { assetType: 'persona', label: 'Persona', requiredness: 'optional-by-tool-setting' as const },
     ];
   }, [toolKey]);
   
   // Asset selection handlers
   const handleCreateAssetAction = useCallback((assetType: string, sourceToolKey?: SupportedTool) => {
     if (sourceToolKey && workspace.id) {
       navigate(`/workspaces/${workspace.id}/tools/${sourceToolKey}?intent=create-asset&assetType=${assetType}`);
     }
   }, [navigate, workspace.id]);
   ```

4. **Find and Update JSX Section**:
   ```bash
   # Look for the form section in ToolPageTemplate (usually around line 600-700)
   grep -n "ui-tool-form-section" apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx
   ```

5. **Insert AssetKnowledgePanel JSX**:
   ```typescript
   // INSERT this JSX after the existing briefing upload section, before the primary CTA:
   
   {/* Asset Knowledge Panel - replaces basic asset selection */}
   {assetInputs.length > 0 && (
     <div className="ui-tool-form-section">
       <AssetKnowledgePanel
         workspaceAssets={workspace.assets}
         compatibilityMatrix={workspace.compatibilityMatrix}
         toolAssetInputs={assetInputs}
         onAssetSelect={setSelectedAssetIds}
         onCreateAssetAction={handleCreateAssetAction}
       />
     </div>
   )}
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. File compiles: npm --workspace apps/frontend run typecheck
2. Imports added: grep -q "AssetKnowledgePanel.*useWorkspace" apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx
3. State added: grep -q "selectedAssetIds.*useState" apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx
4. Component rendered: grep -q "<AssetKnowledgePanel" apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx
5. Handlers added: grep -q "handleCreateAssetAction" apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx
```

**Success Criteria**: All 5 validation checks pass + TypeScript compilation succeeds
**Output**: ToolPageTemplate integrated with AssetKnowledgePanel

**Rollback Instructions**:
```bash
# Restore backup if integration fails:
cp apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx.backup apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx
rm -f apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx.backup
```

---

### **TASK P2B.5A: Phase 2B Integration Test**

**Priority**: HIGH
**Dependencies**: All P2B tasks complete
**Estimated Time**: 30 minutes

**Input Requirements**:
- All Phase 2B tasks completed successfully
- AssetKnowledgePanel integrated in ToolPageTemplate

**Atomic Operations**:
1. **Full TypeScript Compilation**:
   ```bash
   npm --workspace apps/frontend run typecheck
   ```

2. **Build Test**:
   ```bash
   npm --workspace apps/frontend run build
   ```

3. **Verify Component Chain**:
   ```bash
   # Check AssetKnowledgePanel exists
   test -f apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.tsx
   # Check AssetGroupSection exists  
   test -f apps/frontend/src/features/workspace/ui/AssetGroupSection.tsx
   # Check support components exist
   ls apps/frontend/src/features/workspace/ui/QualityScoreBadge.tsx
   ls apps/frontend/src/features/workspace/ui/AssetSelectionList.tsx
   ```

4. **Verify ToolPageTemplate Integration**:
   ```bash
   # Check imports added
   grep -q "AssetKnowledgePanel" apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx
   # Check component rendered
   grep -q "<AssetKnowledgePanel" apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx
   ```

5. **CSS Files Verification**:
   ```bash
   # Check all CSS files exist
   test -f apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.css
   test -f apps/frontend/src/features/workspace/ui/AssetGroupSection.css
   test -f apps/frontend/src/features/workspace/ui/asset-components.css
   ```

**Validation Criteria**:
```bash
# Must pass ALL checks:
1. TypeScript compilation: npm --workspace apps/frontend run typecheck (exit code 0)
2. Build succeeds: npm --workspace apps/frontend run build (exit code 0) 
3. All components exist: find apps/frontend/src/features/workspace/ui -name "*Asset*.tsx" | wc -l >= 4
4. Integration complete: grep -c "AssetKnowledgePanel" apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx >= 2
5. No import errors: npm --workspace apps/frontend run typecheck 2>&1 | grep -c "Cannot find module" = 0
```

**Success Criteria**: All 5 validation checks pass
**Output**: Phase 2B asset knowledge panel infrastructure complete

**Rollback Instructions**:
```bash
# Full Phase 2B rollback:
git checkout HEAD -- apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx
rm -f apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.tsx
rm -f apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.css
rm -f apps/frontend/src/features/workspace/ui/AssetGroupSection.tsx
rm -f apps/frontend/src/features/workspace/ui/AssetGroupSection.css
rm -f apps/frontend/src/features/workspace/ui/QualityScoreBadge.tsx
rm -f apps/frontend/src/features/workspace/ui/AssetTypeIcon.tsx
rm -f apps/frontend/src/features/workspace/ui/CreateAssetPrompt.tsx
rm -f apps/frontend/src/features/workspace/ui/AssetSelectionList.tsx
rm -f apps/frontend/src/features/workspace/ui/asset-components.css
npm --workspace apps/frontend run typecheck
```

---

## 📋 **EXECUTION SUMMARY**

### **Phase Dependencies**
- **Phase 1**: No dependencies (start immediately) ✅ COMPLETED
- **Phase 2A**: Requires Phase 1 complete (P1.3A, P1.3B, P1.3C) ✅ COMPLETED
- **Phase 2B**: Requires Phase 1 complete (can parallel with 2A) ✅ COMPLETED
- **Phase 3**: Requires Phase 1 + Phase 2A complete ✅ COMPLETED
- **Phase 4**: Requires Phase 1 + Phase 2A + Phase 2B complete ✅ COMPLETED
- **Phase 5**: Requires all previous phases complete ✅ COMPLETED
- **Phase 6**: Requires Phase 5 complete — Artifact promotion + manual assets
- **Phase 7**: Requires Phase 6 complete — Feedback/voting system
- **Phase 8**: Bug fixes discovered during integration ✅ COMPLETED

### **Critical Path**
**Phase 1 → Phase 2A → Phase 3 → Phase 5 → Phase 6 → Phase 7**

**Parallel Work**: Phase 2B with 2A, Phase 8 with 5, Phase 6.2 with 6.1

### **Validation Strategy**  
- **Each Task**: Must pass all validation criteria before proceeding
- **Each Phase**: Integration test required before next phase
- **Rollback**: Each task has explicit rollback instructions
- **Compilation**: TypeScript must compile at each major milestone

### **Total Tasks Defined**: 19 atomic tasks across Phases 1, 2A, 2B
### **Completed**: Phases 1, 2A, 2B, 3, 4, 5, 8 (48 tasks) ✅ — 2026-07-17
**Remaining Phases**: 6, 7 (8 tasks) — defined in `workspace-centric-ux-transformation-implementation-plan.md`

---

**EXECUTION READY**: This plan provides deterministic, atomic tasks with full validation and rollback procedures for AI execution of the workspace-centric UX transformation.