/**
 * Re-export shim for canonical UI-state types used across tools/ui components.
 * Import directly from `../../generation/ui/tool-ux-state` for new code.
 *
 * Sprint 4 / TASK-014: removed deprecated `ToolUiDerivationInput`, `ToolUiDerivationOutput`,
 * and `deriveCanonicalToolUiState` overload — last consumer (`useToolUiState`) deleted in TASK-013.
 * Canonical state is now derived exclusively by `toolPageMachine.context.viewModel`.
 */

import type {
  CanonicalToolUiState,
  PrimaryActionPolicy,
  SecondaryActionFlags,
} from '../../generation/ui/tool-ux-state';

export type { CanonicalToolUiState, PrimaryActionPolicy, SecondaryActionFlags };

export { derivePrimaryActionLabel } from '../../generation/ui/tool-ux-state';

