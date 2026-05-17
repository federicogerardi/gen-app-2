import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';

import { feedbackCenterMachine, type FeedbackCenterMachineActors } from './feedback-center.machine';

const createActors = (overrides: Partial<FeedbackCenterMachineActors> = {}): FeedbackCenterMachineActors => ({
  submitUserReport: async (command) => ({
    ok: true,
    data: {
      id: 'rpt_test_001',
      category: command.category,
      status: 'submitted',
      title: command.title,
      description: command.description,
      createdBy: 'member_test',
      triagedBy: null,
      triagedAt: null,
      closedAt: null,
      createdAt: '2026-05-16T10:00:00.000Z',
      updatedAt: '2026-05-16T10:00:00.000Z',
      githubIssueUrl: null,
    },
  }),
  publishProductChangelog: async (command) => ({
    ok: true,
    data: {
      id: 'chg_test_001',
      title: command.title,
      body: command.body,
      status: 'published',
      createdBy: 'admin_test',
      publishedBy: 'admin_test',
      publishedAt: '2026-05-16T10:00:00.000Z',
      createdAt: '2026-05-16T10:00:00.000Z',
      updatedAt: '2026-05-16T10:00:00.000Z',
    },
  }),
  updateUserReportStatus: async (reportId, command) => ({
    ok: true,
    data: {
      id: reportId,
      category: 'issue',
      status: command.status,
      title: 'seed',
      description: 'seed',
      createdBy: 'member_test',
      triagedBy: 'admin_test',
      triagedAt: '2026-05-16T10:00:00.000Z',
      closedAt: command.status === 'closed' ? '2026-05-16T10:10:00.000Z' : null,
      createdAt: '2026-05-16T10:00:00.000Z',
      updatedAt: '2026-05-16T10:10:00.000Z',
      githubIssueUrl: null,
    },
  }),
  publishUserReportIssue: async (reportId) => ({
    ok: true,
    data: {
      userReportId: reportId,
      repository: 'acme/platform',
      issueNumber: 77,
      issueUrl: 'https://github.com/acme/platform/issues/77',
      publishedBy: 'admin_test',
      publishedAt: '2026-05-16T10:20:00.000Z',
    },
  }),
  ...overrides,
});

const createMachineActor = (
  role: 'admin' | 'member',
  overrides: Partial<FeedbackCenterMachineActors> = {},
) => {
  const actor = createActor(feedbackCenterMachine, {
    input: {
      role,
      actors: createActors(overrides),
    },
  });

  actor.start();
  actor.send({ type: 'CONTEXT_READY', role });
  return actor;
};

describe('feedbackCenterMachine', () => {
  it('requires explicit ACK_SUCCESS from reportSubmitSuccess to return idle', async () => {
    const actor = createMachineActor('member');

    actor.send({
      type: 'REPORT_DRAFT_CHANGED',
      category: 'issue',
      title: 'Issue report',
      description: 'Description',
    });
    actor.send({ type: 'REPORT_SUBMIT_REQUESTED' });

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(actor.getSnapshot().matches({ ready: 'reportSubmitSuccess' })).toBe(true);

    actor.send({ type: 'ACK_SUCCESS' });
    expect(actor.getSnapshot().matches({ ready: 'idle' })).toBe(true);
  });

  it('uses RESET_TO_IDLE from reportSubmitFailure to recover to idle', async () => {
    const actor = createMachineActor('member', {
      submitUserReport: async () => ({
        ok: false,
        error: { message: 'submit failed' },
      }),
    });

    actor.send({
      type: 'REPORT_DRAFT_CHANGED',
      category: 'issue',
      title: 'Issue report',
      description: 'Description',
    });
    actor.send({ type: 'REPORT_SUBMIT_REQUESTED' });

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(actor.getSnapshot().matches({ ready: 'reportSubmitFailure' })).toBe(true);

    actor.send({ type: 'RESET_TO_IDLE' });
    expect(actor.getSnapshot().matches({ ready: 'idle' })).toBe(true);
  });

  it('rejects issue publication when category is not issue', () => {
    const actor = createMachineActor('admin');

    actor.send({
      type: 'ISSUE_PUBLISH_REQUESTED',
      reportId: 'rpt_other_001',
      category: 'other',
    });

    expect(actor.getSnapshot().matches({ ready: 'issuePublishFailure' })).toBe(true);
    expect(actor.getSnapshot().context.lastError).toContain('allowed only');
  });

  it('enforces admin guard for changelog publishing', () => {
    const actor = createMachineActor('member');

    actor.send({
      type: 'CHANGELOG_DRAFT_CHANGED',
      title: 'Release',
      body: 'Body',
    });

    actor.send({ type: 'CHANGELOG_PUBLISH_REQUESTED' });
    expect(actor.getSnapshot().matches({ ready: 'idle' })).toBe(true);
  });
});
