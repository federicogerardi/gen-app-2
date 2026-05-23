import { appCopy } from '../copy/system';

export const PageLoader = () => (
  <div className="route-loader" role="status" aria-live="polite" aria-label={appCopy.ui.loader.ariaLabel}>
    <div className="route-loader__panel">
      <div className="route-loader__pulse" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="route-loader__eyebrow">{appCopy.ui.loader.eyebrow}</p>
      <h2 className="route-loader__title">{appCopy.ui.loader.title}</h2>
      <p className="route-loader__body">{appCopy.ui.loader.body}</p>
    </div>
  </div>
);
