/**
 * FunnelPages Tool Page
 * Unified via ToolPageTemplate - minimal wrapper
 */

import { ToolPageTemplate } from '../../ui/ToolPageTemplate';
import { useSearchParams } from 'react-router-dom';
import { parseToolEntryParams } from '../../runtime/tool-entry-params';

export const FunnelPagesToolPage = () => {
	const [searchParams] = useSearchParams();
	const params = parseToolEntryParams(searchParams);

	return (
		<ToolPageTemplate
			toolKey="funnel-pages"
			intent={params.intent}
			sourceArtifactId={params.sourceArtifactId}
			initialProjectId={params.initialProjectId}
			relaunchTone={params.relaunchTone}
			relaunchNotes={params.relaunchNotes}
			relaunchFromArtifactId={params.relaunchFromArtifactId}
			briefingId={params.briefingId}
			extractionArtifactId={params.extractionArtifactId}
			briefingFileName={params.briefingFileName}
		/>
	);
};
