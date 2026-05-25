import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@mui/material';
import { appCopy } from '../../../app/copy/system';
import { EmptyStateMessage, Surface, uiPrimitives } from '../../../app/ui/primitives';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { isUserAdmin } from '../../../app/runtime/user-roles';
import {
  getEnabledToolNavigationItems,
} from '../runtime/tool-form-architecture';

export const ToolsHubPage = () => {
  const auth = useAuthSession();
  const role = auth.session && isUserAdmin(auth.session.user.role) ? 'admin' : 'member';
  const toolItems = getEnabledToolNavigationItems(role);

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <h2>{appCopy.ui.navigation.tools}</h2>

      {toolItems.length === 0 ? (
        <EmptyStateMessage>{appCopy.ui.states.noToolsAvailable}</EmptyStateMessage>
      ) : (
        <section className={uiPrimitives.dashboardGrid}>
          {toolItems.map((item) => (
            <Card key={item.toolKey} className="ui-dashboard-card-with-cta">
              <CardHeader title={item.label} />
              <CardContent>
              <div className="ui-dashboard-card-cta-content">
                <p className="ui-dashboard-card-cta-body">{item.description}</p>
                <Link to={item.to} className="ui-dashboard-card-cta-link ui-button">
                  {appCopy.ui.actions.openToolWorkspace}
                </Link>
              </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </Surface>
  );
};
