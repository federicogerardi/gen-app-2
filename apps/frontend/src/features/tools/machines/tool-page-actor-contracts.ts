// DDD-163: Typed contracts at XState actor boundaries

import type { BriefingUploadEvent } from './briefing-upload.machine';
import type { GenerationLifecycleEvent } from './generation-lifecycle.machine';

/** Events tool-page-machine sends TO briefingActor */
export type BriefingActorInputEvent = Extract<
  BriefingUploadEvent,
  | { type: 'FILE_SELECTED' }
  | { type: 'EXTRACTION_REQUESTED' }
  | { type: 'RESET' }
  | { type: 'INPUT_SYNCED' }
  | { type: 'EXTRACTION_RECOVERED' }
>;

/** Events tool-page-machine sends TO generationLifecycleActor */
export type GenerationLifecycleInputEvent = Extract<
  GenerationLifecycleEvent,
  | { type: 'STEP_DONE' }
  | { type: 'STEP_FAILED' }
  | { type: 'RETRY_STEP' }
  | { type: 'CANCEL' }
>;
