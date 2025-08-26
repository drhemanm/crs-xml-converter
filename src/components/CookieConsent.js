import React, { useState, useEffect } from 'react';
import { Cookie, Settings, X, Check, AlertTriangle } from 'lucide-react';

const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [cookiePreferences, setCookiePreferences] = useState({
    necessary: true, // Always true, cannot be disabled
    analytics: false,
    marketing: false,
    functional: false
  });

  // Check if user has already made a choice
  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      // Show banner after a brief delay for better UX
      setTimeout(() => setShowBanner(true), 1000);
    } else {
      const savedPreferences = JSON.parse(consent);
      setCookiePreferences(savedPreferences);
      // Initialize tracking based on saved preferences
      initializeTracking(savedPreferences);
    }
  }, []);

  const initializeTracking = (preferences) => {
    // Initialize Google Analytics only if analytics cookies accepted
    if (preferences.analytics && window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
      });
    }

    // Initialize other tracking services based on preferences
    if (preferences.marketing) {
      // Initialize marketing pixels, retargeting, etc.
      console.log('Marketing tracking initialized');
    }

    if (preferences.functional) {
      // Initialize functional cookies like preferences, language settings
      console.log('Functional cookies initialized');
    }
  };

  const acceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true
    };
    setCookiePreferences(allAccepted);
    localStorage.setItem('cookieConsent', JSON.stringify(allAccepted));
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    initializeTracking(allAccepted);
    setShowBanner(false);
    setShowSettings(false);
  };

  const acceptNecessaryOnly = () => {
    const necessaryOnly = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false
    };
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
    if (type === 'necessary') return; // Cannot disable necessary cookies
    setCookiePreferences(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Cookie Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl">
            <div className="p-6">
              <div className="flex items-start space-x-4">
                <Cookie className="w-8 h-8 text-amber-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    We use cookies to enhance your experience
                  </h3>
                  <p className="text-gray-300 text-sm mb-4">
                    We use cookies and similar technologies to provide, protect, and improve our services. 
                    Some cookies are necessary for our site to function, while others help us understand 
                    how you use our service so we can improve it. You can manage your cookie preferences at any time.
                  </p>
                  
                  {/* Quick info about cookie types */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-xs">
                    <div className="bg-green-500/10 border border-green-500/20 rounded p-2">
                      <div className="font-medium text-green-100">Necessary</div>
                      <div className="text-green-200">Required for basic functionality</div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2">
                      <div className="font-medium text-blue-100">Analytics</div>
                      <div className="text-blue-200">Usage statistics (anonymous)</div>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded p-2">
                      <div className="font-medium text-purple-100">Functional</div>
                      <div className="text-purple-200">Preferences & settings</div>
                    </div>
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded p-2">
                      <div className="font-medium text-orange-100">Marketing</div>
                      <div className="text-orange-200">Personalized content</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={acceptAll}
                      className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Accept All Cookies
                    </button>
                    <button
                      onClick={acceptNecessaryOnly}
                      className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Necessary Only
                    </button>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors border border-gray-600"
                    >
                      <Settings className="w-4 h-4 inline mr-2" />
                      Customize
                    </button>
                  </div>

                  <p className="text-xs text-gray-400 mt-3">
                    By clicking "Accept All", you agree to our{' '}
                    <a href="/privacy" className="text-emerald-400 hover:underline">Privacy Policy</a> and{' '}
                    <a href="/terms" className="text-emerald-400 hover:underline">Terms of Service</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cookie Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Settings className="w-6 h-6 text-emerald-400 mr-3" />
                  <h2 className="text-xl font-bold text-white">Cookie Preferences</h2>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                
                {/* Necessary Cookies */}
                <div className="border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Necessary Cookies</h3>
                      <p className="text-sm text-gray-300">Required for basic website functionality</p>
                    </div>
                    <div className="bg-green-500 rounded-full p-1">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">
                    These cookies are essential for the website to function and cannot be disabled. 
                    They include authentication, security features, and basic site operations.
                  </p>
                  <div className="text-xs text-gray-500 mt-2">
                    Examples: Session management, security tokens, load balancing
                  </div>
                </div>

                {/* Analytics Cookies */}
                <div className="border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Analytics Cookies</h3>
                      <p className="text-sm text-gray-300">Help us understand how you use our service</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cookiePreferences.analytics}
                        onChange={() => togglePreference('analytics')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-400">
                    These cookies collect anonymous information about how visitors use our website, 
                    helping us improve performance and user experience.
                  </p>
                  <div className="text-xs text-gray-500 mt-2">
                    Examples: Google Analytics, page views, click tracking (anonymized)
                  </div>
                </div>

                {/* Functional Cookies */}
                <div className="border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Functional Cookies</h3>
                      <p className="text-sm text-gray-300">Remember your preferences and settings</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cookiePreferences.functional}
                        onChange={() => togglePreference('functional')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-400">
                    These cookies enable enhanced functionality and personalization, such as 
                    remembering your preferences and previous interactions.
                  </p>
                  <div className="text-xs text-gray-500 mt-2">
                    Examples: Language preferences, theme settings, form data
                  </div>
                </div>

                {/* Marketing Cookies */}
                <div className="border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Marketing Cookies</h3>
                      <p className="text-sm text-gray-300">Personalize ads and marketing content</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cookiePreferences.marketing}
                        onChange={() => togglePreference('marketing')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-400">
                    These cookies are used to deliver relevant advertisements and track marketing 
                    campaign effectiveness.
                  </p>
                  <div className="text-xs text-gray-500 mt-2">
                    Examples: Ad targeting, conversion tracking, retargeting pixels
                  </div>
                </div>

              </div>

              {/* Warning about disabling cookies */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-6">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="text-amber-100 text-sm">
                    <p className="font-medium">Note about disabling cookies:</p>
                    <p className="mt-1">
                      Disabling certain cookies may impact your experience. Analytics cookies 
                      help us improve our service, and functional cookies make the site easier to use.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-700">
                <button
                  onClick={saveCustomPreferences}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                >
                  Save Preferences
                </button>
                <button
                  onClick={acceptAll}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Accept All
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors border border-gray-600"
                >
                  Cancel
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-4 text-center">
                You can change these settings at any time by clicking the cookie preferences link in our footer.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CookieConsent;
