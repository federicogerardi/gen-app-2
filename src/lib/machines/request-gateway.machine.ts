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
      requestId: ({ event, context }) =>
        event.type === 'REQUEST_RECEIVED' ? event.requestId : context.requestId,
      projectId: ({ event, context }) =>
        event.type === 'REQUEST_RECEIVED' ? event.projectId : context.projectId,
      workflowType: ({ event, context }) =>
        event.type === 'REQUEST_RECEIVED' ? event.workflowType ?? null : context.workflowType,
      failureReason: null,
    }),
    setUserId: assign({
      userId: ({ event, context }) => (event.type === 'AUTH_OK' ? event.userId : context.userId),
    }),
    setWorkflowType: assign({
      workflowType: ({ event, context }) =>
        event.type === 'VALIDATION_OK' ? event.workflowType ?? null : context.workflowType,
    }),
    setFailureReason: assign({
      failureReason: ({ event }) => {
        if (event.type === 'VALIDATION_FAIL') {
          return event.reason;
        }
        if (event.type === 'AUTH_FAIL') {
          return 'unauthorized';
        }
        if (event.type === 'MODEL_UNAVAILABLE') {
          return 'model_unavailable';
        }
        if (event.type === 'USAGE_REJECTED') {
          return event.reason;
        }
        if (event.type === 'OWNERSHIP_FAIL') {
          return 'ownership_mismatch';
        }
        return 'gateway_failed';
      },
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
          actions: 'cacheRequestMeta',
        },
      },
    },
    auth: {
      on: {
        AUTH_OK: {
          target: 'validate',
          actions: 'setUserId',
        },
        AUTH_FAIL: {
          target: 'failed',
          actions: 'setFailureReason',
        },
      },
    },
    validate: {
      on: {
        VALIDATION_OK: {
          target: 'preflight.modelCheck',
          actions: 'setWorkflowType',
        },
        VALIDATION_FAIL: {
          target: 'failed',
          actions: 'setFailureReason',
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
              actions: 'setFailureReason',
            },
          },
        },
        usageCheck: {
          on: {
            USAGE_GRANTED: 'ownershipCheck',
            USAGE_REJECTED: {
              target: '#requestGatewayMachine.failed',
              actions: 'setFailureReason',
            },
          },
        },
        ownershipCheck: {
          on: {
            OWNERSHIP_OK: '#requestGatewayMachine.ready',
            OWNERSHIP_FAIL: {
              target: '#requestGatewayMachine.failed',
              actions: 'setFailureReason',
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
