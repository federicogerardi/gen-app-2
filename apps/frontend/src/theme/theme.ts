import { createTheme } from '@mui/material/styles';

// Tema centrale: personalizza palette, tipografia, spaziature secondo le linee guida del progetto
const theme = createTheme({
  palette: {
    mode: 'light', // supporto dark mode: 'dark'
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#9c27b0',
    },
    background: {
      default: '#f5f5f5',
      paper: '#fff',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
});

export default theme;
