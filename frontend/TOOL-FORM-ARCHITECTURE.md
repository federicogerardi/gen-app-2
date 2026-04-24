# Tool Form Architecture - Centralized & Scalable

**Goal**: Single source of truth for multi-step tool forms. Add new tools with minimal code duplication.

## Architecture Layers

### 1. **Configuration Layer** (`tool-form-architecture.ts`)

Declarative tool definitions with zero coupling:

```typescript
export const toolFormRegistry: Record<SupportedTool, ToolFormConfig> = {
  'funnel-pages': {
    toolKey: 'funnel-pages',
    defaultPrompt: 'Genera lo step Funnel...',
    steps: ['optin', 'quiz', 'vsl'],
    stepDependencies: { optin: [], quiz: ['optin'], vsl: ['optin', 'quiz'] },
  },
  nextland: {
    toolKey: 'nextland',
    defaultPrompt: 'Genera lo step Nextland...',
    steps: ['landing', 'thank_you'],
    stepDependencies: { landing: [], thank_you: ['landing'] },
  },
};
```

**To add a new tool**:
1. Add entry to `toolFormRegistry`
2. Define steps and dependencies
3. Set default values

### 2. **Business Logic Layer** (`useToolForm.ts`)

Reusable hooks extracted from page components:

```typescript
// Load projects once, use everywhere
const { projects, loading, error } = useProjectsLoader();

// Handle briefing upload + extraction
const { fileName, status, handleFileSelected } = useBriefingUpload(toolKey, projectId);

// Manage step selection with dependency logic
const { selectedSteps, availableSteps, toggleStep } = useStepSelection(toolKey, artifacts);

// Init form with tool defaults
const { formState, config, validation } = useToolFormInit(toolKey);
```

### 3. **Presentation Layer** (`ToolFormComponents.tsx`)

Pure, reusable form sections:

```typescript
<ProjectSelector
  projectId={projectId}
  onChange={setProjectId}
  projects={projects}
  loading={loading}
  error={error}
  disabled={generation.isStreamActive}
/>

<BriefingUpload
  fileName={fileName}
  error={uploadError}
  status={briefingStatus}
  onFileSelected={handleFileSelected}
  disabled={!projectId}
/>

<GenerationInputs
  model={model}
  onModelChange={setModel}
  registrySnapshotRef={registrySnapshotRef}
  onRegistryRefChange={setRegistrySnapshotRef}
  prompt={prompt}
  onPromptChange={setPrompt}
  disabled={disabled}
/>

<StepSelector
  config={config}
  selectedSteps={selectedSteps}
  completedSteps={completedSteps}
  availableSteps={availableSteps}
  onToggleStep={toggleStep}
  disabled={disabled}
/>
```

### 4. **Page Layer** (Tool pages)

Pages compose hooks + components (minimal code):

```typescript
// FunnelPagesToolPage.tsx (NEW - 50 LOC instead of 300)
export const FunnelPagesToolPage = () => {
  const { formState, config, validation } = useToolFormInit('funnel-pages');
  const { projects, loading, error } = useProjectsLoader();
  const briefing = useBriefingUpload('funnel-pages', formState.projectId);
  const steps = useStepSelection('funnel-pages', artifacts);
  
  return (
    <form onSubmit={handleSubmit}>
      <ProjectSelector {...} />
      <BriefingUpload {...} />
      <GenerationInputs {...} />
      <StepSelector {...} />
    </form>
  );
};
```

## Scaling to N Tools

### Before (Duplicated)
- FunnelPagesToolPage: 300 LOC
- NextlandToolPage: 300 LOC
- Total duplication: ~600 LOC

### After (Centralized)
- `tool-form-architecture.ts`: 150 LOC (config + utilities)
- `useToolForm.ts`: 250 LOC (hooks, once)
- `ToolFormComponents.tsx`: 200 LOC (components, once)
- Each new tool page: **50-80 LOC** (compose existing pieces)

### Adding Tool #3

```typescript
// 1. Register in toolFormRegistry
export const toolFormRegistry = {
  'funnel-pages': { ... },
  nextland: { ... },
  'my-new-tool': {
    toolKey: 'my-new-tool',
    displayName: 'My New Tool',
    defaultPrompt: 'Custom prompt...',
    steps: ['step1', 'step2'],
    stepDependencies: { step1: [], step2: ['step1'] },
    defaults: { registrySnapshotRef: 'snapshot:v2' },
  },
};

// 2. Create page component (50 LOC)
export const MyNewToolPage = () => {
  const { formState, config } = useToolFormInit('my-new-tool');
  const projects = useProjectsLoader();
  const briefing = useBriefingUpload('my-new-tool', formState.projectId);
  const steps = useStepSelection('my-new-tool', artifacts);
  
  return (
    <form>
      <ProjectSelector {...} />
      <BriefingUpload {...} />
      <GenerationInputs {...} />
      <StepSelector {...} />
    </form>
  );
};
```

Done! Zero duplication, full feature parity.

## Benefits

| Aspect | Before | After |
|--------|--------|-------|
| Code per tool page | 300 LOC | 50-80 LOC |
| Duplication | 100% | ~5% |
| Time to add tool | 2-3 hours | 15 mins |
| Bug fixes | Apply N times | Apply once in hooks |
| Feature consistency | Manual sync | Automatic (shared hooks) |
| Type safety | Per-file | Registry-enforced |

## Migration Path

### Phase 1: Setup (today)
- Create `tool-form-architecture.ts` ✅
- Create `useToolForm.ts` hooks ✅
- Create `ToolFormComponents.tsx` ✅
- Register existing tools in `toolFormRegistry` ✅

### Phase 2: Refactor (next sprint)
- Extract `FunnelPagesToolPage` → use hooks + components
- Extract `NextlandToolPage` → use hooks + components
- Delete duplicated code

### Phase 3: Expansion (future)
- Add new tools with minimal code
- All share form infrastructure

## Testing Strategy

```typescript
// Test config loading
it('loads tool config by key', () => {
  const config = getToolFormConfig('funnel-pages');
  expect(config.steps).toEqual(['optin', 'quiz', 'vsl']);
});

// Test step dependency logic
it('calculates available steps', () => {
  const available = getAvailableSteps('funnel-pages', new Set(['optin']));
  expect(available).toContain('quiz'); // quiz depends on optin
  expect(available).not.toContain('vsl'); // vsl needs both
});

// Test form validation
it('validates required fields', () => {
  const validation = validateToolForm({
    projectId: '',
    prompt: 'test',
    briefingFileName: null,
    selectedSteps: new Set(),
  });
  expect(validation.isValid).toBe(false);
  expect(validation.errors.projectId).toBeDefined();
});
```

---

**Status**: Architecture defined and ready for Phase 2 refactor  
**Files**:
- `src/features/tools/runtime/tool-form-architecture.ts`
- `src/features/tools/runtime/useToolForm.ts`
- `src/features/tools/ui/ToolFormComponents.tsx`
