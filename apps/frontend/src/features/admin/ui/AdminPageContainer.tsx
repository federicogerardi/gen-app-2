import type { ReactNode } from 'react';
import { Surface, TopBar, cx, uiPrimitives } from '../../../app/ui/primitives';

type AdminPageContainerProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

export const AdminPageContainer = ({ title, description, actions, children }: AdminPageContainerProps) => {
  return (
    <Surface as="section" className={cx(uiPrimitives.stack, 'ui-admin-page')}>
      <TopBar className="ui-admin-page__header">
        <div className="ui-admin-page__headline">
          <p className="ui-admin-page-eyebrow">Data Table View</p>
          <h2>{title}</h2>
          <p className={uiPrimitives.metaLine}>{description}</p>
        </div>

        {actions ? <div className={uiPrimitives.actions}>{actions}</div> : null}
      </TopBar>

      {children}
    </Surface>
  );
};