import { MoonStar, SunMedium } from 'lucide-react';
import { appCopy } from '../copy/system';
import { useTheme } from '../providers/ThemeProvider';
import { Button, cx, uiPrimitives } from './primitives';

export const ThemeToggleButton = () => {
  const { theme, toggleTheme } = useTheme();
  const isDarkTheme = theme === 'dark';

  return (
    <Button
      type="button"
      className={cx(uiPrimitives.themeToggle, isDarkTheme && 'is-dark')}
      onClick={toggleTheme}
      aria-pressed={isDarkTheme}
      aria-label={isDarkTheme ? appCopy.ui.actions.switchToLightTheme : appCopy.ui.actions.switchToDarkTheme}
      title={isDarkTheme ? appCopy.ui.actions.switchToLightTheme : appCopy.ui.actions.switchToDarkTheme}
    >
      {isDarkTheme ? <SunMedium size={16} aria-hidden="true" /> : <MoonStar size={16} aria-hidden="true" />}
    </Button>
  );
};