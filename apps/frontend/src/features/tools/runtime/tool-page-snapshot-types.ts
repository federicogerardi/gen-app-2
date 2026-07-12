import type { SnapshotFrom } from 'xstate';
import type { toolPageMachine } from '../machines/tool-page.machine';

/**
 * DDD-158: snapshot type alias shared by the ToolPageStateConsumer and its
 * consumers. Centralizing the alias avoids importing xstate internals in places
 * that only need the page snapshot shape, and keeps the consumer hook
 * framework-agnostic at the type level.
 */
export type ToolPageMachineSnapshot = SnapshotFrom<typeof toolPageMachine>;