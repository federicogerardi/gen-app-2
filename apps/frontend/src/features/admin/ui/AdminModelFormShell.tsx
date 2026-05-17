import type { ReactNode } from 'react';

import { Surface, uiPrimitives } from '../../../app/ui/primitives';

type AdminModelFormShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  actions: ReactNode;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
};

export const AdminModelFormShell = ({
  title,
  subtitle,
  children,
  actions,
  onSubmit,
}: AdminModelFormShellProps) => {
  return (
    <Surface as="form" className="ui-admin-user-form" onSubmit={onSubmit}>
      <div className="ui-admin-user-form-headline">
        <h3>{title}</h3>
        <p className={uiPrimitives.metaLine}>{subtitle}</p>
      </div>

      {children}

      <div className={uiPrimitives.actions}>{actions}</div>
    </Surface>
  );
};