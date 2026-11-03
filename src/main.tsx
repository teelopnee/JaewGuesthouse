import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ToastProvider } from './context/ToastContext';
import { AppDataProvider } from './context/AppDataContext';
import { CreativeProvider } from './context/CreativeContext';
import { CreativeToolbar } from './components/CreativeToolbar';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AppDataProvider>
          <CreativeProvider>
            <App />
            <CreativeToolbar />
          </CreativeProvider>
        </AppDataProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
