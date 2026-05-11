
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initializeMonitoring } from './app/runtime/monitoring';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing root element');
}

initializeMonitoring();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
