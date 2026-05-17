export const PageLoader = () => (
  <div className="route-loader" role="status" aria-live="polite" aria-label="Caricamento pagina">
    <div className="route-loader__panel">
      <div className="route-loader__pulse" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="route-loader__eyebrow">Workspace in sync</p>
      <h2 className="route-loader__title">Sto preparando la prossima schermata</h2>
      <p className="route-loader__body">
        Caricamento modulo, stato e contenuti essenziali in corso.
      </p>
    </div>
  </div>
);
