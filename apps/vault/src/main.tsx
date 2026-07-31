import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { AuthProvider } from './auth-context';
import { AppStateProvider } from './state';
import { SyncProvider } from './sync-context';
import './styles/nocturne.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppStateProvider>
        <AuthProvider>
          <SyncProvider>
            <App />
          </SyncProvider>
        </AuthProvider>
      </AppStateProvider>
    </BrowserRouter>
  </StrictMode>,
);
