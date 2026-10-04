import React from 'react';
import ReactDOM from 'react-dom/client';
// Fonts are bundled and served from this site. Loading them from Google Fonts
// sent every visitor's IP address to Google before they could consent.
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import './index.css';
import App from './App';
import { initMonitoring, ErrorBoundary } from './monitoring';

initMonitoring();

// Without a boundary, a render error leaves a blank page and no record of it.
const CrashNotice = () => (
  <div role="alert" style={{ maxWidth: 560, margin: '15vh auto', padding: 24, fontFamily: 'system-ui, sans-serif', color: '#0B0B0C' }}>
    <h1 style={{ fontSize: 24, marginBottom: 12 }}>Something went wrong</h1>
    <p style={{ lineHeight: 1.5 }}>
      The page hit an unexpected error and has been reported. Your file never left
      this browser. Reload the page to start again, or contact contacts@evologics.ai
      if it keeps happening.
    </p>
  </div>
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary fallback={<CrashNotice />}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
