import type { Snapshot } from 'xstate';
import { createComponentLogger, LogComponent } from './log-components';

const inspectorLog = createComponentLogger(LogComponent.ACTOR_INSPECTOR);

export type InspectorOptions = {
  maxDepth?: number;
  showContext?: boolean;
};

type AnyActor = {
  getSnapshot: () => Snapshot<unknown>;
};

export const inspectActor = (
  actor: AnyActor,
  options: InspectorOptions = {},
): string => {
  const snapshot = actor.getSnapshot();
  const lines = walkSnapshot(snapshot, '', options, 0);
  return lines.join('\n');
};

const getMachineId = (snapshot: Snapshot<unknown>): string | undefined => {
  const meta = (snapshot as Record<string, unknown>).machine;
  if (meta && typeof meta === 'object') {
    return (meta as Record<string, unknown>).id as string | undefined;
  }
  return undefined;
};

const getValueString = (snapshot: Snapshot<unknown>): string => {
  const value = (snapshot as Record<string, unknown>).value;
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}:${String(v)}`)
      .join(',');
  }
  return String(value);
};

const walkSnapshot = (
  snapshot: Snapshot<unknown>,
  prefix: string,
  options: InspectorOptions,
  depth: number,
): string[] => {
  const { maxDepth = 3, showContext = false } = options;

  const machineId = getMachineId(snapshot) ?? 'unknown';
  const valueStr = getValueString(snapshot);
  const lines: string[] = [];

  lines.push(`${prefix}${machineId}: ${valueStr}`);

  if (showContext) {
    const ctx = (snapshot as Record<string, unknown>).context;
    if (ctx !== undefined) {
      lines.push(`${prefix}  [context: ${JSON.stringify(ctx).slice(0, 200)}]`);
    }
  }

  const stepStates = (snapshot as Record<string, unknown>).context as Record<string, unknown> | undefined;
  if (stepStates?.stepStates && Array.isArray(stepStates.stepStates)) {
    for (const step of stepStates.stepStates as Array<Record<string, unknown>>) {
      const status = step.status;
      if (status === 'done') {
        lines.push(`${prefix}  ✅ ${step.key}: done`);
      } else if (status === 'running') {
        lines.push(`${prefix}  ⏳ ${step.key}: running`);
      } else if (status === 'error') {
        lines.push(`${prefix}  ❌ ${step.key}: error (${step.errorMessage ?? 'unknown'})`);
      } else if (status === 'skipped') {
        lines.push(`${prefix}  ⏭️  ${step.key}: skipped`);
      } else {
        lines.push(`${prefix}  ⬜ ${step.key}: ${String(status)}`);
      }
    }
  }

  if (depth < maxDepth) {
    const children = (snapshot as Record<string, unknown>).children as
      | Record<string, AnyActor>
      | undefined;

    if (children && typeof children === 'object') {
      const entries = Object.entries(children);
      for (let i = 0; i < entries.length; i++) {
        const [key, childActor] = entries[i]!;
        const isLast = i === entries.length - 1;
        try {
          const childSnapshot = childActor.getSnapshot();
          const childPrefix = isLast ? `${prefix}  └── ` : `${prefix}  ├── `;
          lines.push(...walkSnapshot(childSnapshot, childPrefix, options, depth + 1));
        } catch {
          lines.push(`${prefix}  ├── ${key}: [unavailable]`);
        }
      }
    }
  } else if (depth >= maxDepth) {
    const children = (snapshot as Record<string, unknown>).children;
    if (children && typeof children === 'object' && Object.keys(children).length > 0) {
      lines.push(`${prefix}  ... (max depth reached)`);
    }
  }

  return lines;
};

export const logActorState = (
  actor: AnyActor,
  correlationId: string,
): void => {
  const tree = inspectActor(actor, { maxDepth: 2 });
  inspectorLog.info({ correlationId, actorTree: tree }, 'actor state snapshot');
};
