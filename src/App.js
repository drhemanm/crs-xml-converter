import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainApp from './components/CRSXMLConverter';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import Documentation from './pages/Documentation';
import DataRequestPortal from './pages/DataRequestPortal';
import CookieSettings from './pages/CookieSettings';
import CookieConsent from './components/CookieConsent';
import './index.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<MainApp />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/documentation" element={<Documentation />} />
          <Route path="/data-request" element={<DataRequestPortal />} />
          <Route path="/cookie-settings" element={<CookieSettings />} />
        </Routes>
        <CookieConsent />
      </div>
    </Router>
  );
}

export default App;
