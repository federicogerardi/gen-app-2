import { useState } from 'react';

const fallbackModels = [
  { key: 'openrouter:auto', status: 'enabled' },
  { key: 'gpt-4.1-mini', status: 'enabled' },
  { key: 'claude-3.7-sonnet', status: 'disabled' },
];

export const AdminModelsPage = () => {
  const [models] = useState(fallbackModels);

  return (
    <section className="panel page-stack">
      <h2>Admin models</h2>
      <p className="error-message">Backend endpoint pending</p>
      <ul className="list-clean">
        {models.map((model) => (
          <li key={model.key} className="panel">
            <p><strong>{model.key}</strong></p>
            <p className="meta-line">status: {model.status}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};
