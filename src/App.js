import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CRSXMLConverter from './components/CRSXMLConverter';
import PrivacyPolicy from './pages/PrivacyPolicy';
import './index.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<CRSXMLConverter />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
