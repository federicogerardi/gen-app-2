---
applyTo: "docs/**/*.md"
description: "Template instruction for maintaining a consistent Ubiquitous Language across project documentation."
---

# Domain Ubiquitous Language Template

## Purpose
- Keep domain terminology consistent across all documentation under `docs/`.
- Ensure the same concept is always named with one canonical term.

## Minimal Rules
- Define one canonical term per concept before editing docs.
- Reuse canonical terms in all sections, headings, and tables.
- If synonyms exist, keep one canonical term and list others as aliases once.
- Prefer business/domain terms over technical implementation jargon in user-facing docs.
- Mark uncertain terms as `provisional` until confirmed.

## Required Output Conventions
- Write final domain artifacts in English.
- Keep definitions concise, unambiguous, and system-specific.
- Include source evidence (file path + line) when introducing or changing a canonical term.

## Integration Checklist
- Update glossary sections first (if present), then propagate term changes to related docs.
- Ensure `docs/index-overview.md` points to any newly added domain document.
- Avoid duplicate glossary files; extend existing domain docs whenever possible.
