import { assign, setup } from 'xstate';

import type {
  AuthFailEvent,
  AuthOkEvent,
  RequestReceivedEvent,
  UsageGrantedEvent,
  UsageRejectedEvent,
  ValidationFailEvent,
  ValidationOkEvent,
} from '../types/xstate';

type GatewayMachineContext = {
  requestId: string;
  userId: string | null;
  projectId: string | null;
  workflowType: string | null;
  failureReason: string | null;
};

type GatewayMachineInput = {
  requestId?: string;
};

type RequestMetaParams = {
  requestId: string;
  projectId: string;
  workflowType: string | null;
};

type GatewayMachineEvent =
  | RequestReceivedEvent
  | AuthOkEvent
  | AuthFailEvent
  | ValidationOkEvent
  | ValidationFailEvent
  | UsageGrantedEvent
  | UsageRejectedEvent
  | { type: 'MODEL_AVAILABLE' }
  | { type: 'MODEL_UNAVAILABLE' }
  | { type: 'OWNERSHIP_OK' }
  | { type: 'OWNERSHIP_FAIL' }
  | { type: 'RESET' };

export const requestGatewayMachine = setup({
  types: {
    context: {} as GatewayMachineContext,
    input: {} as GatewayMachineInput,
    events: {} as GatewayMachineEvent,
  },
  actions: {
    cacheRequestMeta: assign({
      requestId: (_, params: RequestMetaParams) => params.requestId,
      projectId: (_, params: RequestMetaParams) => params.projectId,
      workflowType: (_, params: RequestMetaParams) => params.workflowType,
      failureReason: null,
    }),
    setUserId: assign({
      userId: (_, params: { userId: string }) => params.userId,
    }),
    setWorkflowType: assign({
      workflowType: (_, params: { workflowType: string | null }) => params.workflowType,
    }),
    setFailureReason: assign({
      failureReason: (_, params: { reason: string }) => params.reason,
    }),
    resetVolatileContext: assign({
      requestId: '',
      userId: null,
      projectId: null,
      workflowType: null,
      failureReason: null,
    }),
  },
}).createMachine({
  id: 'requestGatewayMachine',
  initial: 'idle',
  context: ({ input }) => ({
    requestId: input.requestId ?? '',
    userId: null,
    projectId: null,
    workflowType: null,
    failureReason: null,
  }),
  states: {
    idle: {
      on: {
        REQUEST_RECEIVED: {
          target: 'auth',
          actions: {
            type: 'cacheRequestMeta',
            params: ({ event }) => ({
              requestId: event.requestId,
              projectId: event.projectId,
              workflowType: event.workflowType ?? null,
            }),
          },
        },
      },
    },
    auth: {
      on: {
        AUTH_OK: {
          target: 'validate',
          actions: {
            type: 'setUserId',
            params: ({ event }) => ({ userId: event.userId }),
          },
        },
        AUTH_FAIL: {
          target: 'failed',
          actions: {
            type: 'setFailureReason',
            params: { reason: 'unauthorized' },
          },
        },
      },
    },
    validate: {
      on: {
        VALIDATION_OK: {
          target: 'preflight.modelCheck',
          actions: {
            type: 'setWorkflowType',
            params: ({ event }) => ({ workflowType: event.workflowType ?? null }),
          },
        },
        VALIDATION_FAIL: {
          target: 'failed',
          actions: {
            type: 'setFailureReason',
            params: ({ event }) => ({ reason: event.reason }),
          },
        },
      },
    },
    preflight: {
      initial: 'modelCheck',
      states: {
        modelCheck: {
          on: {
            MODEL_AVAILABLE: 'usageCheck',
            MODEL_UNAVAILABLE: {
              target: '#requestGatewayMachine.failed',
              actions: {
                type: 'setFailureReason',
                params: { reason: 'model_unavailable' },
              },
            },
          },
        },
        usageCheck: {
          on: {
            USAGE_GRANTED: 'ownershipCheck',
            USAGE_REJECTED: {
              target: '#requestGatewayMachine.failed',
              actions: {
                type: 'setFailureReason',
                params: ({ event }) => ({ reason: event.reason }),
              },
            },
          },
        },
        ownershipCheck: {
          on: {
            OWNERSHIP_OK: '#requestGatewayMachine.ready',
            OWNERSHIP_FAIL: {
              target: '#requestGatewayMachine.failed',
              actions: {
                type: 'setFailureReason',
                params: { reason: 'ownership_mismatch' },
              },
            },
          },
        },
      },
    },
    ready: {
      on: {
        RESET: {
          target: 'idle',
          reenter: true,
          actions: 'resetVolatileContext',
        },
      },
    },
    failed: {
      on: {
        RESET: {
          target: 'idle',
          reenter: true,
          actions: 'resetVolatileContext',
        },
      },
    },
  },
});
