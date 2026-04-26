/**
 * FunnelPages Tool Page
 * Unified via ToolPageTemplate - minimal wrapper
 */

import { ToolPageTemplate } from '../../ui/ToolPageTemplate';
import { useSearchParams } from 'react-router-dom';

const readIntent = (value: string | null): 'new' | 'resume' | 'regenerate' => {
	if (value === 'resume' || value === 'regenerate') {
		return value;
	}

	return 'new';
};

const readOptional = (value: string | null): string | null => {
	if (!value) {
		return null;
	}

	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
};

export const FunnelPagesToolPage = () => {
	const [searchParams] = useSearchParams();

	return (
		<ToolPageTemplate
			toolKey="funnel-pages"
			intent={readIntent(searchParams.get('intent'))}
			sourceArtifactId={readOptional(searchParams.get('sourceArtifactId'))}
			initialProjectId={readOptional(searchParams.get('projectId'))}
			relaunchTone={readOptional(searchParams.get('tone'))}
			relaunchNotes={readOptional(searchParams.get('notes'))}
			relaunchFromArtifactId={readOptional(searchParams.get('relaunchFromArtifactId'))}
			briefingId={readOptional(searchParams.get('briefingId'))}
			briefingFileName={readOptional(searchParams.get('briefingFileName'))}
		/>
	);
};
