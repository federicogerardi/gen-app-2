# API Service Function Naming Migration Plan

## Overview
The `resolveApiServiceForAcquisition` function was originally named for acquisition workflow steps, but it actually works for any workflow step type. To improve semantic clarity, we have added better-named aliases.

## Recommended Migration Path

### For New Code
- Use `resolveApiServiceById` for generic/neutral contexts
- Use `resolveApiServiceForCrawling` for crawling-specific contexts  
- Avoid `resolveApiServiceForAcquisition` in new code

### For Existing Code
- `resolveApiServiceForAcquisition` remains fully supported for backward compatibility
- No breaking changes will be introduced
- Migration to semantic aliases is optional but recommended

## Function Equivalency
All three functions are identical in behavior:
- `resolveApiServiceForAcquisition` (original, preserved for compatibility)
- `resolveApiServiceById` (semantically neutral)
- `resolveApiServiceForCrawling` (semantically clear for crawling contexts)

## Timeline
- **Current**: All functions available, no deprecation warnings
- **Future**: Consider soft deprecation with JSDoc notices (non-breaking)
- **Long-term**: `resolveApiServiceForAcquisition` will remain available indefinitely for compatibility

## Related
- BLOCKER-003 resolution in `refactor-api-service-ddd-blocker-removal-1.md`
- DDD semantic naming principles