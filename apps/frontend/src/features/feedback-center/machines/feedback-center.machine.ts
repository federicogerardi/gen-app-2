import { and, assign, fromPromise, setup } from 'xstate';
import type {
  CreateProductChangelogCommand,
  CreateUserReportCommand,
  GitHubIssueLinkDto,
  ProductChangelogDto,
  ProductChangelogStatus,
  PublishUserReportIssueCommand,
  UpdateUserReportStatusCommand,
  UserReportCategory,
  UserReportDto,
} from '../contracts/feedback-center-contract';
import type { AuthUserRole } from '../../auth/runtime/auth-client';

type FeedbackCenterActorSuccess<TData> = {
  ok: true;
  data: TData;
};

type FeedbackCenterActorFailure = {
  ok: false;
  error: {
    message: string;
  };
};

type FeedbackCenterActorResult<TData> = FeedbackCenterActorSuccess<TData> | FeedbackCenterActorFailure;

export type FeedbackCenterMachineActors = {
  submitUserReport: (
    command: CreateUserReportCommand,
  ) => Promise<FeedbackCenterActorResult<UserReportDto>>;
  publishProductChangelog: (
    command: CreateProductChangelogCommand & { status?: ProductChangelogStatus },
  ) => Promise<FeedbackCenterActorResult<ProductChangelogDto>>;
  updateUserReportStatus: (
    reportId: string,
    command: UpdateUserReportStatusCommand,
  ) => Promise<FeedbackCenterActorResult<UserReportDto>>;
  publishUserReportIssue: (
    reportId: string,
    command: PublishUserReportIssueCommand,
  ) => Promise<FeedbackCenterActorResult<GitHubIssueLinkDto>>;
};

export type FeedbackCenterMachineInput = {
  role: AuthUserRole;
  actors: FeedbackCenterMachineActors;
};

export type FeedbackCenterContext = {
  actors: FeedbackCenterMachineActors;
  principalRole: AuthUserRole | null;
  activeReportCategory: UserReportCategory | null;
  activeReportId: string | null;
  draftReportTitle: string;
  draftReportDescription: string;
  draftChangelogTitle: string;
  draftChangelogBody: string;
  nextTriageStatus: Extract<UpdateUserReportStatusCommand['status'], 'triaged' | 'closed'>;
  lastError: string | null;
  lastIssueUrl: string | null;
};

export type FeedbackCenterEvent =
  | { type: 'CONTEXT_READY'; role: AuthUserRole }
  | {
      type: 'REPORT_DRAFT_CHANGED';
      category: UserReportCategory;
      title: string;
      description: string;
    }
  | {
      type: 'CHANGELOG_DRAFT_CHANGED';
      title: string;
      body: string;
    }
  | { type: 'REPORT_SUBMIT_REQUESTED' }
  | { type: 'CHANGELOG_PUBLISH_REQUESTED' }
  | {
      type: 'REPORT_TRIAGE_REQUESTED';
      reportId: string;
      status: Extract<UpdateUserReportStatusCommand['status'], 'triaged' | 'closed'>;
      category: UserReportCategory;
    }
  | {
      type: 'ISSUE_PUBLISH_REQUESTED';
      reportId: string;
      category: UserReportCategory;
      owner?: string;
      repo?: string;
    }
  | { type: 'ACK_SUCCESS' }
  | { type: 'RESET_TO_IDLE' };

const readErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return fallback;
};

const ensureSuccess = <TData>(
  result: FeedbackCenterActorResult<TData>,
  fallbackMessage: string,
): TData => {
  if (result.ok) {
    return result.data;
  }

  throw new Error(result.error.message || fallbackMessage);
};

export const feedbackCenterMachine = setup({
  types: {
    context: {} as FeedbackCenterContext,
    input: {} as FeedbackCenterMachineInput,
    events: {} as FeedbackCenterEvent,
  },
  guards: {
    isAdmin: ({ context }) => context.principalRole === 'admin',
    isIssueCategory: ({ context, event }) => {
      if (event.type === 'ISSUE_PUBLISH_REQUESTED') {
        return event.category === 'issue';
      }

      return context.activeReportCategory === 'issue';
    },
    hasRequiredSubmissionFields: ({ context }) => (
      context.draftReportTitle.trim().length > 0
      && context.draftReportDescription.trim().length > 0
      && context.activeReportCategory !== null
    ),
    hasRequiredChangelogFields: ({ context }) => (
      context.draftChangelogTitle.trim().length > 0
      && context.draftChangelogBody.trim().length > 0
    ),
  },
  actors: {
    submitReport: fromPromise(async ({ input }: {
      input: {
        actors: FeedbackCenterMachineActors;
        command: CreateUserReportCommand;
      };
    }) => {
      const result = await input.actors.submitUserReport(input.command);
      return ensureSuccess(result, 'Unable to submit user report');
    }),
    publishChangelog: fromPromise(async ({ input }: {
      input: {
        actors: FeedbackCenterMachineActors;
        command: CreateProductChangelogCommand & { status?: ProductChangelogStatus };
      };
    }) => {
      const result = await input.actors.publishProductChangelog(input.command);
      return ensureSuccess(result, 'Unable to publish changelog');
    }),
    triageReport: fromPromise(async ({ input }: {
      input: {
        actors: FeedbackCenterMachineActors;
        reportId: string;
        command: UpdateUserReportStatusCommand;
      };
    }) => {
      const result = await input.actors.updateUserReportStatus(input.reportId, input.command);
      return ensureSuccess(result, 'Unable to triage user report');
    }),
    publishIssue: fromPromise(async ({ input }: {
      input: {
        actors: FeedbackCenterMachineActors;
        reportId: string;
        command: PublishUserReportIssueCommand;
      };
    }) => {
      const result = await input.actors.publishUserReportIssue(input.reportId, input.command);
      return ensureSuccess(result, 'Unable to publish GitHub issue');
    }),
  },
}).createMachine({
  id: 'feedbackCenterMachine',
  initial: 'bootstrapping',
  context: ({ input }) => ({
    actors: input.actors,
    principalRole: input.role,
    activeReportCategory: null,
    activeReportId: null,
    draftReportTitle: '',
    draftReportDescription: '',
    draftChangelogTitle: '',
    draftChangelogBody: '',
    nextTriageStatus: 'triaged',
    lastError: null,
    lastIssueUrl: null,
  }),
  states: {
    bootstrapping: {
      on: {
        CONTEXT_READY: {
          target: 'ready.idle',
          actions: assign({
            principalRole: ({ event }) => event.role,
          }),
        },
      },
    },
    ready: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            REPORT_DRAFT_CHANGED: {
              actions: assign({
                activeReportCategory: ({ event }) => event.category,
                draftReportTitle: ({ event }) => event.title,
                draftReportDescription: ({ event }) => event.description,
                lastError: () => null,
              }),
            },
            CHANGELOG_DRAFT_CHANGED: {
              actions: assign({
                draftChangelogTitle: ({ event }) => event.title,
                draftChangelogBody: ({ event }) => event.body,
                lastError: () => null,
              }),
            },
            REPORT_SUBMIT_REQUESTED: {
              guard: 'hasRequiredSubmissionFields',
              target: 'reportSubmitting',
            },
            CHANGELOG_PUBLISH_REQUESTED: {
              guard: and(['isAdmin', 'hasRequiredChangelogFields']),
              target: 'changelogPublishing',
            },
            REPORT_TRIAGE_REQUESTED: {
              guard: 'isAdmin',
              target: 'reportTriaging',
              actions: assign({
                activeReportId: ({ event }) => event.reportId,
                activeReportCategory: ({ event }) => event.category,
                nextTriageStatus: ({ event }) => event.status,
              }),
            },
            ISSUE_PUBLISH_REQUESTED: [
              {
                guard: and(['isAdmin', 'isIssueCategory']),
                target: 'issuePublishing',
                actions: assign({
                  activeReportId: ({ event }) => event.reportId,
                  activeReportCategory: ({ event }) => event.category,
                }),
              },
              {
                target: 'issuePublishFailure',
                actions: assign({
                  activeReportId: ({ event }) => event.reportId,
                  activeReportCategory: ({ event }) => event.category,
                  lastError: () => 'Issue publication is allowed only for reports in category issue.',
                }),
              },
            ],
          },
        },
        reportSubmitting: {
          invoke: {
            src: 'submitReport',
            input: ({ context }) => ({
              actors: context.actors,
              command: {
                title: context.draftReportTitle,
                description: context.draftReportDescription,
                category: context.activeReportCategory ?? 'other',
              },
            }),
            onDone: {
              target: 'reportSubmitSuccess',
              actions: assign({ lastError: () => null }),
            },
            onError: {
              target: 'reportSubmitFailure',
              actions: assign({
                lastError: ({ event }) => readErrorMessage((event as { error: unknown }).error, 'Report submit failed'),
              }),
            },
          },
        },
        reportSubmitSuccess: {
          on: {
            ACK_SUCCESS: {
              target: 'idle',
              reenter: true,
              actions: assign({
                draftReportTitle: () => '',
                draftReportDescription: () => '',
                activeReportCategory: () => null,
                lastError: () => null,
              }),
            },
          },
        },
        reportSubmitFailure: {
          on: {
            RESET_TO_IDLE: {
              target: 'idle',
              reenter: true,
            },
          },
        },
        changelogPublishing: {
          invoke: {
            src: 'publishChangelog',
            input: ({ context }) => ({
              actors: context.actors,
              command: {
                title: context.draftChangelogTitle,
                body: context.draftChangelogBody,
                status: 'published',
              },
            }),
            onDone: {
              target: 'changelogPublishSuccess',
              actions: assign({ lastError: () => null }),
            },
            onError: {
              target: 'changelogPublishFailure',
              actions: assign({
                lastError: ({ event }) => readErrorMessage((event as { error: unknown }).error, 'Changelog publish failed'),
              }),
            },
          },
        },
        changelogPublishSuccess: {
          on: {
            ACK_SUCCESS: {
              target: 'idle',
              reenter: true,
              actions: assign({
                draftChangelogTitle: () => '',
                draftChangelogBody: () => '',
                lastError: () => null,
              }),
            },
          },
        },
        changelogPublishFailure: {
          on: {
            RESET_TO_IDLE: {
              target: 'idle',
              reenter: true,
            },
          },
        },
        reportTriaging: {
          invoke: {
            src: 'triageReport',
            input: ({ context }) => ({
              actors: context.actors,
              reportId: context.activeReportId ?? '',
              command: { status: context.nextTriageStatus },
            }),
            onDone: {
              target: 'reportTriageSuccess',
              actions: assign({ lastError: () => null }),
            },
            onError: {
              target: 'reportTriageFailure',
              actions: assign({
                lastError: ({ event }) => readErrorMessage((event as { error: unknown }).error, 'User report triage failed'),
              }),
            },
          },
        },
        reportTriageSuccess: {
          on: {
            ACK_SUCCESS: {
              target: 'idle',
              reenter: true,
              actions: assign({ lastError: () => null }),
            },
          },
        },
        reportTriageFailure: {
          on: {
            RESET_TO_IDLE: {
              target: 'idle',
              reenter: true,
            },
          },
        },
        issuePublishing: {
          invoke: {
            src: 'publishIssue',
            input: ({ context }) => ({
              actors: context.actors,
              reportId: context.activeReportId ?? '',
              command: {
                owner: '',
                repo: '',
              },
            }),
            onDone: {
              target: 'issuePublishSuccess',
              actions: assign({
                lastIssueUrl: ({ event }) => {
                  const doneEvent = event as unknown as {
                    output: GitHubIssueLinkDto;
                  };
                  return doneEvent.output.issueUrl;
                },
                lastError: () => null,
              }),
            },
            onError: {
              target: 'issuePublishFailure',
              actions: assign({
                lastError: ({ event }) => readErrorMessage((event as { error: unknown }).error, 'GitHub issue publish failed'),
              }),
            },
          },
        },
        issuePublishSuccess: {
          on: {
            ACK_SUCCESS: {
              target: 'idle',
              reenter: true,
              actions: assign({ lastError: () => null }),
            },
          },
        },
        issuePublishFailure: {
          on: {
            RESET_TO_IDLE: {
              target: 'idle',
              reenter: true,
            },
          },
        },
      },
    },
  },
});
