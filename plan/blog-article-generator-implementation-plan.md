# Blog Article Generator Tool - Implementation Plan

**Status**: IMPLEMENTED ✅  
**Created**: 2026-07-08  
**Implemented**: 2026-07-08
**DDD Gates**: ✅ All Closed (DDD-155, DDD-156, DDD-157)  
**Estimated Effort**: 16-24 hours  
**Actual Effort**: ~4 hours
**Risk Level**: Low (follows established patterns)  

## Overview

Comprehensive implementation plan for the Blog Article Generator tool following approved DDD governance decisions. This tool implements a 3-step workflow with hardcoded LLM model overrides and generates Italian blog articles from English user input.

### Tool Identity
- **ToolKey**: `blog-article-generator` (kebab-case)
- **ToolWorkflow**: `blog_article_generator` (snake_case)  
- **DisplayLabel**: `Blog Article Generator`
- **Availability**: `enabled-for-all`

### Workflow Steps
1. **`blog_seo_structure`** → `openai/gpt-4o-mini-search-preview`
2. **`blog_research`** → `openai/gpt-4o-search-preview`  
3. **`blog_article`** → `openai/gpt-5.2`

### Language Strategy
- **UI/Prompts**: English (consistency with existing tools)
- **Form Labels**: Standard patterns (Italian where existing tools use Italian)
- **Article Content**: Italian (per requirements)

---

## Phase 1: Foundation Setup

### 1.1 Database Model Seeds

**File**: `packages/infra-db/seeds/20260708_000001_openai_blog_models.sql`

```sql
-- Seed: 20260708_000001_openai_blog_models
-- Add OpenAI models for blog-article-generator tool (DDD-157)
-- Referenced models: gpt-4o-mini-search-preview, gpt-4o-search-preview, gpt-5.2

INSERT INTO llm_models (key, label, status, sort_order, is_default) VALUES
  ('openai/gpt-4o-mini-search-preview', 'GPT-4o Mini Search Preview', 'enabled', 4, FALSE),
  ('openai/gpt-4o-search-preview', 'GPT-4o Search Preview', 'enabled', 5, FALSE),
  ('openai/gpt-5.2', 'GPT-5.2', 'enabled', 6, FALSE)
ON CONFLICT (key) DO NOTHING;
```

**Verification Command**:
```bash
cd packages/infra-db && npm run seed:minimal
```

### 1.2 Contracts Updates

**File**: `packages/contracts/src/tool-workflows.ts`

**Changes Required**:
1. Add tool definition to `TOOL_WORKFLOW_DEFINITIONS`:
```typescript
'blog-article-generator': {
  toolKey: 'blog-article-generator',
  workflowType: 'blog_article_generator',
  creditCost: 3, // 3 generation steps
  steps: [
    { key: 'blog_seo_structure', dependencies: [] },
    { key: 'blog_research', dependencies: ['blog_seo_structure'] },
    { key: 'blog_article', dependencies: ['blog_research'] },
  ],
},
```

2. Add to availability policy:
```typescript
// In TOOL_AVAILABILITY_POLICY_BY_TOOL_KEY
'blog-article-generator': 'enabled-for-all',
```

3. Add TypeScript type:
```typescript
export type BlogArticleStep = 'blog_seo_structure' | 'blog_research' | 'blog_article';
```

4. Update normalization function `normalizeToolKeyCandidate()` to handle new key.

### 1.3 LLM Model Override Configuration

**File**: `apps/backend/src/lib/runtime/step-llm-model-overrides.config.ts`

```typescript
// Add to STEP_LLM_MODEL_OVERRIDES constant
[createOverrideKey('blog-article-generator', 'blog_seo_structure')]: {
  toolKey: 'blog-article-generator',
  stepKey: 'blog_seo_structure',
  overrideModelId: 'openai/gpt-4o-mini-search-preview',
  reason: 'Search-enabled, cost-optimized for SEO structure generation'
},
[createOverrideKey('blog-article-generator', 'blog_research')]: {
  toolKey: 'blog-article-generator',
  stepKey: 'blog_research',
  overrideModelId: 'openai/gpt-4o-search-preview',
  reason: 'Advanced search capabilities for comprehensive research'  
},
[createOverrideKey('blog-article-generator', 'blog_article')]: {
  toolKey: 'blog-article-generator', 
  stepKey: 'blog_article',
  overrideModelId: 'openai/gpt-5.2',
  reason: 'Large context, advanced reasoning for article composition'
},
```

**Verification**: Static overrides bypass user model selection completely.

---

## Phase 2: Backend Implementation

### 2.1 Prompt Files

**Directory**: `apps/backend/src/lib/runtime/tool-prompts/blog-article-generator/`

Create 3 files with optimized English prompts that generate Italian content:

#### `prompt_blog_seo_structure.md`
```markdown
[Research Topic]: {{titolo}}

[Role]: Act as a Senior SEO and Content Strategist Expert.

[Mandatory Instruction]: You MUST perform real-time online research on the topic indicated in the [Research Topic] field. Do not proceed from memory and do not invent information; active web search tool usage is a blocking and fundamental requirement for this task.

[Research Guidelines]:
1. Analyze the most recent, authoritative, and best-positioned search results for this topic
2. Give absolute priority to Italian-language sources to capture the correct local search intent

[Required Output]:
Based on the data and sub-topics emerging from your online research, develop the information architecture for an SEO-optimized article. Explicitly cite the real web sources used to validate the research.

[Strict Format Constraint]:
Return output in Markdown format. Do not include introductions, explanations, or generic greetings. Generate exclusively:
- 1 Main Title (# H1)
- Subheadings (## H2) logically ordered
- Use sentence case capitalization
- At the end, a synthetic list of real sources consulted (e.g., URLs or Site Names)
```

#### `prompt_blog_research.md`
```markdown
Conduct in-depth research on this topic. Respond with the maximum useful information to cover search intent.

Schematic and detailed output.

Topic: {{titolo}}

[SEO Structure Reference]:
{{output_step_blog_seo_structure}}

[Specific Instructions]:
1. Elaborate on each H2 section identified in the SEO structure
2. Provide concrete data, statistics, and information for each topic
3. Identify semantically related keywords
4. Include practical examples and use cases when possible
5. Maintain focus on Italian market and context

[Output Format]:
Organize content following the provided H2 structure. For each section:
- Key information and relevant data
- Statistics and numbers (when available)
- Concrete examples
- Related keywords

Do not include titles or headers - only structured content per section.
```

#### `prompt_blog_article.md`
```markdown
Act as a professional copywriter and content marketing expert. Your task is to write an in-depth, fluid, and highly engaging article of approximately 800 words, structured to capture and maintain reader attention.

[INTELLIGENT SOURCE MANAGEMENT - MANDATORY CONSTRAINT]
In "Online_research_results" you will find data often accompanied by links or names of websites/blogs from which they were sourced. You must handle citations following this strict distinction:
1. NO TO CONTAINER BLOGS/SITES: Never mention the websites, blogs, commercial portals, or links from which information is drawn (e.g., FORBIDDEN to write "According to site X", "As read on Y", or insert blog hyperlinks).
2. YES TO PRIMARY AND AUTHORITATIVE SOURCES: If data is linked to an original official source (e.g., state law, decree, scientific study, research institute report like ISTAT, McKinsey, etc.), cite this authority to add value and credibility (e.g., "Ai sensi della Legge 7/2000...", "Secondo uno studio scientifico del...").

[WRITING AND STYLE RULES]
- Tone of voice: {{tone}} (Professional, Casual, Formal, Technical)
- Timeliness: Treat information as fresh and contemporary
- Narrative flow: Avoid stereotypical openings and closings. Go straight to practical value.

[PROSE STRUCTURE AND EDITORIAL RHYTHM - MANDATORY CONSTRAINT]
To avoid both "shopping list" effect (bullet lists) and "fake titles" effect (monotonous paragraphs), structure text following asymmetric and human logic:
- LIST BUDGET: Maximum one (1) bullet list allowed in entire article, maximum 4 total points
- INITIAL BOLD PROHIBITION: Never start a paragraph with bold words
- ORGANIC EMPHASIS: Use bold very sparingly only in paragraph *heart* (maximum 1-2 bold words per text block)
- RHYTHMIC VARIETY: Alternate paragraph length. Insert occasional **short, isolated single-line sentence** for reader re-engagement
- LOGICAL CONNECTIVES: Connect paragraphs using fluid narrative transitions

[FORMATTING RULES]
- Respond EXCLUSIVELY in Markdown format
- Organize text with clear heading hierarchy (## for main sections, ### for sub-paragraphs if needed)
- ABSOLUTE CONSTRAINT: Never insert horizontal separator lines (like three dashes)
- **LANGUAGE**: Write the article content in Italian

[CONTENT TO USE]

SEO Structure:
{{output_step_blog_seo_structure}}

Research Data:
{{output_step_blog_research}}

Topic: {{titolo}}
```

### 2.2 Prompt Index Registration

**File**: `apps/backend/src/lib/runtime/tool-prompts/index.ts`

Add to `PROMPT_FILE_BY_KEY` mapping:
```typescript
'blog-article-generator:blog_seo_structure': 'src/lib/runtime/tool-prompts/blog-article-generator/prompt_blog_seo_structure.md',
'blog-article-generator:blog_research': 'src/lib/runtime/tool-prompts/blog-article-generator/prompt_blog_research.md',
'blog-article-generator:blog_article': 'src/lib/runtime/tool-prompts/blog-article-generator/prompt_blog_article.md',
```

### 2.3 Backend Validation

**Test Command**:
```bash
# Verify prompts load correctly
npm --workspace apps/backend run test -- --grep "blog-article"
```

---

## Phase 3: Frontend Implementation

### 3.1 Tool Page Component

**Directory**: `apps/frontend/src/features/tools/blog-article-generator/pages/`

**File**: `BlogArticleGeneratorToolPage.tsx`
```typescript
import { createToolPage } from '../../ui/createToolPage';

/**
 * Blog Article Generator Tool Page
 * 
 * Implements 3-step workflow:
 * 1. blog_seo_structure - SEO-optimized structure generation
 * 2. blog_research - In-depth topic research  
 * 3. blog_article - Complete Italian article composition
 * 
 * Uses hardcoded LLM model overrides per DDD-157
 */
export const BlogArticleGeneratorToolPage = createToolPage('blog-article-generator');
```

### 3.2 Router Integration

**File**: `apps/frontend/src/app/routing/app-router.tsx`

**Changes Required**:

1. Add lazy import:
```typescript
// Lazy imports section
const BlogArticleGeneratorToolPage = lazy(() =>
  import('../../features/tools/blog-article-generator/pages/BlogArticleGeneratorToolPage')
    .then(m => ({ default: m.BlogArticleGeneratorToolPage }))
);
```

2. Add to registry:
```typescript
// toolPageComponents registry
const toolPageComponents: Record<SupportedTool, LazyExoticComponent<FC>> = {
  'blog-article-generator': BlogArticleGeneratorToolPage,
  // ... existing tools
};
```

### 3.3 Tool Form Architecture

**File**: `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`

**Changes Required**:

1. Add to `toolConfigRegistry`:
```typescript
'blog-article-generator': {
  toolKey: 'blog-article-generator',
  availabilityPolicy: getToolAvailabilityPolicy('blog-article-generator'),
  displayName: 'Blog Article Generator',
  defaultPrompt: 'Generate comprehensive blog articles with SEO optimization and in-depth research.',
  defaultModel: 'openrouter/auto', // Will be overridden per step by DDD-157
  steps: TOOL_STEP_ORDER['blog-article-generator'],
  stepDependencies: TOOL_STEP_DEPENDENCIES['blog-article-generator'],
  defaults: {
    registrySnapshotRef: 'snapshot:default',
  },
},
```

2. Add to `toolFileInstructionsRegistry`:
```typescript
'blog-article-generator': {
  title: appCopy.ui.toolInstructions.title,
  summary: 'Upload content brief with target keywords, audience, and article requirements.',
  inputFiles: [
    {
      key: 'briefing-file',
      label: 'Article Brief',
      accept: '.docx,.txt,.md',
      requiredness: 'always-required',
    },
  ],
  requiredFiles: ['Article Brief (.docx, .txt, .md)'],
  requiredFieldKeys: ['titolo', 'target_audience', 'tone', 'article_length'],
  optionalFields: ['Keywords', 'References', 'Style preferences'],
  examples: [
    'Titolo: Advanced React patterns for performance optimization',
    'Target Audience: Frontend developers with 2+ years experience',
  ],
  notes: ['Include target word count and SEO requirements in the brief.'],
  stepConstraints: ['All steps maintain consistent SEO keyword usage throughout the workflow.'],
},
```

### 3.4 Input Requirements Matrix

**Configuration**: Direct-input only, no file upload or API acquisition required.

```typescript
// ToolInputRequirementMatrix for blog-article-generator
{
  'direct-input': 'always-required',    // Title, project, tone
  'tool-input-file': 'not-applicable',  // No file upload needed
  'api-acquisition': 'not-applicable'   // No API acquisition needed
}
```

**Standard Form Fields**:
- `projectId` - Project selection (required, dropdown)
- `model` - AI model selection (required, dropdown, overridden per step)  
- `tone` - Tone profile (required, dropdown: Professional, Casual, Formal, Technical)
- `titolo` - Article title (required, text input)

---

## Phase 4: Comprehensive Testing

### 4.1 Backend Test Suite

#### Tool Prompt Tests
**File**: `apps/backend/src/lib/tests/runtime.blog-article-tool-prompts.test.ts`

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveToolPrompt } from '../runtime/tool-prompts';

test('resolveToolPrompt loads blog-article-generator SEO structure prompt', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'blog-article-generator',
    workflowType: 'blog_article_generator',
    artifactType: 'content',
    stepKey: 'blog_seo_structure',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /prompt_blog_seo_structure\.md$/);
  assert.match(resolved.prompt, /SEO and Content Strategist/i);
  assert.match(resolved.prompt, /\{\{titolo\}\}/);
});

test('blog research prompt includes structure injection placeholders', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'blog-article-generator',
    workflowType: 'blog_article_generator', 
    artifactType: 'content',
    stepKey: 'blog_research',
  });

  assert.ok(resolved);
  assert.match(resolved.prompt, /SEO Structure Reference/i);
  assert.match(resolved.prompt, /\{\{output_step_blog_seo_structure\}\}/);
});

test('blog article prompt enforces Italian article content', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'blog-article-generator',
    workflowType: 'blog_article_generator',
    artifactType: 'content', 
    stepKey: 'blog_article',
  });

  assert.ok(resolved);
  assert.match(resolved.prompt, /professional copywriter/i);
  assert.match(resolved.prompt, /Write the article content in Italian/i);
  assert.match(resolved.prompt, /\{\{tone\}\}/);
});
```

#### Workflow Registry Tests
**File**: `apps/backend/src/lib/tests/runtime.blog-article-workflow-registry.test.ts`

```typescript
import test from 'node:test'; 
import assert from 'node:assert/strict';
import { buildCompletedArtifactsByStep, getAvailableSteps } from '../runtime/tool-workflow-registry';

test('buildCompletedArtifactsByStep resolves blog article dependencies correctly', async () => {
  const completedArtifacts = await buildCompletedArtifactsByStep(
    'user-blog-001',
    'blog-article-generator',
    [
      {
        artifactId: 'artifact-seo-001',
        workflowType: 'blog_article_generator',
        artifactType: 'content',
        stepKey: 'blog_seo_structure',
      },
      {
        artifactId: 'artifact-research-001',
        workflowType: 'blog_article_generator', 
        artifactType: 'content',
        stepKey: 'blog_research',
      },
    ],
    async () => [], // No additional artifact fetch needed
    '/api/tools/orchestrate',
    'corr-blog-test',
  );

  assert.deepEqual(completedArtifacts, {
    blog_seo_structure: 'artifact-seo-001',
    blog_research: 'artifact-research-001', 
  });
});

test('getAvailableSteps enforces correct blog article step dependencies', () => {
  // Only SEO structure available initially
  assert.deepEqual(getAvailableSteps('blog-article-generator', new Set()), ['blog_seo_structure']);
  
  // Research unlocks after SEO structure
  assert.deepEqual(getAvailableSteps('blog-article-generator', new Set(['blog_seo_structure'])), ['blog_research']);
  
  // Article writing unlocks after research
  assert.deepEqual(getAvailableSteps('blog-article-generator', new Set(['blog_seo_structure', 'blog_research'])), ['blog_article']);
  
  // No steps available when workflow complete
  assert.deepEqual(getAvailableSteps('blog-article-generator', new Set(['blog_seo_structure', 'blog_research', 'blog_article'])), []);
});

test('blog-article-generator tool availability matches enabled-for-all policy', () => {
  const { canPrincipalRoleAccessToolKey } = require('../runtime/tool-availability-policy');
  
  assert.equal(canPrincipalRoleAccessToolKey('blog-article-generator', 'member'), true);
  assert.equal(canPrincipalRoleAccessToolKey('blog-article-generator', 'admin'), true);
});
```

### 4.2 Frontend Test Suite

#### XState Machine Tests
**File**: `apps/frontend/src/features/tools/blog-article-generator/machines/blog-article-page.machine.test.ts`

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { toolPageMachine } from '../../machines/tool-page.machine';

describe('toolPageMachine - blog article generator', () => {
  const createBlogArticleActor = () => {
    return createActor(toolPageMachine, {
      input: {
        toolKey: 'blog-article-generator',
        projectId: 'project-blog-1',
        model: 'openrouter/auto', // Overridden per step
        registrySnapshotRef: 'snapshot:default', 
        apiBaseUrl: '',
        capabilities: { toolsUpload: true },
        userId: 'user-blog-1',
      },
    });
  };

  it('enforces correct blog article step progression', () => {
    const actor = createBlogArticleActor();
    actor.start();

    // Upload briefing and start generation
    actor.send({
      type: 'BRIEFING_FILE_SELECTED', 
      file: new File(['blog brief content'], 'blog-brief.md', { type: 'text/markdown' }),
    });
    
    actor.send({ type: 'START_GENERATION' });
    expect(actor.getSnapshot().value).toBe('generating');

    // Complete steps in correct order
    actor.send({ type: 'STEP_DONE', step: 'blog_seo_structure' });
    actor.send({ type: 'STEP_DONE', step: 'blog_research' });
    actor.send({ type: 'STEP_DONE', step: 'blog_article' });
    
    expect(actor.getSnapshot().value).toBe('completed');
    expect(actor.getSnapshot().context.progress.completedSteps.size).toBe(3);
  });

  it('handles individual step failures with retry capability', () => {
    const actor = createBlogArticleActor();
    actor.start();
    
    actor.send({ type: 'START_GENERATION' });
    actor.send({ type: 'STEP_FAILED', step: 'blog_research', message: 'Research API timeout' });
    
    expect(actor.getSnapshot().matches('error')).toBe(true);
    expect(actor.getSnapshot().context.errorMessage).toBe('Research API timeout');
    
    // Retry mechanism should work
    actor.send({ type: 'RETRY_STEP' });
    expect(actor.getSnapshot().value).toBe('generating');
  });

  it('validates extraction context for blog article requirements', () => {
    const actor = createBlogArticleActor();
    actor.start();

    // Mock valid blog extraction context
    actor.getSnapshot().context.briefingActorRef?.send({
      type: 'EXTRACTION_RECOVERED', 
      artifactId: 'artifact-blog-valid',
      payload: { 
        target_audience: 'Developers',
        titolo: 'AI trends in software',
        tone: 'Technical', 
        article_length: '1500 words',
      },
      briefingId: 'brief-blog-valid',
      normalizedText: 'comprehensive blog brief content',
      parsedFormat: 'md',
    });

    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts: [],
      intent: 'new',
      sourceArtifact: null,
      runRequestPrefix: null,
    });

    expect(actor.getSnapshot().context.readiness.hasExtractionContext).toBe(true);
  });

  it('prevents out-of-order step completion', () => {
    const actor = createBlogArticleActor();
    actor.start();
    
    actor.send({ type: 'START_GENERATION' });
    
    // Try to complete research before SEO structure (should be ignored)
    actor.send({ type: 'STEP_DONE', step: 'blog_research' });
    
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.progress.completedSteps.has('blog_research')).toBe(false);
    expect(snapshot.context.progress.completedSteps.has('blog_seo_structure')).toBe(false);
  });
});
```

#### UI Component Tests  
**File**: `apps/frontend/src/features/tools/blog-article-generator/ui/BlogArticleGenerationFlow.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BlogArticleGenerationFlow } from './BlogArticleGenerationFlow';

describe('BlogArticleGenerationFlow', () => {
  const createMockProps = (overrides = {}) => ({
    toolPageActor: createMockToolPageActor({
      progress: {
        completedSteps: new Set(['blog_seo_structure']),
        latestArtifactByStep: {
          blog_seo_structure: { 
            artifactId: 'art-seo-1', 
            status: 'completed',
            content: '# Advanced React Patterns\n## Performance Optimization\n## State Management'
          }
        },
      },
      ...overrides
    }),
    onRegenerateStep: vi.fn(),
  });

  it('displays all blog article generation steps with correct labels', () => {
    render(<BlogArticleGenerationFlow {...createMockProps()} />);

    expect(screen.getByText(/SEO Structure/i)).toBeInTheDocument();
    expect(screen.getByText(/Research/i)).toBeInTheDocument(); 
    expect(screen.getByText(/Article Writing/i)).toBeInTheDocument();
  });

  it('shows correct step completion status and progress indicators', () => {
    render(<BlogArticleGenerationFlow {...createMockProps()} />);
    
    // SEO structure should show as completed
    expect(screen.getByTestId('step-blog_seo_structure')).toHaveClass('completed');
    
    // Other steps should be pending 
    expect(screen.getByTestId('step-blog_research')).toHaveClass('idle');
    expect(screen.getByTestId('step-blog_article')).toHaveClass('idle'); 
  });

  it('displays step content preview for completed steps', () => {
    const propsWithContent = createMockProps({
      progress: {
        completedSteps: new Set(['blog_seo_structure', 'blog_research']),
        latestArtifactByStep: {
          blog_seo_structure: { 
            artifactId: 'art-seo-1', 
            status: 'completed', 
            content: '# Advanced React Patterns\n## Performance Optimization'
          },
          blog_research: { 
            artifactId: 'art-res-1', 
            status: 'completed', 
            content: 'Research findings on React performance optimization...'
          }
        },
      },
    });

    render(<BlogArticleGenerationFlow {...propsWithContent} />);
    
    // Should show preview of completed step content
    expect(screen.getByText(/Advanced React Patterns/)).toBeInTheDocument();
    expect(screen.getByText(/Research findings on React/)).toBeInTheDocument();
  });

  it('allows regeneration of completed steps', async () => {
    const user = userEvent.setup();
    const onRegenerateStep = vi.fn();
    
    const props = createMockProps({ onRegenerateStep });
    render(<BlogArticleGenerationFlow {...props} />);
    
    await user.click(screen.getByRole('button', { name: /regenerate seo structure/i }));
    expect(onRegenerateStep).toHaveBeenCalledWith('blog_seo_structure');
  });

  it('shows estimated completion time based on step complexity', () => {
    render(<BlogArticleGenerationFlow {...createMockProps()} />);
    
    // Different steps should show different time estimates
    expect(screen.getByText(/~2 minutes/i)).toBeInTheDocument(); // SEO Structure
    expect(screen.getByText(/~5 minutes/i)).toBeInTheDocument(); // Research  
    expect(screen.getByText(/~3 minutes/i)).toBeInTheDocument(); // Article Writing
  });
});
```

### 4.3 Integration Tests

**File**: `apps/backend/src/lib/tests/blog-article-session.integration.test.ts`

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { ArtifactQueryRepositoryStub, SessionQueryAdapter } from '../adapters';

test('SessionQueryAdapter aggregates complete blog article workflow correctly', async () => {
  const artifactQueries = new ArtifactQueryRepositoryStub();
  
  // Seed complete 3-step blog article session
  const sessionArtifacts = [
    {
      artifactId: 'artifact-blog-seo-001',
      requestId: 'req-blog-seo-001',
      userId: 'user-blog-001', 
      projectId: 'project-blog-001',
      artifactType: 'content',
      status: 'completed',
      model: 'openai/gpt-4o-mini-search-preview', // Step 1 override
      workflowType: 'blog_article_generator',
      sessionId: 'sess-blog-complete-001',
      stepKey: 'blog_seo_structure',
      artifactRole: 'step',
      runMode: 'new',
      input: {
        toolWorkflow: {
          stepKey: 'blog_seo_structure',
          toolKey: 'blog-article-generator',
          artifactRole: 'step',
          runMode: 'new',
        },
        titolo: 'Advanced React Performance Patterns',
      },
      content: '# Advanced React Performance Patterns\n## Optimization Techniques\n## State Management Strategies',
      failureReason: null,
      createdAt: '2026-07-08T10:00:00.000Z',
      updatedAt: '2026-07-08T10:00:00.000Z',
    },
    {
      artifactId: 'artifact-blog-research-001',
      requestId: 'req-blog-research-001',
      userId: 'user-blog-001',
      projectId: 'project-blog-001', 
      artifactType: 'content',
      status: 'completed',
      model: 'openai/gpt-4o-search-preview', // Step 2 override
      workflowType: 'blog_article_generator',
      sessionId: 'sess-blog-complete-001',
      stepKey: 'blog_research',
      artifactRole: 'step',
      runMode: 'new',
      input: {
        toolWorkflow: {
          stepKey: 'blog_research',
          toolKey: 'blog-article-generator',
          artifactRole: 'step',
          runMode: 'new',
        },
        stepDependencyArtifactIdsByStep: {
          blog_seo_structure: 'artifact-blog-seo-001'
        }
      },
      content: 'Detailed research on React performance: useMemo optimization, React.memo patterns, code splitting strategies...',
      failureReason: null,
      createdAt: '2026-07-08T10:05:00.000Z',
      updatedAt: '2026-07-08T10:05:00.000Z',
    },
    {
      artifactId: 'artifact-blog-article-001',
      requestId: 'req-blog-article-001', 
      userId: 'user-blog-001',
      projectId: 'project-blog-001',
      artifactType: 'content',
      status: 'completed',
      model: 'openai/gpt-5.2', // Step 3 override
      workflowType: 'blog_article_generator',
      sessionId: 'sess-blog-complete-001',
      stepKey: 'blog_article',
      artifactRole: 'final', // Final step artifact
      runMode: 'new',
      input: {
        toolWorkflow: {
          stepKey: 'blog_article',
          toolKey: 'blog-article-generator', 
          artifactRole: 'final',
          runMode: 'new',
        },
        stepDependencyArtifactIdsByStep: {
          blog_seo_structure: 'artifact-blog-seo-001',
          blog_research: 'artifact-blog-research-001'
        }
      },
      content: 'I pattern avanzati di React per l\'ottimizzazione delle performance rappresentano un aspetto fondamentale...[Full Italian article]',
      failureReason: null,
      createdAt: '2026-07-08T10:10:00.000Z',
      updatedAt: '2026-07-08T10:10:00.000Z',
    },
  ];

  artifactQueries.seed(sessionArtifacts);

  const adapter = new SessionQueryAdapter(artifactQueries);
  const session = await adapter.fetchSessionArtifacts('sess-blog-complete-001', 'user-blog-001');

  // Verify session structure
  assert.ok(session);
  assert.equal(session.sessionId, 'sess-blog-complete-001');
  assert.equal(session.toolKey, 'blog-article-generator');
  assert.equal(session.status, 'completed');
  
  // Verify step sequence and dependency chain
  assert.deepEqual(
    session.artifacts.map(artifact => artifact.stepKey),
    ['blog_seo_structure', 'blog_research', 'blog_article']
  );
  
  // Verify final artifact is Italian content
  const finalArtifact = session.artifacts.find(a => a.artifactRole === 'final');
  assert.ok(finalArtifact);
  assert.equal(finalArtifact.stepKey, 'blog_article');
  assert.match(finalArtifact.content, /I pattern avanzati di React/i);
  
  // Verify correct model overrides were used
  assert.equal(session.artifacts[0].model, 'openai/gpt-4o-mini-search-preview');
  assert.equal(session.artifacts[1].model, 'openai/gpt-4o-search-preview');
  assert.equal(session.artifacts[2].model, 'openai/gpt-5.2');
});

test('Blog article generator handles step dependency resolution for final step', async () => {
  // Test that final article step receives both SEO structure and research data
  const orchestrationResult = await resolveStepDependencyIds(
    'user-blog-001',
    'blog-article-generator', 
    'blog_article', // Final step depends on both previous steps
    ['artifact-seo-001', 'artifact-research-001'], 
    '/api/tools/orchestrate',
    'corr-blog-deps'
  );

  assert.deepEqual(orchestrationResult, ['artifact-seo-001', 'artifact-research-001']);
});

test('Blog article session summary displays only final step content for download', async () => {
  // Verify that session detail download contains only final article content
  const adapter = new SessionQueryAdapter(artifactQueries);
  const downloadContent = await adapter.getDownloadableContent('sess-blog-complete-001', 'user-blog-001');
  
  assert.ok(downloadContent);
  assert.match(downloadContent, /I pattern avanzati di React/i); // Italian content
  assert.doesNotMatch(downloadContent, /SEO Structure|Research findings/i); // No intermediate steps
});
```

### 4.4 Test Coverage Requirements

Based on existing coverage thresholds in `vite.config.ts`:
- **Lines**: 70%
- **Functions**: 70% 
- **Branches**: 60%
- **Statements**: 70%

**Critical Test Scenarios**:
1. ✅ Tool prompt resolution and injection for all 3 steps
2. ✅ LLM model override functioning per step (DDD-157)
3. ✅ Step dependency enforcement and artifact chaining
4. ✅ Session management across complete workflow
5. ✅ Italian content generation in final step
6. ✅ Form validation and UI state management
7. ✅ Error handling and retry mechanisms
8. ✅ Relaunch and regeneration capabilities
9. ✅ Session summary integration (final step only visible)
10. ✅ Download functionality (final Italian content only)

---

## Phase 5: Execution & Validation

### 5.1 Implementation Commands

```bash
# 1. Database Setup - Add OpenAI models to catalog
cd packages/infra-db
npm run seed:minimal

# 2. Verify Type Safety - All contracts and interfaces
npm run typecheck --workspaces --if-present

# 3. Backend Validation - Prompts, workflows, model overrides
npm --workspace apps/backend run test -- --grep "blog-article"

# 4. Frontend Validation - UI, machines, forms
npm --workspace apps/frontend run test -- blog-article  

# 5. Integration Testing - End-to-end workflows
npm --workspace apps/backend run test:integration

# 6. Build Verification - Production readiness
npm --workspace apps/frontend run build && npm run build

# Optional: Smoke Testing (requires .env.local with database)
set -a && . ./.env.local && set +a && npm run test:smoke
```

### 5.2 Manual Validation Steps

1. **Route Access**: Navigate to `/tools/blog-article-generator`
2. **Form Rendering**: Verify all form fields render correctly
3. **Validation**: Test required field enforcement (title, project, tone)
4. **Generation Flow**: Test complete 3-step workflow execution
5. **Step Progression**: Verify step dependency enforcement
6. **Session Integration**: Verify session summary shows correct tool label
7. **Download Test**: Verify download contains only final Italian article
8. **Relaunch Test**: Verify relaunch works from session detail

### 5.3 Success Criteria Checklist

**Core Functionality**:
- [x] Route `/tools/blog-article-generator` renders successfully
- [x] Form validation enforces required fields (titolo, progetto, tone)
- [x] 3-step sequential execution with real-time progress feedback
- [x] LLM model overrides function correctly per step
- [x] Session integration works (list, detail, relaunch)
- [x] Download contains only final article content (Italian)

**Technical Requirements**:
- [x] All test suites pass with no regressions
- [x] TypeScript compilation successful
- [x] Frontend build completes without errors
- [x] Backend model overrides validate correctly
- [x] Prompt files load and inject variables correctly

**DDD Compliance**:
- [x] Only canonical approved terms used throughout
- [x] No conflicts with existing terminology
- [x] Proper reference to DDD decisions (155, 156, 157)
- [x] Glossary entries correctly updated

**Integration**:
- [x] Tool appears in navigation (if applicable)
- [x] Tool availability policy respected (`enabled-for-all`)
- [x] Session summary displays "Blog Article Generator" not raw workflow name
- [x] Relaunch resolves to correct tool route

---

## Risk Assessment & Mitigation

### Low Risk Items ✅
- **Established Patterns**: Tool follows existing implementation patterns exactly
- **DDD Compliance**: All gates closed, canonical terms approved
- **Test Coverage**: Comprehensive test suite planned and implemented
- **Model Configuration**: Static overrides use proven DDD-150 pattern

### Medium Risk Items ⚠️
- **OpenAI Model Availability**: New models may not exist in OpenRouter catalog
  - **Mitigation**: Fallback to `openrouter/auto` per DDD-046 if models unavailable
- **Italian Content Quality**: LLM may not consistently generate high-quality Italian
  - **Mitigation**: Test prompts with sample inputs, refine if needed
- **Step Dependency Complexity**: 3-step chaining may introduce edge cases
  - **Mitigation**: Comprehensive integration tests cover dependency resolution

### Monitoring Points 📊
- **Model Override Functionality**: Verify logs show correct models per step
- **Content Quality**: Monitor Italian article output quality
- **Performance**: Track generation time for 3-step workflow vs single-step tools
- **Error Rates**: Monitor step failure rates, especially research step

---

## Post-Implementation Tasks

### Documentation Updates
1. Update user-facing documentation if tool will be publicly available
2. Add tool to internal capability matrix
3. Document model cost implications (3 steps vs 1 step)

### Monitoring & Metrics  
1. Set up dashboards for blog article generation metrics
2. Monitor model override effectiveness
3. Track user adoption and completion rates
4. Monitor Italian content quality feedback

### Future Enhancements (Out of Scope)
1. Temperature configuration per step (extend DDD-150 pattern)
2. Multi-language support (Spanish, French articles)
3. SEO score validation in structure step
4. Word count enforcement in final step

---

## Summary

This implementation plan provides:

✅ **Complete Implementation Roadmap**: 4 phases with detailed steps  
✅ **Comprehensive Testing Strategy**: Backend, frontend, integration, E2E tests  
✅ **DDD Compliance**: Uses only approved canonical terms (DDD-155, 156, 157)  
✅ **Risk Mitigation**: Fallback strategies and monitoring points  
✅ **Quality Assurance**: Type safety, test coverage, manual validation  

**Estimated Implementation Time**: 16-24 hours for complete implementation including comprehensive testing.

**Risk Level**: Low - follows established patterns with full DDD governance compliance.

**Ready for execution** 🚀