import { Link } from 'react-router-dom';

import { cx, uiPrimitives } from '../../../app/ui/primitives';

type AdminChangelogToolbarProps = {
  showArchived: boolean;
  loading: boolean;
  isPublishing: boolean;
  busyAction: string | null;
  onToggleArchived: () => void;
  onReload: () => void;
};

export const AdminChangelogToolbar = ({
  showArchived,
  loading,
  isPublishing,
  busyAction,
  onToggleArchived,
  onReload,
}: AdminChangelogToolbarProps) => {
  return (
    <div className={cx(uiPrimitives.clusterRow, 'ui-admin-users-toolbar')}>
      <p className={uiPrimitives.metaLine}>Pubblica aggiornamenti di prodotto visibili agli utenti autenticati.</p>
      <div className={uiPrimitives.actions}>
        <Link to="/admin/user-reports" className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}>
          Inbox segnalazioni
        </Link>
        <button
          type="button"
          className={uiPrimitives.button}
          onClick={onToggleArchived}
          disabled={loading}
        >
          {showArchived ? 'Nascondi archiviate' : 'Mostra archiviate'}
        </button>
        <button
          type="button"
          className={uiPrimitives.button}
          onClick={onReload}
          disabled={loading || isPublishing || busyAction !== null}
        >
          Aggiorna tabella
        </button>
      </div>
    </div>
  );
};