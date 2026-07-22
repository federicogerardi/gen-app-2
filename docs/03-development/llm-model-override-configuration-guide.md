---
status: active
version: 1.0
date_created: 2026-07-07
last-reviewed: 2026-07-07
next-review-date: 2026-10-07
owner: Backend Runtime
type: development-guide
tags: [llm-models, override, configuration, development]
---

# LLM Model Override Configuration Guide

## Overview

The LLM Model Step Override System enables per-step model configuration for tools. When configured, overrides take precedence over user-selected models during generation while maintaining full backward compatibility.

**Key Concepts:**
- **Static Configuration**: Overrides are defined in code and validated at startup
- **Precedence Rules**: Override → User Selection → System Default (`openrouter/auto`)
- **Zero User Impact**: Overrides are invisible to users during generation
- **Metadata Tracking**: Effective model is tracked in artifact metadata

## Configuration Location

All override configurations are defined in:

```
apps/backend/src/lib/runtime/step-llm-model-overrides.config.ts
```

## Configuration Format

### Basic Structure

```typescript
import { createOverrideKey } from '../types/step-llm-model-override';

export const STEP_LLM_MODEL_OVERRIDES: Record<string, StepLlmModelOverrideConfig> = {
  [createOverrideKey('tool-key', 'step-key')]: {
    toolKey: 'tool-key',
    stepKey: 'step-key',
    overrideModelId: 'openrouter/provider/model-name',
    reason: 'Optional reason for the override'
  }
} as const;
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `toolKey` | `ToolKey` | Yes | Canonical tool identifier (kebab-case) |
| `stepKey` | `string` | Yes | Step key within the tool workflow |
| `overrideModelId` | `LlmModelId` | Yes | Model to use (format: `provider/model`) |
| `reason` | `string` | No | Human-readable reason for documentation |

## Adding Overrides for a New Tool

### Step 1: Identify Tool and Steps

Check `packages/contracts/src/tool-workflows.ts` for valid tool keys and step keys:

```typescript
// Example: youtube-lf-script has these steps:
// 'pre-script-analysis', 'packaging', 'intro-structure', 
// 'body-structure', 'native-cta-embeds', 'outro-structure'
```

### Step 2: Choose Override Models

Select models from the enabled LlmModelCatalog. Valid model IDs follow the format:
- `openrouter/auto` (system default)
- `openrouter/anthropic/claude-3.5-sonnet`
- `openrouter/openai/gpt-4-turbo`
- `openrouter/meta-llama/llama-3.1-70b-instruct`

### Step 3: Add Configuration

```typescript
export const STEP_LLM_MODEL_OVERRIDES: Record<string, StepLlmModelOverrideConfig> = {
  // Example: Override extraction step for youtube-lf-script
  [createOverrideKey('youtube-lf-script', 'pre-script-analysis')]: {
    toolKey: 'youtube-lf-script',
    stepKey: 'pre-script-analysis',
    overrideModelId: 'openrouter/anthropic/claude-3.5-sonnet',
    reason: 'Superior accuracy for structured data extraction'
  },
  
  // Example: Override generation step with cost-effective model
  [createOverrideKey('youtube-lf-script', 'outro-structure')]: {
    toolKey: 'youtube-lf-script',
    stepKey: 'outro-structure',
    overrideModelId: 'openrouter/meta-llama/llama-3.1-70b-instruct',
    reason: 'Cost-effective model with good Italian support'
  }
} as const;
```

### Step 4: Validate Configuration

Run startup validation to check configuration:

```bash
npm --workspace apps/backend run typecheck
```

The server validates at startup:
- All `toolKey` values exist in canonical registry
- All `overrideModelId` values are valid format
- All `stepKey` values are non-empty strings
- Warns if override model not in enabled catalog

## Testing Checklist

Before deploying overrides:

- [ ] **TypeScript Compilation**: `npm run typecheck` passes
- [ ] **Unit Tests**: `npm --workspace apps/backend run test` passes
- [ ] **Override Resolution**: Verify override takes precedence in logs
- [ ] **Fallback Behavior**: Verify fallback when override model disabled
- [ ] **Session Display**: Verify model info shows in session detail page
- [ ] **Backward Compatibility**: Existing tools unaffected

## Monitoring

### Startup Logs

```
[startup][step-llm-model-overrides] 2 override(s) validated successfully
```

### Generation Logs

```
[gen][session-start] corr=run:req-123 model=openrouter/anthropic/claude-3.5-sonnet
```

### Session Detail Display

When overrides are active, session detail pages show:
- Effective model name
- "Override" indicator badge
- Override reason (if configured)

## Troubleshooting

### Override Not Applied

**Symptoms**: User-selected model used instead of override.

**Possible Causes**:
1. Override model disabled in LlmModelCatalog
2. Invalid toolKey or stepKey in configuration
3. Configuration not deployed

**Resolution**:
1. Check startup logs for validation warnings
2. Verify model exists in `/api/admin/models`
3. Confirm configuration file is deployed

### Startup Validation Errors

**Symptoms**: Server fails to start with override errors.

**Possible Causes**:
1. Invalid toolKey (not in canonical registry)
2. Invalid model ID format (missing `/`)
3. Empty stepKey

**Resolution**:
1. Check `packages/contracts/src/tool-workflows.ts` for valid tool keys
2. Ensure model ID follows `provider/model` format
3. Verify stepKey is non-empty string

### Model Not in Catalog

**Symptoms**: Warning about override model not found.

**Resolution**:
1. Add model to LlmModelCatalog via admin API
2. Or update override to use existing enabled model

## Performance

- **Resolution Time**: < 10ms (in-memory lookup)
- **Memory Impact**: < 1MB for configuration
- **Startup Validation**: One-time check at server start

## Governance

Override configurations are governed through standard code review:

1. **Add Override**: Create PR with configuration changes
2. **Review**: Team reviews model selection and reasoning
3. **Deploy**: Merge and deploy with standard release process
4. **Monitor**: Verify logs and session displays

## References

- **DDD-150**: StepLlmModelOverrideConfig (Value Object)
- **DDD-151**: StepLlmModelResolver (Domain Service)
- **DDD-152**: EffectiveModelResolution (Value Object)
- **Proposal**: `docs/02-design/llm-model-step-override-proposal.md`
- **Plan**: `../99-lifecycle/99-archive/plans/feature-llm-model-step-override-system-1.md`
