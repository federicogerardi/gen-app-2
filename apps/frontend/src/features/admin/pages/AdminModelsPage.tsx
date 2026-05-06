import { useState } from 'react';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { Surface, uiPrimitives } from '../../../app/ui/primitives';

const fallbackModels = [
  { key: 'openrouter/auto', status: 'enabled' },
  { key: 'gpt-4.1-mini', status: 'enabled' },
  { key: 'claude-3.7-sonnet', status: 'disabled' },
];

export const AdminModelsPage = () => {
  const [models] = useState(fallbackModels);

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <h2>{appCopy.editorial.admin.modelsTitle}</h2>
      <p className={uiPrimitives.error}>{appCopy.ui.states.backendEndpointPending}</p>
      <ul className={uiPrimitives.listClean}>
        {models.map((model) => (
          <Surface as="li" key={model.key}>
            <p><strong>{model.key}</strong></p>
            <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.status, model.status)}</p>
          </Surface>
        ))}
      </ul>
    </Surface>
  );
};
