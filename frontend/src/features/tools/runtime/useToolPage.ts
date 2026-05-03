import { useMachine, useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { getToolFormConfig } from './tool-form-architecture';
import { briefingUploadMachine } from '../machines/briefing-upload.machine';
import { toolPageMachine } from '../machines/tool-page.machine';
import type { SupportedTool } from '../machines/tool-flow.machine';

export const useToolPage = (toolKey: SupportedTool, prefillProjectId?: string) => {
  const auth = useAuthSession();
  const config = getToolFormConfig(toolKey);

  const [snapshot, send] = useMachine(toolPageMachine, {
    input: {
      toolKey,
      projectId: prefillProjectId ?? '',
      model: config.defaultModel,
      registrySnapshotRef: config.defaults.registrySnapshotRef,
      apiBaseUrl: auth.apiBaseUrl,
      capabilities: auth.capabilities,
      userId: auth.session?.user.id ?? null,
    },
  });

  // The briefing actor is spawned in configuring entry; useSelector keeps React updates scoped.
  const briefingSnapshot = useSelector(
    snapshot.context.briefingActorRef as ActorRefFrom<typeof briefingUploadMachine>,
    (state) => state,
  );

  return {
    snapshot,
    send,
    briefingSnapshot,
  };
};
