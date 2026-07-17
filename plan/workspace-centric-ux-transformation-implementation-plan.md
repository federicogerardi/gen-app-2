# Workspace-Centric UX Transformation Implementation Plan

---
status: active
version: 2.0.1
last-reviewed: 2026-07-17
next-review-date: 2026-07-24
owner: frontend-team
type: ux-transformation-plan
goal: Transform app UX from tool-centric to workspace-centric paradigm following Asset Domain Model integration
---

## 🎯 **Executive Summary**

**Objective**: Transform application UX from tool-centric silos to workspace-centric knowledge building paradigm
**Duration**: 28-35 development days (5-7 weeks)
**Complexity**: High - Complete UX architecture restructuring
**Impact**: 45+ files, 6 new components, routing restructure, navigation paradigm shift

### **Current State vs Target State**

| Aspect | Current (Tool-Centric) | Target (Workspace-Centric) |
|--------|------------------------|---------------------------|
| **Entry Point** | `/tools` → tool selection | `/workspaces` → workspace dashboard |
| **Navigation** | Tool-first: `/tools/meta-ads` | Workspace-first: `/workspaces/:id/tools/meta-ads` |
| **User Flow** | Select tool → isolated input → single output | Enter workspace → cumulative knowledge building |
| **Asset Model** | File attachments per session | Persistent workspace knowledge base |
| **Tool Relationship** | Independent silos | Collaborative workflow ecosystem |

### **Key Deliverables**

1. **Routing Architecture**: Workspace-first navigation structure
2. **WorkspaceContextHeader**: Breadcrumb navigation + knowledge status
3. **AssetKnowledgePanel**: Replace file uploads with workspace asset management
4. **WorkspaceDashboard**: Replace tool launcher with workspace command center
5. **CrossToolWorkflow**: Workflow position + suggested next actions
6. **ContextualRecommendations**: Smart tool suggestions based on workspace state

---

## 📋 **Implementation Phases**

### **PHASE 1: Foundation Infrastructure (8-10 days)** ✅ COMPLETED 2026-07-17
*Critical path - all subsequent phases depend on this*

### **PHASE 2A: Workspace Context (4-5 days) [PARALLEL]** ✅ COMPLETED 2026-07-17
*Can start after P1.3 completion*

### **PHASE 2B: Asset Knowledge (4-5 days) [PARALLEL]** ✅ COMPLETED 2026-07-17
*Can start after P1.3 completion*

### **PHASE 3: Dashboard & Navigation (6-8 days)** ✅ COMPLETED 2026-07-17
*Requires P1 + P2A completion*

### **PHASE 4: Cross-Tool Integration (4-6 days)** ✅ COMPLETED 2026-07-17
*Requires P1 + P2A + P2B completion*

### **PHASE 5: Integration & Polish (2-3 days)** ✅ COMPLETED 2026-07-17
*Final integration, testing, performance optimization*

---

## 🔧 **PHASE 1: Foundation Infrastructure** ✅ COMPLETED 2026-07-17

### **P1.1 - Routing Architecture** ⏱️ 3-4 days | **Priority: CRITICAL**

#### **P1.1.1 - Update app-router.tsx**
**File**: `apps/frontend/src/app/routing/app-router.tsx`
**Complexity**: HIGH

**Deterministic Changes**:

1. **Add workspace routes structure**:
```tsx
// Insert after existing routes, before tool routes
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
}
```

2. **Add legacy redirects**:
```tsx
// Add redirect for existing /tools routes
{ 
  path: '/tools', 
  element: <Navigate to="/workspaces" replace /> 
},
{
  path: '/tools/:toolKey',
  element: <LegacyToolRedirect />
}
```

**QA Scenario**: 
- **Tool**: Browser navigation
- **Steps**: (1) Navigate to `/workspaces/123/tools/meta-ads` (2) Verify page loads with workspace context (3) Navigate to legacy `/tools/meta-ads` (4) Verify redirect to workspace selection
- **Expected**: All routes resolve correctly, no 404s, workspace context available

**Testing Checklist**:
- [ ] All workspace routes resolve correctly
- [ ] Legacy tool routes redirect properly
- [ ] No broken navigation links
- [ ] Route parameters passed correctly

#### **P1.1.2 - Update tool-form-architecture.ts**
**File**: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`  
**Complexity**: HIGH

**Deterministic Changes**:

1. **Update getToolRoute function**:
```tsx
export const getToolRoute = (toolKey: SupportedTool, workspaceId?: string): string => {
  if (workspaceId) {
    return `/workspaces/${workspaceId}/tools/${toolKey}`;
  }
  // Legacy fallback
  return `/tools/${toolKey}`;
};
```

2. **Update getEnabledToolNavigationItems**:
```tsx
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

**QA Scenario**:
- **Tool**: Function testing
- **Steps**: (1) Call `getToolRoute('meta-ads', 'workspace-123')` (2) Call `getEnabledToolNavigationItems('member', 'workspace-123')` (3) Verify correct paths and readiness scores
- **Expected**: Functions return workspace-aware routes and contextual data

#### **P1.1.3 - Create LegacyToolRedirect component**
**File**: `apps/frontend/src/features/workspace/ui/LegacyToolRedirect.tsx` (NEW)
**Complexity**: MEDIUM

**Implementation**:
```tsx
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

**QA Scenario**:
- **Tool**: Legacy URL testing
- **Steps**: (1) Navigate to `/tools/meta-ads` with active workspace (2) Navigate to `/tools/meta-ads` without workspace (3) Navigate to `/tools` root
- **Expected**: Proper redirects to workspace routes, loading message displayed

### **P1.2 - Copy & Constants Update** ⏱️ 1-2 days | **Priority: HIGH**

#### **P1.2.1 - Update system.ts navigation copy**
**File**: `apps/frontend/src/app/copy/system.ts`
**Complexity**: MEDIUM

**Deterministic Changes**:
```tsx
// Update navigation section (around line 49-64)
navigation: {
  dashboard: 'Dashboard',
  workspaces: 'Workspaces', // Changed from 'tools: Tools'
  projects: 'Projects',
  // Keep existing tool names for internal reference
  funnelPages: 'Hotlead Funnel',
  nextland: 'Nextland',
  // ... rest unchanged
},

// Update actions section (around line 65-100)  
actions: {
  // ... existing actions
  openWorkspace: 'Apri workspace',
  enterWorkspaceTool: 'Usa nel workspace',
  createWorkspace: 'Crea workspace',
  switchWorkspace: 'Cambia workspace',
  // Update existing
  openToolWorkspace: 'Apri nel workspace', // Modified
},

// Add new workspace-specific copy
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

**QA Scenario**:
- **Tool**: UI text verification
- **Steps**: (1) Navigate through all workspace UI (2) Check navigation labels (3) Verify action button text (4) Check asset panel labels
- **Expected**: All text displays correctly, no missing translations, consistent terminology

### **P1.3 - Workspace Infrastructure** ⏱️ 3-4 days | **Priority: CRITICAL**

#### **P1.3.1 - Create useWorkspaceContext hook**
**File**: `apps/frontend/src/features/workspace/runtime/useWorkspaceContext.ts` (NEW)
**Complexity**: HIGH

**Implementation**:
```tsx
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

interface WorkflowPosition {
  currentStep: string;
  totalSteps: number;
  completedSteps: string[];
  suggestedNext?: SupportedTool[];
  estimatedCompletion?: number; // percentage
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

  // Calculate workflow position
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
    
    // Calculate suggested next tools based on gaps
    const gaps = assetsQuery.data?.gaps || [];
    const suggestedNext = gaps
      .map(gap => getAssetProducerTool(gap.assetType))
      .filter((tool): tool is SupportedTool => tool !== null)
      .slice(0, 3);
    
    return {
      currentStep: `${completedTools.size} tools completed`,
      totalSteps: Object.keys(TOOL_ASSET_CONTRACTS).length,
      completedSteps: Array.from(completedTools),
      suggestedNext,
      estimatedCompletion: Math.round((completedTools.size / Object.keys(TOOL_ASSET_CONTRACTS).length) * 100)
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

**QA Scenario**:
- **Tool**: Hook testing
- **Steps**: (1) Call hook with valid workspace ID (2) Call hook with invalid ID (3) Call hook with no ID (4) Verify loading states (5) Test refetch functionality
- **Expected**: Hook returns correct data structure, handles loading/error states, refetch works

#### **P1.3.2 - Create WorkspaceToolWrapper**  
**File**: `apps/frontend/src/features/workspace/ui/WorkspaceToolWrapper.tsx` (NEW)
**Complexity**: MEDIUM

**Implementation**:
```tsx
interface WorkspaceToolWrapperProps {
  toolKey: SupportedTool;
  children: React.ReactNode;
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
};
```

**QA Scenario**:
- **Tool**: Component integration test
- **Steps**: (1) Render with valid workspace (2) Render with invalid workspace (3) Render during loading (4) Render with error state
- **Expected**: Correct UI for each state, navigation works, context provided

#### **P1.3.3 - Create WorkspaceProvider**
**File**: `apps/frontend/src/features/workspace/runtime/WorkspaceProvider.tsx` (NEW)  
**Complexity**: LOW

**Implementation**:
```tsx
interface WorkspaceContextValue {
  workspace: WorkspaceContextData;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const WorkspaceProvider: React.FC<{
  value: WorkspaceContextData;
  children: React.ReactNode;
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

**QA Scenario**:
- **Tool**: Context provider test
- **Steps**: (1) Use useWorkspace inside provider (2) Use useWorkspace outside provider (3) Verify context updates
- **Expected**: Hook works inside provider, throws outside provider, updates propagate

### **P1 Phase Acceptance Criteria**

- [ ] **Routing**: All `/workspaces/:id/tools/:tool` routes resolve correctly
- [ ] **Legacy Support**: All `/tools/*` routes redirect to workspace selection
- [ ] **Context**: WorkspaceContextData available throughout workspace tools  
- [ ] **Performance**: No performance degradation from new context
- [ ] **Testing**: All existing tests still pass
- [ ] **Copy**: Updated terminology consistent throughout UI

---

## 🎨 **PHASE 2A: Workspace Context [PARALLEL]** ✅ COMPLETED 2026-07-17

*Can start after P1.3 completion*

### **P2A.1 - WorkspaceContextHeader** ⏱️ 2-3 days | **Priority: HIGH**

#### **P2A.1.1 - Implement WorkspaceContextHeader component**
**File**: `apps/frontend/src/features/workspace/ui/WorkspaceContextHeader.tsx` (NEW)
**Complexity**: MEDIUM

**Implementation**:
```tsx
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
            {appCopy.workspace.contextHeader.breadcrumbWorkspaces}
          </Link>
          <Link 
            to={`/workspaces/${workspaceId}`} 
            className="workspace-context-header__breadcrumb-link"
          >
            <FolderOpen size={16} />
            {workspaceName}
          </Link>
          <Typography variant="body2" color="text.primary">
            {toolFormRegistry[currentTool].displayName}
          </Typography>
        </Breadcrumbs>
      </div>
      
      <div className="workspace-context-header__status">
        <Chip 
          icon={<Database size={14} />}
          label={`${assetCount} ${appCopy.workspace.contextHeader.assetCountLabel}`}
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
              {crossToolPosition.currentStep} ({crossToolPosition.estimatedCompletion}%)
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
                  {appCopy.workspace.contextHeader.suggestedNextLabel}
                </Typography>
                {crossToolPosition.suggestedNext.slice(0, 2).map(toolKey => (
                  <Chip 
                    key={toolKey}
                    label={toolFormRegistry[toolKey].displayName}
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

**QA Scenario**:
- **Tool**: Visual component testing  
- **Steps**: (1) Render with healthy workspace (2) Render with blocked workspace (3) Test breadcrumb navigation (4) Test suggested tool navigation (5) Test responsive behavior
- **Expected**: Correct status indicators, navigation works, responsive design functions

#### **P2A.1.2 - Add WorkspaceContextHeader styles**
**File**: `apps/frontend/src/features/workspace/ui/WorkspaceContextHeader.css` (NEW)
**Complexity**: LOW

**Implementation**:
```css
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
  min-width: 0; /* Allow text truncation */
}

.workspace-context-header__breadcrumbs {
  max-width: 100%;
}

.workspace-context-header__breadcrumb-link {
  display: flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: var(--mui-palette-text-secondary);
  transition: color 0.2s ease;
  min-width: 0;
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
  background-color: var(--mui-palette-action-disabled);
}

.workspace-context-header__next-tools {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.workspace-context-header__workflow-text {
  font-weight: 500;
  white-space: nowrap;
  font-size: 0.75rem;
}

.workspace-context-header__next-tool-chip {
  font-size: 0.6875rem !important;
}

/* Dark theme support */
[data-theme="dark"] .workspace-context-header {
  border-bottom-color: rgba(255, 255, 255, 0.12);
  background-color: var(--mui-palette-background-paper);
}

/* Responsive design */
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
  
  .workspace-context-header__workflow {
    align-items: stretch;
    min-width: auto;
  }
  
  .workspace-context-header__next-tools {
    justify-content: flex-start;
  }
}

@media (max-width: 480px) {
  .workspace-context-header {
    padding: 8px;
  }
  
  .workspace-context-header__breadcrumb-link span:last-child {
    /* Hide tool name on mobile if space is limited */
    display: none;
  }
  
  .workspace-context-header__status {
    flex-direction: column;
    gap: 6px;
  }
}
```

**QA Scenario**:
- **Tool**: CSS/responsive testing
- **Steps**: (1) Test desktop layout (2) Test tablet layout (3) Test mobile layout (4) Test dark theme (5) Test text overflow handling
- **Expected**: Clean responsive design, proper theme support, no visual breaks

### **P2A Acceptance Criteria**

- [ ] **Header Display**: WorkspaceContextHeader shows correct breadcrumb and status
- [ ] **Status Indicators**: Quality gates display accurate status with correct colors
- [ ] **Navigation**: Breadcrumb navigation works correctly
- [ ] **Workflow Progress**: Progress bar and suggested tools display when available
- [ ] **Responsive**: Header adapts properly to different screen sizes
- [ ] **Theme Support**: Component works in light and dark themes

---

## 🗃️ **PHASE 2B: Asset Knowledge Panel [PARALLEL]** ✅ COMPLETED 2026-07-17

*Can start after P1.3 completion*

### **P2B.1 - AssetKnowledgePanel Core** ⏱️ 3-4 days | **Priority: HIGH**

#### **P2B.1.1 - Implement AssetKnowledgePanel component**
**File**: `apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.tsx` (NEW)
**Complexity**: HIGH

**Implementation**:
```tsx
interface AssetKnowledgePanelProps {
  workspaceAssets: WorkspaceAsset[];
  compatibilityMatrix: AssetCompatibilityEntry[];
  toolAssetInputs: ToolProjectAssetPolicyEntry[];
  onAssetSelect: (assetIds: string[]) => void;
  onCreateAssetAction: (assetType: AssetType, sourceToolKey?: SupportedTool) => void;
}

export const AssetKnowledgePanel: React.FC<AssetKnowledgePanelProps> = ({
  workspaceAssets,
  compatibilityMatrix,
  toolAssetInputs,
  onAssetSelect,
  onCreateAssetAction
}) => {
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<AssetType>>(
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

  // Calculate readiness for current tool
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

  const handleGroupToggle = useCallback((assetType: AssetType, expanded: boolean) => {
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

  const getProducerTool = useCallback((assetType: AssetType): SupportedTool | null => {
    for (const [toolKey, contract] of Object.entries(TOOL_ASSET_CONTRACTS)) {
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
            {appCopy.workspace.assetPanel.title}
          </Typography>
        </div>
        
        <div className="asset-knowledge-panel__metrics">
          <Chip 
            label={`${workspaceAssets.length} ${appCopy.workspace.assetPanel.metricsAssets}`}
            size="small"
            color={workspaceAssets.length > 0 ? "primary" : "default"}
          />
          <QualityScoreBadge 
            score={overallQualityScore}
            label={appCopy.workspace.assetPanel.metricsQuality}
          />
          <ToolReadinessBadge 
            score={toolReadinessScore}
            size="small"
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
            {selectedAssetIds.length} asset {selectedAssetIds.length === 1 ? 'selected' : 'selected'} for generation
          </Typography>
        </div>
      )}
    </div>
  );
};
```

**QA Scenario**:
- **Tool**: Component integration test
- **Steps**: (1) Render with various asset configurations (2) Test asset selection (3) Test group expand/collapse (4) Test create asset actions (5) Verify readiness calculations
- **Expected**: Correct asset grouping, selection works, quality scores accurate, create actions trigger

#### **P2B.1.2 - Implement AssetGroupSection component**  
**File**: `apps/frontend/src/features/workspace/ui/AssetGroupSection.tsx` (NEW)
**Complexity**: HIGH

**Implementation**:
```tsx
interface AssetGroupSectionProps {
  assetType: AssetType;
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
  compatibility,
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

  const AssetIcon = ASSET_TYPE_ICONS[assetType] || Folder;
  
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
          
          <AssetIcon size={18} className="asset-group-section__type-icon" />
          
          <Typography variant="subtitle2" className="asset-group-section__title">
            {label} ({assets.length})
          </Typography>
          
          {isRequired && (
            <Chip 
              label={appCopy.workspace.assetPanel.groupRequiredLabel}
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
                  label={`${selectedAssetsInGroup} ${appCopy.workspace.assetPanel.selectedCount}`}
                  size="small"
                  color="primary"
                />
              )}
            </>
          ) : (
            <Chip 
              label={isRequired ? appCopy.workspace.assetPanel.groupMissingRequired : appCopy.workspace.assetPanel.groupMissingOptional}
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
                {appCopy.workspace.assetPanel.generateMoreAction} {label}
              </Button>
            </div>
          )}
        </div>
      </Collapse>
    </div>
  );
};
```

**QA Scenario**:
- **Tool**: Asset group interaction test
- **Steps**: (1) Test expand/collapse (2) Test select all/none (3) Test individual asset selection (4) Test create actions (5) Verify keyboard navigation
- **Expected**: All interactions work smoothly, accessibility maintained, proper visual feedback

### **P2B.2 - Asset Selection Components** ⏱️ 1-2 days | **Priority: MEDIUM**

#### **P2B.2.1 - Implement supporting components**

Create these supporting components:
- `QualityScoreBadge.tsx` - Quality score display
- `ToolReadinessBadge.tsx` - Tool readiness indicator  
- `AssetSelectionList.tsx` - Asset list with checkboxes
- `CreateAssetPrompt.tsx` - Prompt for creating missing assets

#### **P2B.2.2 - Add comprehensive styling**
**File**: `apps/frontend/src/features/workspace/ui/AssetKnowledgePanel.css` (NEW)

### **P2B.3 - ToolPageTemplate Integration** ⏱️ 1 day | **Priority: HIGH**

#### **P2B.3.1 - Update ToolPageTemplate**
**File**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`
**Complexity**: MEDIUM

**Deterministic Changes**:

1. **Add imports**:
```tsx
import { AssetKnowledgePanel } from '../../workspace/ui/AssetKnowledgePanel';
import { useWorkspace } from '../../workspace/runtime/WorkspaceProvider';
```

2. **Add workspace context**:
```tsx
export const ToolPageTemplate: React.FC<ToolPageTemplateProps> = ({ toolKey, ... }) => {
  // ... existing state
  const { workspace } = useWorkspace();
  
  // Add asset selection state
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  
  // Get tool asset inputs from registry
  const assetInputs = useMemo(() => {
    return toolFormRegistry[toolKey].assetInputs || [];
  }, [toolKey]);
```

3. **Replace existing Project Assets section** (around line 600-700):
```tsx
{/* Replace existing project assets section with AssetKnowledgePanel */}
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

4. **Add asset selection handlers**:
```tsx
const handleCreateAssetAction = useCallback((assetType: AssetType, sourceToolKey?: SupportedTool) => {
  if (sourceToolKey && workspace.id) {
    navigate(`/workspaces/${workspace.id}/tools/${sourceToolKey}?intent=create-asset&assetType=${assetType}`);
  }
}, [navigate, workspace.id]);
```

5. **Update buildBaseGenerationRequest call**:
```tsx
const baseRequest = buildBaseGenerationRequest({
  // ... existing params
  selectedAssetIds,
  selectedAssetGroups: [], // Future enhancement
});
```

**QA Scenario**:
- **Tool**: Tool page integration test
- **Steps**: (1) Open tool page in workspace context (2) Verify asset panel renders (3) Test asset selection (4) Submit form and verify assets included (5) Test create asset navigation
- **Expected**: Asset panel integrated seamlessly, selection persists, generation includes assets

### **P2B Acceptance Criteria**

- [ ] **Panel Integration**: AssetKnowledgePanel renders correctly in ToolPageTemplate
- [ ] **Asset Selection**: Users can select assets for generation
- [ ] **Quality Display**: Quality scores and readiness indicators accurate
- [ ] **Create Actions**: Create asset buttons navigate to appropriate tools
- [ ] **Responsive Design**: Panel works on all screen sizes  
- [ ] **Generation Integration**: Selected assets included in generation requests

---

## 🏠 **PHASE 3: Dashboard & Navigation** ✅ COMPLETED 2026-07-17

*Requires P1 + P2A completion*

### **P3.1 - WorkspaceDashboard** ⏱️ 3-4 days | **Priority: HIGH**

#### **P3.1.1 - Create dashboard panel components**
**Directory**: `apps/frontend/src/features/workspace/ui/dashboard/` (NEW)

Create 5 panel components + 1 CSS file:

| Component | Purpose | Data Source |
|---|---|---|
| `WorkspaceKnowledgeOverview.tsx` | Quality score, asset count, gate status | `useWorkspaceContext` |
| `SuggestedActionsPanel.tsx` | Gap-based tool suggestions | `useWorkspaceContext.gaps` + `useWorkspaceContext.workflowPosition.suggestedNext` |
| `ContextualToolsPanel.tsx` | Grid of tools with readiness scores | `getEnabledToolNavigationItems(role, workspaceId)` + `useWorkspaceContext.gaps` |
| `AssetLibraryQuickAccess.tsx` | Top 6 recent assets with type icons | `useWorkspaceContext.assets.slice(0, 6)` |
| `RecentActivityPanel.tsx` | Last 5 sessions in this workspace | `useSessionsQuery({ projectId: workspaceId })` |

**P3.1.1.1 - WorkspaceKnowledgeOverview.tsx**
```tsx
// Shows: quality score (large number), asset count, gate status badge, workflow progress bar
// Data: useWorkspaceContext()
// Layout: horizontal card with 3 sections: [Score] [Stats] [Progress]
// Score: large qualityScore number + label "Quality Score"
// Stats: "X assets" + gate status chip (healthy/needs-attention/blocked)
// Progress: LinearProgress with estimatedCompletion + "X/Y tools completed"
interface WorkspaceKnowledgeOverviewProps {
  workspaceId: string;
}
```

**P3.1.1.2 - SuggestedActionsPanel.tsx**
```tsx
// Shows: list of suggested next tools based on gaps
// Data: useWorkspaceContext().gaps + workflowPosition.suggestedNext
// Layout: vertical list of action cards
// Each card: [Tool icon] [Tool name] [Gap description] [CTA button "Go to tool"]
// Empty state: "No suggestions — workspace is fully loaded"
interface SuggestedActionsPanelProps {
  workspaceId: string;
}
```

**P3.1.1.3 - ContextualToolsPanel.tsx**
```tsx
// Shows: grid of available tools with readiness indicator per tool
// Data: getEnabledToolNavigationItems('member', workspaceId) + useWorkspaceContext()
// Layout: 2-column grid of tool cards
// Each card: [Tool icon] [Display name] [Description] [Readiness badge] [Link to tool]
// Readiness: derived from gaps — tool is "ready" if its required assets exist
interface ContextualToolsPanelProps {
  workspaceId: string;
}
```

**P3.1.1.4 - AssetLibraryQuickAccess.tsx**
```tsx
// Shows: top 6 assets as mini-cards
// Data: useWorkspaceContext().assets.slice(0, 6)
// Layout: horizontal scroll or 3x2 grid
// Each card: [AssetTypeIcon] [Label] [QualityScoreBadge]
// Footer: "View all assets →" link to /workspaces/:id/assets
interface AssetLibraryQuickAccessProps {
  workspaceId: string;
}
```

**P3.1.1.5 - RecentActivityPanel.tsx**
```tsx
// Shows: last 5 sessions as list items
// Data: useSessionsQuery({ projectId: workspaceId, apiBaseUrl, capabilities })
// Layout: vertical list
// Each item: [Tool icon] [Tool name] [Status chip] [Artifact count] [Relative time]
// Empty state: "No sessions yet — start by selecting a tool"
interface RecentActivityPanelProps {
  workspaceId: string;
}
```

**P3.1.1.6 - dashboard-panels.css**
```css
/* Shared styles for all dashboard panels */
.dashboard-panel { border: 1px solid var(--mui-palette-divider); border-radius: 12px; background: var(--mui-palette-background-paper); }
.dashboard-panel__header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--mui-palette-divider); }
.dashboard-panel__content { padding: 16px 20px; }
.dashboard-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
@media (max-width: 768px) { .dashboard-grid { grid-template-columns: 1fr; } }
```

**Validation**:
```bash
test -f apps/frontend/src/features/workspace/ui/dashboard/WorkspaceKnowledgeOverview.tsx
test -f apps/frontend/src/features/workspace/ui/dashboard/SuggestedActionsPanel.tsx
test -f apps/frontend/src/features/workspace/ui/dashboard/ContextualToolsPanel.tsx
test -f apps/frontend/src/features/workspace/ui/dashboard/AssetLibraryQuickAccess.tsx
test -f apps/frontend/src/features/workspace/ui/dashboard/RecentActivityPanel.tsx
test -f apps/frontend/src/features/workspace/ui/dashboard/dashboard-panels.css
npm --workspace apps/frontend run typecheck
```

---

#### **P3.1.2 - Implement WorkspaceDashboard page**
**File**: `apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx` (REPLACE placeholder)
**Complexity**: HIGH

**Wireframe**:
```
┌─────────────────────────────────────────────────────────┐
│ WorkspaceContextHeader (already exists from P2A)        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ WorkspaceKnowledgeOverview (full width) ──────────┐ │
│  │  Quality Score: 85  │  12 assets  │  3/8 tools    │ │
│  │  ████████████░░░░░░░░░░░░░░░░░░░░  37%            │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ SuggestedActionsPanel ──┐ ┌─ ContextualToolsPanel ┐ │
│  │  ▸ Generate Angle        │ │  ┌─────────┐ ┌──────┐ │ │
│  │  ▸ Create Persona        │ │  │Funnel   │ │Nextl.│ │ │
│  │  ▸ Upload Briefing       │ │  │ 92% ✓  │ │ 78%  │ │ │
│  │                          │ │  └─────────┘ └──────┘ │ │
│  └──────────────────────────┘ │  ┌─────────┐ ┌──────┐ │ │
│                                │  │YT Script│ │Meta  │ │ │
│                                │  │  45% ⚠ │ │  N/A │ │ │
│                                │  └─────────┘ └──────┘ │ │
│                                └──────────────────────┘ │
│                                                         │
│  ┌─ AssetLibraryQuickAccess ─┐ ┌─ RecentActivityPanel ┐ │
│  │  [Angle] [Persona] [Hook] │ │  ▸ Meta Ads — done   │ │
│  │  [Brief] [Ad Copy] [Desc] │ │  ▸ YT Script — running│ │
│  │  View all assets →        │ │  ▸ Funnel — done      │ │
│  └──────────────────────────┘ └──────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Implementation**:
```tsx
// FILE: apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx
import { useParams, Link } from 'react-router-dom';
import { Surface, uiPrimitives } from '../../../app/ui/primitives';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { WorkspaceKnowledgeOverview } from '../ui/dashboard/WorkspaceKnowledgeOverview';
import { SuggestedActionsPanel } from '../ui/dashboard/SuggestedActionsPanel';
import { ContextualToolsPanel } from '../ui/dashboard/ContextualToolsPanel';
import { AssetLibraryQuickAccess } from '../ui/dashboard/AssetLibraryQuickAccess';
import { RecentActivityPanel } from '../ui/dashboard/RecentActivityPanel';
import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import '../ui/dashboard/dashboard-panels.css';

export const WorkspaceDashboard: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const ctx = useWorkspaceContext(workspaceId);

  if (ctx.loading) return <LoadingStateMessage>Loading workspace...</LoadingStateMessage>;
  if (ctx.error) return <ErrorStateMessage>{ctx.error}</ErrorStateMessage>;
  if (!workspaceId) return null;

  return (
    <section className="workspace-dashboard">
      <WorkspaceKnowledgeOverview workspaceId={workspaceId} />
      <div className="dashboard-grid">
        <SuggestedActionsPanel workspaceId={workspaceId} />
        <ContextualToolsPanel workspaceId={workspaceId} />
      </div>
      <div className="dashboard-grid">
        <AssetLibraryQuickAccess workspaceId={workspaceId} />
        <RecentActivityPanel workspaceId={workspaceId} />
      </div>
    </section>
  );
};
```

**Validation**:
```bash
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run build
grep -q "WorkspaceKnowledgeOverview" apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx
grep -q "SuggestedActionsPanel" apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx
grep -q "ContextualToolsPanel" apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx
grep -q "AssetLibraryQuickAccess" apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx
grep -q "RecentActivityPanel" apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx
```

---

### **P3.2 - WorkspacesListPage** ⏱️ 1-2 days | **Priority: HIGH**

#### **P3.2.1 - Implement WorkspacesListPage**
**File**: `apps/frontend/src/features/workspace/pages/WorkspacesListPage.tsx` (REPLACE placeholder)
**Complexity**: MEDIUM

**Wireframe**:
```
┌─────────────────────────────────────────────────────────┐
│ TopBar: "Workspaces"                    [+ New Workspace]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Workspace Card ──────────────────────────────────┐  │
│  │  [Icon] Project Name                              │  │
│  │  12 assets · 85% quality · 3/8 tools             │  │
│  │  [Open Workspace →]                               │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ Workspace Card ──────────────────────────────────┐  │
│  │  [Icon] Another Project                           │  │
│  │  5 assets · 60% quality · 1/8 tools              │  │
│  │  [Open Workspace →]                               │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  Empty state: "No workspaces yet. Create your first    │
│  project to get started."                              │
└─────────────────────────────────────────────────────────┘
```

**Implementation**:
```tsx
// Fetches: useProjectsQuery({ apiBaseUrl, capabilities })
// Maps: each Project → WorkspaceCard with summary stats
// Each card uses useWorkspaceContext(project.id) for stats
// CTA: Link to /workspaces/:id (dashboard)
```

**Validation**:
```bash
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run build
grep -q "useProjectsQuery" apps/frontend/src/features/workspace/pages/WorkspacesListPage.tsx
grep -q "useWorkspaceContext" apps/frontend/src/features/workspace/pages/WorkspacesListPage.tsx
```

---

### **P3.3 - Navigation Updates** ⏱️ 1 day | **Priority: MEDIUM**

#### **P3.3.1 - Update navigation-metadata.ts**
**File**: `apps/frontend/src/app/runtime/navigation-metadata.ts`

**Changes**:
```tsx
// Replace /tools entry with /workspaces
const NAVIGATION_ITEMS: NavigationItem[] = [
  { to: '/dashboard', label: appCopy.ui.navigation.dashboard, end: true, iconKey: 'dashboard' },
  { to: '/workspaces', label: appCopy.ui.navigation.workspaces, end: false, iconKey: 'projects' },
  // REMOVE: { to: '/tools', ... }
  { to: '/dashboard/projects', label: appCopy.ui.navigation.projects, end: true, iconKey: 'projects' },
  { to: '/sessionsummary', label: appCopy.ui.navigation.sessionSummary, end: false, iconKey: 'sessions' },
  // ... rest unchanged
];

// Update NavigationIconKey type to add 'workspaces' if needed
export type NavigationIconKey = 'dashboard' | 'projects' | 'tools' | 'workspaces' | 'sessions' | 'artifacts' | 'admin';
```

**Also update**: `MainNavigation.css` if it references `/tools` in active-state logic.

**Validation**:
```bash
npm --workspace apps/frontend run typecheck
grep -q "workspaces" apps/frontend/src/app/runtime/navigation-metadata.ts
grep -q "/tools" apps/frontend/src/app/runtime/navigation-metadata.ts && echo "WARN: /tools still present" || echo "PASS: /tools removed"
```

#### **P3.3.2 - Update MainNavigation active-state**
**File**: `apps/frontend/src/app/layouts/MainNavigation.tsx`

**Changes**: Update active-state detection to recognize `/workspaces` routes as active when the current path starts with `/workspaces`.

**Validation**:
```bash
npm --workspace apps/frontend run typecheck
grep -q "workspaces" apps/frontend/src/app/layouts/MainNavigation.tsx
```

---

### **P3.4 - Phase 3 Integration Test** ⏱️ 1 day | **Priority: HIGH**

#### **P3.4.1 - Full validation**
```bash
# TypeScript
npm --workspace apps/frontend run typecheck

# Build
npm --workspace apps/frontend run build

# Component existence
test -f apps/frontend/src/features/workspace/ui/dashboard/WorkspaceKnowledgeOverview.tsx
test -f apps/frontend/src/features/workspace/ui/dashboard/SuggestedActionsPanel.tsx
test -f apps/frontend/src/features/workspace/ui/dashboard/ContextualToolsPanel.tsx
test -f apps/frontend/src/features/workspace/ui/dashboard/AssetLibraryQuickAccess.tsx
test -f apps/frontend/src/features/workspace/ui/dashboard/RecentActivityPanel.tsx

# Page integration
grep -q "WorkspaceKnowledgeOverview" apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx
grep -q "useProjectsQuery" apps/frontend/src/features/workspace/pages/WorkspacesListPage.tsx

# Navigation
grep -q "workspaces" apps/frontend/src/app/runtime/navigation-metadata.ts
```

---

### **P3 Acceptance Criteria**

- [ ] **Dashboard**: WorkspaceDashboard renders 5 panels with real data from `useWorkspaceContext` + `useSessionsQuery`
- [ ] **Overview**: KnowledgeOverview shows quality score, asset count, gate status, progress bar
- [ ] **Suggestions**: SuggestedActionsPanel shows gap-based tool recommendations
- [ ] **Tools**: ContextualToolsPanel shows available tools with readiness indicators
- [ ] **Assets**: AssetLibraryQuickAccess shows recent assets with "View all" link
- [ ] **Activity**: RecentActivityPanel shows last 5 sessions with status chips
- [ ] **List**: WorkspacesListPage shows all projects as workspace cards with stats
- [ ] **Navigation**: Sidebar shows "Workspaces" instead of "Tools", active state works
- [ ] **Responsive**: Dashboard panels stack vertically on mobile
- [ ] **Empty states**: All panels show meaningful empty states when data is missing
- [ ] **Loading states**: Dashboard shows loading indicators during data fetch
- [ ] **Error states**: Dashboard shows error messages with retry option

---

## 🔄 **PHASE 4: Cross-Tool Integration** ✅ COMPLETED 2026-07-17

*Requires P1 + P2A + P2B completion*

### **P4.1 - Per-Tool Asset Registry** ⏱️ 1 day | **Priority: HIGH**

#### **P4.1.1 - Create toolAssetRegistry.ts**
**File**: `apps/frontend/src/features/workspace/runtime/toolAssetRegistry.ts` (NEW)
**Complexity**: LOW

**Problem**: `ToolPageTemplate` hardcodes `assetInputs` as a stub. Each tool needs a proper mapping from `toolKey` → `ToolProjectAssetPolicyEntry[]` based on `TOOL_ASSET_CONTRACTS` from contracts.

**Implementation**:
```tsx
// FILE: apps/frontend/src/features/workspace/runtime/toolAssetRegistry.ts
import { TOOL_ASSET_CONTRACTS, type ToolKey, type AssetType } from '@gen-app-2/contracts';

export type ToolProjectAssetPolicyEntry = {
  assetType: string;
  label: string;
  requiredness: 'always-required' | 'optional-by-tool-setting' | 'never-required';
};

// Asset type display labels (canonical, from contracts ASSET_TYPES)
const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  'angle': 'Angle',
  'persona': 'Persona',
  'brand-voice': 'Brand Voice',
  'hook': 'Hook',
  'competitor-analysis': 'Competitor Analysis',
  'creative-brief': 'Creative Brief',
  'ad-copy': 'Ad Copy',
  'landing-page': 'Landing Page',
  'article-outline': 'Article Outline',
  'article': 'Article',
  'script': 'Script',
  'description': 'Description',
};

/**
 * Returns the asset inputs for a given tool based on TOOL_ASSET_CONTRACTS.
 * Required assets (always-required) come from `consumes` minus optional.
 * Optional assets are derived from the contract's optional list.
 */
export const getToolAssetInputs = (toolKey: ToolKey): ToolProjectAssetPolicyEntry[] => {
  const contract = TOOL_ASSET_CONTRACTS[toolKey];
  if (!contract) return [];

  const required = contract.consumes.map(assetType => ({
    assetType,
    label: ASSET_TYPE_LABELS[assetType] || assetType,
    requiredness: 'always-required' as const,
  }));

  return required;
};

/**
 * Returns all tools that can produce a specific asset type.
 */
export const getProducerToolsForAsset = (assetType: AssetType): ToolKey[] => {
  return (Object.keys(TOOL_ASSET_CONTRACTS) as ToolKey[]).filter(toolKey =>
    TOOL_ASSET_CONTRACTS[toolKey].produces.includes(assetType),
  );
};
```

**Validation**:
```bash
test -f apps/frontend/src/features/workspace/runtime/toolAssetRegistry.ts
npm --workspace apps/frontend run typecheck
grep -q "getToolAssetInputs" apps/frontend/src/features/workspace/runtime/toolAssetRegistry.ts
grep -q "getProducerToolsForAsset" apps/frontend/src/features/workspace/runtime/toolAssetRegistry.ts
```

---

### **P4.2 - useToolRecommendations Hook** ⏱️ 1-2 days | **Priority: HIGH**

#### **P4.2.1 - Implement useToolRecommendations**
**File**: `apps/frontend/src/features/workspace/runtime/useToolRecommendations.ts` (NEW)
**Complexity**: HIGH

**Purpose**: Given a workspace state (gaps, completed tools), compute ranked tool recommendations with reasons.

**Data sources**:
- `useWorkspaceContext(workspaceId)` → `gaps`, `workflowPosition.completedSteps`, `assets`
- `TOOL_ASSET_CONTRACTS` from `@gen-app-2/contracts` → static tool→asset→consumer mapping
- `getEnabledToolNavigationItems(role, workspaceId)` → available tools with routes

**Algorithm**:
```
For each tool T not yet in completedSteps:
  1. Get T.consumes (required input assetTypes)
  2. Count how many of T.consumes exist in workspace assets → coveredCount
  3. Count how many of T.consumes are in gaps → gapCount
  4. readinessScore = (coveredCount / T.consumes.length) * 100
  5. impactScore = T.produces.length * gapCount (how many gaps this tool fills)
  6. priorityScore = readinessScore * 0.6 + impactScore * 0.4
  7. reason: "Ready to run" | "Needs X, Y assets" | "Fills Z gaps"
Sort by priorityScore desc, return top 5
```

**Implementation**:
```tsx
// FILE: apps/frontend/src/features/workspace/runtime/useToolRecommendations.ts
import { useMemo } from 'react';
import { TOOL_ASSET_CONTRACTS, type ToolKey, type AssetType } from '@gen-app-2/contracts';
import { useWorkspaceContext } from './useWorkspaceContext';
import { getEnabledToolNavigationItems } from '../../tools/runtime/tool-form-architecture';
import type { ToolAccessRole } from '@gen-app-2/contracts';

export interface ToolRecommendation {
  toolKey: ToolKey;
  label: string;
  description: string;
  to: string;
  readinessScore: number;   // 0-100, how many required inputs exist
  impactScore: number;      // how many gaps this tool would fill
  priorityScore: number;    // combined ranking
  reason: string;           // human-readable recommendation reason
  missingAssets: AssetType[];
  fillableGaps: AssetType[];
}

export const useToolRecommendations = (
  workspaceId?: string,
  role: ToolAccessRole = 'member',
  limit: number = 5,
): ToolRecommendation[] => {
  const ctx = useWorkspaceContext(workspaceId);

  return useMemo(() => {
    if (!workspaceId || ctx.loading || !ctx.workflowPosition) return [];

    const completedSet = new Set(ctx.workflowPosition.completedSteps);
    const gapAssetTypes = new Set(ctx.gaps.map(g => g.assetType));
    const availableTools = getEnabledToolNavigationItems(role, workspaceId);

    const recommendations: ToolRecommendation[] = [];

    for (const item of availableTools) {
      const toolKey = item.toolKey as ToolKey;
      if (completedSet.has(toolKey)) continue;

      const contract = TOOL_ASSET_CONTRACTS[toolKey];
      if (!contract || contract.consumes.length === 0) continue;

      const existingAssetTypes = new Set(ctx.assets.map(a => a.assetType));

      const coveredCount = contract.consumes.filter(a => existingAssetTypes.has(a)).length;
      const missingAssets = contract.consumes.filter(a => !existingAssetTypes.has(a));
      const fillableGaps = contract.produces.filter(a => gapAssetTypes.has(a));

      const readinessScore = Math.round((coveredCount / contract.consumes.length) * 100);
      const impactScore = fillableGaps.length * 30;
      const priorityScore = readinessScore * 0.6 + impactScore * 0.4;

      let reason: string;
      if (missingAssets.length === 0) {
        reason = 'Ready to run — all inputs available';
      } else if (fillableGaps.length > 0) {
        reason = `Needs ${missingAssets.join(', ')} — fills ${fillableGaps.length} gap(s)`;
      } else {
        reason = `Needs ${missingAssets.join(', ')} inputs`;
      }

      recommendations.push({
        toolKey,
        label: item.label,
        description: item.description,
        to: item.to,
        readinessScore,
        impactScore,
        priorityScore,
        reason,
        missingAssets,
        fillableGaps,
      });
    }

    return recommendations
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, limit);
  }, [workspaceId, role, limit, ctx.loading, ctx.workflowPosition, ctx.gaps, ctx.assets]);
};
```

**Validation**:
```bash
test -f apps/frontend/src/features/workspace/runtime/useToolRecommendations.ts
npm --workspace apps/frontend run typecheck
grep -q "TOOL_ASSET_CONTRACTS" apps/frontend/src/features/workspace/runtime/useToolRecommendations.ts
grep -q "priorityScore" apps/frontend/src/features/workspace/runtime/useToolRecommendations.ts
grep -q "readinessScore" apps/frontend/src/features/workspace/runtime/useToolRecommendations.ts
```

---

### **P4.3 - CrossToolWorkflowPanel** ⏱️ 1-2 days | **Priority: MEDIUM**

#### **P4.3.1 - Implement CrossToolWorkflowPanel**
**File**: `apps/frontend/src/features/workspace/ui/CrossToolWorkflowPanel.tsx` (NEW)
**Complexity**: MEDIUM

**Purpose**: Horizontal pipeline visualization showing which tools have been used, current position, and suggested next steps.

**Wireframe**:
```
┌─────────────────────────────────────────────────────────────┐
│ Cross-Tool Workflow                                         │
│                                                             │
│  ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐     │
│  │Geo. │───▶│Angl.│───▶│Meta │───▶│  ?  │───▶│  ?  │     │
│  │  ✓  │    │  ✓  │    │  ✓  │    │     │    │     │     │
│  └─────┘    └─────┘    └─────┘    └─────┘    └─────┘     │
│                                                             │
│  ✅ Completed    ⏳ Suggested    ○ Available                │
│                                                             │
│  Suggested next: Angle Generator, Funnel Pages              │
└─────────────────────────────────────────────────────────────┘
```

**Implementation**:
```tsx
// FILE: apps/frontend/src/features/workspace/ui/CrossToolWorkflowPanel.tsx
import { useMemo } from 'react';
import { Chip, Typography } from '@mui/material';
import { Check, Clock, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ToolKey } from '@gen-app-2/contracts';
import { TOOL_ASSET_CONTRACTS } from '@gen-app-2/contracts';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { useToolRecommendations } from '../runtime/useToolRecommendations';
import { getToolLabel } from '../../tools/runtime/tool-form-architecture';
import './CrossToolWorkflowPanel.css';

interface CrossToolWorkflowPanelProps {
  workspaceId: string;
  currentToolKey?: string;
}

// Canonical tool ordering for visual pipeline display
const TOOL_PIPELINE_ORDER: ToolKey[] = [
  'geometric', 'angle-generator', 'meta-ads', 'funnel-pages',
  'nextland', 'youtube-lf-script', 'youtube-description', 'blog-article-generator',
];

export const CrossToolWorkflowPanel: React.FC<CrossToolWorkflowPanelProps> = ({
  workspaceId,
  currentToolKey,
}) => {
  const ctx = useWorkspaceContext(workspaceId);
  const recommendations = useToolRecommendations(workspaceId, 'member', 3);

  const pipeline = useMemo(() => {
    const completedSet = new Set(ctx.workflowPosition?.completedSteps || []);
    const suggestedSet = new Set(recommendations.map(r => r.toolKey));

    return TOOL_PIPELINE_ORDER.map(toolKey => ({
      toolKey,
      status: completedSet.has(toolKey)
        ? 'completed'
        : suggestedSet.has(toolKey)
          ? 'suggested'
          : 'available',
      isCurrent: toolKey === currentToolKey,
    }));
  }, [ctx.workflowPosition, recommendations, currentToolKey]);

  if (ctx.loading || !ctx.workflowPosition) return null;

  return (
    <div className="cross-tool-workflow-panel">
      <Typography variant="subtitle2" className="cross-tool-workflow-panel__title">
        Cross-Tool Workflow
      </Typography>

      <div className="cross-tool-workflow-panel__pipeline">
        {pipeline.map((item, index) => (
          <div key={item.toolKey} className="cross-tool-workflow-panel__step-wrapper">
            {index > 0 && (
              <div className={`cross-tool-workflow-panel__connector cross-tool-workflow-panel__connector--${item.status}`} />
            )}
            <Link
              to={`/workspaces/${workspaceId}/tools/${item.toolKey}`}
              className={`cross-tool-workflow-panel__step cross-tool-workflow-panel__step--${item.status} ${item.isCurrent ? 'cross-tool-workflow-panel__step--current' : ''}`}
            >
              {item.status === 'completed' ? <Check size={14} /> :
               item.status === 'suggested' ? <Clock size={14} /> :
               <Circle size={14} />}
              <span className="cross-tool-workflow-panel__step-label">
                {getToolLabel(item.toolKey)}
              </span>
            </Link>
          </div>
        ))}
      </div>

      {recommendations.length > 0 && (
        <div className="cross-tool-workflow-panel__suggestions">
          <Typography variant="caption" color="text.secondary">
            Suggested next: {recommendations.map(r => r.label).join(', ')}
          </Typography>
        </div>
      )}
    </div>
  );
};
```

**CSS** (`CrossToolWorkflowPanel.css`):
```css
.cross-tool-workflow-panel { border: 1px solid var(--mui-palette-divider); border-radius: 12px; background: var(--mui-palette-background-paper); padding: 16px 20px; margin-bottom: 24px; }
.cross-tool-workflow-panel__title { margin-bottom: 12px; }
.cross-tool-workflow-panel__pipeline { display: flex; align-items: center; overflow-x: auto; gap: 0; padding: 8px 0; }
.cross-tool-workflow-panel__step-wrapper { display: flex; align-items: center; }
.cross-tool-workflow-panel__connector { width: 24px; height: 2px; background: var(--mui-palette-divider); }
.cross-tool-workflow-panel__connector--completed { background: var(--mui-palette-success-main); }
.cross-tool-workflow-panel__step { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 12px; border-radius: 8px; text-decoration: none; color: inherit; min-width: 64px; transition: background 0.2s; }
.cross-tool-workflow-panel__step:hover { background: var(--mui-palette-action-hover); }
.cross-tool-workflow-panel__step--completed { color: var(--mui-palette-success-main); }
.cross-tool-workflow-panel__step--suggested { color: var(--mui-palette-warning-main); }
.cross-tool-workflow-panel__step--available { color: var(--mui-palette-text-secondary); }
.cross-tool-workflow-panel__step--current { outline: 2px solid var(--mui-palette-primary-main); outline-offset: 2px; }
.cross-tool-workflow-panel__step-label { font-size: 0.75rem; white-space: nowrap; }
.cross-tool-workflow-panel__suggestions { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--mui-palette-divider); }
```

**Validation**:
```bash
test -f apps/frontend/src/features/workspace/ui/CrossToolWorkflowPanel.tsx
test -f apps/frontend/src/features/workspace/ui/CrossToolWorkflowPanel.css
npm --workspace apps/frontend run typecheck
grep -q "TOOL_PIPELINE_ORDER" apps/frontend/src/features/workspace/ui/CrossToolWorkflowPanel.tsx
grep -q "useToolRecommendations" apps/frontend/src/features/workspace/ui/CrossToolWorkflowPanel.tsx
```

---

### **P4.4 - Integrate into ToolPageTemplate** ⏱️ 0.5 day | **Priority: HIGH**

#### **P4.4.1 - Add CrossToolWorkflowPanel to ToolPageTemplate**
**File**: `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx`

**Changes**:
```tsx
// 1. Add import
import { CrossToolWorkflowPanel } from '../../workspace/ui/CrossToolWorkflowPanel';
import { useWorkspace } from '../../workspace/runtime/WorkspaceProvider';

// 2. Inside ToolPageTemplate component, add workspace-aware rendering:
// Find the section before <form> (around line 590) and insert:

// After the existing header, before the form:
{(() => {
  try {
    const { workspace } = useWorkspace();
    return (
      <CrossToolWorkflowPanel
        workspaceId={workspace.id}
        currentToolKey={props.toolKey}
      />
    );
  } catch {
    return null; // Not inside WorkspaceProvider — skip
  }
})()}
```

**Also**: Replace the hardcoded `assetInputs` stub with the real registry:
```tsx
// BEFORE (hardcoded stub):
const assetInputs = useMemo(() => {
  return [
    { assetType: 'angle', label: 'Angle', requiredness: 'optional-by-tool-setting' as const },
    { assetType: 'persona', label: 'Persona', requiredness: 'optional-by-tool-setting' as const },
  ];
}, [toolKey]);

// AFTER (from registry):
import { getToolAssetInputs } from '../../workspace/runtime/toolAssetRegistry';
const assetInputs = useMemo(() => getToolAssetInputs(props.toolKey), [props.toolKey]);
```

**Validation**:
```bash
npm --workspace apps/frontend run typecheck
grep -q "CrossToolWorkflowPanel" apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx
grep -q "getToolAssetInputs" apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx
grep -q "TOOL_ASSET_CONTRACTS\|toolAssetRegistry" apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx
```

---

### **P4.5 - Phase 4 Integration Test** ⏱️ 0.5 day | **Priority: HIGH**

#### **P4.5.1 - Full validation**
```bash
# TypeScript
npm --workspace apps/frontend run typecheck

# Build
npm --workspace apps/frontend run build

# Component existence
test -f apps/frontend/src/features/workspace/runtime/toolAssetRegistry.ts
test -f apps/frontend/src/features/workspace/runtime/useToolRecommendations.ts
test -f apps/frontend/src/features/workspace/ui/CrossToolWorkflowPanel.tsx
test -f apps/frontend/src/features/workspace/ui/CrossToolWorkflowPanel.css

# Integration
grep -q "CrossToolWorkflowPanel" apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx
grep -q "getToolAssetInputs" apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx
grep -q "useToolRecommendations" apps/frontend/src/features/workspace/runtime/useToolRecommendations.ts
grep -q "TOOL_ASSET_CONTRACTS" apps/frontend/src/features/workspace/runtime/useToolRecommendations.ts
```

---

### **P4 Acceptance Criteria**

- [ ] **Registry**: `toolAssetRegistry.ts` provides per-tool asset inputs from `TOOL_ASSET_CONTRACTS`
- [ ] **Recommendations**: `useToolRecommendations` returns ranked tool suggestions with readiness/impact scores
- [ ] **Workflow Panel**: `CrossToolWorkflowPanel` shows horizontal pipeline with completed/suggested/available states
- [ ] **Pipeline Order**: Tools display in canonical production order
- [ ] **Current Tool Highlight**: Active tool is visually highlighted in pipeline
- [ ] **Suggestions**: Pipeline footer shows top 3 recommended next tools
- [ ] **Integration**: `ToolPageTemplate` renders workflow panel when inside workspace context
- [ ] **Asset Inputs**: `ToolPageTemplate` uses `getToolAssetInputs()` instead of hardcoded stub
- [ ] **Responsive**: Pipeline scrolls horizontally on mobile
- [ ] **Empty State**: Panel hidden when no workspace context available

---

## 🧪 **PHASE 5: Integration & Polish** ✅ COMPLETED 2026-07-17

*Final integration and optimization*

### **P5.1 - Test Updates** ⏱️ 1 day | **Priority: HIGH**

#### **P5.1.1 - Update existing tests for new routing**
**Files**: `apps/frontend/src/features/tools/ui/ToolPageTemplate*.test.tsx`, `apps/frontend/src/app/routing/*.test.tsx`

**Changes**:
- Update all test renders that use `/tools/:toolKey` routes to also test `/workspaces/:id/tools/:toolKey`
- Add `WorkspaceProvider` wrapper to tests that render components needing workspace context
- Update snapshot tests for modified components (`ToolPageTemplate`, `WorkspaceToolWrapper`)

**Validation**:
```bash
npm --workspace apps/frontend run test 2>&1 | tail -5
```

#### **P5.1.2 - Add workspace component tests**
**Directory**: `apps/frontend/src/features/workspace/**/*.test.tsx` (NEW)

Create test files for each new component:

| Test File | Covers | Key assertions |
|---|---|---|
| `useWorkspaceContext.test.ts` | Hook | Returns correct data shape, handles loading/error, refetch works |
| `WorkspaceProvider.test.tsx` | Context | Provides context, throws outside provider |
| `WorkspaceToolWrapper.test.tsx` | Wrapper | Shows header, redirects on missing workspace, loading states |
| `WorkspaceContextHeader.test.tsx` | Header | Breadcrumbs render, quality chip shows correct color |
| `AssetKnowledgePanel.test.tsx` | Panel | Groups assets correctly, selection works, empty states |
| `AssetGroupSection.test.tsx` | Group | Expand/collapse, select all/none, create prompt |
| `CrossToolWorkflowPanel.test.tsx` | Pipeline | Shows completed/suggested states, highlights current tool |
| `useToolRecommendations.test.ts` | Hook | Returns ranked recommendations, handles empty workspace |
| `toolAssetRegistry.test.ts` | Registry | Returns correct asset inputs per tool |

**Validation**:
```bash
npm --workspace apps/frontend run test 2>&1 | grep -E "pass|fail|PASS|FAIL"
```

---

### **P5.2 - Performance & Polish** ⏱️ 1 day | **Priority: MEDIUM**

#### **P5.2.1 - Bundle analysis and lazy loading**
**Check**: All new workspace components are lazy-loaded via `app-router.tsx`.

**Actions**:
- Verify `WorkspaceDashboard`, `WorkspacesListPage`, `ProjectAssetsPage` use `React.lazy()`
- Verify `CrossToolWorkflowPanel`, `AssetKnowledgePanel` are imported inline (not lazy, since they're inside already-lazy tool pages)
- Run `npm --workspace apps/frontend run build` and check chunk sizes
- Target: no single chunk > 150KB gzipped

**Validation**:
```bash
npm --workspace apps/frontend run build 2>&1 | grep -E "\.js\s+[0-9]+\.?[0-9]* kB" | awk '{if ($3+0 > 150) print "WARN: " $0}'
```

#### **P5.2.2 - Component memoization audit**
**Files**: All new workspace components

**Actions**:
- Add `React.memo()` to pure presentational components: `QualityScoreBadge`, `AssetTypeIcon`, `AssetSelectionList`
- Verify `useMemo` usage in `useWorkspaceContext`, `useToolRecommendations`, `AssetKnowledgePanel`
- Verify `useCallback` for handlers passed as props to child components
- Target: no unnecessary re-renders when workspace data hasn't changed

#### **P5.2.3 - CSS performance**
**Files**: All new `.css` files

**Actions**:
- Remove any duplicate CSS rules across workspace CSS files
- Use CSS custom properties (MUI vars) consistently — no hardcoded colors
- Verify responsive breakpoints work at 768px and 480px
- Remove unused CSS classes

---

### **P5.3 - Legacy Cleanup** ⏱️ 0.5 day | **Priority: MEDIUM**

#### **P5.3.1 - Remove legacy `/tools` hub route**
**File**: `apps/frontend/src/app/routing/app-router.tsx`

**Changes**:
- Remove the `/tools` route that renders `ToolsHubPage`
- Keep `/tools/:toolKey` → `LegacyToolRedirect` for backward compatibility
- Update wildcard `*` route to redirect to `/workspaces` instead of `/dashboard`

```tsx
// BEFORE:
{ path: '/tools', element: <Suspense fallback={<PageLoader />}><ToolsHubPage /></Suspense> },
{ path: '/tools/:toolKey', element: <Suspense fallback={<PageLoader />}><LegacyToolRedirect /></Suspense> },
// ...
{ path: '*', element: <Navigate to="/dashboard" replace /> },

// AFTER:
{ path: '/tools/:toolKey', element: <Suspense fallback={<PageLoader />}><LegacyToolRedirect /></Suspense> },
// ...
{ path: '*', element: <Navigate to="/workspaces" replace /> },
```

**Validation**:
```bash
npm --workspace apps/frontend run typecheck
grep -q "/tools/:toolKey.*LegacyToolRedirect" apps/frontend/src/app/routing/app-router.tsx
grep -c "ToolsHubPage" apps/frontend/src/app/routing/app-router.tsx && echo "WARN: ToolsHubPage still imported" || echo "PASS: ToolsHubPage removed from router"
```

#### **P5.3.2 - Deprecate ToolsHubPage import**
**File**: `apps/frontend/src/app/routing/app-router.tsx`

**Actions**:
- Remove lazy import of `ToolsHubPage` (no longer referenced)
- Keep `ToolsHubPage.tsx` file for now (deprecation cycle)

---

### **P5.4 - Accessibility Audit** ⏱️ 0.5 day | **Priority: MEDIUM**

#### **P5.4.1 - Keyboard navigation verification**
**Components**: All new workspace components

**Checklist**:
- [ ] `WorkspaceContextHeader`: breadcrumb links keyboard-navigable, chips focusable
- [ ] `AssetGroupSection`: expand/collapse via Enter/Space, header clickable
- [ ] `AssetSelectionList`: checkboxes keyboard-operable, focus visible
- [ ] `CrossToolWorkflowPanel`: pipeline links keyboard-navigable
- [ ] `WorkspaceToolWrapper`: loading/error states announced to screen readers

#### **P5.4.2 - ARIA labels**
**Actions**:
- Add `aria-label` to `AssetGroupSection` expand button
- Add `role="status"` to loading states in workspace components
- Add `aria-live="polite"` to selection count in `AssetKnowledgePanel`
- Verify all interactive elements have visible focus indicators

---

### **P5.5 - Phase 5 Integration Test** ⏱️ 0.5 day | **Priority: HIGH**

#### **P5.5.1 - Full validation**
```bash
# TypeScript
npm --workspace apps/frontend run typecheck

# Build
npm --workspace apps/frontend run build

# All tests pass
npm --workspace apps/frontend run test

# No console errors in build output
npm --workspace apps/frontend run build 2>&1 | grep -i "error\|warning" | grep -v "node_modules" | head -5

# Bundle size check
npm --workspace apps/frontend run build 2>&1 | grep "vendor" | awk '{if ($3+0 > 250) print "WARN: vendor chunk too large"}'

# Legacy route still works
grep -q "LegacyToolRedirect" apps/frontend/src/app/routing/app-router.tsx

# Wildcard defaults to workspaces
grep -q "Navigate.*to=\"/workspaces\"" apps/frontend/src/app/routing/app-router.tsx
```

---

### **P5.6 - UX Flow Completion** ⏱️ 0.5 day | **Priority: HIGH** | ✅ COMPLETED 2026-07-17

Scoperto durante smoke test: il flusso utente era spezzato — la card workspace era cliccabile solo via freccia, e la dashboard non aveva un CTA primario per iniziare la generazione.

#### **P5.6.1 - Clickable workspace cards**
**File**: `apps/frontend/src/features/workspace/pages/WorkspacesListPage.tsx`

**Changes**:
- Card interamente cliccabile (wrapper `<Link>`, non solo freccia `→`)
- Hover effects: border highlight + shadow lift + micro-translate
- Label "Apri workspace" visibile accanto al gate status chip
- Workspace count nell'header della pagina
- Stili responsive: stacking verticale su mobile

#### **P5.6.2 - Dashboard hero CTA**
**File**: `apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx`

**Changes**:
- Hero section con nome progetto (via `useProjectDetailQuery`) + CTA primario
- CTA adattivo: "Start generating" (con icona ▶) se ci sono tool suggeriti, "Choose a tool" altrimenti
- L'ancora `#available-tools` scrolla alla griglia tool quando nessun suggerimento
- Stato descrittivo: "X tool suggestions ready" / "X assets · select a tool" / "Start by creating your first asset"
- Hero stacking verticale su mobile

**CSS**: `dashboard-panels.css` — nuove classi: `.workspace-dashboard__hero`, `.workspace-list-card`, `.workspace-list-card__inner`, `.workspace-list-page`

**Commit**: `3391707`

**Validation**:
```bash
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run build
npm --workspace apps/frontend run test
grep -q "Apri workspace" apps/frontend/src/features/workspace/pages/WorkspacesListPage.tsx
grep -q "Start generating" apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx
```

---

### **P5 Acceptance Criteria**

- [ ] **Tests**: All existing tests pass, new workspace tests added
- [ ] **Coverage**: New components have >80% test coverage
- [ ] **Performance**: No chunk > 150KB gzipped, memoization applied
- [ ] **Legacy**: `/tools` hub removed, `/tools/:toolKey` redirect preserved
- [ ] **Wildcard**: Default route redirects to `/workspaces`
- [ ] **Accessibility**: Keyboard navigation works, ARIA labels present
- [ ] **CSS**: No duplicate rules, consistent custom properties
- [ ] **Build**: Clean build with no warnings

---

## 📦 **PHASE 6: Artifact Promotion & Manual Asset Creation** ✅ COMPLETED 2026-07-17

*Bridges the gap between generated artifacts and the asset knowledge system*

### **P6.1 - Artifact→Asset Promotion UI** ⏱️ 1.5 days | **Priority: HIGH**

#### **P6.1.1 - Add promote button to SessionSummary detail page**
**File**: `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx`

**Changes**:
- For each artifact in the session summary, add a "Promote to asset" button (visible only when `status === 'completed'`)
- On click, show a dialog/modal with:
  - Asset type selector (dropdown of `ASSET_TYPES`)
  - Label input (pre-filled with artifact name)
  - Confirm button
- Call `promoteArtifactToAsset()` from `asset-client.ts`
- Show success/error feedback via `useFeedbackMessage`

**Wireframe**:
```
┌─ Artifact: optin ─────────────────────────────────────┐
│  [content preview...]                        [⬇️ dl]  │
│  [📦 Promote to Asset]                                │
└──────────────────────────────────────────────────────┘

┌─ Artifact: vsl ──────────────────────────────────────┐
│  [content preview...]                        [⬇️ dl]  │
│  [📦 Promote to Asset]                                │
│  👍 3   👎 1                                          │  ← P7 voting
└──────────────────────────────────────────────────────┘
```

**Validation**:
```bash
npm --workspace apps/frontend run typecheck
grep -q "promoteArtifactToAsset" apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx
```

---

### **P6.2 - Manual Asset Creation** ⏱️ 1 day | **Priority: HIGH**

#### **P6.2.1 - Add manual asset creation form**
**File**: `apps/frontend/src/features/workspace/ui/CreateAssetPrompt.tsx`

**Changes**:
When `producerTool === null` (no tool produces this asset type), instead of showing disabled text, render a simple form:
- Text input for asset label
- Textarea for asset content (optional, can be empty)
- "Create asset" button that calls `createAsset()` with `source: 'manual'`

This unblocks `persona`, `brand-voice`, and `creative-brief` which have no producing tools.

**Validation**:
```bash
npm --workspace apps/frontend run typecheck
grep -q "createAsset" apps/frontend/src/features/workspace/ui/CreateAssetPrompt.tsx
```

---

### **P6.3 - Phase 6 Integration Test** ⏱️ 0.5 day | **Priority: HIGH**

**Validation**:
```bash
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run build
npm --workspace apps/frontend run test
grep -q "promoteArtifactToAsset" apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx
grep -q "createAsset" apps/frontend/src/features/workspace/ui/CreateAssetPrompt.tsx
```

---

### **P6 Acceptance Criteria**

- [ ] **Promote Button**: Each artifact in SessionSummary has a "Promote to asset" button
- [ ] **Promote Dialog**: Asset type selector + label input + confirm
- [ ] **Promote Success**: Asset created with `source: 'generated'`, linked to artifact
- [ ] **Manual Creation**: `persona`, `brand-voice`, `creative-brief` can be created via form
- [ ] **Feedback**: Success/error messages shown to user
- [ ] **No Regression**: Existing artifact download/relaunch still works

---

## 🗳️ **PHASE 7: Feedback/Voting System** ✅ COMPLETED 2026-07-17

*Enables quality scoring per step to improve LLM instructions over time*

### **P7.1 - feedbackEnabled Contract Flag** ⏱️ 0.5 day | **Priority: HIGH**

#### **P7.1.1 - Add feedbackEnabled to step definitions**
**File**: `packages/contracts/src/tool-workflows.ts`

**Changes**:
- Add optional `feedbackEnabled?: boolean` to the step definition type
- Default: `true` only for the **last step** of each tool (explicit)
- For tools with intermediate votable steps (e.g., `geometric`), set `true` on specific steps

```ts
// Example for funnel-pages
steps: [
  { key: 'optin', dependencies: [], feedbackEnabled: false },
  { key: 'quiz', dependencies: ['optin'], feedbackEnabled: false },
  { key: 'vsl', dependencies: ['optin', 'quiz'], feedbackEnabled: true },  // finale
],

// Example for geometric (intermediate votable steps)
steps: [
  { key: 'serp-crawling', dependencies: [], feedbackEnabled: false },
  { key: 'competitor-scoring', dependencies: ['serp-crawling'], feedbackEnabled: false },
  { key: 'strategic-reporting', dependencies: [...], feedbackEnabled: true },
  { key: 'unified-report', dependencies: [...], feedbackEnabled: true },
],
```

**Validation**:
```bash
npm --workspace apps/backend run typecheck
grep -q "feedbackEnabled" packages/contracts/src/tool-workflows.ts
```

---

### **P7.2 - Backend Feedback API** ⏱️ 1 day | **Priority: HIGH**

#### **P7.2.1 - Create feedback HTTP endpoint**
**Files**:
- `apps/backend/src/lib/runtime/auth-http/tools/tools-routes.ts`
- `apps/backend/src/lib/runtime/auth-http/tools/tools-asset-handlers.ts`

**Changes**:
- Add `POST /api/tools/feedback` route
- Handler: validates `artifactId`, `rating` ('positive'|'negative'), optional `comment`
- Requires authenticated session
- Calls `recordFeedback()` adapter (already implemented)
- Returns `{ ok: true, netScore: number }`

**Validation**:
```bash
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test
grep -q "handleRecordFeedback" apps/backend/src/lib/runtime/auth-http/tools/tools-asset-handlers.ts
```

---

### **P7.3 - Frontend Voting UI** ⏱️ 1.5 days | **Priority: HIGH**

#### **P7.3.1 - Add thumbs-up/down to SessionSummary detail page**
**File**: `apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx`

**Changes**:
- For each artifact whose step has `feedbackEnabled: true`, render voting buttons
- Use `TOOL_WORKFLOW_DEFINITIONS[toolKey].steps` to check `feedbackEnabled`
- Thumbs-up / Thumbs-down buttons
- Show current net score
- Call `POST /api/tools/feedback` on vote
- Disable after voting (one vote per user per artifact)

**Wireframe**:
```
┌─ Step: vsl (feedbackEnabled: true) ──────────────────┐
│  [content preview...]                        [⬇️ dl]  │
│  [📦 Promote]  👍 5  👎 1                             │
└──────────────────────────────────────────────────────┘

┌─ Step: optin (feedbackEnabled: false) ───────────────┐
│  [content preview...]                        [⬇️ dl]  │
│  [📦 Promote]                                         │  ← no vote buttons
└──────────────────────────────────────────────────────┘
```

**Validation**:
```bash
npm --workspace apps/frontend run typecheck
grep -q "feedbackEnabled" apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx
```

---

### **P7.4 - Backend Scoring Integration** ⏱️ 1 day | **Priority: MEDIUM**

#### **P7.4.1 - Expose feedback score in artifact queries**
**File**: `apps/backend/src/lib/adapters/asset.adapter.ts`

**Changes**:
- Add `getArtifactFeedbackScore()` to artifact list/detail queries
- Return `feedbackScore: { positive: number, negative: number, netScore: number }` per artifact
- Formula: `netScore = positive * 10 - negative * 5` (DDD-205)

**Validation**:
```bash
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test
```

---

### **P7.5 - Phase 7 Integration Test** ⏱️ 0.5 day | **Priority: HIGH**

**Validation**:
```bash
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run build
npm --workspace apps/frontend run test
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test
```

---

### **P7 Acceptance Criteria**

- [ ] **Contract**: `feedbackEnabled` flag defined per step in `TOOL_WORKFLOW_DEFINITIONS`
- [ ] **Backend API**: `POST /api/tools/feedback` creates/updates rating
- [ ] **Backend Score**: `getArtifactFeedbackScore()` returns positive/negative/net
- [ ] **Frontend UI**: Thumbs-up/down buttons on votable artifacts only
- [ ] **One Vote**: User can vote once per artifact (DB constraint enforced)
- [ ] **Score Display**: Net score shown next to vote buttons
- [ ] **No Regression**: Existing artifact functionality unaffected

---

## 🔧 **PHASE 8: Bug Fixes & Hardening** ✅ COMPLETED 2026-07-17

*Backend fixes discovered during integration testing*

### **P8.1 - Backend Asset Routes Reordering** ✅ DONE

**Problem**: Route dispatch iterates in order. Regex `/^\/api\/tools\/assets\/([^/]+)$/` was matching `/api/tools/assets/compatible` and `/api/tools/assets/gaps` before the dedicated string-pattern routes could be reached.

**Fix**: Moved `compatible` and `gaps` discovery routes to the top of the asset routes block, before the regex catch-all patterns.

**File**: `apps/backend/src/lib/runtime/auth-http/tools/tools-routes.ts`
**Commit**: `16a7b39`

---

### **P8.2 - Pre-existing TS Errors in Backend Tests** ✅ DONE

**Fixes**:
- Type `expectedTools` array as `ToolKey[]` in `runtime.asset-contracts.test.ts`
- Remove unused destructured variable
- Add null-safe access for `resolveFieldMapping` result
- Add optional chaining for `logs` array access

**Files**: `runtime.asset-contracts.test.ts`, `runtime.asset-injection-resolver.test.ts`
**Commit**: `609f3cd`

---

## 📊 **Implementation Timeline & Resources**

### **Critical Path Analysis**

```
P1 Foundation (8-10 days)
├─ P1.1 Routing (3-4 days)
├─ P1.2 Copy Updates (1-2 days) [PARALLEL with P1.1]  
└─ P1.3 Infrastructure (3-4 days) [AFTER P1.1]

P2A Context (4-5 days) [AFTER P1.3]
└─ P2A.1 WorkspaceContextHeader (4-5 days)

P2B Asset Panel (4-5 days) [PARALLEL with P2A, AFTER P1.3]
├─ P2B.1 AssetKnowledgePanel (3-4 days)
├─ P2B.2 Supporting Components (1-2 days) [PARALLEL with P2B.1]
└─ P2B.3 ToolPageTemplate Integration (1 day) [AFTER P2B.1]

P3 Dashboard (6-8 days) [AFTER P1 + P2A]
├─ P3.1 WorkspaceDashboard (4-5 days)
└─ P3.2 Navigation Updates (2-3 days) [PARALLEL with P3.1]

P4 Cross-Tool (4-6 days) [AFTER P1 + P2A + P2B]
├─ P4.1 Per-Tool Asset Registry (1 day) [AFTER P2B]
├─ P4.2 useToolRecommendations (1-2 days) [PARALLEL with P4.1]
├─ P4.3 CrossToolWorkflowPanel (1-2 days) [AFTER P4.2]
├─ P4.4 ToolPageTemplate Integration (0.5 day) [AFTER P4.1 + P4.3]
└─ P4.5 Integration Test (0.5 day)

P5 Polish (2-3 days) [AFTER P1-P4]
├─ P5.1 Test Updates (1 day)
├─ P5.2 Performance & Polish (1 day) [PARALLEL with P5.1]
├─ P5.3 Legacy Cleanup (0.5 day)
├─ P5.4 Accessibility Audit (0.5 day) [PARALLEL with P5.3]
├─ P5.5 Integration Test (0.5 day)
└─ P5.6 UX Flow Completion (0.5 day) [AFTER P5.5] ✅ DONE

P6 Promotion & Manual Assets (3-4 days) [AFTER P1-P5]
├─ P6.1 Artifact→Asset Promotion UI (1.5 days)
├─ P6.2 Manual Asset Creation (1 day) [PARALLEL with P6.1]
└─ P6.3 Integration Test (0.5 day)

P7 Feedback/Voting System (4-5 days) [AFTER P1-P6]
├─ P7.1 feedbackEnabled Contract Flag (0.5 day)
├─ P7.2 Backend Feedback API (1 day) [AFTER P7.1]
├─ P7.3 Frontend Voting UI (1.5 days) [AFTER P7.2]
├─ P7.4 Backend Scoring Integration (1 day) [PARALLEL with P7.3]
└─ P7.5 Integration Test (0.5 day)

P8 Bug Fixes & Hardening (1 day) [AFTER P1-P5]
├─ P8.1 Backend Asset Routes Reordering (0.5 day) ✅ DONE
└─ P8.2 Pre-existing TS Errors (0.5 day) ✅ DONE
```

**Total Duration**: 39-50 days
**Critical Path**: P1 → P2A → P3 → P5 → P6 → P7 (31-40 days)
**Parallelizable Work**: P1.2, P2B, P3.2, P4.1/P4.2, P5.2, P5.6, P6.2, P7.4 (up to 10-12 days savings)
**Total Atomic Tasks**: 46 (Phases 1-5) + 1 (P5.6 UX) + 3 (Phase 6) + 5 (Phase 7) + 2 (Phase 8) = 57 tasks
**Completed**: All phases (57 tasks) ✅ — 2026-07-17
**Remaining**: None

### **Resource Requirements**

- **Frontend Lead**: Full engagement for architecture decisions (P1, P2B.3, P3.1)
- **Frontend Developer**: Implementation work (P2A, P2B.1-2, P3.2, P4, P5)
- **UI/UX Designer**: Design review and refinements (P2A.2, P3.1, P5.2)
- **QA Engineer**: Testing strategy and execution (P5.1)

---

## ⚠️ **Risk Mitigation & Rollback Strategy**

### **High-Risk Areas & Mitigations**

1. **Routing Migration Breaking Changes**
   - **Risk**: Users lose access to bookmarked tool URLs
   - **Mitigation**: 
     - Keep legacy `/tools/*` routes with redirects during transition
     - Implement `LegacyToolRedirect` component for graceful migration
     - Feature flag to toggle between old/new routing
   - **Rollback**: Disable workspace routing, restore original tool-first routes

2. **State Management Complexity**
   - **Risk**: XState integration issues with workspace context
   - **Mitigation**:
     - Incremental integration starting with read-only context
     - Comprehensive testing at each integration point
     - Fallback to existing state management if issues arise
   - **Rollback**: Disable workspace context provider, tools work independently

3. **Performance Degradation**
   - **Risk**: New context and components slow down tool pages
   - **Mitigation**:
     - Implement memoization and selective re-renders
     - Bundle size monitoring and lazy loading
     - Performance benchmarks throughout development
   - **Rollback**: Feature flag to disable workspace components

4. **User Experience Disruption**  
   - **Risk**: Users confused by navigation changes
   - **Mitigation**:
     - Gradual rollout with A/B testing
     - User onboarding tooltips and guidance
     - Feedback collection and rapid iteration
   - **Rollback**: Revert to tool-first navigation with user communication

### **Feature Flag Strategy**

```tsx
// Feature flag configuration
const FEATURE_FLAGS = {
  workspaceCentricUX: {
    enabled: process.env.REACT_APP_WORKSPACE_UX_ENABLED === 'true',
    rolloutPercentage: 25, // Start with 25% of users
    userSegments: ['beta-testers', 'internal-users']
  }
};

// Usage in routing
const shouldUseWorkspaceRouting = useFeatureFlag('workspaceCentricUX');
```

### **Rollback Procedures**

1. **Immediate Rollback (< 5 minutes)**:
   ```bash
   # Disable feature flag
   kubectl set env deployment/frontend REACT_APP_WORKSPACE_UX_ENABLED=false
   ```

2. **Code Rollback (< 30 minutes)**:
   ```bash
   # Revert to previous release
   git revert <workspace-ux-merge-commit>
   # Deploy previous version
   npm run deploy
   ```

3. **Data Rollback (if needed)**:
   - Workspace routing doesn't affect data persistence
   - Asset model changes are backward compatible
   - No database rollback required

---

## 📈 **Success Metrics & KPIs**

### **Technical Metrics** (Measurable within 1 week)

- **Zero Breaking Changes**: All existing functionality preserved
- **Bundle Size Impact**: < 5% increase from new components
- **Performance Impact**: < 100ms additional load time per tool page
- **Test Coverage**: > 85% coverage for all new components
- **Accessibility**: Maintain WCAG 2.1 AA compliance score

### **User Experience Metrics** (Measurable within 4 weeks)

- **Workflow Completion Rate**: +40% increase in cross-tool usage sessions
- **Asset Reuse Rate**: +60% increase in assets used across multiple generations
- **Tool Discovery Rate**: +80% increase in users trying new tools via recommendations
- **User Retention**: +25% increase in workspace revisit rate within 7 days
- **Task Completion Time**: -20% reduction in time to complete multi-tool workflows

### **Business Metrics** (Measurable within 8 weeks)

- **Feature Adoption**: 70% of active users engaging with workspace features
- **User Satisfaction**: >4.5/5 rating on workspace UX feedback surveys
- **Support Tickets**: <10% increase in UX-related support requests
- **User Onboarding**: -30% reduction in time to first successful generation for new users

### **Measurement Plan**

1. **Week 1-2**: Technical metrics validation, performance benchmarking
2. **Week 3-4**: User behavior analytics, A/B testing analysis  
3. **Week 5-8**: Business impact assessment, user satisfaction surveys
4. **Ongoing**: Continuous monitoring and iterative improvements

---

## 📝 **Implementation Checklist**

### **Pre-Implementation**
- [ ] Review and approve plan with stakeholders
- [ ] Set up feature flags and deployment pipeline
- [ ] Create development branch: `feat/workspace-centric-ux`
- [ ] Brief team on architecture and timeline

### **During Implementation**  
- [ ] Daily standups to track progress and blockers
- [ ] Code reviews for all architectural changes
- [ ] Regular testing and QA checkpoints
- [ ] User feedback collection from beta testers

### **Post-Implementation**
- [ ] Gradual rollout with monitoring
- [ ] User onboarding and documentation updates  
- [ ] Performance monitoring and optimization
- [ ] Collect user feedback and iterate

---

## 🎯 **Conclusion**

This implementation plan transforms the application from tool-centric silos to a collaborative workspace-centric paradigm that:

1. **Empowers Knowledge Building**: Assets persist and accumulate across tool usage
2. **Enhances Workflow Continuity**: Cross-tool workflows become visible and guided  
3. **Improves User Experience**: Contextual recommendations and quality guidance
4. **Maintains Backward Compatibility**: Existing functionality preserved during transition
5. **Enables Future Growth**: Foundation for advanced collaborative features

**Status: ALL PHASES COMPLETED** (2026-07-17)

- Phase 1: Foundation Infrastructure ✅
- Phase 2A: Workspace Context ✅
- Phase 2B: Asset Knowledge ✅
- Phase 3: Dashboard & Navigation ✅
- Phase 4: Cross-Tool Integration ✅
- Phase 5: Integration & Polish ✅ (includes asset→prompt injection wiring)

The plan balances **ambition with pragmatism**, providing a clear path to workspace-centric UX while maintaining system stability and user experience continuity.

**Next Steps**: 
1. Stakeholder review and approval
2. Resource allocation and timeline confirmation  
3. Begin Phase 1 implementation with foundation infrastructure
4. Establish monitoring and feedback loops for iterative improvement

---

*This plan represents a comprehensive transformation that will position the application for scalable, user-centric growth while maintaining technical excellence and user experience standards.*