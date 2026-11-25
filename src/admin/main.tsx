import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminApp } from './AdminApp';
import './admin.css';

// The owner's page (admin.html → /admin). Its own entry, so none of the app —
// player, themes, motion — loads here, and the app's bundle carries none of this.
const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from admin.html.');

createRoot(container).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
