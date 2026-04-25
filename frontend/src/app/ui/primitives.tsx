import type { ComponentPropsWithoutRef, ElementType, JSX } from 'react';

type PrimitiveProps<T extends ElementType> = {
  as?: T;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>;

export const cx = (...classes: Array<string | undefined | false | null>): string => (
  classes.filter(Boolean).join(' ')
);

export const uiPrimitives = {
  shell: 'ui-shell',
  surface: 'ui-surface',
  stack: 'ui-stack',
  topBar: 'ui-top-bar',
  grid: 'ui-grid',
  actions: 'ui-actions',
  button: 'ui-button',
  inlineLink: 'ui-inline-link',
  navLink: 'ui-nav-link',
  listClean: 'ui-list-clean',
  error: 'ui-error',
} as const;

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

export const Button = ({ className, type = 'button', ...rest }: ButtonProps): JSX.Element => (
  <button type={type} className={cx(uiPrimitives.button, className)} {...rest} />
);
