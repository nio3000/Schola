import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppThemeBootstrap } from '../features/theme/AppThemeBootstrap';
import { ThemeProvider } from '../features/theme/ThemeProvider';
import '../styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Schola root element was not found.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppThemeBootstrap>
        <App />
      </AppThemeBootstrap>
    </ThemeProvider>
  </React.StrictMode>,
);
