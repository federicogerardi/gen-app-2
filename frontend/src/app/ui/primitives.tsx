import type { ComponentPropsWithoutRef, ElementType, JSX, ReactNode } from 'react';

type PrimitiveProps<T extends ElementType> = {
  as?: T;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>;

export const cx = (...classes: Array<string | undefined | false | null>): string => (
  classes.filter(Boolean).join(' ')
);

export const uiPrimitives = {
  shell: 'ui-shell',
  shellAuth: 'ui-shell-auth',
  workbench: 'ui-workbench',
  mainCanvas: 'ui-main-canvas',
  surface: 'ui-surface',
  stack: 'ui-stack',
  topBar: 'ui-top-bar',
  grid: 'ui-grid',
  layoutGrid: 'ui-layout-grid',
  generationCanvas: 'ui-generation-canvas',
  actions: 'ui-actions',
  button: 'ui-button',
  themeToggle: 'ui-theme-toggle',
  inlineLink: 'ui-inline-link',
  oauthLink: 'ui-oauth-link',
  navLink: 'ui-nav-link',
  navLinkActive: 'is-active',
  listClean: 'ui-list-clean',
  error: 'ui-error',
  metaLine: 'ui-meta-line',
  statusLine: 'ui-status-line',
  checkboxRow: 'ui-checkbox-row',
  loginPanel: 'ui-login-panel',
  streamPanel: 'ui-stream-panel',
  artifactHistoryPanel: 'ui-artifact-history-panel',
  artifactFilters: 'ui-artifact-filters',
  artifactGrid: 'ui-artifact-grid',
  artifactList: 'ui-artifact-list',
  artifactRow: 'ui-artifact-row',
  artifactRowSelected: 'is-selected',
  artifactDetail: 'ui-artifact-detail',
  artifactContent: 'ui-artifact-content',
  authHeader: 'ui-auth-header',
  authActions: 'ui-auth-actions',
  shellUtilityBar: 'ui-shell-utility-bar',
  runtimeBadge: 'ui-runtime-badge',
  menuToggle: 'ui-menu-toggle',
  mainNav: 'ui-main-nav',
  mainNavOpen: 'is-open',
  dashboardGrid: 'ui-dashboard-grid',
  dashboardCard: 'ui-dashboard-card',
} as const;

export const Shell = <T extends ElementType = 'div'>(props: PrimitiveProps<T>): JSX.Element => {
  const { as, className, ...rest } = props;
  const Component = (as ?? 'div') as ElementType;

  return <Component className={cx(uiPrimitives.shell, className)} {...rest} />;
};

export const Surface = <T extends ElementType = 'div'>(props: PrimitiveProps<T>): JSX.Element => {
  const { as, className, ...rest } = props;
  const Component = (as ?? 'div') as ElementType;

  return <Component className={cx(uiPrimitives.surface, className)} {...rest} />;
};

export const Stack = <T extends ElementType = 'div'>(props: PrimitiveProps<T>): JSX.Element => {
  const { as, className, ...rest } = props;
  const Component = (as ?? 'div') as ElementType;

  return <Component className={cx(uiPrimitives.stack, className)} {...rest} />;
};

export const TopBar = <T extends ElementType = 'header'>(props: PrimitiveProps<T>): JSX.Element => {
  const { as, className, ...rest } = props;
  const Component = (as ?? 'header') as ElementType;

  return <Component className={cx(uiPrimitives.topBar, className)} {...rest} />;
};

type ButtonProps = ComponentPropsWithoutRef<'button'>;

type PageStateMessageProps = {
  children: ReactNode;
};

export const Button = ({ className, type = 'button', ...rest }: ButtonProps): JSX.Element => (
  <button type={type} className={cx(uiPrimitives.button, className)} {...rest} />
);

export const LoadingStateMessage = ({ children }: PageStateMessageProps): JSX.Element => (
  <p className={uiPrimitives.metaLine}>{children}</p>
);

export const EmptyStateMessage = ({ children }: PageStateMessageProps): JSX.Element => (
  <p className={uiPrimitives.metaLine}>{children}</p>
);

export const ErrorStateMessage = ({ children }: PageStateMessageProps): JSX.Element => (
  <p className={uiPrimitives.error} role="alert">{children}</p>
);
