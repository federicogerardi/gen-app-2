import {
  toolStepOrder,
  type SupportedTool,
} from '../../tools/machines/tool-flow.machine';

export const SESSION_SUMMARY_ID_PATTERN = /^sess_[A-Za-z0-9_-]+$/;

export const isSessionSummaryId = (id: string): boolean => SESSION_SUMMARY_ID_PATTERN.test(id);

export const asSupportedTool = (toolKey: string | null): SupportedTool | null => {
  if (toolKey && Object.prototype.hasOwnProperty.call(toolStepOrder, toolKey)) {
    return toolKey as SupportedTool;
  }
  return null;
};
