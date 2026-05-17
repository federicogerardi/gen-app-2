import type { ReactNode } from 'react';

import { Surface, uiPrimitives } from '../../../app/ui/primitives';

type AdminUserFormShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  actions: ReactNode;
  useSurface?: boolean;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
};

export const AdminUserFormShell = ({
  title,
  subtitle,
  children,
  actions,
  useSurface = false,
  onSubmit,
}: AdminUserFormShellProps) => {
  const content = (
    <>
      <div className="ui-admin-user-form-headline">
        <h3>{title}</h3>
        <p className={uiPrimitives.metaLine}>{subtitle}</p>
      </div>

      {children}

      <div className={uiPrimitives.actions}>{actions}</div>
    </>
  );

  return useSurface ? (
    <Surface as="form" className="ui-admin-user-form" onSubmit={onSubmit}>
      {content}
    </Surface>
  ) : (
    <form className="ui-admin-user-form" onSubmit={onSubmit}>
      {content}
    </form>
  );
};