import React, { useState, useEffect } from 'react';
import { Cookie,  X,  Info } from 'lucide-react';

const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [cookiePreferences, setCookiePreferences] = useState({
    necessary: true,
    analytics: false,
    marketing: false,
    functional: false
  });

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setTimeout(() => setShowBanner(true), 1500);
    } else {
      const savedPreferences = JSON.parse(consent);
      setCookiePreferences(savedPreferences);
      initializeTracking(savedPreferences);
    }
  }, []);

  const initializeTracking = (preferences) => {
    if (preferences.analytics && window.gtag) {
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
    }
    if (preferences.marketing) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Marketing tracking initialized');
      }
    }
    if (preferences.functional) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Functional cookies initialized');
      }
    }
  };

  const acceptAll = () => {
    const allAccepted = { necessary: true, analytics: true, marketing: true, functional: true };
    setCookiePreferences(allAccepted);
    localStorage.setItem('cookieConsent', JSON.stringify(allAccepted));
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    initializeTracking(allAccepted);
    setShowBanner(false);
    setShowSettings(false);
  };

  const acceptNecessaryOnly = () => {
    const necessaryOnly = { necessary: true, analytics: false, marketing: false, functional: false };
    setCookiePreferences(necessaryOnly);
    localStorage.setItem('cookieConsent', JSON.stringify(necessaryOnly));
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    initializeTracking(necessaryOnly);
    setShowBanner(false);
    setShowSettings(false);
  };

  const saveCustomPreferences = () => {
    localStorage.setItem('cookieConsent', JSON.stringify(cookiePreferences));
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    initializeTracking(cookiePreferences);
    setShowBanner(false);
    setShowSettings(false);
  };

  const togglePreference = (type) => {
    if (type === 'necessary') return;
    setCookiePreferences(prev => ({ ...prev, [type]: !prev[type] }));
  };

  if (!showBanner) return null;

  return (
    <>
      {/*
        Stacks on small screens. The previous layout kept the button row at its
        natural width with flex-shrink-0, which squeezed the copy column down to
        roughly one word per line on a phone.
      */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl hairline-t animate-fade-up">
        <div className="max-w-shell mx-auto px-5 sm:px-8 lg:px-10 py-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

            <div className="flex items-start gap-3 min-w-0">
              <Cookie className="w-[18px] h-[18px] text-ink-400 shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="min-w-0">
                <p className="text-[14px] text-ink-700 leading-relaxed">
                  We use cookies to improve this service. Essential cookies are always on; the rest
                  are up to you.
                </p>
                <div className="hidden sm:flex flex-wrap gap-1.5 mt-2.5">
                  {['Essential', 'Analytics', 'Functional', 'Marketing'].map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink-50 text-ink-500 text-[12px]"
                    >
                      <span className="w-1 h-1 rounded-full bg-ink-300" />
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowSettings(true)}
                className="h-11 px-4 rounded-field text-[14px] text-ink-500 hover:bg-ink-50 transition-colors duration-300 shrink-0"
              >
                Customize
              </button>
              <button
                onClick={acceptNecessaryOnly}
                className="h-11 px-4 sm:px-5 flex-1 sm:flex-none rounded-field hairline text-[14px] text-ink-700 hover:bg-ink-50 transition-colors duration-300"
              >
                Reject all
              </button>
              <button
                onClick={acceptAll}
                className="h-11 px-5 sm:px-6 flex-1 sm:flex-none rounded-field bg-ink text-white text-[14px] font-medium hover:bg-ink-800 transition-colors duration-300"
              >
                Accept all
              </button>
            </div>
          </div>

          {/* Legal links */}
          <div className="mt-4 pt-3 hairline-t">
            <p className="text-xs text-ink-400">
              By continuing, you agree to our{' '}
              <a href="/privacy" className="text-ink underline underline-offset-2 decoration-ink-300 hover:decoration-ink transition-colors">Privacy Policy</a>
              {' '}and{' '}
              <a href="/terms" className="text-ink underline underline-offset-2 decoration-ink-300 hover:decoration-ink transition-colors">Terms of Service</a>
            </p>
          </div>
        </div>
      </div>

      {/* Clean Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-field shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-ink-100">
              <h2 className="text-lg font-semibold text-ink">Cookie Preferences</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-ink-300 hover:text-ink-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(85vh-140px)] p-6 space-y-4">
              
              {/* Essential Cookies */}
              <div className="border border-ink-100 rounded-field p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-ink">Essential Cookies</h3>
                  <div className="bg-ink-100 text-ink-600 px-2 py-1 rounded text-xs font-medium">
                    Always Active
                  </div>
                </div>
                <p className="text-ink-500 text-sm">
                  Required for the website to function. These cannot be disabled.
                </p>
              </div>

              {/* Analytics Cookies */}
              <div className="border border-ink-100 rounded-field p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-ink">Analytics Cookies</h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cookiePreferences.analytics}
                      onChange={() => togglePreference('analytics')}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-ink-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink-200 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                  </label>
                </div>
                <p className="text-ink-500 text-sm">
                  Help us understand how you use our website with anonymous usage data.
                </p>
              </div>

              {/* Functional Cookies */}
              <div className="border border-ink-100 rounded-field p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-ink">Functional Cookies</h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cookiePreferences.functional}
                      onChange={() => togglePreference('functional')}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-ink-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink-200 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                  </label>
                </div>
                <p className="text-ink-500 text-sm">
                  Remember your preferences and provide enhanced features.
                </p>
              </div>

              {/* Marketing Cookies */}
              <div className="border border-ink-100 rounded-field p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-ink">Marketing Cookies</h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cookiePreferences.marketing}
                      onChange={() => togglePreference('marketing')}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-ink-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink-200 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                  </label>
                </div>
                <p className="text-ink-500 text-sm">
                  Used to deliver relevant advertisements and measure campaign effectiveness.
                </p>
              </div>

              {/* Info box */}
              <div className="bg-ink-50 border border-ink-100 rounded-field p-4">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-ink-400 mt-0.5 flex-shrink-0" />
                  <p className="text-ink-600 text-sm">
                    You can change these settings at any time. Visit our Privacy Policy to learn more about how we handle your data.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-ink-100 bg-ink-50">
              <button
                onClick={saveCustomPreferences}
                className="px-4 py-2 bg-ink hover:bg-ink-800 text-white text-sm font-medium rounded-field transition-colors duration-300"
              >
                Save Preferences
              </button>
              <button
                onClick={acceptAll}
                className="px-4 py-2 bg-ink-100 hover:bg-ink-200 text-ink-700 text-sm font-medium rounded-field transition-colors"
              >
                Accept All
              </button>
              <button
                onClick={acceptNecessaryOnly}
                className="px-4 py-2 bg-ink-100 hover:bg-ink-200 text-ink-700 text-sm font-medium rounded-field transition-colors"
              >
                Reject All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CookieConsent;
