import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { AuthProvider } from './auth-context';
import { AppStateProvider } from './state';
import './styles/nocturne.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppStateProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AppStateProvider>
    </BrowserRouter>
  </StrictMode>,
);
