import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthorizeApp } from './AuthorizeApp';
import '../admin/admin.css';

// /authorize — the OAuth sign-in page for the personal MCP server. Its own
// small entry (like /admin): none of the app loads here.
const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from authorize.html.');

createRoot(container).render(
  <StrictMode>
    <AuthorizeApp />
  </StrictMode>,
);
