import type { ReactNode } from 'react';
import { appCopy } from '../../../app/copy/system';
import { Surface, TopBar, cx, uiPrimitives } from '../../../app/ui/primitives';

type AdminPageContainerProps = {
  title: string;
  description: string;
  showEyebrow?: boolean;
  actions?: ReactNode;
  children: ReactNode;
};

export const AdminPageContainer = ({ title, description, showEyebrow = true, actions, children }: AdminPageContainerProps) => {
  return (
    <Surface as="section" className={cx(uiPrimitives.stack, 'ui-admin-page')}>
      <TopBar className="ui-admin-page__header">
      <div className="ui-admin-page__headline">
        {showEyebrow ? <p className="ui-admin-page-eyebrow">{appCopy.ui.adminPage.dataTableViewEyebrow}</p> : null}
        <h2>{title}</h2>
          {description ? <p className={uiPrimitives.metaLine}>{description}</p> : null}
        </div>

        {actions ? <div className={uiPrimitives.actions}>{actions}</div> : null}
      </TopBar>

      {children}
    </Surface>
  );
};