import { Link } from 'react-router-dom';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { Surface, uiPrimitives } from '../../../app/ui/primitives';
import { adminNavigationItems } from '../config/admin-navigation';
import { AdminPageContainer } from '../ui/AdminPageContainer';

const overviewCards = adminNavigationItems.filter((item) => item.key !== 'overview');

export const AdminDashboardPage = () => {
  const auth = useAuthSession();
  const adminEmail = auth.session?.user.email ?? 'admin';

  return (
    <AdminPageContainer
      title="Dashboard admin"
      description="Entry point unica per supervisionare utenti, LlmModelCatalog, ProductChangelog, UserReport e attivita recente."
      actions={(
        <Link to="/admin/users" className={uiPrimitives.button}>
          Apri gestione utenti
        </Link>
      )}
    >
      <div className="ui-admin-kpi-grid">
        <Surface className="ui-admin-kpi">
          <p className="ui-admin-page-eyebrow">Responsabile</p>
          <strong>{adminEmail}</strong>
          <p className={uiPrimitives.metaLine}>Sessione autenticata con accesso amministrativo.</p>
        </Surface>

        <Surface className="ui-admin-kpi">
          <p className="ui-admin-page-eyebrow">Sezioni attive</p>
          <strong>{overviewCards.length}</strong>
          <p className={uiPrimitives.metaLine}>Pagine atomiche raggiungibili direttamente da questa dashboard admin.</p>
        </Surface>

        <Surface className="ui-admin-kpi">
          <p className="ui-admin-page-eyebrow">Feedback</p>
          <strong>Globale + locale</strong>
          <p className={uiPrimitives.metaLine}>Le mutazioni mantengono Global Feedback Message e page-state coerenti.</p>
        </Surface>
      </div>

      <section className={uiPrimitives.stack} aria-labelledby="admin-dashboard-sections-title">
        <h3 id="admin-dashboard-sections-title">Sezioni operative</h3>
        <div className="ui-admin-overview-grid">
          {overviewCards.map((item) => (
            <Surface key={item.key} className="ui-dashboard-card ui-admin-overview-card">
              <div className={uiPrimitives.stack}>
                <p className="ui-admin-page-eyebrow">Admin section</p>
                <h3>{item.label}</h3>
                <p>{item.description}</p>
              </div>

              <Link to={item.to} className={uiPrimitives.button}>
                Apri sezione
              </Link>
            </Surface>
          ))}
        </div>
      </section>

      <Surface className={uiPrimitives.stack}>
        <h3>Governance operativa</h3>
        <p className={uiPrimitives.metaLine}>Le viste tabellari admin convergono sul pattern canonico Data Table View con toolbar locale, page-state in-page e azioni di riga compatte.</p>
      </Surface>
    </AdminPageContainer>
  );
};