/**
 * createToolPage: Factory that produces a minimal page wrapper for a given SupportedTool.
 * Eliminates boilerplate duplication across FunnelPagesToolPage and NextlandToolPage.
 * Each produced component reads search params, delegates all rendering to ToolPageTemplate.
 */

import type { FC } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SupportedTool } from '../machines/tool-flow.machine';
import { parseToolEntryParams } from '../runtime/tool-entry-params';
import { ToolPageTemplate } from './ToolPageTemplate';

export const createToolPage = (toolKey: SupportedTool): FC => {
  const ToolPage: FC = () => {
    const [searchParams] = useSearchParams();
    const params = parseToolEntryParams(searchParams);

    return (
      <ToolPageTemplate
        toolKey={toolKey}
        intent={params.intent}
        sourceArtifactId={params.sourceArtifactId}
        initialProjectId={params.initialProjectId}
        relaunchNotes={params.relaunchNotes}
        relaunchFromArtifactId={params.relaunchFromArtifactId}
        briefingId={params.briefingId}
        extractionArtifactId={params.extractionArtifactId}
        briefingFileName={params.briefingFileName}
      />
    );
  };

  ToolPage.displayName = `ToolPage(${toolKey})`;
  return ToolPage;
};
