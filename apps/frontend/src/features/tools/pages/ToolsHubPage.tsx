import { Link } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { AppCard } from '../../../components/AppCard';
import { EmptyStateMessage, Surface, uiPrimitives } from '../../../app/ui/primitives';
import {
  getEnabledToolNavigationItems,
} from '../runtime/tool-form-architecture';

export const ToolsHubPage = () => {
  const toolItems = getEnabledToolNavigationItems();

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <h2>{appCopy.ui.navigation.tools}</h2>

      {toolItems.length === 0 ? (
        <EmptyStateMessage>{appCopy.ui.states.noToolsAvailable}</EmptyStateMessage>
      ) : (
        <section className={uiPrimitives.dashboardGrid}>
          {toolItems.map((item) => (
            <AppCard key={item.toolKey} title={item.label} className="ui-dashboard-card-with-cta">
              <div className="ui-dashboard-card-cta-content">
                <p className="ui-dashboard-card-cta-body">{item.description}</p>
                <Link to={item.to} className="ui-dashboard-card-cta-link ui-button">
                  {appCopy.ui.actions.openToolWorkspace}
                </Link>
              </div>
            </AppCard>
          ))}
        </section>
      )}
    </Surface>
  );
};
