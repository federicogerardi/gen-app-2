import { createTheme } from '@mui/material/styles';

// Tema centrale MUI v9+ con CSS Variables.
// colorSchemeSelector sincronizza MUI con i CSS custom properties legacy
// che usano il selettore :root[data-theme='dark'] in styles.css.
const theme = createTheme({
  cssVariables: true,
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#2563EB' },
        background: { default: '#F6F8FB', paper: '#fff' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#3b82f6' },
        background: { default: '#08111f', paper: '#0f172a' },
      },
    },
  },
  // @ts-expect-error colorSchemeSelector is valid at runtime for CssVarsTheme but missing from createTheme overload types
  colorSchemeSelector: '[data-theme="%s"]',
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
});

export default theme;
